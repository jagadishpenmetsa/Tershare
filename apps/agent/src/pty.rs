//! Windows ConPTY wrapper — spawns cmd.exe and streams I/O.

use crate::protocol::WsMessage;
use std::ffi::c_void;
use std::io::{Read, Write};
use std::os::windows::io::{AsRawHandle, FromRawHandle, RawHandle};
use std::ptr::null_mut;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;
use windows::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
use windows::Win32::Storage::FileSystem::{
    ReadFile, WriteFile,
};
use windows::Win32::System::Console::{
    ClosePseudoConsole, CreatePseudoConsole, ResizePseudoConsole, COORD, HPCON,
};
use windows::Win32::System::Pipes::CreatePipe;
use windows::Win32::System::Threading::{
    CreateProcessW, InitializeProcThreadAttributeList, UpdateProcThreadAttribute,
    CREATE_UNICODE_ENVIRONMENT, EXTENDED_STARTUPINFO_PRESENT, PROCESS_INFORMATION,
    STARTUPINFOEXW, STARTUPINFOW,
};
use windows::Win32::System::Threading::{
    LPPROC_THREAD_ATTRIBUTE_LIST, PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
};

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
        let mut output = self.output_read.try_clone().expect("clone pipe");
        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match output.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buf[..n]).into_owned();
                        if tx.send(WsMessage::Stdout { data: chunk }).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
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
    let (input_read, input_write) = create_pipe()?;
    let (output_write, output_read) = create_pipe()?;

    let size = COORD { X: 120, Y: 40 };
    let hpc = unsafe {
        CreatePseudoConsole(
            size,
            HANDLE(input_read.as_raw_handle() as *mut c_void),
            HANDLE(output_write.as_raw_handle() as *mut c_void),
            0,
        )?
    };

    let mut attr_size = 0;
    unsafe {
        let _ = InitializeProcThreadAttributeList(LPPROC_THREAD_ATTRIBUTE_LIST::default(), 1, 0, &mut attr_size);
    }
    
    // Ensure the buffer for attribute list lives long enough
    let mut attr_list = vec![0u8; attr_size];
    let attr_list_ptr = LPPROC_THREAD_ATTRIBUTE_LIST(attr_list.as_mut_ptr() as *mut _);
    
    unsafe {
        InitializeProcThreadAttributeList(attr_list_ptr, 1, 0, &mut attr_size)?;
        UpdateProcThreadAttribute(
            attr_list_ptr,
            0,
            PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE as usize,
            Some(&hpc as *const _ as *const c_void),
            std::mem::size_of::<HPCON>(),
            None,
            None,
        )?;
    }

    let mut cmd_path = wide_string("C:\\Windows\\System32\\cmd.exe");
    let mut si: STARTUPINFOEXW = unsafe { std::mem::zeroed() };
    si.StartupInfo = STARTUPINFOW {
        cb: std::mem::size_of::<STARTUPINFOEXW>() as u32,
        ..unsafe { std::mem::zeroed() }
    };
    si.lpAttributeList = attr_list_ptr;

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
            &si.StartupInfo,
            &mut pi,
        )?;
    }

    // Now we can safely close the handles on our side
    drop(input_read);
    drop(output_write);

    Ok(PtySession {
        hpc,
        input_write,
        output_read,
        process: pi,
    })
}

fn create_pipe() -> Result<(std::fs::File, std::fs::File), Box<dyn std::error::Error + Send + Sync>> {
    let mut read = INVALID_HANDLE_VALUE;
    let mut write = INVALID_HANDLE_VALUE;
    unsafe { CreatePipe(&mut read, &mut write, None, 0)? };
    Ok((
        unsafe { std::fs::File::from_raw_handle(read.0 as RawHandle) },
        unsafe { std::fs::File::from_raw_handle(write.0 as RawHandle) },
    ))
}

fn wide_string(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}
