import {
    type Block, type Dimension, type Player,
    type PlayerBreakBlockBeforeEvent, type Vector3,
    BlockPermutation, EquipmentSlot, system,
    ItemStack, EntityComponentTypes
} from "@minecraft/server"
import { applyItemDamage, checkRandom, consumeOffhand, debug, getInv, getHeld, isCreative, pickupCooldown, reduceItem, tryRemove, RUNTIME, setEqu, sumLoc, swing } from "../lib"
const { HARVEST: { LOSS_SEED, PLANT_LEVEL, DURABILITY, COCOA_VALID_LOGS, COCOA_DIRECTIONS, STEM } } = RUNTIME

type Crop = (typeof PLANT_LEVEL)[string]
const COCOA_ID = 'minecraft:cocoa'
const COCOA: Crop = { level: 2, seed: 'minecraft:cocoa_beans' }
export const SEED_TO_PLANT: Record<string, string> = Object.fromEntries(
    Object.entries(PLANT_LEVEL).map(([plant, { seed }]) => [seed, plant])
)

export const resolveCocoaPermutation = (block: Block, originalDir: number) => {
    const { location, dimension } = block

    const hasLog = (dir: number) => {
        const { x, z } = COCOA_DIRECTIONS[dir]
        const neighbour = dimension.getBlock({ x: location.x + x, y: location.y, z: location.z + z })
        return COCOA_VALID_LOGS.has(neighbour?.typeId ?? '')
    }

    const dir = hasLog(originalDir)
        ? originalDir
        : COCOA_DIRECTIONS.find(d => hasLog(d.dir))?.dir ?? originalDir // :sadge: o(n)

    return BlockPermutation.resolve(COCOA_ID, { direction: dir, age: 0 })
}

const takeOffhandSeed = (player: Player, seed: string) => {
    const offhand = getHeld(player, EquipmentSlot.Offhand)
    if (offhand?.typeId !== seed) return false

    consumeOffhand(player, offhand)
    swing(player, 'off')
    return true
}

const takeInvSeed = (player: Player, seed: string) => {
    const container = getInv(player)?.container
    const slot = container?.find(new ItemStack(seed, 1))
    if (!container || slot === undefined) return false

    const stack = container.getItem(slot)!
    container.setItem(slot, stack.amount > 1 ? reduceItem(stack) : undefined)
    return true
}

// seed dropped from crop
const takeDropSeed = (dimension: Dimension, location: Vector3, seed: string) => {
    const center = { x: location.x + .5, y: location.y, z: location.z + .5 }

    for (const drop of dimension.getEntities({ type: 'minecraft:item', maxDistance: 2, location: center })) {
        if (!drop.isValid) continue
        const stack = drop.getComponent(EntityComponentTypes.Item)?.itemStack
        if (!stack || stack.typeId !== seed) continue

        if (stack.amount > 1) {
            try {
                const rest = dimension.spawnItem(reduceItem(stack), center)
                pickupCooldown(rest)
                rest.applyImpulse(drop.getVelocity())
            } catch { /* air? */ }
        }

        if (!tryRemove(drop)) debug(`[harvest] cannot remove ${seed}`)
        return true
    }
    return false
}

export const harvest_playerBreakBlock = (data: PlayerBreakBlockBeforeEvent) => {
    const { player, itemStack, block } = data
    if (!itemStack || isCreative(player)) return
    if (STEM.has(block.typeId) && !player.isSneaking) return data.cancel = true

    const isHoe = itemStack.typeId.endsWith("_hoe")
    const isAxe = itemStack.typeId.endsWith("_axe")
    if (!isHoe && !isAxe) return

    const { typeId, location, dimension } = block
    const isCocoa = typeId === COCOA_ID
    if (isAxe && !isCocoa) return

    const crop = isCocoa ? COCOA : PLANT_LEVEL[typeId]
    if (!crop) return

    const { permutation } = block
    const growth = (permutation.getState("growth") ?? permutation.getState("age")) as number | undefined
    if (!growth || growth < crop.level) {
        if (!player.isSneaking) data.cancel = true // not growth
        return
    }

    const originalDir = (permutation.getState("direction") ?? 0) as number
    system.run(() => {
        if (DURABILITY) {
            const { changed, item } = applyItemDamage(player, itemStack)
            if (changed) setEqu(player, item)
        }

        // offhand
        const offhandId = isCocoa ? undefined : getHeld(player, EquipmentSlot.Offhand)?.typeId
        const swap = offhandId ? SEED_TO_PLANT[offhandId] : undefined
        const plantId = swap ?? typeId
        const plantSeed = swap ? offhandId! : crop.seed

        const hasSeed = !LOSS_SEED ||
            takeOffhandSeed(player, plantSeed) ||
            takeDropSeed(dimension, location, plantSeed) ||
            takeInvSeed(player, plantSeed)

        if (!hasSeed) return dimension.spawnParticle(
            "minecraft:villager_angry",
            sumLoc(location, {
                x: checkRandom([.4, .7]),
                y: checkRandom([.2, .6]),
                z: checkRandom([.4, .7])
            })
        )

        const target = dimension.getBlock(location)!
        const { harvested, harvested_state } = crop

        if (harvested) target.setPermutation(BlockPermutation.resolve(plantId, { [harvested_state!]: harvested }))
        else if (plantId === COCOA_ID) target.setPermutation(resolveCocoaPermutation(target, originalDir))
        else target.setPermutation(BlockPermutation.resolve(plantId))
    })
}
