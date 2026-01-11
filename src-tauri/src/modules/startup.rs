#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::utils::platform::current_exe;
use winreg::{enums::*, RegKey};

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn enable_startup(_minimized: bool) -> Result<(), String> {
    let exe_path = current_exe().map_err(|e| e.to_string())?;
    // We expect the launcher to be in the same directory as the main executable
    // In dev: src-tauri/target/debug/hotspot-launcher.exe
    // In prod: The installer places them together
    let launcher_path = exe_path
        .parent()
        .ok_or("Invalid parent")?
        .join("hotspot-launcher.exe");

    let raw_path = launcher_path.to_str().ok_or("Invalid path")?;
    // Remove UNC prefix if present
    let launcher_str = raw_path.strip_prefix("\\\\?\\").unwrap_or(raw_path);

    // Create batch script for reliable execution via sc.exe
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
    // This part requires interaction if UAC is not elevated, but we use RunAs
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

    // Clean up legacy methods
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
pub async fn disable_startup() -> Result<(), String> {
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
pub async fn is_startup_enabled() -> bool {
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

pub fn check_and_migrate_legacy_autostart() {
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
