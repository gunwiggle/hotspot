use crate::AppState;
use local_ip_address::local_ip;
use serde::Serialize;
use sysinfo::{NetworkExt, SystemExt};

#[tauri::command]
pub async fn check_connection() -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_default();

    match client
        .get("http://connectivitycheck.gstatic.com/generate_204")
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status().as_u16();
            if status == 204 {
                return true;
            }
            if status == 302 || status == 301 || status == 200 {
                let body = resp.text().await.unwrap_or_default();
                if body.contains("hotspot") || body.contains("maxxarena") || body.contains("login")
                {
                    return false;
                }
            }
            false
        }
        Err(_) => false,
    }
}

#[tauri::command]
pub fn get_ip_info() -> String {
    if let Ok(ip) = local_ip() {
        ip.to_string()
    } else {
        "Bilinmiyor".to_string()
    }
}

#[derive(Serialize)]
pub struct NetworkStats {
    total_received: u64,
    total_transmitted: u64,
}

#[tauri::command]
pub fn get_network_stats(state: tauri::State<AppState>) -> NetworkStats {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_all();

    let mut total_received = 0;
    let mut total_transmitted = 0;

    for (_interface_name, data) in sys.networks() {
        total_received += data.total_received();
        total_transmitted += data.total_transmitted();
    }

    NetworkStats {
        total_received,
        total_transmitted,
    }
}
