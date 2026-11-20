import {
    type PlayerInteractWithBlockBeforeEvent,
    BlockComponentTypes, EquipmentSlot, system
} from "@minecraft/server"
import { applyItemDamage, cache, checkPerm, checkRandom, createThrottle, heldAfterDelay, playSound, RUNTIME, setEqu } from "../lib"

const {
    BLOCK_INTERACTION_DELAY,
    WAXED_OF: { DURABILITY }
} = RUNTIME

const throttled = createThrottle(BLOCK_INTERACTION_DELAY)
export const waxedOff_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { block, player, itemStack, isFirstEvent } = data
    if (throttled(player.id, isFirstEvent)) return
    if (!checkPerm(player)) return

    if (!itemStack?.hasTag('minecraft:is_axe') || !block.typeId.endsWith('_sign')) return

    const sign = block.getComponent(BlockComponentTypes.Sign)
    if (!sign?.isWaxed) return

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        const { changed, item } = applyItemDamage(player, itemStack)

        if (changed && DURABILITY) {
            const curItem = heldAfterDelay(player, slot)
            if (
                curItem?.typeId === itemStack.typeId &&
                curItem.nameTag === itemStack.nameTag
            ) setEqu(player, item, EquipmentSlot.Mainhand, true)
        }

        const dim = player.dimension
        const center = block.center()

        sign.setWaxed(false)
        playSound(dim, center, { ID: "copper.wax.off", VOLUME: 1.0, PITCH: [0.8, 1.2] })

        const particles = checkRandom([15, 20])
        for (let i = 0; i < particles; i++) dim.spawnParticle("qof:wax_off", center)
    })
}
