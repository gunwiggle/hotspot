import { useState } from 'react'
import { Eye, EyeOff, LogOut, Loader2, RefreshCw, Zap } from 'lucide-react'
import { useStore } from '@/store'

interface LoginCardProps {
    onLogout: () => Promise<void>
    isLoggingOut: boolean
}

export function LoginCard({ onLogout, isLoggingOut }: LoginCardProps) {
    const [showPassword, setShowPassword] = useState(false)
    const {
        status,
        credentials,
        settings,
        errorMessage,
        isChecking,
        setCredentials,
        performLogin,
        checkConnection,
        setSettings,
    } = useStore()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await performLogin()
    }

    const handleAutoReconnectToggle = () => {
        setSettings({ ...settings, autoReconnect: !settings.autoReconnect })
    }

    const handleCheckConnection = () => {
        checkConnection(false)
    }

    return (
        <div className="glass-strong p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-sm font-semibold">Giriş Bilgileri</h2>
                    <p className="text-xs text-[var(--color-muted-foreground)]">hotspot.maxxarena.de</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Kullanıcı Adı</label>
                    <input
                        type="text"
                        className="glass-input"
                        placeholder="Kullanıcı adınız"
                        value={settings.privacyMode ? '************' : credentials.username}
                        onChange={(e) => !settings.privacyMode && setCredentials({ ...credentials, username: e.target.value })}
                        disabled={settings.privacyMode}
                        autoComplete="username"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Şifre</label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="glass-input pr-12"
                            placeholder="Şifreniz"
                            value={settings.privacyMode ? '************' : credentials.password}
                            onChange={(e) => !settings.privacyMode && setCredentials({ ...credentials, password: e.target.value })}
                            disabled={settings.privacyMode}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                            onClick={() => !settings.privacyMode && setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {errorMessage && (
                    <p className="text-sm text-red-400 font-medium">{errorMessage}</p>
                )}

                <div className="flex gap-2">
                    {status === 'connected' ? (
                        <button
                            type="button"
                            className="btn-red glass-button flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                            onClick={onLogout}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? (
                                <><Loader2 size={16} className="animate-spin" /> Kesiliyor...</>
                            ) : (
                                <><LogOut size={16} /> Bağlantıyı Kes</>
                            )}
                        </button>
                    ) : (
                        <button
                            type="submit"
                            className="btn-green flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                            disabled={status === 'connecting'}
                        >
                            {status === 'connecting' ? (
                                <><Loader2 size={16} className="animate-spin" /> Bağlanıyor...</>
                            ) : (
                                'Bağlan'
                            )}
                        </button>
                    )}

                    <button
                        type="button"
                        className={`btn-icon glass-button ${settings.autoReconnect ? 'btn-icon-active' : ''}`}
                        onClick={handleAutoReconnectToggle}
                        title={settings.autoReconnect ? 'Otomatik Bağlanma: AÇIK' : 'Otomatik Bağlanma: KAPALI'}
                    >
                        <Zap size={18} className={settings.autoReconnect ? 'fill-white' : ''} />
                    </button>

                    <button
                        type="button"
                        className="btn-icon glass-button"
                        onClick={handleCheckConnection}
                        disabled={isChecking}
                        title="Bağlantı durumunu kontrol et"
                    >
                        <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                    </button>
                </div>
            </form>
        </div>
    )
}
