import {
    type Player, type PlayerInteractWithBlockBeforeEvent,
    Difficulty, EntityComponentTypes, ItemStack, world
} from "@minecraft/server"
import { checkPerm, createThrottle, isBlockItem, isCreative, RUNTIME } from "../../lib"
import { blockHandle, fireHandle, seedsHandle, torchHandle } from "./handlers"

const {
    BLOCK_INTERACTION_DELAY,
    OFFHAND: { CAN_ALWAYS_USE, FOOD, FOOD_ALWAYS_EDIBLE, ALLOW_PLACE },
    HARVEST: { COCOA_VALID_LOGS }
} = RUNTIME

// public ---
export { offhand_playerLeave, offhand_player } from "./swap"
export { offhand_playerInteractWithEntity } from "./entity"
// ---

const throttled = createThrottle(BLOCK_INTERACTION_DELAY)

const WEARABLE = ['_boat', 'minecart', 'harness', 'bundle', '_boots', '_leggings', '_chestplate', '_helmet']
const HOE_IDLE = new Set(['minecraft:farmland', 'minecraft:soul_sand']) // hoe does nothing here

// vanilla return empty in food component -.-
const canEat = (player: Player, typeId: string, creative: boolean) => {
    if (creative || FOOD_ALWAYS_EDIBLE.has(typeId) || world.getDifficulty() === Difficulty.Peaceful) return true

    const hunger = player.getComponent(EntityComponentTypes.Hunger)!
    return hunger.currentValue < hunger.effectiveMax
}

// mainhand alr do smth
const mainhandBusy = ({ player, block }: PlayerInteractWithBlockBeforeEvent, item: ItemStack, creative: boolean) => {
    const { typeId } = item
    if (CAN_ALWAYS_USE.has(typeId) || WEARABLE.some(part => typeId.endsWith(part))) return true
    if (block.typeId === 'minecraft:jukebox' && typeId.startsWith('minecraft:music_disc_')) return true
    if (FOOD.has(typeId) && canEat(player, typeId, creative)) return true

    if (block.hasTag('dirt')) {
        if (item.hasTag('minecraft:is_shovel')) return true
        if (item.hasTag('minecraft:is_hoe') && !HOE_IDLE.has(block.typeId) && !COCOA_VALID_LOGS.has(block.typeId)) return true
    }

    return isBlockItem(typeId)
}

export const offhand_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, isFirstEvent, itemStack } = data
    if (throttled(player.id, isFirstEvent)) return
    if (!checkPerm(player)) return

    const creative = isCreative(player)
    if (itemStack && mainhandBusy(data, itemStack, creative)) return

    // handle offhand
    fireHandle(data)
    seedsHandle(data)
    if (ALLOW_PLACE !== 'none') torchHandle(data, creative)
    if (ALLOW_PLACE === 'all') blockHandle(data, creative)
}