import { EquipmentSlot, PlayerInteractWithEntityBeforeEvent, system } from "@minecraft/server"
import { checkPerm, getEqu, playSound } from "../../lib"

const susCow = new Map()
const SUS_STEW = Object.freeze({
    // night vision
    "minecraft:poppy": 0,
    "minecraft:torchflower": 10,

    // jump boost
    "minecraft:cornflower": 1,

    // weakness
    "minecraft:orange_tulip": 2,
    "minecraft:pink_tulip": 2,
    "minecraft:red_tulip": 2,
    "minecraft:white_tulip": 2,

    // blindness
    "minecraft:azure_bluet": 3,
    "minecraft:open_eyeblossom": 11,

    // poison
    "minecraft:lily_of_the_valley": 4,

    // saturation
    "minecraft:golden_dandelion": 5,
    "minecraft:dandelion": 5,
    "minecraft:blue_orchid": 6,

    // fire resistance
    "minecraft:allium": 7,

    // regeneration
    "minecraft:oxeye_daisy": 8,

    // wither
    "minecraft:wither_rose": 9,

    // nausea
    "minecraft:closed_eyeblossom": 12
})


export const offhand_playerInteractWithEntity = (event: PlayerInteractWithEntityBeforeEvent) => {
    const { player, target } = event
    const equippable = getEqu(player)!
    const offhand = equippable.getEquipment(EquipmentSlot.Offhand)

    if (checkPerm(player) === false) return
    if (
        (target.typeId === "minecraft:cow" || target.typeId === "minecraft:mooshroom") &&
        offhand?.typeId === "minecraft:bucket"
    ) {
        event.cancel = true
        system.run(() => {
            player.runCommand("replaceitem entity @s slot.weapon.offhand 0 milk_bucket")
            playSound(player.dimension, player.location, { VOLUME: 0.5, PITCH: 1, ID: "mob.cow.milk" })
        })
        return
    }
    // maybe later -aitji
}