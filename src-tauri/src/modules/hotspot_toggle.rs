use log::info;
use std::os::windows::process::CommandExt;
use std::process::Command;

fn run_powershell(script: &str) -> Result<String, String> {
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("PowerShell çalıştırılamadı: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("PowerShell hatası: {}", stderr))
    }
}

#[tauri::command]
pub async fn get_hotspot_status() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        let script = r#"
            $cp = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
            $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($cp)
            $tm.TetheringOperationalState.ToString()
        "#;
        let result = run_powershell(script)?;
        Ok(result == "On")
    })
    .await
    .map_err(|e| format!("Task hatası: {}", e))?
}

#[tauri::command]
pub async fn toggle_hotspot() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        let status_script = r#"
            $cp = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
            $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($cp)
            $tm.TetheringOperationalState.ToString()
        "#;
        let state = run_powershell(status_script)?;
        let is_on = state == "On";

        if is_on {
            info!("Mobil etkin nokta kapatılıyor...");
            let script = r#"
                $cp = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
                $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($cp)
                $result = $tm.StopTetheringAsync().AsTask().Result
                $result.Status.ToString()
            "#;
            let result = run_powershell(script)?;
            if result == "Success" {
                info!("Mobil etkin nokta kapatıldı");
                Ok(false)
            } else {
                Err(format!("Kapatma başarısız: {}", result))
            }
        } else {
            info!("Mobil etkin nokta açılıyor...");
            let script = r#"
                $cp = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
                $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($cp)
                $result = $tm.StartTetheringAsync().AsTask().Result
                $result.Status.ToString()
            "#;
            let result = run_powershell(script)?;
            if result == "Success" {
                info!("Mobil etkin nokta açıldı");
                Ok(true)
            } else {
                Err(format!("Açma başarısız: {}", result))
            }
        }
    })
    .await
    .map_err(|e| format!("Task hatası: {}", e))?
}
