import {
    type PlayerInteractWithBlockBeforeEvent, type Block,
    system, ItemStack, LiquidType,
    PlayerPlaceBlockAfterEvent,
} from "@minecraft/server"
import { type BlockStateSuperset } from "@minecraft/vanilla-data"
import { addItem, applyItemDamage, cache, checkPerm, checkRandom, createThrottle, heldAfterDelay, isCreative, neighbour, permOf, pickupCooldown, playSound, reduceItem, RUNTIME, setEqu, sumLoc, swing } from "../../lib"
import { isManagedLight, suppressLight } from "./core"
const {
    BLOCK_INTERACTION_DELAY,
    LIGHT: { PATCHER: {
        SEEDTOBLOCK, SOUND_SHOVEL_USE, SOUND_HOE_USE, FIRE_ITEM,
        REFUNED: {
            FACING_BY_INDEX, OPPOSITE, LEVER_SUPPORT,
            GROUND_BLOCKS, REFUND_ITEM
        }
    } }
} = RUNTIME

type Dir = 'up' | 'down' | 'north' | 'south' | 'east' | 'west'
const isGroundBlock = (id: string) => GROUND_BLOCKS.has(id)
    || id.endsWith('_carpet')
    || id.endsWith('_pressure_plate')
    || id.endsWith('_coral')
    || id.endsWith('rail')
    || id.endsWith('candle')

const getNeighbor = (block: Block, dir?: Dir): Block | undefined => {
    switch (dir) {
        case 'up': return block.above()
        case 'down': return block.below()
        case 'north': return block.north()
        case 'south': return block.south()
        case 'east': return block.east()
        case 'west': return block.west()
        default: return undefined
    }
}

const getFacing = (block: Block): Dir | undefined => {
    const v = block.permutation.getState('facing_direction')
    return (typeof v === 'number' ? FACING_BY_INDEX[v] : v) as Dir | undefined
}

const torchSupport = (block: Block, facing: string) => getNeighbor(block, facing === 'top' || facing === 'unknown' ? 'down' : facing as Dir)
export const torchOnLight = (block: Block, facing: string) => {
    try { return isManagedLight(torchSupport(block, facing)) }
    catch { return false }
}

const throttled = createThrottle(BLOCK_INTERACTION_DELAY)
const SEED_SOUND = {
    nature: { ID: "place.grass", VOLUME: 0.8, PITCH: [0.8, 1] },
    nether: { ID: "dig.nether_wart", VOLUME: 0.7, PITCH: [0.8, 1] },
}

const makePath = (block: Block, above: Block) => {
    if (block.typeId === 'minecraft:grass_path' || block.typeId === 'minecraft:farmland') return false

    suppressLight(above, true)
    block.setPermutation(permOf('minecraft:grass_path'))
    playSound(block.dimension, block.center(), SOUND_SHOVEL_USE)
    return true
}

const NO_TILL = new Set(['minecraft:farmland', 'minecraft:podzol', 'minecraft:mycelium'])
const till = (block: Block) => {
    const { typeId, dimension } = block
    if (NO_TILL.has(typeId)) return false

    if (typeId === 'minecraft:dirt_with_roots')
        pickupCooldown(dimension.spawnItem(new ItemStack('minecraft:hanging_roots', 1), block.center()), 15)

    const toDirt = typeId === 'minecraft:dirt_with_roots' || typeId === 'minecraft:coarse_dirt'
    block.setPermutation(permOf(toDirt ? 'minecraft:dirt' : 'minecraft:farmland'))
    playSound(dimension, block.center(), SOUND_HOE_USE)
    return true
}

const dirtCheck = ({ player, block }: PlayerInteractWithBlockBeforeEvent, item: ItemStack) => {
    if (!block.hasTag('dirt')) return

    const shovel = item.hasTag('minecraft:is_shovel')
    if (!shovel && !item.hasTag('minecraft:is_hoe')) return

    const above = block.above()
    if (!above || !isManagedLight(above)) return

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        if (!(shovel ? makePath(block, above) : till(block))) return

        swing(player, "main")
        if (isCreative(player)) return

        const { changed, item: damaged } = applyItemDamage(player, item)
        if (!changed) return

        heldAfterDelay(player, slot)
        setEqu(player, damaged)
    })
}

const placeCrop = (block: Block, id: string) => {
    try { block.setType(id) }
    catch {
        try { block.setPermutation(permOf(id)) }
        catch { return block.dimension.runCommand(`setblock ${block.x} ${block.y} ${block.z} ${id}`).successCount > 0 }
    }
    return true
}

const seedCheck = ({ player, block }: PlayerInteractWithBlockBeforeEvent, item: ItemStack) => {
    const seed = SEEDTOBLOCK[item.typeId]
    if (!seed || seed.pot !== block.typeId) return

    const above = block.above()
    if (!above || !isManagedLight(above)) return

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        swing(player, "main")
        if (!placeCrop(above, seed.asBlock)) return

        playSound(block.dimension, block.center(), SEED_SOUND[seed.sound])
        if (isCreative(player)) return

        heldAfterDelay(player, slot)
        setEqu(player, reduceItem(item))
    })
}

// flint and steel + fire charge
const fireCheck = ({ player, block, blockFace }: PlayerInteractWithBlockBeforeEvent, item: ItemStack) => {
    const fireSound = FIRE_ITEM[item.typeId]
    if (!fireSound) return

    const target = neighbour(block, blockFace)
    if (!target || !isManagedLight(target)) return

    suppressLight(target, false)

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        try {
            const supported = !target.below()!.permutation.canBeDestroyedByLiquidSpread(LiquidType.Water)
            if (!supported || !(target.isAir || isManagedLight(target))) {
                if (isManagedLight(target)) target.setPermutation(permOf('minecraft:air'))
                return
            }

            target.setType('minecraft:fire')
        } catch { return }

        // minecraft alr handle damage
        playSound(target.dimension, target.center(), fireSound)
        swing(player, "main")

        if (!fireSound.REDUCE_ITEM) return

        const current = heldAfterDelay(player, slot)
        if (current) setEqu(player, reduceItem(current))
    })
}

export const light_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, itemStack, isFirstEvent } = data
    if (throttled(player.id, isFirstEvent)) return
    if (!checkPerm(player) || !itemStack) return

    dirtCheck(data, itemStack)
    seedCheck(data, itemStack)
    fireCheck(data, itemStack)
}

// refuned system ._.
const getSupports = (block: Block): (Block | undefined)[] | undefined => {
    const { typeId } = block
    const state = (name: any) => block.permutation.getState(name)
    const pick = (...dirs: (Dir | undefined)[]) => dirs.map(d => getNeighbor(block, d))

    if (typeId.endsWith('torch')) return [torchSupport(block, String(state('torch_facing_direction')))]
    if (typeId !== 'minecraft:sea_lantern' && typeId.endsWith('lantern')) return pick(state('hanging') ? 'up' : 'down')
    if (typeId === 'minecraft:lever') return pick(LEVER_SUPPORT[String(state('lever_direction'))])

    if (typeId.endsWith('_button') || typeId === 'minecraft:ladder') {
        const f = getFacing(block)
        return pick(f && OPPOSITE[f])
    }
    if (typeId.endsWith('_hanging_sign')) {
        if (state('hanging')) return pick('up')
        const f = getFacing(block)
        return f === 'north' || f === 'south' ? pick('east', 'west') : pick('north', 'south')
    }
    if (
        typeId === 'minecraft:sulfur_spike' ||
        typeId === 'minecraft:pointed_dripstone'
    ) return pick(state('hanging') ? 'up' : 'down')
    if (isGroundBlock(typeId)) return pick('down')

    return undefined
}

export const light_playerPlaceBlock = (data: PlayerPlaceBlockAfterEvent) => {
    const { player, block, dimension } = data
    const { typeId, location } = block
    if (!typeId.startsWith('minecraft:')) return

    let supports: (Block | undefined)[] | undefined
    try { supports = getSupports(block) }
    catch { return }

    if (!supports?.length) return
    const refuned = supports.every(s => isManagedLight(s))

    if (refuned) {
        if (!isCreative(player)) addItem(player, new ItemStack(REFUND_ITEM[typeId] ?? typeId, 1), 1)
        dimension.setBlockType(location, 'minecraft:air')
        dimension.spawnParticle(
            "minecraft:villager_angry",
            sumLoc(location, {
                x: checkRandom([.4, .7]),
                y: checkRandom([.2, .6]),
                z: checkRandom([.4, .7])
            })
        )
    }
}