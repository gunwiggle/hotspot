use image::imageops::FilterType;
use tauri::image::Image;
use tauri::{AppHandle, Manager};

pub fn update_tray_icon(app: &AppHandle, status: &str) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let (tooltip, icon_bytes) = match status {
            "connected" => (
                "Hotspot Manager - Bağlı",
                include_bytes!("../../icons/tray-connected.png").to_vec(),
            ),
            "checking" => (
                "Hotspot Manager - Kontrol Ediliyor...",
                include_bytes!("../../icons/tray-checking.png").to_vec(),
            ),
            _ => (
                "Hotspot Manager - Bağlı Değil",
                include_bytes!("../../icons/tray-disconnected.png").to_vec(),
            ),
        };

        let _ = tray.set_tooltip(Some(tooltip));

        match image::load_from_memory(&icon_bytes) {
            Ok(img) => {
                let resized = img.resize(32, 32, FilterType::Lanczos3);
                let rgba = resized.to_rgba8();
                let width = rgba.width();
                let height = rgba.height();

                let icon = Image::new(&rgba, width, height);
                if let Err(e) = tray.set_icon(Some(icon)) {
                    eprintln!("Tray icon update failed: {}", e);
                } else {
                    println!("Tray icon updated to: {}", status);
                }
            }
            Err(e) => {
                eprintln!("Failed to load image from memory: {}", e);
            }
        }
    } else {
        eprintln!("Tray 'main-tray' not found");
    }
}
