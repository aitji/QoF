import {
    type PlayerInteractWithBlockBeforeEvent, type Block,
    system, ItemStack, LiquidType,
} from "@minecraft/server"
import { applyItemDamage, cache, checkPerm, createThrottle, heldAfterDelay, isAirOrLight, isCreative, isLightBlock, neighbour, permOf, pickupCooldown, playSound, reduceItem, RUNTIME, setEqu, swing } from "../../lib"
import { suppressLight } from "./core"
const {
    BLOCK_INTERACTION_DELAY,
    LIGHT: { SEEDTOBLOCK, SOUND_SHOVEL_USE, SOUND_HOE_USE, FIRE_ITEM }
} = RUNTIME

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
    if (!above || !isLightBlock(above)) return

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
    if (!above || !isLightBlock(above)) return

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
    if (!target || !isLightBlock(target)) return

    suppressLight(target, false)

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        try {
            if (!target.below()!.permutation.canBeDestroyedByLiquidSpread(LiquidType.Water) || !isAirOrLight(target)) return

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