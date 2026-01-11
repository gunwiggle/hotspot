; NSIS Installer Hooks for Hotspot Manager

!macro NSIS_HOOK_PREINSTALL
  ; Stop the service before installation to unlock the executable
  nsExec::ExecToLog 'sc stop HotspotLauncher'
  ; Wait a moment for the service to stop
  Sleep 2000
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Start the service after installation
  nsExec::ExecToLog 'sc start HotspotLauncher'
!macroend
