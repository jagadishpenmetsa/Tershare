use crate::protocol::WsMessage;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

pub async fn connect(
    url: &str,
) -> Result<
    (
        futures_util::stream::SplitSink<WsStream, Message>,
        impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
    ),
    Box<dyn std::error::Error + Send + Sync>,
> {
    let (ws, _) = connect_async(url).await?;
    Ok(ws.split())
}

pub fn parse_message(text: &str) -> Option<WsMessage> {
    serde_json::from_str(text).ok()
}

pub fn spawn_writer(
    mut sink: futures_util::stream::SplitSink<WsStream, Message>,
    mut rx: mpsc::UnboundedReceiver<WsMessage>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let Ok(text) = serde_json::to_string(&msg) else { break };
            if sink.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    })
}
