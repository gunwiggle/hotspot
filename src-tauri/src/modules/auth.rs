use super::network::check_connection;

#[tauri::command]
pub async fn perform_login(username: String, password: String) -> Result<bool, String> {
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
pub async fn perform_logout() -> Result<(), String> {
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
