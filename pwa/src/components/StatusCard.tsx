import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useStore } from '@/store'

export function StatusCard() {
    const { status, logs, ping, publicIp, settings, lastLogin } = useStore()

    return (
        <div className="card">
            <div className="card-header">
                <div className="card-icon" style={{
                    background: status === 'connected' ? 'rgba(34, 197, 94, 0.12)' : status === 'connecting' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${status === 'connected' ? 'rgba(34, 197, 94, 0.15)' : status === 'connecting' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`
                }}>
                    {status === 'connected' ? <Wifi size={16} color="#4ade80" />
                        : status === 'connecting' ? <Loader2 size={16} color="#facc15" className="animate-spin" />
                            : <WifiOff size={16} color="#f87171" />}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Durum</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>Bağlantı durumu ve geçmişi</div>
                </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {lastLogin && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: 'var(--color-muted-foreground)' }}>Son Giriş</span>
                        <span style={{ fontFamily: "'SF Mono', monospace", fontSize: '11px' }}>
                            {new Date(lastLogin).toLocaleString('tr-TR')}
                        </span>
                    </div>
                )}

                <div className="log-area">
                    {logs.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--color-muted-foreground)', fontStyle: 'italic' }}>Henüz log yok</p>
                    ) : (
                        logs.map((log, i) => (
                            <p key={i} style={{
                                fontSize: '11px',
                                color: 'var(--color-muted-foreground)',
                                fontFamily: "'SF Mono', 'Menlo', monospace",
                                lineHeight: '20px'
                            }}>{log}</p>
                        ))
                    )}
                </div>

                <div className="divider" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="stat-block">
                        <span className="stat-label">Ping</span>
                        <div className="stat-value">
                            <span className="stat-dot" style={{
                                background: ping ? (ping < 100 ? '#22c55e' : '#eab308') : '#64748b',
                                boxShadow: ping ? (ping < 100 ? '0 0 6px rgba(34,197,94,0.4)' : '0 0 6px rgba(234,179,8,0.4)') : 'none'
                            }} />
                            <span>{ping ? `${ping}ms` : '—'}</span>
                        </div>
                    </div>

                    <div className="stat-block">
                        <span className="stat-label">IP Adresi</span>
                        <div className="stat-value" style={{ fontSize: '12px' }}>
                            {settings.privacyMode ? '•••.•••.•••.•••' : publicIp}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
