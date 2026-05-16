//! Windows ConPTY wrapper - spawns cmd.exe and streams I/O via Named Pipes.

use crate::protocol::WsMessage;
use std::ffi::c_void;
use tokio::sync::mpsc::UnboundedSender;

pub struct PtySession {
    hpc: windows::Win32::System::Console::HPCON,
    input_write: windows::Win32::Foundation::HANDLE,
    output_read: windows::Win32::Foundation::HANDLE,
    process: windows::Win32::System::Threading::PROCESS_INFORMATION,
}

impl PtySession {
    pub fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        let mut written = 0u32;
        unsafe {
            let ok = windows::Win32::Storage::FileSystem::WriteFile(
                self.input_write,
                Some(data),
                Some(&mut written),
                None
            ).is_ok();
            if !ok {
                return Err(std::io::Error::last_os_error());
            }
        }
        Ok(())
    }

    pub fn process_id(&self) -> u32 {
        self.process.dwProcessId
    }

    pub fn resize(&self, cols: u16, rows: u16) {
        let size = windows::Win32::System::Console::COORD {
            X: cols as i16,
            Y: rows as i16,
        };
        unsafe {
            let _ = windows::Win32::System::Console::ResizePseudoConsole(self.hpc, size);
        }
    }

    pub fn spawn_reader(&self, tx: UnboundedSender<WsMessage>) {
        let raw_handle = self.output_read.0 as isize;
        std::thread::spawn(move || {
            let handle = windows::Win32::Foundation::HANDLE(raw_handle as *mut c_void);
            let mut buf = [0u8; 8192];
            loop {
                let mut read = 0u32;
                let ok = unsafe {
                    windows::Win32::Storage::FileSystem::ReadFile(handle, Some(&mut buf), Some(&mut read), None).is_ok()
                };
                if !ok || read == 0 {
                    break;
                }
                
                let chunk = String::from_utf8_lossy(&buf[..read as usize]).into_owned();
                println!("PTY OUTPUT: {:?}", chunk);
                if tx.send(WsMessage::Stdout { data: chunk }).is_err() {
                    break;
                }
            }
        });
    }

    pub fn kill(&mut self) {
        unsafe {
            let _ = windows::Win32::System::Console::ClosePseudoConsole(self.hpc);
            let _ = windows::Win32::System::Threading::TerminateProcess(self.process.hProcess, 1);
            let _ = windows::Win32::Foundation::CloseHandle(self.process.hProcess);
            let _ = windows::Win32::Foundation::CloseHandle(self.process.hThread);
            let _ = windows::Win32::Foundation::CloseHandle(self.input_write);
            let _ = windows::Win32::Foundation::CloseHandle(self.output_read);
        }
    }
}

pub fn spawn_cmd() -> Result<PtySession, Box<dyn std::error::Error + Send + Sync>> {
    let pid = std::process::id();
    let pipe_in_name = format!("\\\\.\\pipe\\tershare-in-{}", pid);
    let pipe_out_name = format!("\\\\.\\pipe\\tershare-out-{}", pid);

    let mut w_pipe_in = wide_string(&pipe_in_name);
    let mut w_pipe_out = wide_string(&pipe_out_name);

    let h_in = unsafe { 
        windows::Win32::System::Pipes::CreateNamedPipeW(
            windows::core::PCWSTR(w_pipe_in.as_ptr()), 
            std::mem::transmute(2u32), // PIPE_ACCESS_OUTBOUND
            std::mem::transmute(0u32), // PIPE_TYPE_BYTE
            1, 0, 0, 0, None
        ) 
    };
    let h_out = unsafe { 
        windows::Win32::System::Pipes::CreateNamedPipeW(
            windows::core::PCWSTR(w_pipe_out.as_ptr()), 
            std::mem::transmute(1u32), // PIPE_ACCESS_INBOUND
            std::mem::transmute(0u32), // PIPE_TYPE_BYTE
            1, 0, 0, 0, None
        ) 
    };

    if h_in.is_invalid() || h_out.is_invalid() { return Err("Named pipe creation failed".into()); }

    let h_pipe_in_client = unsafe {
        windows::Win32::Storage::FileSystem::CreateFileW(
            windows::core::PCWSTR(w_pipe_in.as_ptr()),
            0x80000000, // GENERIC_READ
            windows::Win32::Storage::FileSystem::FILE_SHARE_MODE(0),
            None,
            windows::Win32::Storage::FileSystem::OPEN_EXISTING,
            windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL,
            None,
        )?
    };

    let h_pipe_out_client = unsafe {
        windows::Win32::Storage::FileSystem::CreateFileW(
            windows::core::PCWSTR(w_pipe_out.as_ptr()),
            0x40000000, // GENERIC_WRITE
            windows::Win32::Storage::FileSystem::FILE_SHARE_MODE(0),
            None,
            windows::Win32::Storage::FileSystem::OPEN_EXISTING,
            windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL,
            None,
        )?
    };

    let size = windows::Win32::System::Console::COORD { X: 120, Y: 40 };
    let hpc = unsafe {
        windows::Win32::System::Console::CreatePseudoConsole(size, h_pipe_in_client, h_pipe_out_client, 0)?
    };

    unsafe {
        let _ = windows::Win32::Foundation::CloseHandle(h_pipe_in_client);
        let _ = windows::Win32::Foundation::CloseHandle(h_pipe_out_client);
    }

    let mut attr_size = 0;
    unsafe {
        let _ = windows::Win32::System::Threading::InitializeProcThreadAttributeList(windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST::default(), 1, 0, &mut attr_size);
    }
    
    let mut attr_list_buf = vec![0u64; (attr_size + 7) / 8];
    let attr_list = windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST(attr_list_buf.as_mut_ptr() as *mut _);
    
    unsafe {
        windows::Win32::System::Threading::InitializeProcThreadAttributeList(attr_list, 1, 0, &mut attr_size)?;
        windows::Win32::System::Threading::UpdateProcThreadAttribute(
            attr_list,
            0,
            0x00020016, // PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE
            Some(&hpc as *const _ as *const c_void),
            std::mem::size_of::<windows::Win32::System::Console::HPCON>(),
            None,
            None,
        )?;
    }

    let mut si_ex: windows::Win32::System::Threading::STARTUPINFOEXW = unsafe { std::mem::zeroed() };
    si_ex.StartupInfo.cb = std::mem::size_of::<windows::Win32::System::Threading::STARTUPINFOEXW>() as u32;
    si_ex.lpAttributeList = attr_list;

    let mut cmd_path = wide_string("C:\\Windows\\System32\\cmd.exe");
    let mut pi = windows::Win32::System::Threading::PROCESS_INFORMATION::default();

    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    let mut w_user_profile = wide_string(&user_profile);

    unsafe {
        windows::Win32::System::Threading::CreateProcessW(
            None,
            windows::core::PWSTR(cmd_path.as_mut_ptr()),
            None,
            None,
            false,
            windows::Win32::System::Threading::EXTENDED_STARTUPINFO_PRESENT,
            None,
            windows::core::PCWSTR(w_user_profile.as_ptr()),
            &si_ex.StartupInfo,
            &mut pi,
        )?;
    }

    Ok(PtySession {
        hpc,
        input_write: h_in,
        output_read: h_out,
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
