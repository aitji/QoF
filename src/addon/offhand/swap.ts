import {
    type Player, type PlayerLeaveAfterEvent,
    ItemLockMode, ItemStack, PlatformType,
    EquipmentSlot, ItemComponentTypes,
} from "@minecraft/server"
import { cache, getEqu, playSound, RUNTIME, setOffhand, sumLoc, swing } from "../../lib"

const {
    OFFHAND: {
        DOUBLE_SNEAK_WINDOW_MOBILE, DOUBLE_SNEAK_WINDOW_CONSOLE,
        DOUBLE_SNEAK_WINDOW_DEFAULT, DISALLOWED_ITEM,
        SOUND_FAIL, FAIL_PARTICLE, PARTICLE_OFFSET
    }
} = RUNTIME

const SNEAK_WINDOW = {
    [PlatformType.Mobile]: DOUBLE_SNEAK_WINDOW_MOBILE as number,
    [PlatformType.Console]: DOUBLE_SNEAK_WINDOW_CONSOLE as number,
    [PlatformType.Desktop]: DOUBLE_SNEAK_WINDOW_DEFAULT as number
}

type SneakState = { lastSneakTick: number, wasSneaking: boolean }
const sneakState = new Map<string, SneakState>()

const stateOf = (id: string) => {
    let state = sneakState.get(id)
    if (!state) {
        state = { lastSneakTick: -999, wasSneaking: false }
        sneakState.set(id, state)
    }
    return state
}

export const offhand_playerLeave = ({ playerId }: PlayerLeaveAfterEvent) => sneakState.delete(playerId)

const isUnsafe = (item: ItemStack) =>
    !!item.nameTag ||
    item.getLore().length > 0 ||
    item.lockMode !== ItemLockMode.none ||
    DISALLOWED_ITEM.has(item.typeId) ||
    (item.getComponent(ItemComponentTypes.Enchantable)?.getEnchantments().length ?? 0) > 0

const swapItem = (player: Player) => {
    const equippable = getEqu(player)!
    const mainhand = equippable.getEquipment(EquipmentSlot.Mainhand)
    const offhand = equippable.getEquipment(EquipmentSlot.Offhand)

    if (mainhand && isUnsafe(mainhand)) {
        const { location, dimension } = player
        dimension.spawnParticle(FAIL_PARTICLE, sumLoc(location, PARTICLE_OFFSET))
        playSound(dimension, location, SOUND_FAIL)
        return
    }

    if (mainhand) swing(player, 'off')
    if (offhand) swing(player, 'main')

    equippable.setEquipment(EquipmentSlot.Mainhand, offhand)

    // replaceitem keeps durability
    if (mainhand) setOffhand(player, mainhand.typeId, mainhand.amount, mainhand.getComponent(ItemComponentTypes.Durability)?.damage ?? 0)
    else equippable.setEquipment(EquipmentSlot.Offhand, undefined)
}

// double sneak = swap
export const offhand_player = (player: Player, now: number) => {
    const state = stateOf(player.id)
    const { isSneaking } = player

    const justReleased = state.wasSneaking && !isSneaking
    state.wasSneaking = isSneaking
    if (!justReleased) return

    const window = SNEAK_WINDOW[cache.getPlayer(player, 'platformType')]
    if (now - state.lastSneakTick <= window) {
        swapItem(player)
        state.lastSneakTick = 0
    } else state.lastSneakTick = now
}
