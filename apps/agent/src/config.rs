pub fn relay_url() -> String {
    std::env::var("TERSHARE_RELAY_URL")
        .unwrap_or_else(|_| "wss://tershare-backend.onrender.com/ws".to_string())
}
