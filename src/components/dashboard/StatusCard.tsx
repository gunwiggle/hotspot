import { Loader2, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useHotspotStore } from '@/store/hotspot'

export function StatusCard() {
    const {
        status,
        logs,
        ping,
        ipInfo,
        networkStats,
        settings,
        lastLogin,
        speedTestResult,
        runSpeedTest
    } = useHotspotStore()

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
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
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-tight">İndirme</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-mono font-bold tracking-tight">
                                    {speedTestResult.download > 0 ? speedTestResult.download : '0.00'}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">Mbps</span>
                            </div>
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Yükleme</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-mono font-bold tracking-tight">
                                        {speedTestResult.upload > 0 ? speedTestResult.upload : '0.00'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-medium">Mbps</span>
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
                </div>
            </CardContent>
        </Card>
    )
}
