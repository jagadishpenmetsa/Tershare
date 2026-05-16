use std::ffi::c_void;
use std::ptr;
use tokio::sync::mpsc::UnboundedSender;
use crate::protocol::WsMessage;

#[repr(C)]
#[allow(non_snake_case)]
pub struct STARTUPINFOEXW {
    pub StartupInfo: windows::Win32::System::Threading::STARTUPINFOW,
    pub lpAttributeList: windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST,
}

pub struct Pty {
    hpc: windows::Win32::System::Console::HPCON,
    process: windows::Win32::System::Threading::PROCESS_INFORMATION,
    input_write: windows::Win32::Foundation::HANDLE,
    output_read: windows::Win32::Foundation::HANDLE,
}

impl Pty {
    pub fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
let mut written = 0u32;
unsafe {
    println!("  [CHECKPOINT 2] Writing to PTY: {:?}", String::from_utf8_lossy(data));
    let _ = windows::Win32::Storage::FileSystem::WriteFile(self.input_write, Some(data), Some(&mut written), None);
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
println!("  [CHECKPOINT 3] Read from PTY: {:?}", chunk);
if tx.send(WsMessage::Stdout { data: chunk }).is_err() {
    break;
}
    }
});
    }
}

fn wide_string(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
.encode_wide()
.chain(std::iter::once(0))
.collect()
}

pub fn spawn_cmd() -> Result<Pty, Box<dyn std::error::Error>> {
    let pid = std::process::id();
    let pipe_in_name = format!("\\\\.\\pipe\\tershare-in-{}", pid);
    let pipe_out_name = format!("\\\\.\\pipe\\tershare-out-{}", pid);
    
    let w_pipe_in = wide_string(&pipe_in_name);
    let w_pipe_out = wide_string(&pipe_out_name);

    let h_in = unsafe {
windows::Win32::System::Pipes::CreateNamedPipeW(
    windows::core::PCWSTR(w_pipe_in.as_ptr()),
    windows::Win32::System::Pipes::PIPE_ACCESS_OUTBOUND,
    windows::Win32::System::Pipes::PIPE_TYPE_BYTE | windows::Win32::System::Pipes::PIPE_WAIT,
    1, 65536, 65536, 0, None,
?
    };

    let h_out = unsafe {
windows::Win32::System::Pipes::CreateNamedPipeW(
    windows::core::PCWSTR(w_pipe_out.as_ptr()),
    windows::Win32::System::Pipes::PIPE_ACCESS_INBOUND,
    windows::Win32::System::Pipes::PIPE_TYPE_BYTE | windows::Win32::System::Pipes::PIPE_WAIT,
    1, 65536, 65536, 0, None,
?
    };

    let h_pipe_in_client = unsafe {
windows::Win32::Storage::FileSystem::CreateFileW(
    windows::core::PCWSTR(w_pipe_in.as_ptr()),
    0x80000000, // GENERIC_READ
    windows::Win32::Storage::FileSystem::FILE_SHARE_MODE(0),
    None,
    windows::Win32::Storage::FileSystem::OPEN_EXISTING,
    windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL,
    None,
?
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
?
    };

    unsafe {
let _ = windows::Win32::System::Pipes::ConnectNamedPipe(h_in, None);
let _ = windows::Win32::System::Pipes::ConnectNamedPipe(h_out, None);
    }

    let size = windows::Win32::System::Console::COORD { X: 120, Y: 40 };
    let hpc = unsafe {
windows::Win32::System::Console::CreatePseudoConsole(size, h_pipe_in_client, h_pipe_out_client, 0)?
    };

    unsafe {
let _ = windows::Win32::Foundation::CloseHandle(h_pipe_in_client);
let _ = windows::Win32::Foundation::CloseHandle(h_pipe_out_client);
    }

    let mut si_ex = STARTUPINFOEXW {
StartupInfo: windows::Win32::System::Threading::STARTUPINFOW {
    cb: std::mem::size_of::<STARTUPINFOEXW>() as u32,
    ..Default::default()
},
lpAttributeList: windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST(ptr::null_mut()),
    };

    let mut attr_size = 0usize;
    unsafe {
let _ = windows::Win32::System::Threading::InitializeProcThreadAttributeList(
    windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST(ptr::null_mut()),
    1, 0, &mut attr_size
;
    }

    let mut attr_buf = vec![0u8; attr_size];
    si_ex.lpAttributeList = windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST(attr_buf.as_mut_ptr() as *mut _);

    unsafe {
windows::Win32::System::Threading::InitializeProcThreadAttributeList(si_ex.lpAttributeList, 1, 0, &mut attr_size)?;
windows::Win32::System::Threading::UpdateProcThreadAttribute(
    si_ex.lpAttributeList,
    0,
    0x00020016, // PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE
    Some(hpc.0 as *const _),
    std::mem::size_of::<windows::Win32::System::Console::HPCON>(),
    None, None
?;
    }

    let mut cmd = wide_string("cmd.exe");
    let mut pi = windows::Win32::System::Threading::PROCESS_INFORMATION::default();

    unsafe {
windows::Win32::System::Threading::CreateProcessW(
    None,
    windows::core::PWSTR(cmd.as_mut_ptr()),
    None, None, false,
    windows::Win32::System::Threading::EXTENDED_STARTUPINFO_PRESENT,
    None, None,
    &si_ex.StartupInfo,
    &mut pi
?;
    }

    Ok(Pty {
hpc,
process: pi,
input_write: h_in,
output_read: h_out,
    })
}
