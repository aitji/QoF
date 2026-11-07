import { Block, Dimension, Entity, EquipmentSlot, GameMode, ItemStack, PlayerInteractWithBlockBeforeEvent, system, type Vector3 } from "@minecraft/server"
import { addItem, getEqu, playSound, RUNTIME, setEqu } from "../../lib"
import { getPlayer } from "../../core/cache"
const {
    DEBUG,
    WATER_CONCRETE: {
        DONE_PARTICLE, DONE_SOUND
    }
} = RUNTIME

// internal
type Location = { vec3: Vector3, dimension: Dimension }
const LINGERING_AREA = new Map<Location, number>() // {vec3, dim}, tickdiff
const lingering_init = 35 * 20
const lingering_decay = 2 * 20
const splash_offset = {
    y: [2, 1, 0, -1],
    xz: [
        { x: 0, z: 0 },
        { x: 0, z: 1 },
        { x: 0, z: -1 },

        { x: 1, z: 0 },
        { x: 1, z: 1 },
        { x: 1, z: -1 },

        { x: -1, z: 0 },
        { x: -1, z: 1 },
        { x: -1, z: -1 },
    ]
}

const convertPowder = (location: Vector3, dimension: Dimension) => {
    let count = 0
    const block = dimension?.getBlock(location)
    for (const y of splash_offset.y) {
        for (const xz of splash_offset.xz) {
            const con = block?.offset({ x: xz.x, y: y, z: xz.z })
            if (!con) continue
            if (!con.typeId.endsWith('concrete_powder')) continue
            con.setType(con.typeId.replace('_powder', ''))
            dimension.spawnParticle(DONE_PARTICLE, con.location)
            playSound(dimension, con.location, DONE_SOUND)
            count++
        }
    }
    return count
}

// index call
export const projectileHit = (projectile: Entity, location?: Vector3, dimension?: Dimension) => {
    if (!location || !dimension || !projectile) return

    switch (projectile.typeId) {
        case 'minecraft:splash_potion':
            convertPowder(location, dimension)
            break
        case 'minecraft:lingering_potion':
            const count = convertPowder(location, dimension)
            LINGERING_AREA.set({ vec3: location, dimension }, system.currentTick + lingering_init - (count * lingering_decay))
            break
        default: return
    }
}

export const splash_pending = (tick: number) => {
    for (const [loc, diff] of LINGERING_AREA) {
        const { vec3, dimension } = loc
        if (tick > diff) {
            const area = dimension.getEntities({ type: "minecraft:area_effect_cloud", maxDistance: 2, closest: 1, location: vec3 })[0]
            if (area) try { area.kill() } catch { area.remove() }
            LINGERING_AREA.delete(loc)
            break
        }

        const reduce = convertPowder(vec3, dimension)
        if (reduce > 0) LINGERING_AREA.set(loc, LINGERING_AREA.get(loc)! - (reduce * lingering_decay))
    }
}

export const splash_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { block, itemStack, player } = data
    if (itemStack?.typeId !== 'minecraft:potion') return

    const { selectedSlotIndex } = player
    const { dimension } = block
    if (!block) return
    if (!block.typeId.endsWith('concrete_powder')) return

    system.run(() => {
        // gate
        if (getPlayer(player, 'gameMode') !== GameMode.Creative) {
            if (player.selectedSlotIndex !== selectedSlotIndex) {
                player.selectedSlotIndex = selectedSlotIndex
                if (getEqu(player)?.getEquipment(EquipmentSlot.Mainhand)?.typeId !== 'minecraft:potion') return
            }

            // item
            const bottle = new ItemStack("minecraft:glass_bottle", 1)
            setEqu(player, undefined, "Mainhand")
            addItem(player, bottle)
        }

        // block
        block.setType(block.typeId.replace('_powder', ''))
        dimension.spawnParticle(DONE_PARTICLE, block.location)
        playSound(dimension, block.location, DONE_SOUND)
    })
}
