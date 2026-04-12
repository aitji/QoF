import {
    BlockPermutation, Difficulty, EntityComponentTypes,
    GameMode, PlayerInteractWithBlockBeforeEvent, system, world
} from "@minecraft/server"
import { getInv, RUNTIME } from "../../lib"
import { blockHandle, fireHandle, seedsHandle, torchHandle } from "./handlers"
import * as cache from "../../core/cache"

const {
    DEBUG, CARRIED_CHEST,
    OFFHAND: { ENABLED, NEED_SNEAK, BLOCK_INTERACTION_DELAY, ITEMBUTBLOCK, FOOD_DATA, CAN_ALWAYS_USE },
    HARVEST: { COCOA_VALID_LOGS }
} = RUNTIME

// public ---
export { offhand_playerSpawn, offhand_playerLeave, offhand_player } from "./swap"
export { offhand_playerInteractWithEntity } from "./entity"
// ---

const delay: Record<string, number> = {}
export const offhand_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, isFirstEvent, block, blockFace, itemStack } = data

    const now = system.currentTick
    if (!isFirstEvent) {
        const stamp = delay[player.id] ?? -1
        if (stamp === now + BLOCK_INTERACTION_DELAY) return
        if (stamp > now) return
    }
    delay[player.id] = now + BLOCK_INTERACTION_DELAY

    const creative = cache.getPlayer(player, 'gameMode') === GameMode.Creative

    if (itemStack) {
        const typeId = itemStack?.typeId ?? ''
        const food = FOOD_DATA[typeId] // vanilla return empty in food component -.-
        const hunger = player.getComponent(EntityComponentTypes.Hunger)!

        // disallow main hand always use item
        if (typeId) {
            if (CAN_ALWAYS_USE.has(typeId)) return
            if (typeId.endsWith('_boat')) return
            if (typeId.endsWith('minecart')) return
            if (typeId.endsWith('harness')) return
            if (typeId.endsWith('bundle')) return
            if (typeId.endsWith('_boots')) return
            if (typeId.endsWith('_leggings')) return
            if (typeId.endsWith('_chestplate')) return
            if (typeId.endsWith('_helmet')) return
            if (block && block.typeId === 'minecraft:jukebox' && typeId.startsWith('minecraft:music_disc_')) return
        }

        // ignore foods
        if (food) {
            if (
                creative ||
                food?.canAlwaysEat ||
                world.getDifficulty() === Difficulty.Peaceful ||
                hunger.currentValue < hunger.effectiveMax
            ) return
        }

        // shovel/hoe
        if (
            block && block?.hasTag('dirt') &&
            itemStack && (
                itemStack.hasTag('minecraft:is_shovel') ||
                itemStack.hasTag('minecraft:is_hoe') && !(
                    block.typeId === 'minecraft:farmland' ||
                    block.typeId === 'minecraft:soul_sand' ||
                    COCOA_VALID_LOGS.has(block.typeId)
                )
            )
        ) return

        if (ITEMBUTBLOCK[typeId] === true) return
        try { if (BlockPermutation.resolve(itemStack.typeId)) return } catch { }
    }

    // handle offhand
    torchHandle(data, creative)
    fireHandle(data)
    seedsHandle(data)
    blockHandle(data, creative)
}