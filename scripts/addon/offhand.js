import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes, ItemStack, Player, world } from "@minecraft/server"

const sneakState = new Map()

/**
 * @param {Player} player 
 * @param {number} now 
 */
export const offhand_player = (player, now) => {
    const id = player.id
    const isSneaking = player.isSneaking
    const DOUBLE_SNEAK_WINDOW = player.clientSystemInfo.platformType === "Mobile" ? 20 : 12

    if (!sneakState.has(id)) sneakState.set(id, { lastSneakTick: -999, wasSneaking: false })
    const state = sneakState.get(id)

    if (state.wasSneaking && !isSneaking) {
        const gap = now - state.lastSneakTick

        if (gap <= DOUBLE_SNEAK_WINDOW) {
            // ready!
            player.sendMessage(`ok: ${gap}`)
            swapItem(player)
        }

        state.lastSneakTick = now
    }

    state.wasSneaking = isSneaking
}

/**@param {Player} player*/
const swapItem = (player) => {
    const equ = player.getComponent(EntityComponentTypes.Equippable)
    const mainhand = equ.getEquipment(EquipmentSlot.Mainhand)
    const offhand = equ.getEquipment(EquipmentSlot.Offhand)

    /**@param {ItemStack} item*/
    const isCool = (item) => {
        const enchant = (item?.getComponent(ItemComponentTypes.Enchantable)?.getEnchantments()?.length ?? 0) > 0
        const durability = (item?.getComponent(ItemComponentTypes.Durability)?.damage ?? 0) > 0
        const dye = item?.getComponent(ItemComponentTypes.Dyeable)
        return item?.nameTag || enchant ||
            durability ||
            (dye && (
                dye.color.red === dye.defaultColor.red &&
                dye.color.green === dye.defaultColor.green &&
                dye.color.blue === dye.defaultColor.blue
            ))
    }

    if (isCool(mainhand) || isCool(offhand)) return player.sendMessage(`§7Couldn't transfer item with nametag/enchantment/durability/color`)
    if (offhand) equ.setEquipment(EquipmentSlot.Mainhand, offhand)
    else equ.setEquipment(EquipmentSlot.Mainhand, undefined)

    if (mainhand) player.runCommand(`replaceitem entity @s slot.weapon.offhand 0 ${mainhand.typeId} ${mainhand.amount}`)
    else equ.setEquipment(EquipmentSlot.Offhand, undefined)
}