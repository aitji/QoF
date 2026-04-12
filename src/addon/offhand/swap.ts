import {
    EquipmentSlot, ItemComponentTypes, ItemStack,
    PlatformType, Player, PlayerLeaveAfterEvent,
    PlayerSpawnAfterEvent, system, world
} from "@minecraft/server"
import { getEqu, RUNTIME } from "../../lib"
import * as cache from "../../core/cache"

const {
    OFFHAND: { DOUBLE_SNEAK_WINDOW_MOBILE, DOUBLE_SNEAK_WINDOW_CONSOLE, DOUBLE_SNEAK_WINDOW_DEFAULT, DISALLOWED_ITEM }
} = RUNTIME

type SneakState = { lastSneakTick: number, wasSneaking: boolean }
const sneakState = new Map<string, SneakState>()

export const offhand_playerSpawn = (data: PlayerSpawnAfterEvent) => data.initialSpawn && _initPlayer(data.player)
export const offhand_playerLeave = (data: PlayerLeaveAfterEvent) => sneakState.delete(data.playerId)

system.run(() => { for (const player of world.getAllPlayers()) _initPlayer(player) })

function _initPlayer(player: Player) {
    const { id } = player
    if (sneakState.has(id)) return
    sneakState.set(id, { lastSneakTick: -999, wasSneaking: false })
}

const sneakWindow = {
    [PlatformType.Mobile]: DOUBLE_SNEAK_WINDOW_MOBILE as number,
    [PlatformType.Console]: DOUBLE_SNEAK_WINDOW_CONSOLE as number,
    [PlatformType.Desktop]: DOUBLE_SNEAK_WINDOW_DEFAULT as number
} as const

export function offhand_player(player: Player, now: number) {
    const { id, isSneaking } = player
    if (!sneakState.has(id)) _initPlayer(player)

    const state = sneakState.get(id)!

    const plCache = cache.getPlayer(player)
    const platform = (plCache as cache.PlayerData).platformType
    const window = sneakWindow[platform]

    const justReleased = state?.wasSneaking && !isSneaking
    if (justReleased) {
        const gap = now - state.lastSneakTick
        if (gap <= window) {
            swapItem(player)
            state.lastSneakTick = 0
        } else state.lastSneakTick = now
    }

    state.wasSneaking = isSneaking
}

function hasUnsafeProperties(item: ItemStack) {
    if (!item) return false
    if (item.nameTag) return true
    if (item.getLore().length > 0) return true

    const enchants = item.getComponent(ItemComponentTypes.Enchantable)
    if (enchants && enchants.getEnchantments().length > 0) return true

    // nvm i found the way!
    // const durability = item.getComponent(ItemComponentTypes.Durability)
    // if ((durability?.damage ?? 0) > 0) return true

    // edge case
    const isDisallow = DISALLOWED_ITEM.has(item?.typeId ?? '')
    if (isDisallow && isDisallow === true) return true

    return false
}

function swapItem(player: Player) {
    const equippable = getEqu(player)!
    const mainhand = equippable.getEquipment(EquipmentSlot.Mainhand)
    const offhand = equippable.getEquipment(EquipmentSlot.Offhand)

    if (mainhand && hasUnsafeProperties(mainhand))
        return player.sendMessage("§7Couldn't transfer item with nametag/enchantment/nbt")

    const durability = mainhand?.getComponent(ItemComponentTypes.Durability)

    equippable.setEquipment(EquipmentSlot.Mainhand, offhand ?? undefined)

    if (mainhand) {
        player.runCommand(`replaceitem entity @s slot.weapon.offhand 0 ${mainhand.typeId} ${mainhand.amount} ${durability ? durability.damage : 0}`)
    } else equippable.setEquipment(EquipmentSlot.Offhand, undefined)
}