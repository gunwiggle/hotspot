import { Wifi, WifiOff, Loader2, Zap } from 'lucide-react'
import { useStore } from '@/store'

export function StatusCard() {
    const { status, logs, ping, publicIp, settings, lastLogin } = useStore()

    return (
        <div className="glass-strong p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === 'connected'
                        ? 'bg-green-500/20'
                        : status === 'connecting'
                            ? 'bg-yellow-500/20'
                            : 'bg-red-500/20'
                    }`}>
                    {status === 'connected' ? <Wifi size={16} className="text-green-400" />
                        : status === 'connecting' ? <Loader2 size={16} className="text-yellow-400 animate-spin" />
                            : <WifiOff size={16} className="text-red-400" />}
                </div>
                <div>
                    <h2 className="text-sm font-semibold">Durum</h2>
                    <p className="text-xs text-[var(--color-muted-foreground)]">Bağlantı durumu ve geçmişi</p>
                </div>
            </div>

            {lastLogin && (
                <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-muted-foreground)]">Son Giriş</span>
                    <span className="font-mono">{new Date(lastLogin).toLocaleString('tr-TR')}</span>
                </div>
            )}

            <div className="bg-black/30 rounded-lg p-3 h-28 overflow-y-auto scroll-hide">
                {logs.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)]">Henüz log yok</p>
                ) : (
                    logs.map((log, i) => (
                        <p key={i} className="text-xs text-[var(--color-muted-foreground)] font-mono leading-5">{log}</p>
                    ))
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-t border-white/5 pt-4">
                <div className="space-y-1">
                    <p className="text-[var(--color-muted-foreground)] text-[10px] uppercase tracking-wider">Ping</p>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${ping ? (ping < 100 ? 'bg-green-500' : 'bg-yellow-500') : 'bg-gray-500'}`} />
                        <span className="font-mono font-semibold">{ping ? `${ping}ms` : '-'}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-[var(--color-muted-foreground)] text-[10px] uppercase tracking-wider">IP Adresi</p>
                    <span className="font-mono font-semibold text-xs">{settings.privacyMode ? '***.***.***.***' : publicIp}</span>
                </div>
            </div>
        </div>
    )
}
