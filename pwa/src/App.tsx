import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Loader2, Settings, Check, X } from 'lucide-react'
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

function QuickConnect() {
    const [phase, setPhase] = useState<'connecting' | 'success' | 'error'>('connecting')
    const { init, performLogin, status } = useStore()
    const didRun = useRef(false)

    useEffect(() => {
        if (didRun.current) return
        didRun.current = true
        init()
        setTimeout(async () => {
            const store = useStore.getState()
            if (!store.credentials.username || !store.credentials.password) {
                setPhase('error')
                return
            }
            await store.performLogin()
            const result = useStore.getState().status
            setPhase(result === 'connected' ? 'success' : 'error')
        }, 300)
    }, [])

    return (
        <div className="safe-area" style={{
            minHeight: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '24px',
            paddingLeft: '40px', paddingRight: '40px', textAlign: 'center'
        }}>
            {phase === 'connecting' && (
                <>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
                        border: '1px solid rgba(59,130,246,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Loader2 size={32} color="#60a5fa" className="animate-spin" />
                    </div>
                    <div>
                        <p style={{ fontSize: '20px', fontWeight: 700 }}>Bağlanıyor...</p>
                        <p style={{ fontSize: '14px', color: 'var(--color-muted-foreground)', marginTop: '8px' }}>Hotspot'a giriş yapılıyor</p>
                    </div>
                </>
            )}

            {phase === 'success' && (
                <>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))',
                        border: '1px solid rgba(34,197,94,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 40px rgba(34,197,94,0.15)'
                    }}>
                        <Check size={36} color="#4ade80" strokeWidth={3} />
                    </div>
                    <div>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: '#4ade80' }}>Bağlantı Başarılı</p>
                        <p style={{ fontSize: '14px', color: 'var(--color-muted-foreground)', marginTop: '8px' }}>İnternete erişim sağlandı</p>
                    </div>
                </>
            )}

            {phase === 'error' && (
                <>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                        border: '1px solid rgba(239,68,68,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={36} color="#f87171" strokeWidth={3} />
                    </div>
                    <div>
                        <p style={{ fontSize: '20px', fontWeight: 700, color: '#f87171' }}>Bağlantı Başarısız</p>
                        <p style={{ fontSize: '14px', color: 'var(--color-muted-foreground)', marginTop: '8px' }}>
                            {!useStore.getState().credentials.username ? 'Kayıtlı giriş bilgisi yok' : 'Tekrar deneyin'}
                        </p>
                    </div>
                    <button
                        className="btn btn-primary"
                        style={{ height: '48px', paddingLeft: '32px', paddingRight: '32px' }}
                        onClick={() => {
                            setPhase('connecting')
                            setTimeout(async () => {
                                await useStore.getState().performLogin()
                                setPhase(useStore.getState().status === 'connected' ? 'success' : 'error')
                            }, 300)
                        }}
                    >
                        Tekrar Dene
                    </button>
                </>
            )}

            <a
                href="/hotspot/"
                style={{ fontSize: '13px', color: 'var(--color-muted-foreground)', marginTop: '16px', textDecoration: 'none' }}
            >
                Uygulamayı Aç →
            </a>
        </div>
    )
}

export function App() {
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const hasInitRef = useRef(false)
    const isAutoConnect = new URLSearchParams(window.location.search).has('auto')
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
        if (isAutoConnect || hasInitRef.current) return
        hasInitRef.current = true
        init()

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
        if (isAutoConnect) return
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

    if (isAutoConnect) return <QuickConnect />
    if (isSettingsOpen) return <SettingsCard />

    return (
        <div className="safe-area" style={{ minHeight: '100dvh', paddingLeft: '20px', paddingRight: '20px', paddingBottom: '40px' }}>
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
