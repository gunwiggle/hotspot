use image::imageops::FilterType;
use local_ip_address::local_ip;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::process::Command;
use std::sync::Mutex;
use sysinfo::{NetworkExt, System, SystemExt};
use tauri::utils::platform::current_exe;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_store::StoreExt;
use winreg::{enums::*, RegKey};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

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
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
            auto_reconnect: false,
        }
    }
}

pub struct AppState {
    pub credentials: Mutex<Credentials>,
    pub is_connected: Mutex<bool>,
    pub settings: Mutex<Settings>,
    pub sys: Mutex<System>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            credentials: Mutex::new(Credentials::default()),
            is_connected: Mutex::new(false),
            settings: Mutex::new(Settings::default()),
            sys: Mutex::new(System::new_all()),
        }
    }
}

#[tauri::command]
async fn check_connection() -> bool {
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
async fn perform_login(username: String, password: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;

    let login_url = "https://hotspot.maxxarena.de/?auth=ticket&pageID=page-0";

    let _ = client
        .get("https://hotspot.maxxarena.de/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let params = [
        ("auth", "ticket"),
        ("lp-screen-size", "1920:1080:1920:1080"),
        ("lp-input-username", username.as_str()),
        ("lp-input-password", password.as_str()),
        ("submit-login", "Oturum aç"),
    ];

    let response = client
        .post(login_url)
        .form(&params)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Origin", "https://hotspot.maxxarena.de")
        .header("Referer", "https://hotspot.maxxarena.de/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body = response.text().await.unwrap_or_default();

    if body.contains("Oturum açma başarılı")
        || body.contains("başarılı")
        || body.contains("Oturumu kapat")
        || body.contains("logout")
    {
        Ok(true)
    } else {
        let is_online = check_connection().await;
        if is_online {
            Ok(true)
        } else {
            Err(format!("Giriş başarısız oldu"))
        }
    }
}

#[tauri::command]
async fn save_credentials(
    app: tauri::AppHandle,
    username: String,
    password: String,
) -> Result<(), String> {
    let store = app.store("credentials.json").map_err(|e| e.to_string())?;
    store.set("username", serde_json::json!(username));
    store.set("password", serde_json::json!(password));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn load_credentials(app: tauri::AppHandle) -> Result<Credentials, String> {
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
fn update_tray_icon(app: tauri::AppHandle, status: String) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let (tooltip, icon_bytes) = match status.as_str() {
            "connected" => (
                "Hotspot Manager - Bağlı",
                include_bytes!("../icons/tray-connected.png").to_vec(),
            ),
            "checking" => (
                "Hotspot Manager - Kontrol Ediliyor...",
                include_bytes!("../icons/tray-checking.png").to_vec(),
            ),
            _ => (
                "Hotspot Manager - Bağlı Değil",
                include_bytes!("../icons/tray-disconnected.png").to_vec(),
            ),
        };

        let _ = tray.set_tooltip(Some(tooltip));

        if let Ok(img) = image::load_from_memory(&icon_bytes) {
            let resized = img.resize(32, 32, FilterType::Lanczos3);
            let rgba = resized.to_rgba8();
            let width = rgba.width();
            let height = rgba.height();

            let icon = tauri::image::Image::new(&rgba, width, height);
            if let Err(e) = tray.set_icon(Some(icon)) {
                eprintln!("Tray icon update failed: {}", e);
            }
        } else {
            eprintln!("Failed to load image from memory");
        }
    }
}

#[tauri::command]
async fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set(
        "minimizeToTray",
        serde_json::json!(settings.minimize_to_tray),
    );
    store.set("autoReconnect", serde_json::json!(settings.auto_reconnect));
    store.save().map_err(|e| e.to_string())?;

    let state = app.state::<AppState>();
    if let Ok(mut cache) = state.settings.lock() {
        *cache = settings.clone();
    }
    println!(
        "Settings saved and cached: minimize={}",
        settings.minimize_to_tray
    );

    Ok(())
}

#[tauri::command]
async fn load_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    let minimize_to_tray = store
        .get("minimizeToTray")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let auto_reconnect = store
        .get("autoReconnect")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let settings = Settings {
        minimize_to_tray,
        auto_reconnect,
    };

    let state = app.state::<AppState>();
    if let Ok(mut cache) = state.settings.lock() {
        *cache = settings.clone();
    }
    println!("Settings loaded and cached: minimize={}", minimize_to_tray);

    Ok(settings)
}

#[tauri::command]
async fn perform_logout() -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    let params = [("logout", "1")];
    let _ = client
        .post("https://hotspot.maxxarena.de/")
        .form(&params)
        .header("Origin", "https://hotspot.maxxarena.de")
        .header("Referer", "https://hotspot.maxxarena.de/")
        .send()
        .await;

    Ok(())
}

#[tauri::command]
fn get_ip_info() -> String {
    if let Ok(ip) = local_ip() {
        ip.to_string()
    } else {
        "Bilinmiyor".to_string()
    }
}

#[derive(Serialize)]
struct NetworkStats {
    total_received: u64,
    total_transmitted: u64,
}

#[tauri::command]
fn get_network_stats(state: tauri::State<AppState>) -> NetworkStats {
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

mod secrets;

#[tauri::command]
fn get_github_token() -> String {
    // "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".to_string()
    secrets::GITHUB_TOKEN.to_string()
}

#[tauri::command]
async fn enable_startup(_minimized: bool) -> Result<(), String> {
    let exe_path = current_exe().map_err(|e| e.to_string())?;
    let launcher_path = exe_path
        .parent()
        .ok_or("Invalid parent")?
        .join("hotspot-launcher.exe");

    let raw_path = launcher_path.to_str().ok_or("Invalid path")?;
    let launcher_str = raw_path.strip_prefix("\\\\?\\").unwrap_or(raw_path);

    // Create batch script for reliable execution
    let temp_dir = std::env::temp_dir();
    let batch_path = temp_dir.join("hotspot_service_install.bat");

    let batch_content = format!(
        r#"@echo off
sc stop HotspotLauncher >nul 2>&1
sc delete HotspotLauncher >nul 2>&1
sc create HotspotLauncher binPath= "{}" start= auto DisplayName= "Hotspot Manager Launcher"
sc start HotspotLauncher
"#,
        launcher_str
    );

    std::fs::write(&batch_path, batch_content).map_err(|e| e.to_string())?;

    // Run batch as Admin
    let batch_path_str = batch_path.to_str().ok_or("Invalid batch path")?;
    let ps_command = format!(
        "Start-Process cmd.exe -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '/c \"{}\"'",
        batch_path_str
    );

    let _ = Command::new("powershell")
        .args(&["-Command", &ps_command])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    // Cleanup
    let _ = std::fs::remove_file(batch_path);
    let _ = disable_registry_startup();
    let _ = Command::new("powershell")
        .args(&["-Command", "Start-Process schtasks -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '/delete /tn HotspotManager /f'"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    Ok(())
}

fn disable_registry_startup() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Run";
    if let Ok(key) = hkcu.open_subkey_with_flags(path, KEY_WRITE) {
        let _ = key.delete_value("HotspotManager");
    }
    Ok(())
}

#[tauri::command]
async fn disable_startup() -> Result<(), String> {
    // 1. Stop and Delete Service
    let _ = Command::new("powershell")
        .args(&["-Command", "Start-Process sc.exe -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList 'stop HotspotLauncher'"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let _ = Command::new("powershell")
        .args(&["-Command", "Start-Process sc.exe -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList 'delete HotspotLauncher'"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    // 2. Delete Scheduled Task (legacy cleanup)
    let _ = Command::new("powershell")
        .args(&["-Command", "Start-Process schtasks -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '/delete /tn HotspotManager /f'"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    // 3. Delete Registry Key (legacy cleanup)
    let _ = disable_registry_startup();

    Ok(())
}

#[tauri::command]
async fn is_startup_enabled() -> bool {
    // Check for Windows Service first
    let service_exists = Command::new("sc")
        .args(&["query", "HotspotLauncher"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if service_exists {
        return true;
    }

    // Fallback: Check Task Scheduler
    let task_exists = Command::new("schtasks")
        .args(&["/query", "/tn", "HotspotManager"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if task_exists {
        return true;
    }

    // Fallback: Check Registry
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Run";
    if let Ok(key) = hkcu.open_subkey_with_flags(path, KEY_READ) {
        return key.get_value::<String, _>("HotspotManager").is_ok();
    }

    false
}

fn check_and_migrate_legacy_autostart() {
    // Check for standard Tauri autostart registry keys
    // Try both product name and bundle identifier just in case
    let keys_to_check = ["Hotspot Manager", "com.hotspot.app", "hotspot"];

    for key in keys_to_check {
        let check = Command::new("reg")
            .args(&[
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                key,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(output) = check {
            if output.status.success() {
                println!("Found legacy autostart key: {}. Migrating...", key);

                // 1. Create new Scheduled Task (preserve the user's "enabled" preference)
                // We run this synchronously here since we are in setup
                if let Ok(exe_path) = current_exe() {
                    if let Some(exe_str) = exe_path.to_str() {
                        let _ = Command::new("schtasks")
                            .args(&[
                                "/create",
                                "/tn",
                                "HotspotManager",
                                "/tr",
                                &format!("\"{}\"", exe_str),
                                "/sc",
                                "ONLOGON",
                                "/rl",
                                "HIGHEST",
                                "/f",
                            ])
                            .creation_flags(CREATE_NO_WINDOW)
                            .output();
                    }
                }

                // 2. Delete the old registry key
                let _ = Command::new("reg")
                    .args(&[
                        "delete",
                        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                        "/v",
                        key,
                        "/f",
                    ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // .plugin(tauri_plugin_autostart::Builder::new().build()) // Removed in favor of custom impl
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .setup(|app| {
            // Check for legacy registry keys and migrate them to Task Scheduler
            std::thread::spawn(|| {
                check_and_migrate_legacy_autostart();
            });

            // Handle start minimized logic
            let args: Vec<String> = std::env::args().collect();
            // Check if "--minimized" is present in arguments
            let start_minimized = args.iter().any(|arg| arg == "--minimized");

            if let Some(window) = app.get_webview_window("main") {
                if !start_minimized {
                    println!("Starting normal (visible)");
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                } else {
                    println!("Starting minimized to tray");
                    // Window is already hidden by default config ("visible": false)
                }
            }

            let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Pencereyi Göster", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            // Initialize store and memory cache on startup
            if let Ok(settings) =
                tauri::async_runtime::block_on(load_settings(app.handle().clone()))
            {
                println!(
                    "Initial settings loaded: minimize={}",
                    settings.minimize_to_tray
                );
            }

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Hotspot Manager - Bağlı Değil")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_minimized = window.is_minimized().unwrap_or(false);

                            if is_visible && !is_minimized {
                                let _ = window.minimize();
                            } else {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Debug log
                println!("Close requested");

                let app = window.app_handle();
                let state = app.state::<AppState>();

                let minimize = if let Ok(settings) = state.settings.lock() {
                    println!("Minimize setting in cache: {}", settings.minimize_to_tray);
                    settings.minimize_to_tray
                } else {
                    println!("Failed to lock settings, defaulting to true");
                    true
                };

                if minimize {
                    println!("Minimizing to tray (preventing close)");
                    api.prevent_close();
                    if let Err(e) = window.hide() {
                        eprintln!("Failed to hide window: {}", e);
                    }
                } else {
                    println!("Closing window normally");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            check_connection,
            perform_login,
            save_credentials,
            load_credentials,
            update_tray_icon,
            save_settings,
            load_settings,
            perform_logout,
            get_ip_info,
            get_network_stats,
            get_github_token,
            enable_startup,
            disable_startup,
            is_startup_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
