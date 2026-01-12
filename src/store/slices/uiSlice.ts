import { StateCreator } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { HotspotState } from '../types'

export interface UISlice {
    logs: HotspotState['logs']
    errorMessage: HotspotState['errorMessage']
    settings: HotspotState['settings']
    isChecking: HotspotState['isChecking']
    isSettingsOpen: HotspotState['isSettingsOpen']

    setSettingsOpen: HotspotState['setSettingsOpen']
    setSettings: HotspotState['setSettings']
    addLog: HotspotState['addLog']
    saveSettings: HotspotState['saveSettings']
    loadSettings: HotspotState['loadSettings']
    autoStartEnabled: HotspotState['autoStartEnabled']
    checkAutoStartStatus: HotspotState['checkAutoStartStatus']
    toggleAutoStart: HotspotState['toggleAutoStart']
}

export const createUISlice: StateCreator<HotspotState, [], [], UISlice> = (set, get) => ({
    logs: [],
    errorMessage: null,
    settings: {
        minimizeToTray: true,
        autoReconnect: false,
        privacyMode: false,
        startInTray: true
    },
    isChecking: false,
    isSettingsOpen: false,

    setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
    setSettings: (settings) => set({ settings }),

    addLog: (message) => {
        const time = new Date().toLocaleTimeString('tr-TR');
        set((state) => ({ logs: [`[${time}] ${message}`, ...state.logs].slice(0, 50) }))
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
            const settings = await invoke<UISlice['settings']>('load_settings')
            set({ settings })
            // Check autostart status after loading settings
            get().checkAutoStartStatus()
        } catch (e) {
            console.error('Settings load failed', e)
        }
    },

    autoStartEnabled: false,

    checkAutoStartStatus: async () => {
        try {
            const enabled = await invoke<boolean>('is_startup_enabled')
            set({ autoStartEnabled: enabled })
        } catch (e) {
            console.error('Failed to check autostart', e)
        }
    },

    toggleAutoStart: async (checked: boolean) => {
        // Optimistic update
        set({ autoStartEnabled: checked })
        const { settings } = get()
        try {
            if (checked) {
                await invoke('enable_startup', { minimized: settings.startInTray })
            } else {
                await invoke('disable_startup')
            }
        } catch (error) {
            console.error('Failed to change autostart settings:', error)
            // Revert on failure
            set({ autoStartEnabled: !checked })
            throw error // Re-throw to handle in UI if needed
        }
    }
})
