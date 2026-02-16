import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Loader2, Settings } from 'lucide-react'
import { useStore, type ConnectionStatus } from '@/store'
import { LoginCard } from '@/components/LoginCard'
import { StatusCard } from '@/components/StatusCard'
import { SettingsCard } from '@/components/SettingsCard'

function StatusDot({ status, isChecking }: { status: ConnectionStatus; isChecking: boolean }) {
    if (isChecking) return <div className="status-dot animate-pulse" style={{ background: '#3b82f6', boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
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
            <span className="badge badge-info">
                <Loader2 size={12} className="animate-spin" />
                Kontrol...
            </span>
        )
    }

    const map: Record<ConnectionStatus, { cls: string; label: string }> = {
        connected: { cls: 'badge-success', label: 'Bağlı' },
        disconnected: { cls: 'badge-danger', label: 'Bağlı Değil' },
        connecting: { cls: 'badge-warning', label: 'Bağlanıyor...' },
        error: { cls: 'badge-danger', label: 'Hata' },
    }

    const { cls, label } = map[status]

    return (
        <span className={`badge ${cls}`}>
            {status === 'connected' && <Wifi size={12} />}
            {(status === 'disconnected' || status === 'error') && <WifiOff size={12} />}
            {status === 'connecting' && <Loader2 size={12} className="animate-spin" />}
            {label}
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

    if (isSettingsOpen) return <SettingsCard />

    return (
        <div className="safe-area" style={{ minHeight: '100dvh', padding: '20px', paddingBottom: '40px' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', paddingBottom: '4px' }}>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>Hotspot Manager</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-muted-foreground)', marginTop: '2px' }}>Yurt interneti otomasyonu</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <StatusDot status={status} isChecking={isChecking} />
                        <StatusBadge status={status} isChecking={isChecking} />
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => setSettingsOpen(true)}
                            title="Ayarlar"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                <LoginCard onLogout={handleLogout} isLoggingOut={isLoggingOut} />
                <StatusCard />
            </div>
        </div>
    )
}
