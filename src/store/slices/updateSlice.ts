import { StateCreator } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { HotspotState } from '../types'

export interface UpdateSlice {
    updateInfo: HotspotState['updateInfo']
    checkForUpdates: HotspotState['checkForUpdates']
    installUpdate: HotspotState['installUpdate']
    restartApp: HotspotState['restartApp']
    skipVersion: HotspotState['skipVersion']
    dismissUpdateModal: HotspotState['dismissUpdateModal']
    loadSkippedVersion: HotspotState['loadSkippedVersion']
    loadPendingUpdate: HotspotState['loadPendingUpdate']
    clearPendingUpdate: HotspotState['clearPendingUpdate']
}

let pendingUpdate: any = null;

export const createUpdateSlice: StateCreator<HotspotState, [], [], UpdateSlice> = (set, get) => ({
    updateInfo: {
        status: 'idle',
        latestVersion: null,
        releaseNotes: null,
        downloadUrl: null,
        skippedVersion: null,
        showModal: false,
        downloadProgress: 0,
        isUpdating: false,
        restartPending: false,
        pendingUpdateVersion: null,
        lastCheckTime: null,
        checkInProgress: false
    },

    checkForUpdates: async (silent = false, isAutoCheck = false) => {
        const { updateInfo } = get();

        if (!silent) {
            set((state) => ({ updateInfo: { ...state.updateInfo, status: 'checking' } }));
        }

        if (updateInfo.checkInProgress) {
            console.log('Update check already in progress, skipping');
            return;
        }

        const now = Date.now();
        if (updateInfo.lastCheckTime && (now - updateInfo.lastCheckTime) < 30000) {
            console.log('Rate limited: too soon since last check');
            if (!silent) {
                await new Promise(r => setTimeout(r, 1000));
                set((state) => {
                    // Check again inside set to be race-condition safe-ish
                    if (isAutoCheck && state.updateInfo.status === 'idle') {
                        return {
                            updateInfo: {
                                ...state.updateInfo,
                                status: 'up-to-date',
                                checkInProgress: false,
                                lastCheckTime: now
                            }
                        };
                    }
                    return {
                        updateInfo: {
                            ...state.updateInfo,
                            status: 'up-to-date',
                            checkInProgress: false
                            // Do not update lastCheckTime so user can check again soon
                        }
                    };
                });
            }
            return;
        }

        set((state) => ({
            updateInfo: {
                ...state.updateInfo,
                checkInProgress: true,
                status: silent ? state.updateInfo.status : 'checking',
                lastCheckTime: now
            }
        }));

        try {
            const { check } = await import('@tauri-apps/plugin-updater');

            const GITHUB_TOKEN = await invoke<string>('get_github_token');

            const update = await check({
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/octet-stream'
                }
            });

            if (update) {
                const { updateInfo, installUpdate } = get();

                if (updateInfo.isUpdating || updateInfo.restartPending) {
                    set((state) => ({ updateInfo: { ...state.updateInfo, checkInProgress: false } }));
                    return;
                }

                if (!update.version) {
                    console.error('Update object found but missing version', update);
                    set((state) => ({ updateInfo: { ...state.updateInfo, checkInProgress: false } }));
                    return;
                }

                let releaseNotes = update.body || 'Performans iyileştirmeleri ve hata düzeltmeleri içerir.';

                try {
                    const res = await fetch(`https://api.github.com/repos/gunwiggle/hotspot/releases/tags/v${update.version}`, {
                        headers: {
                            'Authorization': `Bearer ${GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.body) releaseNotes = data.body;
                    }
                } catch (e) {
                    console.error('Failed to fetch GH release notes', e);
                }

                if (isAutoCheck) {
                    console.log('Otomatik güncelleme bulundu, sessizce indiriliyor...');
                    installUpdate();
                } else {
                    if (releaseNotes) {
                        localStorage.setItem('hotspot_release_notes', releaseNotes);
                    }

                    set({
                        updateInfo: {
                            ...get().updateInfo,
                            status: 'available',
                            latestVersion: update.version,
                            releaseNotes: releaseNotes,
                            downloadUrl: 'https://github.com/gunwiggle/hotspot/releases/latest',
                            showModal: false,
                            checkInProgress: false
                        }
                    });
                }
            } else {
                set((state) => ({
                    updateInfo: {
                        ...state.updateInfo,
                        status: 'up-to-date',
                        showModal: false,
                        checkInProgress: false
                    }
                }));
            }
        } catch (e) {
            console.error('Updater check failed', e);
            set((state) => ({
                updateInfo: {
                    ...state.updateInfo,
                    status: silent ? (state.updateInfo.status === 'idle' ? 'up-to-date' : state.updateInfo.status) : 'idle',
                    checkInProgress: false
                }
            }));
        }
    },

    installUpdate: async () => {
        const { updateInfo } = get();
        if (updateInfo.isUpdating) return;

        set((state) => ({
            updateInfo: {
                ...state.updateInfo,
                isUpdating: true,
                downloadProgress: 0,
            }
        }));

        try {
            const { check } = await import('@tauri-apps/plugin-updater');

            let update = pendingUpdate;

            if (!update) {
                const GITHUB_TOKEN = await invoke<string>('get_github_token');
                update = await check({
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/octet-stream'
                    }
                });
            }

            if (update) {
                pendingUpdate = update;
                const targetVersion = update.version;

                let downloaded = 0;
                let contentLength = 0;

                await update.download(async (event: any) => {
                    switch (event.event) {
                        case 'Started':
                            contentLength = event.data.contentLength || 0;
                            break;
                        case 'Progress':
                            downloaded += event.data.chunkLength;
                            if (contentLength > 0) {
                                const percent = Math.round((downloaded / contentLength) * 100);
                                set((state) => ({ updateInfo: { ...state.updateInfo, downloadProgress: percent } }));
                            }
                            break;
                        case 'Finished':
                            console.log('Download finished successfully');
                            localStorage.setItem('hotspot_pending_update', targetVersion);

                            set((state) => ({
                                updateInfo: {
                                    ...state.updateInfo,
                                    downloadProgress: 100,
                                    isUpdating: false,
                                    restartPending: true,
                                    pendingUpdateVersion: targetVersion,
                                    showModal: false,
                                    checkInProgress: false
                                }
                            }));
                            break;
                    }
                });

                // Fallback state update
                set((state) => ({
                    updateInfo: {
                        ...state.updateInfo,
                        downloadProgress: 100,
                        isUpdating: false,
                        restartPending: true,
                        showModal: false
                    }
                }));
            }
        } catch (error) {
            console.error('Update download failed:', error);
            set((state) => ({ updateInfo: { ...state.updateInfo, isUpdating: false, status: 'available' } }));
        }
    },

    restartApp: async () => {
        try {
            if (!pendingUpdate) {
                console.log('Update object lost, re-checking...');
                const { check } = await import('@tauri-apps/plugin-updater');
                const GITHUB_TOKEN = await invoke<string>('get_github_token');
                const update = await check({
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/octet-stream'
                    }
                });

                if (update) {
                    pendingUpdate = update;
                    await update.downloadAndInstall();
                    return;
                }
            }

            if (pendingUpdate) {
                await pendingUpdate.install();
                return;
            }

            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch (e) {
            console.error('Update install failed, falling back to relaunch', e);
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        }
    },

    skipVersion: (version: string) => {
        localStorage.setItem('hotspot_skipped_version', version);
        set((state) => ({
            updateInfo: {
                ...state.updateInfo,
                skippedVersion: version,
                showModal: false
            }
        }));
    },

    dismissUpdateModal: () => {
        set((state) => ({ updateInfo: { ...state.updateInfo, showModal: false } }));
    },

    loadSkippedVersion: () => {
        const skipped = localStorage.getItem('hotspot_skipped_version');
        if (skipped) {
            set((state) => ({ updateInfo: { ...state.updateInfo, skippedVersion: skipped } }));
        }
    },

    loadPendingUpdate: async () => {
        const pendingVersion = localStorage.getItem('hotspot_pending_update');
        if (pendingVersion) {
            try {
                const { getVersion } = await import('@tauri-apps/api/app');
                const currentVersion = await getVersion();

                const compareVersions = (v1: string, v2: string) => {
                    const parts1 = v1.split('.').map(Number);
                    const parts2 = v2.split('.').map(Number);
                    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
                        const n1 = parts1[i] || 0;
                        const n2 = parts2[i] || 0;
                        if (n1 > n2) return 1;
                        if (n1 < n2) return -1;
                    }
                    return 0;
                };

                if (compareVersions(pendingVersion, currentVersion) > 0) {
                    const persistedNotes = localStorage.getItem('hotspot_release_notes');
                    set((state) => ({
                        updateInfo: {
                            ...state.updateInfo,
                            updateAvailable: true,
                            version: pendingVersion,
                            status: 'available',
                            releaseNotes: persistedNotes || state.updateInfo.releaseNotes,
                            downloadUrl: 'https://github.com/gunwiggle/hotspot/releases/latest'
                        },
                        restartPending: true
                    }));
                } else {
                    localStorage.removeItem('hotspot_pending_update');
                    localStorage.removeItem('hotspot_release_notes');
                    set((state) => ({
                        updateInfo: {
                            ...state.updateInfo,
                            updateAvailable: false,
                            status: 'idle'
                        },
                        restartPending: false
                    }));
                }
            } catch (e) {
                console.error('Failed to load version info', e);
            }
        }
    },

    clearPendingUpdate: () => {
        localStorage.removeItem('hotspot_pending_update');
        localStorage.removeItem('hotspot_release_notes');
        pendingUpdate = null;
    }
})
