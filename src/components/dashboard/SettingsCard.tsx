import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useHotspotStore } from '@/store/hotspot'



interface SettingsCardProps {
    appVersion: string
}

export function SettingsCard({ appVersion }: SettingsCardProps) {
    const {
        settings,
        setSettings,
        saveSettings,
        updateInfo,
        checkForUpdates,
        installUpdate,
        restartApp,
        autoStartEnabled,
        toggleAutoStart,
        userManuallyDisabledHotspot
    } = useHotspotStore()

    const handleSettingsChange = async (key: keyof typeof settings, value: boolean) => {
        setSettings({ ...settings, [key]: value })
        setTimeout(() => saveSettings(), 100)
    }

    const handleAutoStartChange = async (checked: boolean) => {
        try {
            await toggleAutoStart(checked)
        } catch (error) {
            alert(`Başlangıç ayarı değiştirilemedi: ${error}`)
        }
    }

    const handleStartMinimizedChange = async (checked: boolean) => {
        handleSettingsChange('startInTray', checked)
    }

    return (
        <div className="space-y-6">
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
                            checked={autoStartEnabled}
                            onCheckedChange={handleAutoStartChange}
                        />
                    </div>

                    <div className="flex items-center justify-between opacity-transition transition-opacity duration-200" style={{ opacity: autoStartEnabled ? 1 : 0.5, pointerEvents: autoStartEnabled ? 'auto' : 'none' }}>
                        <div className="space-y-0.5">
                            <Label>Sistem Tepsisinde Başlat</Label>
                            <p className="text-sm text-muted-foreground">
                                Windows ile başladığında pencereyi gizle
                            </p>
                        </div>
                        <Switch
                            checked={settings.startInTray}
                            onCheckedChange={handleStartMinimizedChange}
                            disabled={!autoStartEnabled}
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
                </CardContent>
            </Card>

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Mobil Etkin Nokta</CardTitle>
                    <CardDescription>Mobil etkin nokta davranış ayarları</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className={userManuallyDisabledHotspot ? "text-muted-foreground" : ""}>Daima Açık Tut</Label>
                            <p className={`text-sm ${userManuallyDisabledHotspot ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
                                {userManuallyDisabledHotspot
                                    ? "Etkin nokta elle kapatıldığı için otomatik açma devre dışı bırakıldı."
                                    : "Bilgisayar açıldığında etkin noktayı otomatik başlatır ve kapanırsa tekrar açar"
                                }
                            </p>
                        </div>
                        <Switch
                            checked={settings.keepHotspotOn}
                            onCheckedChange={(checked) => handleSettingsChange('keepHotspotOn', checked)}
                            disabled={userManuallyDisabledHotspot}
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
                    <CardTitle className="flex items-center gap-2">
                        Uygulama Hakkında
                        {updateInfo.status === 'available' && !updateInfo.isUpdating && (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-xs">
                                Güncelleme Mevcut
                            </Badge>
                        )}
                    </CardTitle>
                    <CardDescription>Versiyon ve güncellemeler</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className={updateInfo.status === 'up-to-date' ? "text-green-600 font-bold" : ""}>
                                Sürüm v{appVersion}
                                {updateInfo.status === 'up-to-date' && (
                                    <span className="ml-2 inline-flex items-center text-xs font-normal text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Sistem Güncel
                                    </span>
                                )}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                {updateInfo.lastCheckTime
                                    ? `Son kontrol: ${new Date(updateInfo.lastCheckTime).toLocaleTimeString()}`
                                    : 'Henüz kontrol edilmedi'}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkForUpdates()}
                            disabled={updateInfo.status === 'checking' || updateInfo.isUpdating || updateInfo.restartPending}
                        >
                            {updateInfo.status === 'checking' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            <span className="ml-2">{updateInfo.status === 'checking' ? 'Kontrol Ediliyor...' : 'Kontrol Et'}</span>
                        </Button>
                    </div>

                    {(updateInfo.status === 'available' || updateInfo.isUpdating || updateInfo.restartPending) && (
                        <div className="rounded-md bg-blue-500/10 p-4 space-y-3 border border-blue-500/20">
                            {!updateInfo.isUpdating && !updateInfo.restartPending && (
                                <>
                                    <div className="text-sm font-medium text-blue-500">Yenilikler:</div>
                                    <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto scrollbar-hide">
                                        {updateInfo.releaseNotes || 'Sürüm notu bulunamadı.'}
                                    </div>
                                </>
                            )}

                            {updateInfo.isUpdating ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        <span>{updateInfo.downloadProgress >= 100 ? 'Kuruluyor...' : 'İndiriliyor...'}</span>
                                        <span>%{updateInfo.downloadProgress}</span>
                                    </div>
                                    <div className="h-2 w-full bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
                                            style={{ width: `${updateInfo.downloadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : updateInfo.restartPending ? (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm text-center text-blue-600 font-medium">
                                        Güncelleme hazır! Değişikliklerin uygulanması için yeniden başlatılması gerekiyor.
                                    </p>
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                                        size="sm"
                                        onClick={() => restartApp()}
                                    >
                                        Şimdi Yeniden Başlat
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                    size="sm"
                                    onClick={() => installUpdate()}
                                >
                                    Şimdi Güncelle
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
