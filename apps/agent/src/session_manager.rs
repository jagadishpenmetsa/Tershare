#[cfg(windows)]
mod imp {
    use crate::config::relay_url;
    use crate::protocol::{generate_session_code, WsMessage};
    use crate::pty;
    use crate::relay::{connect, parse_message, spawn_writer};
    use futures_util::StreamExt;
    use std::io::{self, Write};
    use tokio::sync::mpsc;
    use tokio_tungstenite::tungstenite::Message;
    use tracing::info;

    pub async fn run_host_session() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let code = generate_session_code();
        let url = relay_url();
        info!(%code, %url, "Connecting to relay");

        let (sink, mut read) = connect(&url).await?;
        let (tx, rx) = mpsc::unbounded_channel::<WsMessage>();
        let _writer = spawn_writer(sink, rx);

        tx.send(WsMessage::SessionCreate {
            code: code.clone(),
        })?;

        let mut pty_handle: Option<pty::PtySession> = None;
        let mut connected = false;
        let mut session_ready = false;

        while let Some(Ok(msg)) = read.next().await {
            let Message::Text(text) = msg else {
                if matches!(msg, Message::Close(_)) {
                    break;
                }
                continue;
            };

            let Some(parsed) = parse_message(&text) else { continue }; println!("  [DEBUG] Received raw message: {:?}" , parsed);
            match parsed {
                WsMessage::Error { code: Some(ref err_code), .. } if err_code == "CODE_COLLISION" => { println!("  [DEBUG] Code collision! Retrying with new code..."); let new_code = generate_session_code(); tx.send(WsMessage::SessionCreate { code: new_code })?; } WsMessage::SessionState { state, .. } if state == "WAITING" && !session_ready => {
                    session_ready = true;
        println!();
        println!("  TerShare session v0.1.5 - [LIVE]");
        println!("  Code: {code}");
        println!("  Waiting for connection (expires in 2 min if unused)...");
                    println!();
                }
                WsMessage::PermissionRequest => {
                    let accepted = prompt_permission(&code)?;
                    tx.send(WsMessage::PermissionResponse { accepted })?;
                    if !accepted {
                        println!("  Request rejected.");
                        continue;
                    }
                    if pty_handle.is_none() {
                        println!("  [DEBUG] Spawning terminal v0.1.5...");
                        let mut sess = pty::spawn_cmd()?;
                        println!("  [DEBUG] Terminal process started (PID: {})", sess.process_id());
                        
                        // Give cmd.exe a moment to initialize
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        
                        sess.spawn_reader(tx.clone());
                        // Send welcome message and newline to trigger visibility
                        let _ = tx.send(WsMessage::Stdout { 
                            data: "\r\n\x1b[1;32m[TerShare] Native terminal bridge established (v0.1.5).\x1b[0m\r\n".to_string() 
                        });
                        let _ = sess.write(b"\r\n");
                        pty_handle = Some(sess);
                    }
                    connected = true;
                    println!("  Remote user connected."); println!("  [DEBUG] Terminal bridge active. Typing in web should show logs here.");
                    println!("  [DEBUG] Terminal bridge active.");
                }
                WsMessage::Stdin { data } if connected => {
                    if let Some(ref mut pty_sess) = pty_handle {
                        println!("  [DEBUG] Received Stdin: {:?}" , data); let _ = pty_sess.write(data.as_bytes());
                    }
                }
                WsMessage::Resize { cols, rows } if connected => {
                    if let Some(ref pty_sess) = pty_handle {
                        pty_sess.resize(cols, rows);
                    }
                }
                WsMessage::Error { code: Some(ref err_code), .. } if err_code == "CODE_COLLISION" => { println!("  [DEBUG] Code collision! Retrying with new code..."); let new_code = generate_session_code(); tx.send(WsMessage::SessionCreate { code: new_code })?; } WsMessage::SessionState { state, .. }
                    if state == "DISCONNECTED" || state == "disconnected" || state == "EXPIRED" =>
                {
                    info!(%state, "Session ended");
                    break;
                }
                WsMessage::Error { code: Some(ref err_code), .. } if err_code == "CODE_COLLISION" => { println!("  [DEBUG] Code collision! Retrying with new code..."); let new_code = generate_session_code(); tx.send(WsMessage::SessionCreate { code: new_code })?; } WsMessage::SessionState { state, .. } => {
                    info!(%state, "Session state");
                }
                _ => {}
            }
        }

        if let Some(mut pty_sess) = pty_handle {
            pty_sess.kill();
        }
        Ok(())
    }

    fn prompt_permission(code: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        println!();
        println!("  Remote user wants terminal access");
        println!("  Code: {code}");
        print!("  Accept? [y/N]: ");
        io::stdout().flush()?;
        let mut line = String::new();
        io::stdin().read_line(&mut line)?;
        Ok(line.trim().eq_ignore_ascii_case("y"))
    }
}

#[cfg(windows)]
pub use imp::run_host_session;

#[cfg(not(windows))]
pub async fn run_host_session() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    Err("Windows only".into())
}
