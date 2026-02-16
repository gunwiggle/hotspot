import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Loader2, Settings } from 'lucide-react'
import { useStore, type ConnectionStatus } from '@/store'
import { LoginCard } from '@/components/LoginCard'
import { StatusCard } from '@/components/StatusCard'
import { SettingsCard } from '@/components/SettingsCard'

function StatusDot({ status, isChecking }: { status: ConnectionStatus; isChecking: boolean }) {
    if (isChecking) {
        return <div className="status-dot bg-blue-500 animate-pulse" style={{ color: '#3b82f6' }} />
    }

    const cls: Record<ConnectionStatus, string> = {
        connected: 'status-dot-connected',
        disconnected: 'status-dot-disconnected',
        connecting: 'status-dot-connecting',
        error: 'status-dot-disconnected',
    }

    return <div className={`status-dot ${cls[status]}`} />
}

function StatusBadge({ status, isChecking }: { status: ConnectionStatus; isChecking: boolean }) {
    if (isChecking) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                <Loader2 size={12} className="animate-spin" />
                Kontrol...
            </span>
        )
    }

    const variants: Record<ConnectionStatus, { bg: string; text: string; label: string }> = {
        connected: { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Bağlı' },
        disconnected: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Bağlı Değil' },
        connecting: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'Bağlanıyor...' },
        error: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Hata' },
    }

    const v = variants[status]

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${v.bg} ${v.text}`}>
            {status === 'connected' && <Wifi size={12} />}
            {(status === 'disconnected' || status === 'error') && <WifiOff size={12} />}
            {status === 'connecting' && <Loader2 size={12} className="animate-spin" />}
            {v.label}
        </span>
    )
}

export function App() {
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const hasInitRef = useRef(false)
    const {
        status,
        isChecking,
        isSettingsOpen,
        setSettingsOpen,
        settings,
        init,
        checkConnection,
        refreshPing,
        performLogin,
        performLogout,
    } = useStore()

    useEffect(() => {
        if (!hasInitRef.current) {
            init()
            hasInitRef.current = true
        }

        const connInterval = setInterval(() => checkConnection(true), 10000)
        const pingInterval = setInterval(() => {
            if (useStore.getState().status === 'connected') refreshPing()
        }, 5000)

        return () => {
            clearInterval(connInterval)
            clearInterval(pingInterval)
        }
    }, [])

    useEffect(() => {
        if (settings.connectOnStartup && status === 'disconnected' && hasInitRef.current) {
            const timer = setTimeout(() => performLogin(), 1000)
            return () => clearTimeout(timer)
        }
    }, [settings.connectOnStartup])

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await performLogout()
        setIsLoggingOut(false)
    }

    if (isSettingsOpen) {
        return <SettingsCard />
    }

    return (
        <div className="safe-area min-h-[100dvh] bg-[var(--color-background)] p-5 pb-8">
            <div className="max-w-lg mx-auto space-y-5">
                <div className="flex items-center justify-between pt-2">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Hotspot Manager</h1>
                        <p className="text-xs text-[var(--color-muted-foreground)]">Yurt interneti otomasyonu</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <StatusDot status={status} isChecking={isChecking} />
                        <StatusBadge status={status} isChecking={isChecking} />
                        <button
                            className="btn-icon glass-button relative"
                            onClick={() => setSettingsOpen(true)}
                            title="Ayarlar"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <LoginCard onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                    <StatusCard />
                </div>
            </div>
        </div>
    )
}
