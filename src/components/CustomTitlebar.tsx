import { useState, useEffect, useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, X, Zap, RotateCw, Shield } from 'lucide-react'
import { useHotspotStore } from '@/store/hotspot'

export function CustomTitlebar() {
    const appWindow = getCurrentWindow()
    const { updateInfo, restartApp, settings } = useHotspotStore()
    const [minimizeHover, setMinimizeHover] = useState(false)
    const [closeHover, setCloseHover] = useState(false)

    const resetHover = useCallback(() => {
        setMinimizeHover(false)
        setCloseHover(false)
    }, [])

    useEffect(() => {
        const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
            if (focused) resetHover()
        })
        return () => { unlisten.then(f => f()) }
    }, [])

    const minimize = () => {
        resetHover()
        appWindow.minimize()
    }

    const close = () => {
        resetHover()
        appWindow.close()
    }

    const buttonBase = "h-full w-12 flex items-center justify-center transition-colors focus:outline-none cursor-default"

    return (
        <div className="h-10 bg-background border-b flex select-none shrink-0 overflow-hidden">
            <div
                data-tauri-drag-region
                className="flex-1 flex items-center px-4 gap-2 cursor-default"
            >
                <div className="flex items-center gap-2 pointer-events-none">
                    <div className="bg-primary/20 p-1 rounded">
                        <Zap className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">Hotspot Manager</span>
                </div>

                {settings.privacyMode && (
                    <div className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-full flex items-center gap-1 pointer-events-none">
                        <Shield className="h-3 w-3" />
                        Gizlilik Modu
                    </div>
                )}

                {updateInfo.restartPending && (
                    <button
                        onClick={restartApp}
                        className="ml-auto mr-2 px-3 py-1 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-1.5 transition-colors pointer-events-auto animate-pulse"
                        type="button"
                    >
                        <RotateCw className="h-3 w-3" />
                        Yeniden Başlat
                    </button>
                )}

                {updateInfo.isUpdating && !updateInfo.restartPending && (
                    <div className="ml-auto mr-2 px-3 py-1 text-xs font-medium bg-blue-600/20 text-blue-400 rounded-md flex items-center gap-1.5 pointer-events-none">
                        <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                        Güncelleme İndiriliyor... {updateInfo.downloadProgress}%
                    </div>
                )}
            </div>

            <div className="flex items-center shrink-0 bg-background z-50">
                <button
                    onClick={minimize}
                    onMouseEnter={() => setMinimizeHover(true)}
                    onMouseLeave={() => setMinimizeHover(false)}
                    className={`${buttonBase} ${minimizeHover ? "bg-white/10 text-foreground" : "text-foreground/70"}`}
                    type="button"
                >
                    <Minus className="h-4 w-4 pointer-events-none" />
                </button>
                <button
                    onClick={close}
                    onMouseEnter={() => setCloseHover(true)}
                    onMouseLeave={() => setCloseHover(false)}
                    className={`${buttonBase} ${closeHover ? "bg-red-500 text-white" : "text-foreground/70"}`}
                    type="button"
                >
                    <X className="h-4 w-4 pointer-events-none" />
                </button>
            </div>
        </div>
    )
}
