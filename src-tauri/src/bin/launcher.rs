#![windows_subsystem = "windows"]

use std::env;
use std::ffi::OsString;
use std::path::PathBuf;

use std::sync::mpsc;
use std::time::Duration;

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
    service_dispatcher::start(SERVICE_NAME, ffi_service_main)?;
    Ok(())
}

fn service_main(_arguments: Vec<OsString>) {
    if let Err(e) = run_service() {
        eprintln!("Service error: {:?}", e);
    }
}

fn run_service() -> Result<(), windows_service::Error> {
    let (shutdown_tx, shutdown_rx) = mpsc::channel();

    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                let _ = shutdown_tx.send(());
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::SessionChange(param) => {
                if param.reason == windows_service::service::SessionChangeReason::SessionLogon {
                    let session_id = param.notification.session_id;
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

    loop {
        match shutdown_rx.recv_timeout(Duration::from_secs(1)) {
            Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
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

    Ok(())
}

fn spawn_app_for_session(session_id: u32) {
    unsafe {
        let mut user_token: HANDLE = HANDLE::default();

        if WTSQueryUserToken(session_id, &mut user_token).is_ok() {
            let exe_path = get_hotspot_exe_path();

            if let Some(path) = exe_path {
                let mut path_wide: Vec<u16> =
                    path.encode_utf16().chain(std::iter::once(0)).collect();

                let desktop_str = "winsta0\\default\0";
                let mut desktop_wide: Vec<u16> = desktop_str.encode_utf16().collect();

                let mut si = STARTUPINFOW::default();
                si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
                si.lpDesktop = PWSTR(desktop_wide.as_mut_ptr());

                let mut pi = PROCESS_INFORMATION::default();

                let mut env_block: *mut std::ffi::c_void = std::ptr::null_mut();
                let _ = CreateEnvironmentBlock(&mut env_block, Some(user_token), false);

                let _ = CreateProcessAsUserW(
                    Some(user_token),
                    None,
                    Some(PWSTR(path_wide.as_mut_ptr())),
                    None,
                    None,
                    false,
                    CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW,
                    Some(env_block),
                    None,
                    &si,
                    &mut pi,
                );

                if !env_block.is_null() {
                    let _ = DestroyEnvironmentBlock(env_block);
                }

                if !pi.hProcess.is_invalid() {
                    let _ = CloseHandle(pi.hProcess);
                }
                if !pi.hThread.is_invalid() {
                    let _ = CloseHandle(pi.hThread);
                }
            }

            let _ = CloseHandle(user_token);
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
