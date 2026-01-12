mod modules;

use log::{error, info, LevelFilter};
use modules::{auth, config, network, startup, tray};
use simplelog::*;
use std::fs::File;
use std::sync::Mutex;
use sysinfo::{System, SystemExt};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

pub struct AppState {
    pub credentials: Mutex<config::Credentials>,
    pub is_connected: Mutex<bool>,
    pub settings: Mutex<config::Settings>,
    pub sys: Mutex<System>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            credentials: Mutex::new(config::Credentials::default()),
            is_connected: Mutex::new(false),
            settings: Mutex::new(config::Settings::default()),
            sys: Mutex::new(System::new_all()),
        }
    }
}

mod secrets;

#[tauri::command]
fn get_github_token() -> String {
    secrets::GITHUB_TOKEN.to_string()
}

fn init_logging() {
    // Use default config to avoid 'time' crate dependency issues for now
    let log_config = ConfigBuilder::new().set_time_format_rfc3339().build();

    let log_path = std::env::temp_dir().join("hotspot_manager.log");

    if let Ok(file) = File::create(&log_path) {
        let _ = WriteLogger::init(LevelFilter::Info, log_config, file);
        info!("Logging initialized at {:?}", log_path);
    } else {
        // Fallback or silently fail, but do NOT panic
        eprintln!("Failed to create log file at {:?}", log_path);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    info!("Application starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .setup(|app| {
            info!("Setup started");

            // Migrate legacy autostart if needed (fire and forget)
            std::thread::spawn(|| {
                startup::check_and_migrate_legacy_autostart();
            });

            let args: Vec<String> = std::env::args().collect();
            let has_minimized_flag = args.iter().any(|arg| arg == "--minimized");
            info!("Args: {:?}, Minimized Flag: {}", args, has_minimized_flag);

            // Load settings
            let handle = app.handle().clone();
            let should_minimize = tauri::async_runtime::block_on(async move {
                match config::load_settings(handle.clone()).await {
                    Ok(settings) => {
                        info!(
                            "Settings loaded: minimize={}, startInTray={}",
                            settings.minimize_to_tray, settings.start_in_tray
                        );
                        has_minimized_flag && settings.start_in_tray
                    }
                    Err(e) => {
                        error!("Failed to load settings: {}", e);
                        has_minimized_flag
                    }
                }
            });

            if let Some(window) = app.get_webview_window("main") {
                if !should_minimize {
                    info!("Starting visible");
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                } else {
                    info!("Starting minimized to tray");
                }
            }

            // Tray Setup
            let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Pencereyi Göster", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Hotspot Manager - Başlatılıyor...")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
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

            // Initial Connection Check & Tray Update
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                // Initial check after 1.5s
                std::thread::sleep(std::time::Duration::from_millis(1500));
                info!("Doing initial connection check...");

                tauri::async_runtime::block_on(async {
                    let is_connected = network::check_connection().await;
                    let status = if is_connected {
                        "connected"
                    } else {
                        "disconnected"
                    };
                    info!("Initial connection status: {}", status);
                    tray::update_tray_icon(handle.clone(), status.to_string());
                    let _ = handle.emit("network-status-update", is_connected);
                });
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<AppState>();
                let minimize = if let Ok(settings) = state.settings.lock() {
                    settings.minimize_to_tray
                } else {
                    true
                };

                if minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            network::check_connection,
            network::get_ip_info,
            network::get_network_stats,
            auth::perform_login,
            auth::perform_logout,
            config::save_credentials,
            config::load_credentials,
            config::save_settings,
            config::load_settings,
            startup::enable_startup,
            startup::disable_startup,
            startup::is_startup_enabled,
            get_github_token,
            tray::update_tray_icon
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
