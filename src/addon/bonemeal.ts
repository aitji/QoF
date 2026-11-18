import { type Block, EquipmentSlot, GameMode, type Player, PlayerInteractWithBlockBeforeEvent, system, world } from "@minecraft/server"
import { getEqu, reduceItem, setEqu, sumLoc, swing } from "../lib"

const delay: Record<string, number> = {}
world.afterEvents.playerLeave.subscribe(({ playerId }) => { delete delay[playerId] })

export const bonemeal_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, itemStack, isFirstEvent } = data

    if (!isFirstEvent && (delay[player.id] ?? 0) > system.currentTick) return
    delay[player.id] = system.currentTick + 8

    if (itemStack?.typeId !== 'minecraft:bone_meal') return

    const grown = [cactus].some(fn => fn(block))
    if (grown) takeItem(player)
}

const takeItem = (player: Player): void => {
    if (player.getGameMode() === GameMode.Creative) return
    const slot = player.selectedSlotIndex

    system.run(() => {
        if (slot !== player.selectedSlotIndex) return
        const equ = getEqu(player)
        const current = equ?.getEquipment(EquipmentSlot.Mainhand)
        if (!equ || current?.typeId !== 'minecraft:bone_meal') return
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
        dimension.spawnParticle('qof:crop_growth_emitter', block.center())
        try { for (let i = 1; i <= room; i++) top.above(i)?.setType('minecraft:cactus') }
        catch { }
    })
    return true
}