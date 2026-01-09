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
}

export const createUISlice: StateCreator<HotspotState, [], [], UISlice> = (set, get) => ({
    logs: [],
    errorMessage: null,
    settings: {
        minimizeToTray: true,
        autoReconnect: false,
        privacyMode: false
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
        } catch (e) {
            console.error('Settings load failed', e)
        }
    }
})
