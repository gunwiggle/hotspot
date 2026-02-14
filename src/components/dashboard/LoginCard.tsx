import { useState } from 'react'
import { Eye, EyeOff, LogOut, Loader2, RefreshCw, Zap, Settings, Power, RadioTower } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useHotspotStore } from '@/store/hotspot'

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
        saveCredentials,
        checkConnection,
        setSettings,
        saveSettings,
        hotspotEnabled,
        isTogglingHotspot,
        toggleHotspot
    } = useHotspotStore()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await saveCredentials()
        await performLogin()
    }

    const handleCheckConnection = async () => {
        await checkConnection(false)
    }

    const handleAutoReconnectToggle = async () => {
        const newValue = !settings.autoReconnect;
        setSettings({ ...settings, autoReconnect: newValue });
        setTimeout(() => saveSettings(), 100);
    }

    const handleConnectOnStartupToggle = async () => {
        const newValue = !settings.connectOnStartup;
        setSettings({ ...settings, connectOnStartup: newValue });
        setTimeout(() => saveSettings(), 100);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Giriş Bilgileri
                </CardTitle>
                <CardDescription>
                    hotspot.maxxarena.de için kimlik bilgileriniz
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Kullanıcı Adı</Label>
                        <Input
                            id="username"
                            type="text"
                            placeholder="Kullanıcı adınız"
                            value={settings.privacyMode ? '************' : credentials.username}
                            onChange={(e) => !settings.privacyMode && setCredentials({ ...credentials, username: e.target.value })}
                            disabled={settings.privacyMode}
                            autoComplete="username"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Şifre</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Şifreniz"
                                value={settings.privacyMode ? '************' : credentials.password}
                                onChange={(e) => !settings.privacyMode && setCredentials({ ...credentials, password: e.target.value })}
                                disabled={settings.privacyMode}
                                autoComplete="current-password"
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full w-10 px-3"
                                onClick={() => !settings.privacyMode && setShowPassword(!showPassword)}
                                disabled={settings.privacyMode}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {errorMessage && (
                        <p className="text-sm text-destructive">{errorMessage}</p>
                    )}

                    <div className="flex gap-2">
                        {status === 'connected' ? (
                            <Button
                                type="button"
                                variant="destructive"
                                className="flex-1"
                                onClick={onLogout}
                                disabled={isLoggingOut}
                            >
                                {isLoggingOut ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Bağlantı Kesiliyor...
                                    </>
                                ) : (
                                    <>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Bağlantıyı Kes
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                disabled={status === 'connecting'}
                            >
                                {status === 'connecting' ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Bağlanıyor...
                                    </>
                                ) : (
                                    'Bağlan'
                                )}
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => toggleHotspot()}
                            disabled={isTogglingHotspot}
                            className={hotspotEnabled ? "bg-green-600 hover:bg-green-700 hover:text-white border-green-600" : "text-muted-foreground"}
                            title={hotspotEnabled ? "Mobil Etkin Nokta: AÇIK" : "Mobil Etkin Nokta: KAPALI"}
                        >
                            {isTogglingHotspot ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RadioTower className={`h-4 w-4 ${hotspotEnabled ? "text-white" : ""}`} />
                            )}
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleAutoReconnectToggle}
                            className={settings.autoReconnect ? "bg-green-600 hover:bg-green-700 hover:text-white border-green-600" : "text-muted-foreground"}
                            title={settings.autoReconnect ? "Otomatik Bağlanma: AÇIK" : "Otomatik Bağlanma: KAPALI"}
                        >
                            <Zap className={`h-4 w-4 ${settings.autoReconnect ? "fill-white text-white" : ""}`} />
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleConnectOnStartupToggle}
                            className={settings.connectOnStartup ? "bg-blue-600 hover:bg-blue-700 hover:text-white border-blue-600" : "text-muted-foreground"}
                            title={settings.connectOnStartup ? "Açılışta Bağlan: AÇIK" : "Açılışta Bağlan: KAPALI"}
                        >
                            <Power className={`h-4 w-4 ${settings.connectOnStartup ? "text-white" : ""}`} />
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleCheckConnection}
                            disabled={isChecking}
                            title="Bağlantı durumunu kontrol et"
                        >
                            <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
