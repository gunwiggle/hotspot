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
            iconOn: <Zap size={18} className="text-green-400" />,
            iconOff: <ZapOff size={18} className="text-[var(--color-muted-foreground)]" />,
        },
        {
            label: 'Açılışta Bağlan',
            description: 'Uygulama açıldığında otomatik olarak giriş yap',
            value: settings.connectOnStartup,
            onChange: () => setSettings({ ...settings, connectOnStartup: !settings.connectOnStartup }),
            iconOn: <Power size={18} className="text-blue-400" />,
            iconOff: <PowerOff size={18} className="text-[var(--color-muted-foreground)]" />,
        },
        {
            label: 'Gizlilik Modu',
            description: 'Kullanıcı adı, şifre ve IP bilgilerini gizle',
            value: settings.privacyMode,
            onChange: () => setSettings({ ...settings, privacyMode: !settings.privacyMode }),
            iconOn: <Shield size={18} className="text-purple-400" />,
            iconOff: <ShieldOff size={18} className="text-[var(--color-muted-foreground)]" />,
        },
    ]

    return (
        <div className="safe-area min-h-[100dvh] bg-[var(--color-background)] p-5">
            <div className="max-w-lg mx-auto space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Ayarlar</h1>
                        <p className="text-xs text-[var(--color-muted-foreground)]">Uygulama tercihlerinizi yönetin</p>
                    </div>
                    <button
                        className="btn-icon glass-button"
                        onClick={() => setSettingsOpen(false)}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="glass-strong p-1 space-y-0.5">
                    {toggles.map((t, i) => (
                        <button
                            key={i}
                            className="w-full flex items-center gap-3 p-4 rounded-xl active:bg-white/5 transition-colors"
                            onClick={t.onChange}
                        >
                            <div className="w-9 h-9 rounded-lg glass flex items-center justify-center shrink-0">
                                {t.value ? t.iconOn : t.iconOff}
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium">{t.label}</p>
                                <p className="text-xs text-[var(--color-muted-foreground)]">{t.description}</p>
                            </div>
                            <div className={`w-12 h-7 rounded-full p-0.5 transition-colors ${t.value ? 'bg-green-500' : 'bg-white/10'}`}>
                                <div className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${t.value ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </button>
                    ))}
                </div>

                <div className="glass p-4 text-center">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Hotspot Manager PWA</p>
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-1">v1.0.0</p>
                </div>

                <button
                    className="w-full h-11 glass-button rounded-xl text-sm font-medium"
                    onClick={() => setSettingsOpen(false)}
                >
                    Geri Dön
                </button>
            </div>
        </div>
    )
}
