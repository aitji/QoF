import {
    type PlayerInteractWithBlockBeforeEvent,
    type Vector3, type Block, type Dimension,
    type Entity,
    ItemStack, system
} from "@minecraft/server"
import { addItem, heldAfterDelay, isCreative, playSound, tryRemove, RUNTIME, setEqu, cache } from "../../lib"
const { WATER_CONCRETE: { DONE_PARTICLE, DONE_SOUND } } = RUNTIME

type Lingering = { location: Vector3, dimension: Dimension, until: number }
const LINGERING = new Set<Lingering>()
const LINGERING_INIT = 35 * 20
const LINGERING_DECAY = 2 * 20

// 3x3, from 2 above to 1 below
const OFFSETS: Vector3[] = []
for (let y = 2; y >= -1; y--) {
    for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) OFFSETS.push({ x, y, z })
    }
}

const harden = (block: Block, dimension: Dimension) => {
    block.setType(block.typeId.replace('_powder', ''))
    dimension.spawnParticle(DONE_PARTICLE, block.location)
    playSound(dimension, block.location, DONE_SOUND)
}

const convertPowder = (location: Vector3, dimension: Dimension) => {
    const origin = dimension.getBlock(location)
    if (!origin) return 0

    let count = 0
    for (const offset of OFFSETS) {
        const block = origin.offset(offset)
        if (!block?.typeId.endsWith('concrete_powder')) continue

        harden(block, dimension)
        count++
    }
    return count
}

// index call
export const projectileHit = (projectile: Entity, location?: Vector3, dimension?: Dimension) => {
    if (!location || !dimension || !projectile) return

    const { typeId } = projectile
    if (typeId === 'minecraft:splash_potion') convertPowder(location, dimension)
    else if (typeId === 'minecraft:lingering_potion') {
        const count = convertPowder(location, dimension)
        LINGERING.add({ location, dimension, until: system.currentTick + LINGERING_INIT - count * LINGERING_DECAY })
    }
}

export const splash_pending = (tick: number) => {
    for (const area of LINGERING) {
        const { location, dimension } = area
        if (tick > area.until) {
            const cloud = dimension.getEntities({ type: "minecraft:area_effect_cloud", maxDistance: 2, closest: 1, location })[0]
            if (cloud) tryRemove(cloud)
            LINGERING.delete(area)
            continue
        }

        area.until -= convertPowder(location, dimension) * LINGERING_DECAY
    }
}

export const splash_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { block, itemStack, player } = data
    if (itemStack?.typeId !== 'minecraft:potion') return
    if (!block.typeId.endsWith('concrete_powder')) return

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        if (!isCreative(player)) {
            if (heldAfterDelay(player, slot)?.typeId !== 'minecraft:potion') return

            setEqu(player, undefined)
            addItem(player, new ItemStack('minecraft:glass_bottle', 1))
        }

        harden(block, block.dimension)
    })
}
