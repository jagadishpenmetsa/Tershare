//! TerShare native Windows agent — connects to relay, spawns cmd.exe via ConPTY.

mod config;
mod protocol;
mod relay;
mod session;

#[cfg(windows)]
mod pty;

use tracing::info;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tershare_agent=info".into()),
        )
        .init();

    #[cfg(not(windows))]
    {
        eprintln!("TerShare agent requires Windows (ConPTY).");
        std::process::exit(1);
    }

    #[cfg(windows)]
    {
        info!("TerShare agent starting");
        if let Err(e) = session::run_host_session().await {
            tracing::error!("Session ended with error: {e}");
            std::process::exit(1);
        }
    }
}
