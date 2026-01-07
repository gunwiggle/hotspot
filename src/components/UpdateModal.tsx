import { useEffect } from 'react'
import { X, Sparkles, ArrowDownToLine, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHotspotStore } from '@/store/hotspot'

export function UpdateModal() {
    const { updateInfo, skipVersion, dismissUpdateModal, setSettingsOpen } = useHotspotStore()

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && updateInfo.showModal) {
                dismissUpdateModal()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [updateInfo.showModal, dismissUpdateModal])

    if (!updateInfo.showModal || updateInfo.status !== 'available' || updateInfo.isUpdating) {
        return null
    }

    const handleSkip = () => {
        if (updateInfo.latestVersion) {
            skipVersion(updateInfo.latestVersion)
        }
    }

    const handleUpdate = () => {
        setSettingsOpen(true)
        dismissUpdateModal()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transform transition-all">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <ArrowDownToLine size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                Yeni Güncelleme Mevcut
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                Sürüm v{updateInfo.latestVersion} indirilebilir.
                            </p>
                        </div>
                        <button
                            onClick={dismissUpdateModal}
                            className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="mt-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                        <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Sparkles size={12} />
                            YENİLİKLER
                        </h4>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-line">
                            {updateInfo.releaseNotes || 'Performans iyileştirmeleri ve hata düzeltmeleri.'}
                        </p>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <Button
                            variant="outline"
                            onClick={handleSkip}
                            className="flex-1 gap-2"
                        >
                            <Clock size={16} />
                            Daha Sonra
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                        >
                            <ArrowDownToLine size={16} />
                            İncele ve Güncelle
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
