import {
    type PlayerInteractWithEntityBeforeEvent,
    EquipmentSlot, system
} from "@minecraft/server"
import { checkPerm, getHeld, playSound, setOffhand, swing } from "../../lib"

export const offhand_playerInteractWithEntity = (event: PlayerInteractWithEntityBeforeEvent) => {
    const { player, target } = event
    if (!checkPerm(player)) return
    if (target.typeId !== "minecraft:cow" && target.typeId !== "minecraft:mooshroom") return
    if (getHeld(player, EquipmentSlot.Offhand)?.typeId !== "minecraft:bucket") return

    event.cancel = true
    system.run(() => {
        swing(player, 'off')
        setOffhand(player, "milk_bucket", 1)
        playSound(player.dimension, player.location, { VOLUME: 0.5, PITCH: 1, ID: "mob.cow.milk" })
    })
    // maybe later -aitji
}