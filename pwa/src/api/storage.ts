const CREDENTIALS_KEY = 'hotspot_credentials'
const SETTINGS_KEY = 'hotspot_settings'

export interface Credentials {
    username: string
    password: string
}

export interface Settings {
    autoReconnect: boolean
    privacyMode: boolean
    connectOnStartup: boolean
}

const DEFAULT_SETTINGS: Settings = {
    autoReconnect: true,
    privacyMode: false,
    connectOnStartup: false,
}

export function saveCredentials(creds: Credentials): void {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds))
}

export function loadCredentials(): Credentials {
    try {
        const raw = localStorage.getItem(CREDENTIALS_KEY)
        if (raw) return JSON.parse(raw)
    } catch { }
    return { username: '', password: '' }
}

export function saveSettings(settings: Settings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch { }
    return DEFAULT_SETTINGS
}
