import { create } from 'zustand'
import { HotspotState } from './types'
import { createAuthSlice } from './slices/authSlice'
import { createNetworkSlice } from './slices/networkSlice'
import { createSpeedSlice } from './slices/speedSlice'
import { createUpdateSlice } from './slices/updateSlice'
import { createUISlice } from './slices/uiSlice'

export const useHotspotStore = create<HotspotState>()((...a) => ({
    ...createAuthSlice(...a),
    ...createNetworkSlice(...a),
    ...createSpeedSlice(...a),
    ...createUpdateSlice(...a),
    ...createUISlice(...a),
}))
