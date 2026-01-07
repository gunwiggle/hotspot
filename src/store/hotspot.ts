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
    speedTestResult: SpeedTestResult
    updateInfo: {
        status: 'idle' | 'checking' | 'available' | 'up-to-date',
        latestVersion: string | null,
        releaseNotes: string | null,
        downloadUrl: string | null,
        skippedVersion: string | null,
        showModal: boolean,
        downloadProgress: number,
        isUpdating: boolean,
        restartPending: boolean,
        pendingUpdateVersion: string | null,
        lastCheckTime: number | null,
        checkInProgress: boolean
    }
    isSettingsOpen: boolean
    setSettingsOpen: (isOpen: boolean) => void
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
    checkForUpdates: (silent?: boolean, isAutoCheck?: boolean) => Promise<void>
    installUpdate: () => Promise<void>
    restartApp: () => Promise<void>
    skipVersion: (version: string) => void
    dismissUpdateModal: () => void
    loadSkippedVersion: () => void
    loadPendingUpdate: () => void
    clearPendingUpdate: () => void
}

// Keep track of the pending update object
let pendingUpdate: any = null;

export const useHotspotStore = create<HotspotState>((set, get) => ({
    // ... existing initial state ...
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
    isSettingsOpen: false,

    setCredentials: (credentials) => set({ credentials }),
    setSettings: (settings) => set({ settings }),
    setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
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

                    // Trigger silent update check after successful connection
                    get().checkForUpdates(true, true)
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
            // STEP 1: REAL-TIME DOWNLOAD TEST (Cloudflare ~10MB to give time for ramp-up)
            // Using a larger file to allow speed to stabilize
            const downloadUrl = 'https://speed.cloudflare.com/__down?bytes=10000000';
            const dStart = Date.now();
            let loadedBytes = 0;

            const response = await fetch(downloadUrl);
            const reader = response.body?.getReader();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    loadedBytes += value.length;
                    const currentTime = Date.now();
                    const durationInSec = (currentTime - dStart) / 1000;

                    // Prevent division by zero and extremely high spikes at start
                    if (durationInSec > 0.1) {
                        const currentBps = (loadedBytes * 8) / durationInSec;
                        const currentMbps = currentBps / 1000000;

                        // Update UI seamlessly
                        set((state) => ({
                            speedTestResult: {
                                ...state.speedTestResult,
                                download: parseFloat(currentMbps.toFixed(2))
                            }
                        }));
                    }
                }
            }

            // Final Download Fixup
            const dEnd = Date.now();
            const dSec = (dEnd - dStart) / 1000;
            const finalDMbps = (loadedBytes * 8) / (dSec * 1000000);
            set((state) => ({
                speedTestResult: { ...state.speedTestResult, download: parseFloat(finalDMbps.toFixed(2)) }
            }));


            // STEP 2: REAL-TIME UPLOAD TEST (XHR for Progress Events)
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const uStart = Date.now();
                // 2MB random payload
                const uPayload = new Uint8Array(2 * 1024 * 1024);

                // Use httpbin.org as it handles raw POSTs reliably for testing
                xhr.open('POST', 'https://httpbin.org/post', true);

                let lastLoaded = 0;
                let lastTime = uStart;

                xhr.upload.onprogress = (event) => {
                    const currentTime = Date.now();
                    const durationInSec = (currentTime - uStart) / 1000;

                    // Calculate "average speed from start" for stability
                    if (event.lengthComputable && durationInSec > 0.05) {
                        const currentBps = (event.loaded * 8) / durationInSec;
                        const currentMbps = currentBps / 1000000;

                        set((state) => ({
                            speedTestResult: {
                                ...state.speedTestResult,
                                upload: parseFloat(currentMbps.toFixed(2))
                            }
                        }));
                    }
                };

                // The upload is actually finished when validation logic (onload on upload) fires 
                // OR we can just use the last progress if it was 100%
                // BUT xhr.onload fires after the RESPONSE is received (which includes download time).
                // We want to capture the time when UPLOAD finished.
                xhr.upload.onloadend = () => {
                    const endDuration = (Date.now() - uStart) / 1000;
                    if (endDuration > 0) {
                        const finalMbps = (uPayload.length * 8) / (endDuration * 1000000);
                        set((state) => ({
                            speedTestResult: {
                                ...state.speedTestResult,
                                upload: parseFloat(finalMbps.toFixed(2))
                            }
                        }));
                    }
                    resolve();
                };

                xhr.onerror = (e) => {
                    console.error('XHR Upload Error', e);
                    reject(new Error('Upload test failed'));
                };

                // We don't need to wait for the full response body for the speed test result
                // But we generally keep the request open. 
                // resolving in upload.onloadend is safer format speed measurement perspective.

                xhr.send(uPayload);
            });

            set((state) => ({
                speedTestResult: {
                    ...state.speedTestResult,
                    isTesting: false,
                    lastRun: Date.now()
                }
            }));

        } catch (e) {
            console.error('Speed test failed', e)
            set({ speedTestResult: { download: 0, upload: 0, isTesting: false } })
        }
    },

    checkForUpdates: async (silent = false, isAutoCheck = false) => {
        const { updateInfo } = get();

        // MUTEX: Prevent concurrent checks
        if (updateInfo.checkInProgress) {
            console.log('Update check already in progress, skipping');
            return;
        }

        // RATE LIMITING: Minimum 30 seconds between checks
        const now = Date.now();
        if (updateInfo.lastCheckTime && (now - updateInfo.lastCheckTime) < 30000) {
            console.log('Rate limited: too soon since last check');
            if (!silent) {
                // UX Improvement: Show fake loading state so user knows button worked
                set((state) => ({ updateInfo: { ...state.updateInfo, checkInProgress: true } }));
                setTimeout(() => {
                    set((state) => ({
                        updateInfo: {
                            ...state.updateInfo,
                            checkInProgress: false,
                            // Restore 'available' if it was there, otherwise 'idle' (or 'up-to-date')
                            status: state.updateInfo.status === 'available' ? 'available' : 'idle'
                        }
                    }));
                }, 800);
            }
            return;
        }

        // Skip if already pending restart
        if (updateInfo.restartPending) {
            console.log('Update already downloaded, awaiting restart');
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
            const { invoke } = await import('@tauri-apps/api/core');

            const GITHUB_TOKEN = await invoke<string>('get_github_token');

            const update = await check({
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/octet-stream'
                }
            });

            if (update) {
                const { updateInfo, installUpdate } = get();

                // Zaten güncelleme sürecindeysek veya restart bekliyorsak tekrar işlem yapma
                if (updateInfo.isUpdating || updateInfo.restartPending) {
                    set((state) => ({ updateInfo: { ...state.updateInfo, checkInProgress: false } }));
                    return;
                }
                // Safety check: ensure version exists
                if (!update.version) {
                    console.error('Update object found but missing version', update);
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

                // Eger otomatik kontrol ise (internet baglandiginda), KULLANICIYA SORMADAN indir
                if (isAutoCheck) {
                    console.log('Otomatik güncelleme bulundu, sessizce indiriliyor...');
                    installUpdate();
                } else {
                    // PERSISTENCE: Save release notes
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
                            showModal: false, // Inline UI handles this
                            checkInProgress: false
                        }
                    });
                }
            } else {
                if (!silent) {
                    set((state) => ({
                        updateInfo: {
                            ...state.updateInfo,
                            status: 'up-to-date',
                            showModal: false,
                            checkInProgress: false
                        }
                    }));
                    // Timeout removed to keep "System Up to Date" badge visible
                } else {
                    set((state) => ({ updateInfo: { ...state.updateInfo, checkInProgress: false } }));
                }
            }
        } catch (e) {
            console.error('Updater check failed', e);
            set((state) => ({
                updateInfo: {
                    ...state.updateInfo,
                    status: silent ? state.updateInfo.status : 'idle',
                    checkInProgress: false
                }
            }));
        }
    },

    installUpdate: async () => {
        const { updateInfo } = get();
        if (updateInfo.isUpdating) return;

        // UI'da indirme barı göstermek isteyip istemediğimize karar verelim.
        // Silent modda bile "İndiriliyor..." yazısı köşede şık durabilir.
        // Ama modal açmasın.
        set((state) => ({
            updateInfo: {
                ...state.updateInfo,
                isUpdating: true,
                downloadProgress: 0,
                // Silent ise modal açma, değilse belki aç (ama gerek yok, buton loading dönecek)
            }
        }));

        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const { invoke } = await import('@tauri-apps/api/core');

            let update = pendingUpdate; // Check'ten geleni kullanmaya calis

            // Eger pending yoksa tekrar check et (silent install icin gerekli olabilir)
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
                            console.log(`Download started: ${contentLength} bytes`);
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

                            // PERSISTENCE: Save to localStorage
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

                // Fallback
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
            // If update object is missing (e.g. after app restart), try to find it again
            if (!pendingUpdate) {
                console.log('Update object lost, re-checking...');
                const { check } = await import('@tauri-apps/plugin-updater');
                const { invoke } = await import('@tauri-apps/api/core');

                try {
                    const GITHUB_TOKEN = await invoke<string>('get_github_token');
                    const update = await check({
                        headers: {
                            'Authorization': `Bearer ${GITHUB_TOKEN}`,
                            'Accept': 'application/octet-stream'
                        }
                    });

                    if (update) {
                        pendingUpdate = update;
                        // If cached, download might be needed again to get the handle, but usually fast
                        // Ideally we should just verify signature but plugin logic requires download call to prep install?
                        // Let's assume install() handles it or re-download is fast.
                        await update.downloadAndInstall();
                        return; // install() should handle restart/exit
                    }
                } catch (err) {
                    console.error('Failed to re-acquire update object', err);
                }
            }

            if (pendingUpdate) {
                await pendingUpdate.install();
                return;
            }

            // Fallback
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

                // Simple version comparison helper
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

                // Only treat as pending if pendingVersion > currentVersion
                if (compareVersions(pendingVersion, currentVersion) > 0) {
                    const persistedNotes = localStorage.getItem('hotspot_release_notes');
                    set((state) => ({
                        updateInfo: {
                            ...state.updateInfo,
                            updateAvailable: true,
                            version: pendingVersion,
                            status: 'available',
                            releaseNotes: persistedNotes || state.updateInfo.releaseNotes, // Restore notes if available
                            downloadUrl: 'https://github.com/gunwiggle/hotspot/releases/latest' // Restore URL assumption
                        },
                        restartPending: true
                    }));
                } else {
                    localStorage.removeItem('hotspot_pending_update');
                    localStorage.removeItem('hotspot_release_notes'); // Clean up notes too
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
        set((state) => ({
            updateInfo: {
                ...state.updateInfo,
                updateAvailable: false,
                status: 'idle',
                pendingUpdateVersion: null,
                restartPending: false
            }
        }));
    }
}))
