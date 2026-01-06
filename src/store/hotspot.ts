import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface Credentials {
    username: string
    password: string
}

interface Settings {
    minimizeToTray: boolean
    autoReconnect: boolean
    privacyMode: boolean
}

interface HotspotState {
    status: ConnectionStatus
    credentials: Credentials
    logs: string[]
    lastLogin: Date | null
    errorMessage: string | null
    settings: Settings
    isChecking: boolean
    manualDisconnect: boolean
    ping: number | null
    ipInfo: { local: string, public: string }
    networkStats: { received: number, transmitted: number }
    speedTestResult: { download: number, upload: number, isTesting: boolean }
    updateInfo: {
        status: 'idle' | 'checking' | 'available' | 'up-to-date',
        latestVersion: string | null,
        releaseNotes: string | null,
        downloadUrl: string | null
    }
    setCredentials: (credentials: Credentials) => void
    setSettings: (settings: Settings) => void
    setStatus: (status: ConnectionStatus) => void
    addLog: (message: string) => void
    performLogin: () => Promise<void>
    performLogout: () => Promise<void>
    checkConnection: (silent?: boolean) => Promise<void>
    saveCredentials: () => Promise<void>
    loadCredentials: () => Promise<void>
    saveSettings: () => Promise<void>
    loadSettings: () => Promise<void>
    updateNetworkInfo: () => Promise<void>
    performPingTest: () => Promise<void>
    fetchPublicIp: () => Promise<void>
    runSpeedTest: () => Promise<void>
    checkForUpdates: (silent?: boolean) => Promise<void>
    installUpdate: () => Promise<void>
}

export const useHotspotStore = create<HotspotState>((set, get) => ({
    status: 'disconnected',
    credentials: { username: '', password: '' },
    logs: [],
    lastLogin: null,
    errorMessage: null,
    settings: {
        minimizeToTray: true,
        autoReconnect: false,
        privacyMode: false
    },
    isChecking: false,
    manualDisconnect: false,
    ping: null,
    ipInfo: { local: '...', public: '...' },
    networkStats: { received: 0, transmitted: 0 },
    speedTestResult: { download: 0, upload: 0, isTesting: false },
    updateInfo: {
        status: 'idle',
        latestVersion: null,
        releaseNotes: null,
        downloadUrl: null
    },

    setCredentials: (credentials) => set({ credentials }),
    setSettings: (settings) => set({ settings }),
    setStatus: (status) => {
        set({ status })

        let iconStatus = 'disconnected'
        if (status === 'connected') iconStatus = 'connected'
        else if (status === 'connecting') iconStatus = 'checking' // Connecting sirasinda mavi
        else if (status === 'error') iconStatus = 'disconnected'

        invoke('update_tray_icon', { status: iconStatus }).catch(() => { })
    },
    addLog: (message) => {
        const time = new Date().toLocaleTimeString('tr-TR');
        set((state) => ({ logs: [`[${time}] ${message}`, ...state.logs].slice(0, 50) }))
    },

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
                // Manuel disconnect flag'ini kaldir, cunku basarili giris yaptik
                set({ manualDisconnect: false })
                setStatus('connected')
                set({ lastLogin: new Date() })
                addLog('Giriş başarılı')
                await checkConnection(true) // Silent check after login
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

        // Manuel disconnect isaretle ki auto-reconnect calismas'in
        set({ manualDisconnect: true })

        addLog('Bağlantı kesiliyor...')
        // UI feedback icin kisa bir sure connecting/checking durumu gosterilebilirdi 
        // ama kullanici "baglanti kesiliyor" gormek istiyor. 
        // Status indicator bunu gostermez ama dashboard butonu disabled olacak.

        try {
            await invoke('perform_logout')
        } catch (error) {
            console.error('Logout hatası:', error)
        }

        // Kesinlikle disconnected yap
        setStatus('disconnected')
        addLog('Bağlantı kesildi')
    },

    checkConnection: async (silent = false) => {
        const { setStatus, settings, performLogin, status, manualDisconnect } = get()

        if (!silent) {
            set({ isChecking: true })
            // Manuel kontrol sirasinda mavi ikon
            invoke('update_tray_icon', { status: 'checking' }).catch(() => { })
            // Yapay gecikme (sadece manuel check icin)
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        try {
            const isConnected = await invoke<boolean>('check_connection')

            if (isConnected) {
                // Baglandiksa manual disconnect flagi resetlemeliyiz, cunku artik bagliyiz.
                // Ama belki kullanici baska bi yerden baglandi. Iyi UX icin resetlemek mantikli.
                if (manualDisconnect) set({ manualDisconnect: false })

                if (status !== 'connected') {
                    setStatus('connected')
                    get().addLog('Bağlantı doğrulandı - İnternet mevcut')
                } else if (!silent) {
                    // Eger zaten bagliysak ve manuel kontrol ettiysek ikonu yesile dondur
                    invoke('update_tray_icon', { status: 'connected' }).catch(() => { })
                }
            } else {
                if (status === 'connected') {
                    setStatus('disconnected')
                    get().addLog('Bağlantı koptu')

                    // Auto-reconnect logic
                    // Sadece manuel disconnect DEGILSE calis
                    if (settings.autoReconnect && !manualDisconnect) {
                        get().addLog('Otomatik yeniden bağlanılıyor...')
                        await performLogin() // Bu fonksiyon icinde status connecting olacak
                    }
                } else {
                    if (status !== 'disconnected') setStatus('disconnected')
                    else if (!silent) {
                        // Zaten disconnected ve manuel check yaptik -> kirmizi ikon
                        invoke('update_tray_icon', { status: 'disconnected' }).catch(() => { })
                    }

                    // Eger disconnected durumdayken (ilk acilis veya kopukluk) auto-connect aciksa
                    // ve manual disconnect degilse baglanmayi dene.
                    // Bu durum uygulamanin ilk acilisi icin onemli.
                    if (settings.autoReconnect && !manualDisconnect && status === 'disconnected') {
                        // Loop prevention: Eger zaten deniyorsak yapma (performLogin handles connecting status)
                        // Ama burada status disconnected.
                        // Bir sans verelim
                        get().addLog('Otomatik bağlantı başlatılıyor...')
                        await performLogin()
                    }
                }
            }
        } catch (error) {
            console.error(error)
            setStatus('error')
        } finally {
            if (!silent) set({ isChecking: false })
        }
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
            const credentials = await invoke<Credentials>('load_credentials')
            set({ credentials })
        } catch (e) {
            // No credentials saved is fine
        }
    },

    saveSettings: async () => {
        const { settings } = get()
        try {
            await invoke('save_settings', { settings })
        } catch (e) {
            console.error('Settings save failed', e)
        }
    },

    loadSettings: async () => {
        try {
            const settings = await invoke<Settings>('load_settings')
            set({ settings })
        } catch (e) {
            console.error('Settings load failed', e)
        }
    },

    updateNetworkInfo: async () => {
        try {
            // Update network stats from Rust
            const stats = await invoke<{ total_received: number, total_transmitted: number }>('get_network_stats')

            // Get Local IP (only if not set or periodically)
            const { ipInfo } = get()
            if (ipInfo.local === '...') {
                const localIp = await invoke<string>('get_ip_info')
                set((state) => ({ ipInfo: { ...state.ipInfo, local: localIp } }))
            }

            // Public IP (fetch once or rarely)
            // For now, let's just keep network stats updated
            set({ networkStats: { received: stats.total_received, transmitted: stats.total_transmitted } })

        } catch (e) {
            console.error('Network info update failed', e)
        }
    },

    performPingTest: async () => {
        const start = Date.now()
        try {
            await fetch('https://www.google.com/generate_204', { mode: 'no-cors', cache: 'no-store' })
            const end = Date.now()
            set({ ping: end - start })
        } catch {
            set({ ping: -1 }) // Timeout or error
        }
    },

    fetchPublicIp: async () => {
        try {
            const res = await fetch('https://api.ipify.org?format=json')
            const data = await res.json()
            set((state) => ({ ipInfo: { ...state.ipInfo, public: data.ip } }))
        } catch {
            set((state) => ({ ipInfo: { ...state.ipInfo, public: 'Hata' } }))
        }
    },

    // 10. Hız Testi (Gelişmiş: Download & Upload)
    runSpeedTest: async () => {
        set({ speedTestResult: { download: 0, upload: 0, isTesting: true } })

        try {
            // STEP 1: DOWNLOAD TEST (Cloudflare ~2MB)
            const dStart = Date.now()
            const dRes = await fetch('https://speed.cloudflare.com/__down?bytes=2000000', { cache: 'no-store' })
            const dData = await dRes.blob()
            const dEnd = Date.now()

            const dSec = (dEnd - dStart) / 1000
            const dMbps = (dData.size * 8) / (dSec * 1000000)

            set((state) => ({ speedTestResult: { ...state.speedTestResult, download: parseFloat(dMbps.toFixed(2)) } }))

            // STEP 2: UPLOAD TEST (Simulated POST ~1MB)
            const uStart = Date.now()
            const uPayload = new Uint8Array(1000000) // 1MB random data

            // Note: In a real app, use a proper upload endpoint. 
            // Using httpbin for demonstration
            await fetch('https://httpbin.org/post', {
                method: 'POST',
                body: uPayload,
                cache: 'no-store',
                mode: 'cors'
            })
            const uEnd = Date.now()

            const uSec = (uEnd - uStart) / 1000
            const uMbps = (uPayload.length * 8) / (uSec * 1000000)

            set((state) => ({ speedTestResult: { ...state.speedTestResult, upload: parseFloat(uMbps.toFixed(2)), isTesting: false } }))
        } catch (e) {
            console.error('Speed test failed', e)
            set({ speedTestResult: { download: -1, upload: -1, isTesting: false } })
        }
    },

    checkForUpdates: async (silent = false) => {
        set((state) => ({ updateInfo: { ...state.updateInfo, status: 'checking' } }))

        try {
            // First try official Tauri Updater plugin (Tauri 2 compatible)
            const { check } = await import('@tauri-apps/plugin-updater');
            const update = await check();

            if (update) {
                set({
                    updateInfo: {
                        status: 'available',
                        latestVersion: update.version,
                        releaseNotes: update.body || 'Performans iyileştirmeleri ve hata düzeltmeleri içerir.',
                        downloadUrl: 'https://github.com/gunwiggle/hotspot/releases/latest'
                    }
                });
            } else {
                set((state) => ({ updateInfo: { ...state.updateInfo, status: 'up-to-date' } }));
                if (!silent) {
                    setTimeout(() => set((state) => ({ updateInfo: { ...state.updateInfo, status: 'idle' } })), 3000);
                }
            }
        } catch (e) {
            console.error('Updater plugin failed, falling back to manual API check', e);
            // Fallback to manual GitHub API check
            try {
                const res = await fetch('https://api.github.com/repos/gunwiggle/hotspot/releases/latest', {
                    headers: { 'Accept': 'application/vnd.github.v3+json' }
                });
                if (!res.ok) throw new Error('GitHub API error');
                const data = await res.json();
                const latestVersion = data.tag_name.replace('v', '');
                const currentVersion = '0.2.1';

                if (latestVersion !== currentVersion) {
                    set({
                        updateInfo: {
                            status: 'available',
                            latestVersion,
                            releaseNotes: data.body,
                            downloadUrl: data.html_url
                        }
                    });
                } else {
                    set((state) => ({ updateInfo: { ...state.updateInfo, status: 'up-to-date' } }));
                }
            } catch (apiError) {
                set((state) => ({ updateInfo: { ...state.updateInfo, status: 'idle' } }));
            }
        }
    },

    installUpdate: async () => {
        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const update = await check();
            if (update) {
                set((state) => ({ updateInfo: { ...state.updateInfo, status: 'checking' } }));
                await update.downloadAndInstall();
                // app will restart automatically
            }
        } catch (error) {
            console.error('Update installation failed:', error);
            alert('Güncelleme yüklenirken bir hata oluştu. Lütfen GitHub üzerinden manuel indirmeyi deneyin.');
            set((state) => ({ updateInfo: { ...state.updateInfo, status: 'available' } }));
        }
    }
}))
