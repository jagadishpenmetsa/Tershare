//! Windows ConPTY wrapper — spawns cmd.exe and streams I/O.

use crate::protocol::WsMessage;
use std::ffi::c_void;
use std::io::Write;
use std::os::windows::io::{AsRawHandle, FromRawHandle, RawHandle, IntoRawHandle};
use std::ptr::null_mut;
use tokio::sync::mpsc::UnboundedSender;
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE, GetLastError};
use windows::Win32::Storage::FileSystem::{
    ReadFile,
};
use windows::Win32::System::Console::{
    ClosePseudoConsole, CreatePseudoConsole, ResizePseudoConsole, COORD, HPCON,
};
use windows::Win32::System::Pipes::CreatePipe;
use windows::Win32::System::Threading::{
    CreateProcessW, InitializeProcThreadAttributeList, UpdateProcThreadAttribute,
    CREATE_UNICODE_ENVIRONMENT, EXTENDED_STARTUPINFO_PRESENT, PROCESS_INFORMATION,
    STARTUPINFOEXW, STARTUPINFOW, GetExitCodeProcess,
};
use windows::Win32::System::Threading::{
    LPPROC_THREAD_ATTRIBUTE_LIST, PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
};
use windows::Win32::Security::SECURITY_ATTRIBUTES;

pub struct PtySession {
    hpc: HPCON,
    input_write: std::fs::File,
    output_read: std::fs::File,
    process: PROCESS_INFORMATION,
}

impl PtySession {
    pub fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        self.input_write.write_all(data)?;
        self.input_write.flush()
    }

    pub fn process_id(&self) -> u32 {
        self.process.dwProcessId
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
        let output_clone = self.output_read.try_clone().expect("clone pipe");
        
        std::thread::spawn(move || {
            let handle = HANDLE(output_clone.as_raw_handle() as *mut c_void);
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
            ClosePseudoConsole(self.hpc);
        }
    }
}

pub fn spawn_cmd() -> Result<PtySession, Box<dyn std::error::Error + Send + Sync>> {
    // 1. Create pipes. Inheritance MUST be FALSE for ConPTY handles.
    let (input_read, input_write) = create_pipe(false)?;
    let (output_write, output_read) = create_pipe(false)?;

    let h_input_read = HANDLE(input_read.into_raw_handle() as *mut c_void);
    let h_output_write = HANDLE(output_write.into_raw_handle() as *mut c_void);

    // 2. Create PseudoConsole
    let size = COORD { X: 120, Y: 40 };
    let hpc = unsafe {
        CreatePseudoConsole(
            size,
            h_input_read,
            h_output_write,
            0,
        )?
    };

    // 3. Prepare Startup Info
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

    // 4. Create Process. Inheritance MUST be FALSE.
    unsafe {
        CreateProcessW(
            None,
            windows::core::PWSTR(cmd_path.as_mut_ptr()),
            None,
            None,
            false, // NO INHERITANCE
            EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT,
            None,
            None,
            &si_ex.StartupInfo,
            &mut pi,
        )?;
    }

    Ok(PtySession {
        hpc,
        input_write,
        output_read,
        process: pi,
    })
}

fn create_pipe(inheritable: bool) -> Result<(std::fs::File, std::fs::File), Box<dyn std::error::Error + Send + Sync>> {
    let mut h_read = INVALID_HANDLE_VALUE;
    let mut h_write = INVALID_HANDLE_VALUE;
    
    let mut sa = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: null_mut(),
        bInheritHandle: if inheritable { true.into() } else { false.into() },
    };

    unsafe { CreatePipe(&mut h_read, &mut h_write, Some(&mut sa), 0)? };
    Ok((
        unsafe { std::fs::File::from_raw_handle(h_read.0 as RawHandle) },
        unsafe { std::fs::File::from_raw_handle(h_write.0 as RawHandle) },
    ))
}

fn wide_string(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}
