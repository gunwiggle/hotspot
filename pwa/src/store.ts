import { create } from 'zustand'
import * as network from '@/api/network'
import * as storage from '@/api/storage'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface HotspotState {
    status: ConnectionStatus
    credentials: storage.Credentials
    settings: storage.Settings
    errorMessage: string | null
    isChecking: boolean
    ping: number | null
    publicIp: string
    lastLogin: Date | null
    logs: string[]
    isSettingsOpen: boolean

    setCredentials: (c: storage.Credentials) => void
    setSettings: (s: storage.Settings) => void
    setSettingsOpen: (open: boolean) => void

    init: () => void
    performLogin: () => Promise<void>
    performLogout: () => Promise<void>
    checkConnection: (silent?: boolean) => Promise<void>
    refreshPing: () => Promise<void>
    addLog: (msg: string) => void
}

export const useStore = create<HotspotState>((set, get) => ({
    status: 'disconnected',
    credentials: { username: '', password: '' },
    settings: { autoReconnect: true, privacyMode: false, connectOnStartup: false },
    errorMessage: null,
    isChecking: false,
    ping: null,
    publicIp: '-',
    lastLogin: null,
    logs: [],
    isSettingsOpen: false,

    setCredentials: (c) => set({ credentials: c }),
    setSettings: (s) => {
        set({ settings: s })
        storage.saveSettings(s)
    },
    setSettingsOpen: (open) => set({ isSettingsOpen: open }),

    init: () => {
        const creds = storage.loadCredentials()
        const settings = storage.loadSettings()
        set({ credentials: creds, settings })
        get().checkConnection(true)
    },

    addLog: (msg) => {
        const ts = new Date().toLocaleTimeString('tr-TR')
        set((s) => ({ logs: [`[${ts}] ${msg}`, ...s.logs].slice(0, 50) }))
    },

    performLogin: async () => {
        const { credentials, addLog } = get()
        if (!credentials.username || !credentials.password) {
            set({ errorMessage: 'Kullanıcı adı ve şifre gerekli' })
            return
        }

        set({ status: 'connecting', errorMessage: null })
        storage.saveCredentials(credentials)
        addLog('Giriş yapılıyor...')

        const success = await network.performLogin(credentials.username, credentials.password)

        if (success) {
            set({ status: 'connected', lastLogin: new Date() })
            addLog('Giriş başarılı')
            const ip = await network.fetchPublicIp()
            set({ publicIp: ip })
        } else {
            set({ status: 'error', errorMessage: 'Giriş başarısız' })
            addLog('Giriş başarısız')
        }
    },

    performLogout: async () => {
        const { addLog } = get()
        addLog('Çıkış yapılıyor...')
        await network.performLogout()
        set({ status: 'disconnected' })
        addLog('Çıkış yapıldı')
    },

    checkConnection: async (silent = false) => {
        if (!silent) set({ isChecking: true })
        const connected = await network.checkConnection()
        const prev = get().status

        if (connected && prev !== 'connected') {
            set({ status: 'connected' })
            if (!silent) get().addLog('Bağlantı aktif')
            const ip = await network.fetchPublicIp()
            set({ publicIp: ip })
        } else if (!connected && prev === 'connected') {
            set({ status: 'disconnected' })
            if (!silent) get().addLog('Bağlantı kesildi')

            if (get().settings.autoReconnect) {
                get().addLog('Otomatik yeniden bağlanma deneniyor...')
                await get().performLogin()
            }
        } else if (!connected && prev !== 'connected') {
            set({ status: 'disconnected' })
        }

        set({ isChecking: false })
    },

    refreshPing: async () => {
        const p = await network.measurePing()
        set({ ping: p })
    },
}))
