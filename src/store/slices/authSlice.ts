import { StateCreator } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { HotspotState } from '../types'

export interface AuthSlice {
    credentials: HotspotState['credentials']
    lastLogin: HotspotState['lastLogin']
    setCredentials: HotspotState['setCredentials']
    performLogin: HotspotState['performLogin']
    performLogout: HotspotState['performLogout']
    saveCredentials: HotspotState['saveCredentials']
    loadCredentials: HotspotState['loadCredentials']
}

export const createAuthSlice: StateCreator<HotspotState, [], [], AuthSlice> = (set, get) => ({
    credentials: { username: '', password: '' },
    lastLogin: null,

    setCredentials: (credentials) => set({ credentials }),

    performLogin: async () => {
        const { credentials, addLog, setStatus, checkConnection } = get()

        if (!credentials.username || !credentials.password) {
            set({ errorMessage: 'Kullanıcı adı ve şifre gerekli' })
            return
        }

        setStatus('connecting')
        set({ errorMessage: null })
        addLog('Giriş yapılıyor...')

        try {
            const success = await invoke<boolean>('perform_login', {
                username: credentials.username,
                password: credentials.password
            })

            if (success) {
                set({ manualDisconnect: false })
                setStatus('connected')
                set({ lastLogin: new Date() })
                addLog('Giriş başarılı')
                await checkConnection(true)
            }
        } catch (error) {
            const msg = typeof error === 'string' ? error : 'Giriş başarısız'
            set({ errorMessage: msg })
            setStatus('error')
            addLog(`Hata: ${msg}`)
        }
    },

    performLogout: async () => {
        const { setStatus, addLog } = get()
        set({ manualDisconnect: true })
        addLog('Bağlantı kesiliyor...')

        try {
            await invoke('perform_logout')
        } catch (error) {
            console.error('Logout hatası:', error)
        }

        setStatus('disconnected')
        addLog('Bağlantı kesildi')
    },

    saveCredentials: async () => {
        const { credentials } = get()
        try {
            await invoke('save_credentials', { ...credentials })
        } catch (e) {
            console.error('Credentials save failed', e)
        }
    },

    loadCredentials: async () => {
        try {
            const credentials = await invoke<AuthSlice['credentials']>('load_credentials')
            set({ credentials })
        } catch (e) {
            // No credentials saved is fine
        }
    }
})
