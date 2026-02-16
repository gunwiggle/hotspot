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

    return (
        <div className="card">
            <div className="card-header">
                <div className="card-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Giriş Bilgileri</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}>hotspot.maxxarena.de</div>
                </div>
            </div>

            <div className="card-body">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="input-group">
                        <label className="input-label">Kullanıcı Adı</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Kullanıcı adınız"
                            value={settings.privacyMode ? '••••••••' : credentials.username}
                            onChange={(e) => !settings.privacyMode && setCredentials({ ...credentials, username: e.target.value })}
                            disabled={settings.privacyMode}
                            autoComplete="username"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Şifre</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="input-field"
                                style={{ paddingRight: '48px' }}
                                placeholder="Şifreniz"
                                value={settings.privacyMode ? '••••••••' : credentials.password}
                                onChange={(e) => !settings.privacyMode && setCredentials({ ...credentials, password: e.target.value })}
                                disabled={settings.privacyMode}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                style={{
                                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'var(--color-muted-foreground)', cursor: 'pointer', padding: '4px'
                                }}
                                onClick={() => !settings.privacyMode && setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {errorMessage && (
                        <div style={{ fontSize: '13px', color: '#f87171', fontWeight: 500, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                            {errorMessage}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                        {status === 'connected' ? (
                            <button
                                type="button"
                                className="btn btn-danger"
                                style={{ flex: 1, height: '48px' }}
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
                                className="btn btn-primary"
                                style={{ flex: 1, height: '48px' }}
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
                            className={`btn btn-ghost btn-icon ${settings.autoReconnect ? 'btn-icon-active' : ''}`}
                            onClick={() => setSettings({ ...settings, autoReconnect: !settings.autoReconnect })}
                            title={settings.autoReconnect ? 'Otomatik Bağlanma: AÇIK' : 'Otomatik Bağlanma: KAPALI'}
                        >
                            <Zap size={18} style={settings.autoReconnect ? { fill: 'white' } : {}} />
                        </button>

                        <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => checkConnection(false)}
                            disabled={isChecking}
                            title="Bağlantı durumunu kontrol et"
                        >
                            <RefreshCw size={18} className={isChecking ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
