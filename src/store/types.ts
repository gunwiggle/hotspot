
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface Credentials {
    username: string
    password: string
}

export interface Settings {
    minimizeToTray: boolean
    autoReconnect: boolean
    privacyMode: boolean
    startInTray: boolean
}

export interface SpeedTestResult {
    download: number
    upload: number
    isTesting: boolean
    lastRun: number | null
}

export interface UpdateInfo {
    status: 'idle' | 'checking' | 'available' | 'up-to-date'
    latestVersion: string | null
    releaseNotes: string | null
    downloadUrl: string | null
    skippedVersion: string | null
    showModal: boolean
    downloadProgress: number
    isUpdating: boolean
    restartPending: boolean
    pendingUpdateVersion: string | null
    lastCheckTime: number | null
    checkInProgress: boolean
}

export interface IpInfo {
    local: string
    public: string
}

export interface NetworkStats {
    received: number
    transmitted: number
}

export interface HotspotState {
    // Auth Slice
    credentials: Credentials
    lastLogin: Date | null
    setCredentials: (credentials: Credentials) => void
    performLogin: () => Promise<void>
    performLogout: () => Promise<void>
    saveCredentials: () => Promise<void>
    loadCredentials: () => Promise<void>

    // Network Slice
    status: ConnectionStatus
    ping: number | null
    ipInfo: IpInfo
    networkStats: NetworkStats
    setStatus: (status: ConnectionStatus) => void
    checkConnection: (silent?: boolean) => Promise<void>
    updateNetworkInfo: () => Promise<void>
    performPingTest: () => Promise<void>
    fetchPublicIp: () => Promise<void>
    manualDisconnect: boolean

    // Speed Slice
    speedTestResult: SpeedTestResult
    runSpeedTest: () => Promise<void>

    // Update Slice
    updateInfo: UpdateInfo
    checkForUpdates: (silent?: boolean, isAutoCheck?: boolean) => Promise<void>
    installUpdate: () => Promise<void>
    restartApp: () => Promise<void>
    skipVersion: (version: string) => void
    dismissUpdateModal: () => void
    loadSkippedVersion: () => void
    loadPendingUpdate: () => void
    clearPendingUpdate: () => void

    // UI/Common Slice
    logs: string[]
    errorMessage: string | null
    settings: Settings
    isChecking: boolean
    isSettingsOpen: boolean
    setSettingsOpen: (isOpen: boolean) => void
    setSettings: (settings: Settings) => void
    addLog: (message: string) => void
    saveSettings: () => Promise<void>
    loadSettings: () => Promise<void>
}
