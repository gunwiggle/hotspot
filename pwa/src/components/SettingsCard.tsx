import { Shield, ShieldOff, Zap, ZapOff, Power, PowerOff, X } from 'lucide-react'
import { useStore } from '@/store'

export function SettingsCard() {
    const { settings, setSettings, setSettingsOpen } = useStore()

    const toggles = [
        {
            label: 'Otomatik Yeniden Bağlanma',
            description: 'Bağlantı kesildiğinde otomatik olarak yeniden bağlan',
            value: settings.autoReconnect,
            onChange: () => setSettings({ ...settings, autoReconnect: !settings.autoReconnect }),
            iconOn: <Zap size={18} color="#4ade80" />,
            iconOff: <ZapOff size={18} color="#94a3b8" />,
        },
        {
            label: 'Açılışta Bağlan',
            description: 'Uygulama açıldığında otomatik olarak giriş yap',
            value: settings.connectOnStartup,
            onChange: () => setSettings({ ...settings, connectOnStartup: !settings.connectOnStartup }),
            iconOn: <Power size={18} color="#60a5fa" />,
            iconOff: <PowerOff size={18} color="#94a3b8" />,
        },
        {
            label: 'Gizlilik Modu',
            description: 'Kullanıcı adı, şifre ve IP bilgilerini gizle',
            value: settings.privacyMode,
            onChange: () => setSettings({ ...settings, privacyMode: !settings.privacyMode }),
            iconOn: <Shield size={18} color="#c084fc" />,
            iconOff: <ShieldOff size={18} color="#94a3b8" />,
        },
    ]

    return (
        <div className="safe-area" style={{ minHeight: '100dvh', background: '#030712', padding: '20px', paddingBottom: '32px' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>Ayarlar</h1>
                        <p style={{ fontSize: '13px', color: 'var(--color-muted-foreground)', marginTop: '2px' }}>Uygulama tercihlerinizi yönetin</p>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => setSettingsOpen(false)}>
                        <X size={18} />
                    </button>
                </div>

                <div className="card" style={{ padding: '4px' }}>
                    {toggles.map((t, i) => (
                        <div key={i}>
                            <div className="toggle-row" onClick={t.onChange}>
                                <div className="toggle-icon">
                                    {t.value ? t.iconOn : t.iconOff}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{t.label}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-muted-foreground)', marginTop: '2px' }}>{t.description}</div>
                                </div>
                                <div className={`toggle-track ${t.value ? 'toggle-track-on' : 'toggle-track-off'}`}>
                                    <div className={`toggle-thumb ${t.value ? 'toggle-thumb-on' : 'toggle-thumb-off'}`} />
                                </div>
                            </div>
                            {i < toggles.length - 1 && <div className="divider" style={{ margin: '0 16px' }} />}
                        </div>
                    ))}
                </div>

                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>Hotspot Manager PWA</p>
                    <p style={{ fontSize: '13px', color: 'var(--color-muted-foreground)', marginTop: '4px', fontFamily: "'SF Mono', monospace" }}>v1.0.0</p>
                </div>

                <button
                    className="btn btn-ghost"
                    style={{ width: '100%', height: '48px', fontSize: '14px' }}
                    onClick={() => setSettingsOpen(false)}
                >
                    Geri Dön
                </button>
            </div>
        </div>
    )
}
