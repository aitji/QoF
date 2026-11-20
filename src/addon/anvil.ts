import {
    type PlayerInteractWithBlockBeforeEvent,
    type Direction,
    system, BlockPermutation
} from "@minecraft/server"
import { RUNTIME, cache, checkPerm, createThrottle, heldAfterDelay, isCreative, playSound, reduceItem, setEqu } from "../lib"
const { DEBUG, REPAIR_ANVIL: { ITEM_TYPEID, REPAIRABLE_ANVIL, REPAIR_SOUND, REPAIR_HELD_DELAY } } = RUNTIME

// helper
const permCache = new Map<string, BlockPermutation | null>()
function getCache(typeId: string, direction: Direction): BlockPermutation | null {
    const key = `${typeId}:${direction}`
    const cached = permCache.get(key)
    if (cached !== undefined) return cached

    let perm: BlockPermutation | null = null
    try { perm = BlockPermutation.resolve(typeId).withState('minecraft:cardinal_direction', direction) }
    catch (e) { if (DEBUG) console.warn('[ANVIL] failed to resolve permutation for', typeId, e) }

    permCache.set(key, perm)
    return perm
}

const throttled = createThrottle(REPAIR_HELD_DELAY)
export const anvil_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, itemStack, isFirstEvent, block } = data
    if (itemStack?.typeId !== ITEM_TYPEID || player.isSneaking) return

    if (!isFirstEvent) data.cancel = true
    if (throttled(player.id, isFirstEvent)) return
    if (!checkPerm(player)) return

    const currType = block.typeId
    const nextType = REPAIRABLE_ANVIL[currType]
    if (!nextType) return

    data.cancel = true

    const state = block.permutation.getState('minecraft:cardinal_direction') as Direction
    if (!state) return

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        const anvilPerm = getCache(nextType, state)
        if (!anvilPerm) return

        const feedback = () => {
            block.setPermutation(anvilPerm)

            const center = block.center()
            const dim = player.dimension

            playSound(dim, center, REPAIR_SOUND)
            dim.spawnParticle("minecraft:wind_explosion_emitter", center)
        }

        if (isCreative(player)) return feedback()

        const currItem = heldAfterDelay(player, slot)
        if (currItem?.typeId !== itemStack.typeId) {
            const removed = player.runCommand(`clear @s ${ITEM_TYPEID} 0 1`).successCount
            if (removed) return feedback()
            return
        }

        if (setEqu(player, reduceItem(itemStack))) feedback()
    })
}
