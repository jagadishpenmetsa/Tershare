//! Windows ConPTY wrapper — spawns cmd.exe and streams I/O via Named Pipes.

use crate::protocol::WsMessage;
use std::ffi::c_void;
use std::io::Write;
use tokio::sync::mpsc::UnboundedSender;
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE, GetLastError, PWSTR};
use windows::Win32::Storage::FileSystem::{
    ReadFile, WriteFile, CreateFileW, OPEN_EXISTING, GENERIC_READ, GENERIC_WRITE, FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_ATTRIBUTE_NORMAL,
};
use windows::Win32::System::Console::{
    ClosePseudoConsole, CreatePseudoConsole, ResizePseudoConsole, COORD, HPCON,
};
use windows::Win32::System::Pipes::CreateNamedPipeW;
use windows::Win32::System::Pipes::{PIPE_ACCESS_INBOUND, PIPE_ACCESS_OUTBOUND, PIPE_TYPE_BYTE, PIPE_READMODE_BYTE, PIPE_WAIT};
use windows::Win32::System::Threading::{
    CreateProcessW, InitializeProcThreadAttributeList, UpdateProcThreadAttribute,
    CREATE_UNICODE_ENVIRONMENT, EXTENDED_STARTUPINFO_PRESENT, PROCESS_INFORMATION,
    STARTUPINFOEXW, GetExitCodeProcess,
};
use windows::Win32::System::Threading::{
    LPPROC_THREAD_ATTRIBUTE_LIST, PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
};

pub struct PtySession {
    hpc: HPCON,
    input_write: HANDLE,
    output_read: HANDLE,
    process: PROCESS_INFORMATION,
}

impl PtySession {
    pub fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        let mut written = 0u32;
        unsafe {
            let _ = WriteFile(self.input_write, Some(data), Some(&mut written), None);
        }
        Ok(())
    }

    pub fn process_id(&self) -> u32 {
        self.process.dwProcessId
    }

    pub fn is_alive(&self) -> bool {
        let mut exit_code = 0u32;
        unsafe {
            let _ = GetExitCodeProcess(self.process.hProcess, &mut exit_code);
            exit_code == 259 // STILL_ACTIVE
        }
    }

    pub fn resize(&self, cols: u16, rows: u16) {
        let size = COORD {
            X: cols as i16,
            Y: rows as i16,
        };
        unsafe {
            let _ = ResizePseudoConsole(self.hpc, size);
        }
    }

    pub fn spawn_reader(&self, tx: UnboundedSender<WsMessage>) {
        let raw_handle = self.output_read.0 as isize;
        std::thread::spawn(move || {
            let handle = HANDLE(raw_handle as *mut c_void);
            let mut buf = [0u8; 8192];
            loop {
                let mut read = 0u32;
                let ok = unsafe {
                    ReadFile(handle, Some(&mut buf), Some(&mut read), None).is_ok()
                };
                if !ok || read == 0 {
                    let err = unsafe { GetLastError() };
                    println!("  [DEBUG] Terminal pipe closed. Error: {:?}", err);
                    break;
                }
                
                let chunk = String::from_utf8_lossy(&buf[..read as usize]).into_owned();
                if tx.send(WsMessage::Stdout { data: chunk }).is_err() {
                    break;
                }
            }
        });
    }

    pub fn kill(&mut self) {
        unsafe {
            let _ = CloseHandle(self.process.hProcess);
            let _ = CloseHandle(self.process.hThread);
            let _ = CloseHandle(self.input_write);
            let _ = CloseHandle(self.output_read);
            ClosePseudoConsole(self.hpc);
        }
    }
}

pub fn spawn_cmd() -> Result<PtySession, Box<dyn std::error::Error + Send + Sync>> {
    let pipe_in_name = format!("\\\\.\\pipe\\tershare-in-{}", std::process::id());
    let pipe_out_name = format!("\\\\.\\pipe\\tershare-out-{}", std::process::id());

    let mut w_pipe_in = wide_string(&pipe_in_name);
    let mut w_pipe_out = wide_string(&pipe_out_name);

    let h_pipe_in_server = unsafe {
        CreateNamedPipeW(
            PWSTR(w_pipe_in.as_mut_ptr()),
            PIPE_ACCESS_OUTBOUND,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
            1, 0, 0, 0, None
        )
    };
    if h_pipe_in_server.is_invalid() { return Err("Failed to create in-pipe server".into()); }

    let h_pipe_out_server = unsafe {
        CreateNamedPipeW(
            PWSTR(w_pipe_out.as_mut_ptr()),
            PIPE_ACCESS_INBOUND,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
            1, 0, 0, 0, None
        )
    };
    if h_pipe_out_server.is_invalid() { return Err("Failed to create out-pipe server".into()); }

    let h_pipe_in_client = unsafe {
        CreateFileW(
            PWSTR(w_pipe_in.as_mut_ptr()),
            GENERIC_READ.0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            None,
        )?
    };

    let h_pipe_out_client = unsafe {
        CreateFileW(
            PWSTR(w_pipe_out.as_mut_ptr()),
            GENERIC_WRITE.0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            None,
        )?
    };

    let size = COORD { X: 120, Y: 40 };
    let hpc = unsafe {
        CreatePseudoConsole(size, h_pipe_in_client, h_pipe_out_client, 0)?
    };

    // Close client handles as they are now owned by ConPTY
    unsafe {
        let _ = CloseHandle(h_pipe_in_client);
        let _ = CloseHandle(h_pipe_out_client);
    }

    let mut attr_size = 0;
    unsafe {
        let _ = InitializeProcThreadAttributeList(LPPROC_THREAD_ATTRIBUTE_LIST::default(), 1, 0, &mut attr_size);
    }
    let mut attr_list_buf = vec![0u8; attr_size];
    let attr_list = LPPROC_THREAD_ATTRIBUTE_LIST(attr_list_buf.as_mut_ptr() as *mut _);
    
    unsafe {
        InitializeProcThreadAttributeList(attr_list, 1, 0, &mut attr_size)?;
        UpdateProcThreadAttribute(
            attr_list,
            0,
            PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE as usize,
            Some(&hpc as *const _ as *const c_void),
            std::mem::size_of::<HPCON>(),
            None,
            None,
        )?;
    }

    let mut si_ex: STARTUPINFOEXW = unsafe { std::mem::zeroed() };
    si_ex.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
    si_ex.lpAttributeList = attr_list;

    let mut cmd_path = wide_string("C:\\Windows\\System32\\cmd.exe");
    let mut pi = PROCESS_INFORMATION::default();

    unsafe {
        CreateProcessW(
            None,
            windows::core::PWSTR(cmd_path.as_mut_ptr()),
            None,
            None,
            false,
            EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT,
            None,
            None,
            &si_ex.StartupInfo,
            &mut pi,
        )?;
    }

    Ok(PtySession {
        hpc,
        input_write: h_pipe_in_server,
        output_read: h_pipe_out_server,
        process: pi,
    })
}

fn wide_string(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}
