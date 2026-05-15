pub fn relay_url() -> String {
    std::env::var("TERSHARE_RELAY_URL")
        .unwrap_or_else(|_| "ws://127.0.0.1:4000/ws".to_string())
}
