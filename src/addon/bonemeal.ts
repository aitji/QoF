import {
    type Block, type Player,
    type PlayerInteractWithBlockBeforeEvent,
    EquipmentSlot, system
} from "@minecraft/server"
import { cache, checkPerm, createThrottle, getHeld, reduceItem, setEqu, swing } from "../lib"

const throttled = createThrottle(8)
export const bonemeal_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, itemStack, isFirstEvent } = data
    if (!checkPerm(player)) return
    if (throttled(player.id, isFirstEvent)) return

    if (itemStack?.typeId !== 'minecraft:bone_meal') return
    if (cactus(block)) takeItem(player)
}

const takeItem = (player: Player): void => {
    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        if (slot !== cache.getPlayer(player, "selectedSlotIndex")) return

        const current = getHeld(player)
        if (current?.typeId !== 'minecraft:bone_meal') return

        setEqu(player, reduceItem(current), EquipmentSlot.Mainhand, true)
        swing(player, 'main')
    })
}

const cactus = (block: Block): boolean => {
    if (block.typeId !== 'minecraft:cactus') return false

    let top = block // im sick help! i have a headache
    while (top.above()?.typeId === 'minecraft:cactus')
        top = top.above()!

    let height = 1
    for (let b = top.below(); b?.typeId === 'minecraft:cactus'; b = b.below())
        height++

    if (height >= 3) return false

    // missing
    let room = 0
    while (room < 3 - height && top.above(room + 1)?.isAir) room++
    if (room === 0) return false

    const { dimension } = block
    system.run(() => {
        // todo: chance for flowers
        dimension.spawnParticle('qof:crop_growth_emitter', block.center())
        try { for (let i = 1; i <= room; i++) top.above(i)?.setType('minecraft:cactus') }
        catch { }
    })
    return true
}