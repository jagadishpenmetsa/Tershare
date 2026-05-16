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
        let mut session_code = "".to_string();
        let url = relay_url();
        info!(%url, "Connecting to relay");

        let (sink, mut read) = connect(&url).await?;
        let (tx, mut rx) = mpsc::unbounded_channel::<WsMessage>();
        
        // Spawn writer thread with logging
        let sink_clone = sink;
        tokio::spawn(async move {
            use futures_util::SinkExt;
            let mut sink = sink_clone;
            while let Some(ws_msg) = rx.recv().await {
                println!("  [CHECKPOINT 4] Outgoing WsMessage: {:?}", ws_msg);
                let text = serde_json::to_string(&ws_msg).unwrap_or_default();
                if sink.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        });

        tx.send(WsMessage::SessionCreate {
            code: "".to_string(),
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

            let Some(parsed) = parse_message(&text) else { continue };
            println!("  [CHECKPOINT 1] Incoming WsMessage: {:?}", parsed);
            
            match parsed {
                WsMessage::SessionState { state, code, .. } if state == "WAITING" && !session_ready => {
                    session_ready = true;
                    if let Some(c) = code { session_code = c; }
                    println!();
                    println!("  TerShare session v0.1.5 - [LIVE]");
                    println!("  Code: {session_code}");
                    println!("  Waiting for connection (expires in 2 min if unused)...");
                    println!();
                }
                WsMessage::Error { code: Some(ref err_code), .. } if err_code == "CODE_COLLISION" => {
                    println!("  [DEBUG] Code collision! Retrying...");
                    tx.send(WsMessage::SessionCreate { code: "".to_string() })?;
                }
                WsMessage::PermissionRequest => {
                    let accepted = prompt_permission(&session_code)?;
                    tx.send(WsMessage::PermissionResponse { accepted })?;
                    if !accepted {
                        println!("  Request rejected.");
                        continue;
                    }
                    if pty_handle.is_none() {
                        let mut sess = pty::spawn_cmd()?;
                        sess.spawn_reader(tx.clone());
                        let _ = tx.send(WsMessage::Stdout { 
                            data: "\r\n\x1b[1;32m[TerShare] Native terminal bridge established.\x1b[0m\r\n".to_string() 
                        });
                        pty_handle = Some(sess);
                    }
                    connected = true;
                    println!("  Remote user connected.");
                }
                WsMessage::Stdin { data } if connected => {
                    println!("WS INPUT: {:?}", data);
                    if let Some(ref mut pty_sess) = pty_handle {
                        let _ = pty_sess.write(data.as_bytes());
                    }
                }
                WsMessage::Resize { cols, rows } if connected => {
                    if let Some(ref pty_sess) = pty_handle {
                        pty_sess.resize(cols, rows);
                    }
                }
                WsMessage::SessionState { state, .. }
                    if state == "DISCONNECTED" || state == "disconnected" || state == "EXPIRED" =>
                {
                    info!(%state, "Session ended");
                    break;
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
