import { useState, useEffect, useRef } from 'react'
import { Wifi, WifiOff, Loader2, Eye, EyeOff, RefreshCw, Settings, LogOut, X, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useHotspotStore, type ConnectionStatus } from '@/store/hotspot'
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart'

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
    const [showPassword, setShowPassword] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [autoStart, setAutoStart] = useState(false)
    const hasCheckedRef = useRef(false)
    const {
        status,
        credentials,
        settings,
        lastLogin,
        errorMessage,
        logs,
        isChecking,
        ping,
        ipInfo,
        networkStats,
        setCredentials,
        setSettings,
        performLogin,
        performLogout,
        checkConnection,
        saveCredentials,
        loadCredentials,
        saveSettings,
        loadSettings,
        updateNetworkInfo,
        performPingTest,
        fetchPublicIp,
        speedTestResult,
        runSpeedTest,
        updateInfo,
        checkForUpdates
    } = useHotspotStore()

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

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
        // Check auto-start status on mount
        isEnabled().then(setAutoStart).catch(console.error)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await saveCredentials()
        await performLogin()
    }

    const handleLogout = async () => {
        setIsLoggingOut(true)
        await performLogout()
        setIsLoggingOut(false)
    }

    const handleCheckConnection = async () => {
        // Manual check is explicit
        await checkConnection(false)
    }

    const handleSettingsChange = async (key: keyof typeof settings, value: boolean) => {
        setSettings({ ...settings, [key]: value })
        setTimeout(() => saveSettings(), 100)
    }

    const handleAutoStartChange = async (checked: boolean) => {
        try {
            if (checked) {
                await enable()
            } else {
                await disable()
            }
            setAutoStart(checked)
        } catch (error) {
            console.error('Failed to change autostart settings:', error)
        }
    }

    if (showSettings) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="mx-auto max-w-2xl space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
                            <p className="text-muted-foreground">Uygulama tercihlerinizi yönetin</p>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => setShowSettings(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Genel</CardTitle>
                            <CardDescription>Uygulama davranış ayarları</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Windows ile Başlat</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Bilgisayar açıldığında uygulamayı otomatik çalıştır
                                    </p>
                                </div>
                                <Switch
                                    checked={autoStart}
                                    onCheckedChange={handleAutoStartChange}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Kapatma butonunda sistem tepsisine küçült</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Kapatma butonuna basıldığında uygulama kapanmak yerine sistem tepsisine gider
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.minimizeToTray}
                                    onCheckedChange={(checked) => handleSettingsChange('minimizeToTray', checked)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Otomatik Yeniden Bağlanma</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Bağlantı koptuğunda otomatik olarak tekrar bağlanmayı dener
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.autoReconnect}
                                    onCheckedChange={(checked) => handleSettingsChange('autoReconnect', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>Gizlilik & IP</CardTitle>
                            <CardDescription>Ağ gizlilik ayarları</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Gizlilik Modu</Label>
                                    <p className="text-sm text-muted-foreground">
                                        IP adresini ve kullanıcı adını gizle
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.privacyMode}
                                    onCheckedChange={(checked) => handleSettingsChange('privacyMode', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>Uygulama Hakkında</CardTitle>
                            <CardDescription>Versiyon ve güncellemeler</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Sürüm v0.2.0</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {updateInfo.status === 'up-to-date' ? 'En güncel sürümü kullanıyorsunuz' :
                                            updateInfo.status === 'available' ? `Yeni sürüm mevcut: v${updateInfo.latestVersion}` :
                                                'Güncellemeleri kontrol edin'}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => checkForUpdates()}
                                    disabled={updateInfo.status === 'checking'}
                                >
                                    {updateInfo.status === 'checking' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                    <span className="ml-2">Kontrol Et</span>
                                </Button>
                            </div>

                            {updateInfo.status === 'available' && (
                                <div className="rounded-md bg-blue-500/10 p-4 space-y-3">
                                    <div className="text-sm font-medium text-blue-500">Yenilikler:</div>
                                    <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                                        {updateInfo.releaseNotes || 'Sürüm notu bulunamadı.'}
                                    </div>
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                        size="sm"
                                        onClick={() => window.open(updateInfo.downloadUrl!, '_blank')}
                                    >
                                        GitHub'dan İndir
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button variant="outline" className="w-full" onClick={() => setShowSettings(false)}>
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
                        <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="Ayarlar">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
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
                                        value={settings.privacyMode ? (credentials.username ? '***' : '') : credentials.username}
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
                                            value={credentials.password}
                                            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                            autoComplete="current-password"
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-full w-10 px-3"
                                            onClick={() => setShowPassword(!showPassword)}
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
                                            onClick={handleLogout}
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
                                        onClick={() => handleSettingsChange('autoReconnect', !settings.autoReconnect)}
                                        className={settings.autoReconnect ? "bg-green-600 hover:bg-green-700 hover:text-white border-green-600" : "text-muted-foreground"}
                                        title={settings.autoReconnect ? "Otomatik Bağlanma: AÇIK" : "Otomatik Bağlanma: KAPALI"}
                                    >
                                        <Zap className={`h-4 w-4 ${settings.autoReconnect ? "fill-white text-white" : ""}`} />
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Durum</CardTitle>
                            <CardDescription>Bağlantı durumu ve geçmişi</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                {lastLogin && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Son Giriş</span>
                                        <span>{new Date(lastLogin).toLocaleString('tr-TR')}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Günlük</Label>
                                <div className="h-32 overflow-y-auto rounded-md border bg-muted/50 p-2 text-xs font-mono scrollbar-hide">
                                    {logs.length === 0 ? (
                                        <p className="text-muted-foreground">Henüz log yok</p>
                                    ) : (
                                        logs.map((log, i) => (
                                            <p key={i} className="text-muted-foreground">{log}</p>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs border-t pt-4">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Ağ Gecikmesi (Ping)</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${ping ? (ping < 100 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-gray-500'}`} />
                                        <span className="font-mono">{ping ? `${ping}ms` : '-'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Veri İndirme</p>
                                    <span className="font-mono">{formatBytes(networkStats.received)}</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">IP (Yerel)</p>
                                    <span className="font-mono">{settings.privacyMode ? '192.168.x.x' : ipInfo.local}</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">IP (Dış)</p>
                                    <span className="font-mono">{settings.privacyMode ? '***.***.***.***' : ipInfo.public}</span>
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <div className="flex items-end justify-between">
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-tight">İndirme</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-mono font-bold tracking-tight">
                                                    {speedTestResult.download > 0 ? speedTestResult.download : '0.00'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-medium">Mbps</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Yükleme</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-mono font-bold tracking-tight">
                                                    {speedTestResult.upload > 0 ? speedTestResult.upload : '0.00'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-medium">Mbps</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={runSpeedTest}
                                        disabled={speedTestResult.isTesting || status !== 'connected'}
                                        title="Hız Testi Başlat"
                                        className="h-10 px-4"
                                    >
                                        {speedTestResult.isTesting ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Zap className="h-4 w-4 mr-2 text-yellow-500 fill-yellow-500" />
                                        )}
                                        {speedTestResult.isTesting ? 'Test Ediliyor...' : 'Testi Başlat'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
