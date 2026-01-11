#![windows_subsystem = "windows"]

use std::env;
use std::ffi::OsString;
use std::fs::File;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

use log::{error, info, warn};
use simplelog::{Config, LevelFilter, WriteLogger};
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
};

use windows::{
    core::PWSTR, Win32::Foundation::*, Win32::System::Environment::*,
    Win32::System::RemoteDesktop::*, Win32::System::Threading::*,
};

const SERVICE_NAME: &str = "HotspotLauncher";
const SERVICE_TYPE: ServiceType = ServiceType::OWN_PROCESS;

define_windows_service!(ffi_service_main, service_main);

fn main() -> Result<(), windows_service::Error> {
    init_logging();
    info!("Launcher starting...");
    let result = service_dispatcher::start(SERVICE_NAME, ffi_service_main);
    if let Err(e) = &result {
        error!("Failed to start service dispatcher: {:?}", e);
    }
    result
}

fn init_logging() {
    let mut path = std::env::temp_dir();
    path.push("hotspot_launcher.log");

    if let Ok(file) = File::create(&path) {
        let _ = WriteLogger::init(LevelFilter::Info, Config::default(), file);
        info!("Logging initialized at {:?}", path);
    }
}

fn service_main(_arguments: Vec<OsString>) {
    info!("Service main entry point");
    if let Err(e) = run_service() {
        error!("Service error: {:?}", e);
    }
}

fn run_service() -> Result<(), windows_service::Error> {
    info!("Running service logic");
    let (shutdown_tx, shutdown_rx) = mpsc::channel();

    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                info!("Received Stop event");
                let _ = shutdown_tx.send(());
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::SessionChange(param) => {
                info!(
                    "Received SessionChange event: reason={:?} session={}",
                    param.reason, param.notification.session_id
                );
                if param.reason == windows_service::service::SessionChangeReason::SessionLogon {
                    let session_id = param.notification.session_id;
                    info!("SessionLogon detected for session {}", session_id);
                    spawn_app_for_session(session_id);
                }
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    let status_handle = service_control_handler::register(SERVICE_NAME, event_handler)?;

    status_handle.set_service_status(ServiceStatus {
        service_type: SERVICE_TYPE,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SESSION_CHANGE,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    info!("Service status set to RUNNING");

    // Spawn app immediately for current active session (in case user is already logged in)
    spawn_for_active_session();

    loop {
        match shutdown_rx.recv_timeout(Duration::from_secs(1)) {
            Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                info!("Shutdown signal received or channel disconnected");
                break;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
    }

    status_handle.set_service_status(ServiceStatus {
        service_type: SERVICE_TYPE,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    info!("Service stopped");
    Ok(())
}

fn spawn_for_active_session() {
    unsafe {
        let active_session = WTSGetActiveConsoleSessionId();
        info!("Current active console session ID: {}", active_session);
        if active_session != 0xFFFFFFFF {
            spawn_app_for_session(active_session);
        } else {
            info!("No active console session found");
        }
    }
}

fn spawn_app_for_session(session_id: u32) {
    info!("Attempting to spawn app for session {}", session_id);
    unsafe {
        let mut user_token: HANDLE = HANDLE::default();

        if WTSQueryUserToken(session_id, &mut user_token).is_ok() {
            info!(
                "Successfully obtained user token for session {}",
                session_id
            );
            let exe_path = get_hotspot_exe_path();

            if let Some(path) = exe_path {
                info!("Target executable path: {}", path);
                let cmd_line = format!("\"{}\" --minimized", path);
                let mut cmd_wide: Vec<u16> =
                    cmd_line.encode_utf16().chain(std::iter::once(0)).collect();

                let desktop_str = "winsta0\\default\0";
                let mut desktop_wide: Vec<u16> = desktop_str.encode_utf16().collect();

                let mut si = STARTUPINFOW::default();
                si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
                si.lpDesktop = PWSTR(desktop_wide.as_mut_ptr());

                let mut pi = PROCESS_INFORMATION::default();

                let mut env_block: *mut std::ffi::c_void = std::ptr::null_mut();
                if CreateEnvironmentBlock(&mut env_block, Some(user_token), false).is_ok() {
                    info!("Environment block created");
                } else {
                    warn!("Failed to create environment block");
                }

                let result = CreateProcessAsUserW(
                    Some(user_token),
                    None,
                    Some(PWSTR(cmd_wide.as_mut_ptr())),
                    None,
                    None,
                    false,
                    CREATE_UNICODE_ENVIRONMENT,
                    Some(env_block),
                    None,
                    &si,
                    &mut pi,
                );

                if let Err(e) = result {
                    error!("CreateProcessAsUserW failed. Error: {:?}", e);
                } else {
                    info!("CreateProcessAsUserW succeeded. PID: {:?}", pi.dwProcessId);
                    let _ = CloseHandle(pi.hProcess);
                    let _ = CloseHandle(pi.hThread);
                }

                if !env_block.is_null() {
                    let _ = DestroyEnvironmentBlock(env_block);
                }
            } else {
                error!("Could not find hotspot.exe path");
            }

            let _ = CloseHandle(user_token);
        } else {
            let error = GetLastError();
            warn!(
                "Failed to query user token for session {}. Error: {:?}",
                session_id, error
            );
        }
    }
}

fn get_hotspot_exe_path() -> Option<String> {
    if let Ok(exe) = env::current_exe() {
        if let Some(parent) = exe.parent() {
            let hotspot_path = parent.join("hotspot.exe");
            if hotspot_path.exists() {
                return hotspot_path.to_str().map(|s| s.to_string());
            }
        }
    }

    let program_files = env::var("ProgramFiles").ok()?;
    let path = PathBuf::from(program_files)
        .join("Hotspot Manager")
        .join("hotspot.exe");
    if path.exists() {
        return path.to_str().map(|s| s.to_string());
    }

    None
}
