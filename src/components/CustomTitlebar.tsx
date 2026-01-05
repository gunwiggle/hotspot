import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, X, Zap } from 'lucide-react'

export function CustomTitlebar() {
    const appWindow = getCurrentWindow()

    const minimize = () => appWindow.minimize()
    const close = () => appWindow.close()

    return (
        <div className="h-10 bg-background border-b flex select-none shrink-0 overflow-hidden">
            {/* 1. SOL TARAF: Tamamen Sürüklenebilir Alan (Butonlara kadar) */}
            {/* data-tauri-drag-region bu div'de olduğu için, sadece burası sürükler. */}
            <div
                data-tauri-drag-region
                className="flex-1 flex items-center px-4 gap-2 cursor-default"
            >
                {/* İçerik, tıklamaları engellememeli ama zaten drag region içinde olduğu için sorun yok */}
                <div className="flex items-center gap-2 pointer-events-none">
                    <div className="bg-primary/20 p-1 rounded">
                        <Zap className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">Hotspot Manager</span>
                </div>
            </div>

            {/* 2. SAĞ TARAF: Butonlar (Drag Region YOK) */}
            {/* Burası drag region'ın DIŞINDA olduğu için sürükleme tetiklemez, butonlar çalışır. */}
            <div className="flex items-center shrink-0 bg-background z-50">
                <button
                    onClick={minimize}
                    className="h-full w-12 flex items-center justify-center hover:bg-white/10 transition-colors text-foreground/70 hover:text-foreground focus:outline-none cursor-default"
                    type="button"
                >
                    <Minus className="h-4 w-4 pointer-events-none" />
                </button>
                <button
                    onClick={close}
                    className="h-full w-12 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-foreground/70 focus:outline-none cursor-default"
                    type="button"
                >
                    <X className="h-4 w-4 pointer-events-none" />
                </button>
            </div>
        </div>
    )
}
