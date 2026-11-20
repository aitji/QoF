import {
    type Block, type Container, type Dimension,
    type PistonActivateAfterEvent, type Vector3,
    type PlayerInteractWithBlockBeforeEvent,
    type PlayerPlaceBlockAfterEvent,
    ItemComponentTypes, ItemStack, system, world
} from "@minecraft/server"
import { cache, checkPerm, clamp, createThrottle, getInv, heldAfterDelay, isCreative, playSound, reduceItem, RUNTIME, setEqu, sumLoc, swing } from "../lib"
const {
    COMPOSTER: {
        ENABLED, WORK_WITH_HOPPER, BLOCK_TYPEID, ITEMS, SOUND_FILL_SUCCESS,
        SOUND_FILL, SOUND_READY, DELAY_BEFORE_READY,
        HOPPER_TYPEID, HOPPER_INTERVAL_TICK, DATA_LOSS_DYP,
        PARTICLE_FILL_SUCCESS, DATA_COMPOSTER_LOCATION, SOUND_FILL_BONEMEAL
    }
} = RUNTIME
// todo: add dim support + migration

const LEVEL = 'composter_fill_level'
const NAMESPACE = 'minecraft:'.length
const throttled = createThrottle(8)

const composterSet = new Set<string>()
const saveSet = () => world.setDynamicProperty(DATA_COMPOSTER_LOCATION, JSON.stringify([...composterSet]))
const lossData = (): Record<string, 1> => JSON.parse(world.getDynamicProperty(DATA_LOSS_DYP) as string ?? '{}')
const saveLoss = (data: Record<string, 1>) => world.setDynamicProperty(DATA_LOSS_DYP, JSON.stringify(data))

// helper
const locKey = (dim: Dimension, { x, y, z }: Vector3) => `${dim.id.slice(NAMESPACE)}:${x}:${y}:${z}`
const parseKey = (key: string) => {
    const [dim, x, y, z] = key.split(':')
    return { dimension: world.getDimension(dim), loc: { x: +x, y: +y, z: +z } }
}
const isStew = (id: string) => id.endsWith('_stew') || id.endsWith('_soup')
const setLevel = (block: Block, level: number) => block.setPermutation(block.permutation.withState(LEVEL, clamp(level)))
const track = (dim: Dimension, block: Block) => {
    const key = locKey(dim, block)
    if (composterSet.has(key)) return

    composterSet.add(key)
    saveSet()
}

const ripen = (dim: Dimension, loc: Vector3) => {
    const block = dim.getBlock(loc)
    if (block?.typeId !== BLOCK_TYPEID || block.permutation.getState(LEVEL) !== 7) return

    setLevel(block, 8)
    playSound(dim, loc, SOUND_READY)
}

const ripenLater = (block: Block, dim: Dimension, loc: Vector3) => {
    const key = locKey(dim, block)
    saveLoss({ ...lossData(), [key]: 1 })

    system.runTimeout(() => {
        ripen(dim, loc)

        const data = lossData()
        delete data[key]
        saveLoss(data)
    }, DELAY_BEFORE_READY)
}

if (ENABLED && WORK_WITH_HOPPER) system.run(() => {
    const raw = world.getDynamicProperty(DATA_COMPOSTER_LOCATION) as string | undefined
    if (raw) {
        composterSet.clear()
        for (const key of JSON.parse(raw)) composterSet.add(key)
    }

    const keys = Object.keys(lossData())
    for (const key of keys) {
        const { dimension, loc } = parseKey(key)
        ripen(dimension, loc)
    }
    if (keys.length) saveLoss({})
})

export const composter_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, itemStack, isFirstEvent } = data
    if (player.isSneaking || !itemStack || block.typeId !== BLOCK_TYPEID) return
    if (!checkPerm(player)) return
    if (throttled(player.id, isFirstEvent)) return

    track(block.dimension, block)

    const itemID = itemStack.typeId
    const chance = ITEMS[itemID]
    if (!chance) return

    const level = block.permutation.getState(LEVEL) as number
    if (level >= 7) return
    data.cancel = true

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        const success = Math.random() <= chance
        const dim = player.dimension
        const loc = block.center()

        playSound(dim, loc, SOUND_FILL_BONEMEAL)
        swing(player, 'main')
        if (success) {
            playSound(dim, loc, SOUND_FILL_SUCCESS)
            setLevel(block, level + 1)
            dim.spawnParticle(PARTICLE_FILL_SUCCESS, loc)
            if (level === 6) ripenLater(block, dim, loc)
        } else playSound(dim, loc, SOUND_FILL)

        if (isCreative(player)) return

        const current = heldAfterDelay(player, slot)
        if (current?.typeId !== itemStack.typeId) {
            // fallback
            const removed = player.runCommand(`clear @s ${itemID} 0 1`).successCount
            if (!removed) {
                if (success) setLevel(block, level - 1)
                return
            }

            if (isStew(itemID)) player.runCommand('give @s bowl 0 1')
            return
        }

        // stew leaves a bowl
        if (itemStack.amount <= 1) setEqu(player, isStew(itemID) ? new ItemStack('minecraft:bowl', 1) : undefined)
        else setEqu(player, reduceItem(current))
    })
}

export const composter_playerPlaceBlock = ({ block, dimension }: PlayerPlaceBlockAfterEvent) => (block?.typeId === BLOCK_TYPEID) && track(dimension, block)

const FACING: Vector3[] = [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 1 },
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
]

// todo: this is so cringe, need better way to handle this
export const composter_pistonActivate = ({ block, dimension, piston, isExpanding }: PistonActivateAfterEvent) => {
    const dir = FACING[block.permutation.getState('facing_direction') as number]
    const pull = isExpanding ? -1 : 1
    const step = { x: dir.x * pull, y: dir.y * pull, z: dir.z * pull }

    const moves = piston.getAttachedBlocksLocations().map(loc => ({
        from: locKey(dimension, loc),
        to: locKey(dimension, sumLoc(loc, step))
    }))

    system.run(() => { // this is might be still lossy track tho, but who move composter?
        let moved = false
        for (const { from, to } of moves) {
            if (!composterSet.delete(from)) continue

            composterSet.add(to)
            moved = true
        }
        if (moved) saveSet()
    })
}

// null = vanilla
const scanHopper = (container: Container) => {
    let target = -1
    let bowl = -1
    let empty = -1

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i)
        if (!item) {
            if (empty === -1) empty = i
            continue
        }

        if (item.getComponent(ItemComponentTypes.Compostable)?.compostingChance) return null

        if (target === -1 && (isStew(item.typeId) || ITEMS[item.typeId])) target = i
        if (bowl === -1 && item.typeId === 'minecraft:bowl' && item.amount < 64) bowl = i
    }

    return target === -1 ? null : { target, bowl, empty }
}

const giveBowl = (container: Container, slot: number) => {
    if (slot === -1) return

    const amount = container.getItem(slot)?.amount ?? 0
    container.setItem(slot, new ItemStack('minecraft:bowl', amount + 1))
}

let trackTick = system.currentTick + HOPPER_INTERVAL_TICK
export const composter_pending = (tick: number) => {
    if (trackTick > tick) return
    trackTick = tick + HOPPER_INTERVAL_TICK

    let changed = false
    for (const key of [...composterSet]) {
        const { dimension, loc } = parseKey(key)
        const block = dimension.getBlock(loc)
        if (!block?.isValid) continue

        if (block.typeId !== BLOCK_TYPEID) {
            composterSet.delete(key)
            changed = true
            continue
        }

        const level = block.permutation.getState(LEVEL) as number
        if (level >= 7) continue

        const hopper = block.above()
        if (!hopper?.isValid || hopper.typeId !== HOPPER_TYPEID) continue
        if (hopper.getRedstonePower()! > 0) continue

        const perm = hopper.permutation
        if (perm.getState('powered_bit') || perm.getState('facing_direction') !== 0) continue

        const container = getInv(hopper)?.container
        const found = container && scanHopper(container)
        if (!found) continue

        const { target, bowl, empty } = found
        const item = container.getItem(target)!
        const itemID = item.typeId
        const success = Math.random() <= ITEMS[itemID]
        const center = block.center()

        if (item.amount > 1) container.setItem(target, reduceItem(item))
        else {
            container.setItem(target, undefined)
            // todo: put bowl on hopper below if have any <-- this idea is dumb because it will broke bone meal compactor
            if (isStew(itemID)) giveBowl(container, bowl !== -1 ? bowl : empty)
        }

        playSound(dimension, center, SOUND_FILL_BONEMEAL)
        if (success) {
            playSound(dimension, center, SOUND_FILL_SUCCESS)
            setLevel(block, level + 1)
            if (level === 6) ripenLater(block, dimension, center)
        } else playSound(dimension, center, SOUND_FILL)
    }

    if (changed) saveSet()
}