import { StateCreator } from 'zustand'
import { HotspotState } from '../types'

export interface SpeedSlice {
    speedTestResult: HotspotState['speedTestResult']
    runSpeedTest: HotspotState['runSpeedTest']
}

export const createSpeedSlice: StateCreator<HotspotState, [], [], SpeedSlice> = (set) => ({
    speedTestResult: { download: 0, upload: 0, isTesting: false, lastRun: null },

    runSpeedTest: async () => {
        set((state) => ({ speedTestResult: { ...state.speedTestResult, download: 0, upload: 0, isTesting: true } }))

        try {
            // STEP 1: REAL-TIME DOWNLOAD TEST
            const downloadUrl = 'https://speed.cloudflare.com/__down?bytes=10000000';
            const dStart = Date.now();
            let loadedBytes = 0;

            const response = await fetch(downloadUrl);
            const reader = response.body?.getReader();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    loadedBytes += value.length;
                    const currentTime = Date.now();
                    const durationInSec = (currentTime - dStart) / 1000;

                    if (durationInSec > 0.1) {
                        const currentBps = (loadedBytes * 8) / durationInSec;
                        const currentMbps = currentBps / 1000000;
                        set((state) => ({
                            speedTestResult: {
                                ...state.speedTestResult,
                                download: parseFloat(currentMbps.toFixed(2))
                            }
                        }));
                    }
                }
            }

            const dEnd = Date.now();
            const dSec = (dEnd - dStart) / 1000;
            const finalDMbps = (loadedBytes * 8) / (dSec * 1000000);
            set((state) => ({
                speedTestResult: { ...state.speedTestResult, download: parseFloat(finalDMbps.toFixed(2)) }
            }));


            // STEP 2: REAL-TIME UPLOAD TEST
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const uStart = Date.now();
                const uPayload = new Uint8Array(2 * 1024 * 1024);

                xhr.open('POST', 'https://httpbin.org/post', true);

                xhr.upload.onprogress = (event) => {
                    const currentTime = Date.now();
                    const durationInSec = (currentTime - uStart) / 1000;

                    if (event.lengthComputable && durationInSec > 0.05) {
                        const currentBps = (event.loaded * 8) / durationInSec;
                        const currentMbps = currentBps / 1000000;

                        set((state) => ({
                            speedTestResult: {
                                ...state.speedTestResult,
                                upload: parseFloat(currentMbps.toFixed(2))
                            }
                        }));
                    }
                };

                xhr.upload.onloadend = () => {
                    const endDuration = (Date.now() - uStart) / 1000;
                    if (endDuration > 0) {
                        const finalMbps = (uPayload.length * 8) / (endDuration * 1000000);
                        set((state) => ({
                            speedTestResult: {
                                ...state.speedTestResult,
                                upload: parseFloat(finalMbps.toFixed(2))
                            }
                        }));
                    }
                    resolve();
                };

                xhr.onerror = (e) => {
                    console.error('XHR Upload Error', e);
                    reject(new Error('Upload test failed'));
                };

                xhr.send(uPayload);
            });

            set((state) => ({ speedTestResult: { ...state.speedTestResult, isTesting: false, lastRun: Date.now() } }));

        } catch (e) {
            console.error('Speed test failed', e)
            set((state) => ({ speedTestResult: { ...state.speedTestResult, download: 0, upload: 0, isTesting: false } }))
        }
    }
})
