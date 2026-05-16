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
            println!("  [CHECKPOINT 2] Writing {} bytes to PTY: {:?}", data.len(), String::from_utf8_lossy(data));
            let ok = windows::Win32::Storage::FileSystem::WriteFile(
                self.input_write,
                Some(data),
                Some(&mut written),
                None
            ).is_ok();
            if !ok {
                let err = std::io::Error::last_os_error();
                println!("  [DEBUG] PTY Write Failed: {:?}", err);
                return Err(err);
            }
            println!("  [DEBUG] PTY Write Successful: {}/{} bytes", written, data.len());
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
            let handle = windows::Win32::Foundation::HANDLE(raw_handle as *mut _);
            let mut buf = [0u8; 8192];
            println!("  [DEBUG] PTY Reader thread started for handle {:?}", handle);
            loop {
                // Peek to see if there is ANY data available
                let mut avail = 0u32;
                unsafe {
                    let _ = windows::Win32::System::Pipes::PeekNamedPipe(handle, None, 0, None, Some(&mut avail), None);
                }
                
                if avail > 0 {
                    let mut read = 0u32;
                    let ok = unsafe {
                        windows::Win32::Storage::FileSystem::ReadFile(handle, Some(&mut buf), Some(&mut read), None).is_ok()
                    };
                    if !ok || read == 0 {
                        let err = unsafe { windows::Win32::Foundation::GetLastError() };
                        println!("  [DEBUG] Terminal pipe closed or error. Read: {}, Error: {:?}", read, err);
                        break;
                    }
                    
                    let chunk = String::from_utf8_lossy(&buf[..read as usize]).into_owned();
                    println!("  [CHECKPOINT 3] Read {} bytes from PTY: {:?}", read, chunk);
                    if tx.send(WsMessage::Stdout { data: chunk }).is_err() {
                        break;
                    }
                } else {
                    // Small sleep if no data to avoid spinning
                    std::thread::sleep(std::time::Duration::from_millis(50));
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

pub fn spawn_cmd(tx: UnboundedSender<WsMessage>) -> Result<PtySession, Box<dyn std::error::Error + Send + Sync>> {
    println!("  TerShare session v0.1.6 - [LIVE]");
    
    let mut h_pipe_in_read = windows::Win32::Foundation::HANDLE::default();
    let mut h_pipe_in_write = windows::Win32::Foundation::HANDLE::default();
    let mut h_pipe_out_read = windows::Win32::Foundation::HANDLE::default();
    let mut h_pipe_out_write = windows::Win32::Foundation::HANDLE::default();

    // Anonymous pipes for PTY should NOT be inheritable to avoid process-inheritance issues
    let sa = windows::Win32::Security::SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<windows::Win32::Security::SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: std::ptr::null_mut(),
        bInheritHandle: windows::Win32::Foundation::BOOL(0), // Set to 0 (False)
    };

    unsafe {
        windows::Win32::System::Pipes::CreatePipe(&mut h_pipe_in_read, &mut h_pipe_in_write, Some(&sa), 0)?;
        windows::Win32::System::Pipes::CreatePipe(&mut h_pipe_out_read, &mut h_pipe_out_write, Some(&sa), 0)?;
    }

    let size = windows::Win32::System::Console::COORD { X: 80, Y: 25 };
    let hpc = unsafe {
        windows::Win32::System::Console::CreatePseudoConsole(size, h_pipe_in_read, h_pipe_out_write, 0)?
    };

    let pty_sess = PtySession {
        hpc,
        input_write: h_pipe_in_write,
        output_read: h_pipe_out_read,
        process: windows::Win32::System::Threading::PROCESS_INFORMATION::default(),
    };

    // START THE READER NOW, BEFORE THE PROCESS STARTS
    pty_sess.spawn_reader(tx);

    let mut attr_size = 0;
    unsafe {
        let _ = windows::Win32::System::Threading::InitializeProcThreadAttributeList(windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST::default(), 1, 0, &mut attr_size);
    }
    
    // Ensure 8-byte alignment for the attribute list
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

    println!("  [DEBUG] PTY created successfully. HPC: {:?}", hpc);

    let mut si_ex: windows::Win32::System::Threading::STARTUPINFOEXW = unsafe { std::mem::zeroed() };
    si_ex.StartupInfo.cb = std::mem::size_of::<windows::Win32::System::Threading::STARTUPINFOEXW>() as u32;
    si_ex.lpAttributeList = attr_list;

    let mut cmd_path = wide_string("C:\\Windows\\System32\\cmd.exe");
    let mut pi = windows::Win32::System::Threading::PROCESS_INFORMATION::default();

    println!("  [DEBUG] Spawning cmd.exe...");

    unsafe {
        windows::Win32::System::Threading::CreateProcessW(
            None,
            windows::core::PWSTR(cmd_path.as_mut_ptr()),
            None,
            None,
            false,
            windows::Win32::System::Threading::EXTENDED_STARTUPINFO_PRESENT,
            None, // Use parent's environment
            None, // Use parent's directory
            &si_ex.StartupInfo,
            &mut pi,
        )?;
    }

    println!("  [DEBUG] cmd.exe spawned. PID: {}", pi.dwProcessId);

    // CRITICAL: Close handles ONLY AFTER CreateProcessW has started
    unsafe {
        let _ = windows::Win32::Foundation::CloseHandle(h_pipe_in_read);
        let _ = windows::Win32::Foundation::CloseHandle(h_pipe_out_write);
    }

    let mut sess = pty_sess;
    sess.process = pi;

    // Give the reader thread a moment to start
    std::thread::sleep(std::time::Duration::from_millis(500));

    // Immediate Echo Test
    println!("  [DEBUG] Sending immediate echo test to PTY...");
    let _ = sess.write(b"echo HELLO_TERSHARE\r\n");

    Ok(sess)
}

fn wide_string(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}
