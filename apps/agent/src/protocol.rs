use serde::{Deserialize, Serialize};

pub const CODE_CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
pub const CODE_LEN: usize = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    SessionCreate { code: Option<String> },
    SessionJoin { code: String },
    PermissionRequest,
    PermissionResponse { accepted: bool },
    Stdin { data: String },
    Stdout { data: String },
    Resize { cols: u16, rows: u16 },
    Ping,
    Pong,
    Error { message: String, code: Option<String> },
    SessionState { state: String, code: Option<String> },
}

pub fn generate_session_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    (0..CODE_LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CODE_CHARSET.len());
            CODE_CHARSET[idx] as char
        })
        .collect()
}
