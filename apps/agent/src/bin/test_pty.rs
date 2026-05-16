use windows::Win32::Foundation::{CloseHandle, GetLastError, HANDLE};
use windows::Win32::System::Console::{ClosePseudoConsole, CreatePseudoConsole, COORD, HPCON};
use windows::Win32::System::Pipes::CreatePipe;
use windows::Win32::Security::SECURITY_ATTRIBUTES;
use windows::Win32::System::Threading::{
    CreateProcessW, InitializeProcThreadAttributeList, TerminateProcess, UpdateProcThreadAttribute,
    EXTENDED_STARTUPINFO_PRESENT, LPPROC_THREAD_ATTRIBUTE_LIST, PROCESS_INFORMATION, STARTUPINFOEXW,
};
use windows::core::PWSTR;
use std::ffi::c_void;

fn wide_string(s: &str) -> Vec<u16> {
    let mut v: Vec<u16> = s.encode_utf16().collect();
    v.push(0);
    v
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut h_pipe_in_read = HANDLE::default();
    let mut h_pipe_in_write = HANDLE::default();
    let mut h_pipe_out_read = HANDLE::default();
    let mut h_pipe_out_write = HANDLE::default();

    unsafe {
        CreatePipe(&mut h_pipe_in_read, &mut h_pipe_in_write, None, 0)?;
        CreatePipe(&mut h_pipe_out_read, &mut h_pipe_out_write, None, 0)?;
    }

    let size = COORD { X: 80, Y: 25 };
    let hpc = unsafe { CreatePseudoConsole(size, h_pipe_in_read, h_pipe_out_write, 0)? };

    // CLOSE HANDLES EARLY
    unsafe {
        CloseHandle(h_pipe_in_read);
        CloseHandle(h_pipe_out_write);
    }

    let mut attr_size = 0;
    unsafe {
        let _ = InitializeProcThreadAttributeList(LPPROC_THREAD_ATTRIBUTE_LIST::default(), 1, 0, &mut attr_size);
    }
    
    let mut attr_list_buf = vec![0u64; (attr_size + 7) / 8];
    let attr_list = LPPROC_THREAD_ATTRIBUTE_LIST(attr_list_buf.as_mut_ptr() as *mut _);
    
    unsafe {
        InitializeProcThreadAttributeList(attr_list, 1, 0, &mut attr_size)?;
        
        // TEST 1: Pass &hpc
        let res1 = UpdateProcThreadAttribute(
            attr_list,
            0,
            0x00020016, // PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE
            Some(&hpc as *const _ as *const c_void),
            std::mem::size_of::<HPCON>(),
            None,
            None,
        );
        println!("UpdateProcThreadAttribute direct result: {:?}", res1);
    }

    let mut si_ex: STARTUPINFOEXW = unsafe { std::mem::zeroed() };
    si_ex.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
    si_ex.lpAttributeList = attr_list;

    let mut cmd_path = wide_string("C:\\Windows\\System32\\cmd.exe /c echo CONPTY_WORKS");
    let mut pi = PROCESS_INFORMATION::default();

    let res = unsafe {
        CreateProcessW(
            None,
            PWSTR(cmd_path.as_mut_ptr()),
            None,
            None,
            false,
            EXTENDED_STARTUPINFO_PRESENT,
            None,
            None,
            &si_ex.StartupInfo,
            &mut pi,
        )
    };
    println!("CreateProcessW result: {:?}", res);

    // Read thread
    let raw_handle = h_pipe_out_read.0 as isize;
    std::thread::spawn(move || {
        let handle = HANDLE(raw_handle as *mut _);
        let mut buf = [0u8; 8192];
        loop {
            let mut read = 0u32;
            let ok = unsafe {
                windows::Win32::Storage::FileSystem::ReadFile(handle, Some(&mut buf), Some(&mut read), None).is_ok()
            };
            if !ok || read == 0 {
                let err = unsafe { GetLastError() };
                println!("Read error or EOF: {:?}", err);
                break;
            }
            println!("READ: {:?}", String::from_utf8_lossy(&buf[..read as usize]).into_owned());
        }
    });

    std::thread::sleep(std::time::Duration::from_secs(2));

    unsafe {
        let _ = TerminateProcess(pi.hProcess, 0);
        ClosePseudoConsole(hpc);
    }

    Ok(())
}
