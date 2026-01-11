use serde::{Deserialize, Serialize};

use tauri::Manager;
use tauri_plugin_store::StoreExt;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

impl Default for Credentials {
    fn default() -> Self {
        Self {
            username: String::new(),
            password: String::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub minimize_to_tray: bool,
    pub auto_reconnect: bool,
    pub start_in_tray: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
            auto_reconnect: false,
            start_in_tray: true,
        }
    }
}

#[tauri::command]
pub async fn save_credentials(
    app: tauri::AppHandle,
    username: String,
    password: String,
) -> Result<(), String> {
    let store = app.store("credentials.json").map_err(|e| e.to_string())?;
    store.set("username", serde_json::json!(username));
    store.set("password", serde_json::json!(password));
    store.save().map_err(|e| e.to_string())?;

    // Also update in-memory state if needed, but credentials usually fetched on demand or login
    // For consistency with settings, we could update state, but AppState is defined in lib.rs or main.rs
    // We'll access AppState via app handle if strictly necessary, but store is source of truth.
    Ok(())
}

#[tauri::command]
pub async fn load_credentials(app: tauri::AppHandle) -> Result<Credentials, String> {
    let store = app.store("credentials.json").map_err(|e| e.to_string())?;

    let username = store
        .get("username")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    let password = store
        .get("password")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_default();

    if username.is_empty() && password.is_empty() {
        Err("Kayıtlı kimlik bilgisi yok".to_string())
    } else {
        Ok(Credentials { username, password })
    }
}

#[tauri::command]
pub async fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set(
        "minimizeToTray",
        serde_json::json!(settings.minimize_to_tray),
    );
    store.set("autoReconnect", serde_json::json!(settings.auto_reconnect));
    store.set("startInTray", serde_json::json!(settings.start_in_tray));
    store.save().map_err(|e| e.to_string())?;

    let state = app.state::<AppState>();
    if let Ok(mut cache) = state.settings.lock() {
        *cache = settings.clone();
    }
    println!(
        "Settings saved and cached: minimize={}, startInTray={}",
        settings.minimize_to_tray, settings.start_in_tray
    );

    Ok(())
}

#[tauri::command]
pub async fn load_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let minimize_to_tray = store
        .get("minimizeToTray")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let auto_reconnect = store
        .get("autoReconnect")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let start_in_tray = store
        .get("startInTray")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let settings = Settings {
        minimize_to_tray,
        auto_reconnect,
        start_in_tray,
    };

    let state = app.state::<AppState>();
    if let Ok(mut cache) = state.settings.lock() {
        *cache = settings.clone();
    }
    println!(
        "Settings loaded and cached: minimize={}, startInTray={}",
        minimize_to_tray, start_in_tray
    );

    Ok(settings)
}
