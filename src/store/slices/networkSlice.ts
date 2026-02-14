import { StateCreator } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { HotspotState } from '../types'

export interface NetworkSlice {
    status: HotspotState['status']
    ping: HotspotState['ping']
    ipInfo: HotspotState['ipInfo']
    networkStats: HotspotState['networkStats']
    manualDisconnect: HotspotState['manualDisconnect']

    hotspotEnabled: HotspotState['hotspotEnabled']
    isTogglingHotspot: HotspotState['isTogglingHotspot']
    userManuallyDisabledHotspot: HotspotState['userManuallyDisabledHotspot']
    toggleHotspot: HotspotState['toggleHotspot']
    checkHotspotStatus: HotspotState['checkHotspotStatus']

    setStatus: HotspotState['setStatus']
    checkConnection: HotspotState['checkConnection']
    updateNetworkInfo: HotspotState['updateNetworkInfo']
    performPingTest: HotspotState['performPingTest']
    fetchPublicIp: HotspotState['fetchPublicIp']
}

export const createNetworkSlice: StateCreator<HotspotState, [], [], NetworkSlice> = (set, get) => ({
    status: 'disconnected',
    ping: null,
    ipInfo: { local: '...', public: '...' },
    networkStats: { received: 0, transmitted: 0 },
    manualDisconnect: false,

    hotspotEnabled: false,
    isTogglingHotspot: false,
    userManuallyDisabledHotspot: false,

    setStatus: (status) => {
        set({ status })
        let iconStatus = 'disconnected'
        if (status === 'connected') iconStatus = 'connected'
        else if (status === 'connecting') iconStatus = 'checking'
        else if (status === 'error') iconStatus = 'disconnected'
        invoke('update_tray_icon', { status: iconStatus }).catch(() => { })
    },

    checkConnection: async (silent = false) => {
        const { setStatus, settings, performLogin, status, manualDisconnect } = get()

        if (!silent) {
            set({ isChecking: true })
            invoke('update_tray_icon', { status: 'checking' }).catch(() => { })
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        try {
            const isConnected = await invoke<boolean>('check_connection')

            if (isConnected) {
                if (manualDisconnect) set({ manualDisconnect: false })

                if (status !== 'connected') {
                    setStatus('connected')
                    get().addLog('Bağlantı doğrulandı - İnternet mevcut')
                    get().checkForUpdates(true, true)
                } else if (!silent) {
                    invoke('update_tray_icon', { status: 'connected' }).catch(() => { })
                }
            } else {
                if (status === 'connected') {
                    setStatus('disconnected')
                    get().addLog('Bağlantı koptu')
                    if (settings.autoReconnect && !manualDisconnect) {
                        get().addLog('Otomatik yeniden bağlanılıyor...')
                        await performLogin()
                    }
                } else {
                    if (status !== 'disconnected') setStatus('disconnected')
                    else if (!silent) {
                        invoke('update_tray_icon', { status: 'disconnected' }).catch(() => { })
                    }

                    if (settings.autoReconnect && !manualDisconnect && status === 'disconnected') {
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

    updateNetworkInfo: async () => {
        try {
            const stats = await invoke<{ total_received: number, total_transmitted: number }>('get_network_stats')
            const { ipInfo } = get()
            if (ipInfo.local === '...') {
                const localIp = await invoke<string>('get_ip_info')
                set((state) => ({ ipInfo: { ...state.ipInfo, local: localIp } }))
            }
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
            set({ ping: -1 })
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

    checkHotspotStatus: async () => {
        try {
            const enabled = await invoke<boolean>('get_hotspot_status')
            set({ hotspotEnabled: enabled })
        } catch (e) {
            console.error('Hotspot durumu alınamadı', e)
        }
    },

    toggleHotspot: async () => {
        const currentEnabled = get().hotspotEnabled
        const intendedAction = currentEnabled ? 'disable' : 'enable'

        set({ isTogglingHotspot: true })

        try {
            await invoke<boolean>('toggle_hotspot')
        } catch (e) {
            console.error('Hotspot toggle işlem hatası', e)
        }

        try {
            // Hata olsa bile son durumu kontrol et
            const actual = await invoke<boolean>('get_hotspot_status')
            set({ hotspotEnabled: actual })

            // Logic Düzeltmesi: Niyetimize göre state'i güncelle
            if (intendedAction === 'disable' && !actual) {
                // Kapatmak istedik ve kapandı -> Manuel disable aktif
                set({ userManuallyDisabledHotspot: true })
            } else if (intendedAction === 'enable' && actual) {
                // Açmak istedik ve açıldı -> Manuel disable pasif
                set({ userManuallyDisabledHotspot: false })
            }
        } catch (e) {
            console.error('Status check hatası', e)
        } finally {
            set({ isTogglingHotspot: false })
        }
    }
})
