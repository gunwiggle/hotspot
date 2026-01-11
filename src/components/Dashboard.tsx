import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Loader2, Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useHotspotStore, type ConnectionStatus } from '@/store/hotspot'
import { getVersion } from '@tauri-apps/api/app'
import { LoginCard } from './dashboard/LoginCard'
import { StatusCard } from './dashboard/StatusCard'
import { SettingsCard } from './dashboard/SettingsCard'

const StatusBadge = ({ status, isChecking }: { status: ConnectionStatus, isChecking: boolean }) => {
    if (isChecking) {
        return (
            <Badge variant="secondary" className="gap-1 animate-pulse bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                <Loader2 className="h-3 w-3 animate-spin" />
                Kontrol Ediliyor...
            </Badge>
        )
    }

    const variants: Record<ConnectionStatus, { variant: "success" | "destructive" | "warning" | "secondary"; label: string }> = {
        connected: { variant: 'success', label: 'Bağlı' },
        disconnected: { variant: 'destructive', label: 'Bağlı Değil' },
        connecting: { variant: 'warning', label: 'Bağlanıyor...' },
        error: { variant: 'destructive', label: 'Hata' },
    }

    const { variant, label } = variants[status]

    return (
        <Badge variant={variant} className="gap-1">
            {status === 'connected' && <Wifi className="h-3 w-3" />}
            {status === 'disconnected' && <WifiOff className="h-3 w-3" />}
            {status === 'connecting' && <Loader2 className="h-3 w-3 animate-spin" />}
            {status === 'error' && <WifiOff className="h-3 w-3" />}
            {label}
        </Badge>
    )
}

const StatusIndicator = ({ status, isChecking }: { status: ConnectionStatus, isChecking: boolean }) => {
    if (isChecking) {
        return (
            <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse shadow-lg shadow-current/50" />
                <StatusBadge status={status} isChecking={isChecking} />
            </div>
        )
    }

    const colors: Record<ConnectionStatus, string> = {
        connected: 'bg-green-500',
        disconnected: 'bg-red-500',
        connecting: 'bg-yellow-500 animate-pulse-slow',
        error: 'bg-red-500',
    }

    return (
        <div className="flex items-center gap-3">
            <div className={`h-4 w-4 rounded-full ${colors[status]} shadow-lg shadow-current/50`} />
            <StatusBadge status={status} isChecking={isChecking} />
        </div>
    )
}

export function Dashboard() {
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [appVersion, setAppVersion] = useState<string>('...')
    const hasCheckedRef = useRef(false)
    const {
        status,
        isChecking,
        loadCredentials,
        loadSettings,
        checkConnection,
        updateNetworkInfo,
        fetchPublicIp,
        performPingTest,
        performLogout,
        updateInfo,
        isSettingsOpen,
        setSettingsOpen
    } = useHotspotStore()

    useEffect(() => {
        loadCredentials()
        loadSettings()
        // Initial check is explicit (not silent) to show blue icon/status on startup
        if (!hasCheckedRef.current) {
            checkConnection(false)
            hasCheckedRef.current = true
        }

        const interval = setInterval(() => {
            // Periodic checks are silent to avoid UI flicker/noise
            checkConnection(true)
        }, 10000)

        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        // Network stats loop (every 2s)
        updateNetworkInfo()
        fetchPublicIp()
        const interval = setInterval(() => {
            updateNetworkInfo()
            if (status === 'connected') performPingTest()
        }, 2000)
        return () => clearInterval(interval)
    }, [status])

    useEffect(() => {
        // Listen for backend network status updates (sync with tray)
        import('@tauri-apps/api/event').then(({ listen }) => {
            const unlisten = listen('network-status-update', (event) => {
                const isConnected = event.payload as boolean
                useHotspotStore.getState().setStatus(isConnected ? 'connected' : 'disconnected')
            })
            return () => { unlisten.then(f => f()) }
        })
    }, [])

    useEffect(() => {
        getVersion().then(setAppVersion).catch(console.error)
    }, [])

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await performLogout()
        setIsLoggingOut(false)
    }

    if (isSettingsOpen) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="mx-auto max-w-2xl space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
                            <p className="text-muted-foreground">Uygulama tercihlerinizi yönetin</p>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => setSettingsOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <SettingsCard appVersion={appVersion} />

                    <Button variant="outline" className="w-full" onClick={() => setSettingsOpen(false)}>
                        Geri Dön
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Hotspot Manager</h1>
                        <p className="text-muted-foreground">Yurt interneti otomasyonu</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <StatusIndicator status={status} isChecking={isChecking} />
                        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Ayarlar">
                            <Settings className="h-4 w-4" />
                            {updateInfo.status === 'available' && !updateInfo.isUpdating && (
                                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <LoginCard onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                    <StatusCard />
                </div>
            </div>
        </div>
    )
}
