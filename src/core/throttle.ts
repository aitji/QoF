import { system } from "@minecraft/server"
import { RUNTIME } from "../_store"
const { BLOCK_INTERACTION_DELAY } = RUNTIME
const cooldowns: Map<string, number>[] = []

// caller
export const throttle_playerLeave = (id: string) => {
    for (const until of cooldowns) until.delete(id)
}

// other modules
export const createThrottle = (ticks: number = BLOCK_INTERACTION_DELAY) => {
    const until = new Map<string, number>()
    cooldowns.push(until)

    return (playerId: string, isFirstEvent = false): boolean => {
        const now = system.currentTick
        if (!isFirstEvent && (until.get(playerId) ?? 0) > now) return true

        until.set(playerId, now + ticks)
        return false
    }
}
