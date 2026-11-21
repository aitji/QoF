import {
    type PlayerInteractWithBlockBeforeEvent,
    type Vector3, type Player, type Block,
    EquipmentSlot, ItemComponentTypes,
    ItemStack, LiquidType, system,
    BlockPermutation, Direction
} from "@minecraft/server"
import { applyItemDamage, consumeOffhand, debug, disSqu, getInv, getHeld, isAirOrLight, isBlockItem, isLightBlock, isSolid, neighbour, playSound, RUNTIME, setOffhand, sumLoc, swing } from "../../lib"
import { suppressLight } from "../light/core"
import { resolveCocoaPermutation, SEED_TO_PLANT } from "../harvest"
import { getSpecialPermutation, hasEntityInBlock, isDoorItem, isReplaceableTarget, resolveOrientedPermutation } from "./placement"

const {
    CARRIED_CHEST,
    HARVEST: { COCOA_VALID_LOGS },
    LIGHT: { PATCHER: { FIRE_ITEM } },
    OFFHAND: { ALLOW_REPLACE, NEED_SNEAK, FACE_TO_TORCH_DIR, TORCH_ID, PLACE_SOUND }
} = RUNTIME

const SELF_RANGE = 0.62 ** 2

// helper
const useOffhand = (player: Player) => {
    const current = getHeld(player, EquipmentSlot.Offhand)
    if (current) consumeOffhand(player, current)
}

// right click does its own thing, sneak to place instead
const usesOnClick = (block: Block) => {
    const id = block.typeId
    return NEED_SNEAK.has(id) || id.endsWith('_door') || id.endsWith('_trapdoor') || id.endsWith('_fence_gate')
}

const canPlaceTorchOn = (block: Block) => {
    if (isAirOrLight(block)) return true

    const replace = ALLOW_REPLACE[block.typeId]
    if (replace === undefined) return false
    return replace || isSolid(block.below())
}

export const torchHandle = (data: PlayerInteractWithBlockBeforeEvent, creative: boolean) => {
    const { player, block, blockFace } = data

    const offhandItem = getHeld(player, EquipmentSlot.Offhand)
    if (!offhandItem || !TORCH_ID.has(offhandItem.typeId)) return
    if (block.isLiquid) return

    const light = isLightBlock(block)
    const solid = isSolid(block) && !light
    if (solid && usesOnClick(block) && !player.isSneaking) return

    const place = (at: Block, facing: string) => {
        at.setPermutation(BlockPermutation.resolve(offhandItem.typeId).withState('torch_facing_direction', facing))
        playSound(player.dimension, block.center(), PLACE_SOUND)
        swing(player, 'off')
        if (!creative) consumeOffhand(player, offhandItem)
    }

    if (light) {
        data.cancel = true
        system.run(() => place(block, 'top'))
        return
    }

    if (solid) {
        if (CARRIED_CHEST.ENABLED && NEED_SNEAK.has(block.typeId) && player.isSneaking && getInv(block)?.container) return

        const target = neighbour(block, blockFace)
        if (!target || !canPlaceTorchOn(target)) return

        data.cancel = true
        system.run(() => place(target, FACE_TO_TORCH_DIR[blockFace] ?? 'top'))
        return
    }

    // replaceable blocks
    if (ALLOW_REPLACE[block.typeId] === undefined) return

    data.cancel = true
    system.run(() => {
        if (canPlaceTorchOn(block)) place(block, 'top')
    })
}

const isFire = (block: Block) => block.typeId === 'minecraft:fire' || block.typeId === 'minecraft:soul_fire'
const damageOffhand = (player: Player, offhandItem: ItemStack) => {
    const { item, changed } = applyItemDamage(player, offhandItem)
    if (!changed) return

    if (item.typeId === 'minecraft:air') consumeOffhand(player, offhandItem) // broke
    else setOffhand(player, item.typeId, item.amount, item.getComponent(ItemComponentTypes.Durability)?.damage ?? 0)
}

export const fireHandle = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, blockFace, itemStack } = data

    const target = neighbour(block, blockFace)
    if (!target) return

    // fix vanilla consumed wired durability
    if (isFire(target) && itemStack?.typeId === 'minecraft:flint_and_steel') data.cancel = true

    const offhandItem = getHeld(player, EquipmentSlot.Offhand)
    const fireSound = offhandItem && FIRE_ITEM[offhandItem.typeId]
    if (!offhandItem || !fireSound) return

    if (isLightBlock(target)) suppressLight(target, false)
    if (isFire(target)) return

    system.run(() => {
        try {
            if (!isSolid(target.below()) || !isAirOrLight(target)) return

            target.setType('minecraft:fire')
            swing(player, 'off')
            if (fireSound.REDUCE_ITEM) consumeOffhand(player, offhandItem)
            else damageOffhand(player, offhandItem)
            playSound(target.dimension, target.center(), fireSound)
        } catch (e) { debug(`[offhand] fire ${e}`) }
    })
}

const cocoaHandle = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, blockFace, itemStack } = data
    if (!COCOA_VALID_LOGS.has(block.typeId)) return

    // axe strips the log instead
    if (itemStack?.hasTag('minecraft:is_axe') && (block.typeId === 'minecraft:jungle_log' || block.typeId === 'minecraft:jungle_wood')) return

    const target = neighbour(block, blockFace)
    if (!target || !isAirOrLight(target)) return

    data.cancel = true
    system.run(() => {
        target.setPermutation(resolveCocoaPermutation(target, 0))
        swing(player, 'off')
        useOffhand(player)
    })
}

export const seedsHandle = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, blockFace } = data

    const typeId = getHeld(player, EquipmentSlot.Offhand)?.typeId
    if (!typeId) return
    if (typeId === 'minecraft:cocoa_beans') return cocoaHandle(data)

    const plant = SEED_TO_PLANT[typeId]
    if (!plant || blockFace !== Direction.Up) return
    if (block.typeId !== 'minecraft:farmland' && block.typeId !== 'minecraft:soul_sand') return

    const above = block.above()
    if (!above || !isAirOrLight(above)) return

    data.cancel = true
    system.run(() => {
        above.setType(plant)
        swing(player, 'off')
        useOffhand(player)
    })
}

const clickedHalf = (face: Direction, faceLocation: Vector3) => {
    if (face === Direction.Up) return 'top'
    if (face === Direction.Down) return 'bottom'
    return faceLocation.y > 0.5 ? 'bottom' : 'top'
}

// true = merged into double slab
const slabMerge = (data: PlayerInteractWithBlockBeforeEvent, typeId: string, creative: boolean) => {
    const { player, block, blockFace, faceLocation } = data

    const onSlab = block.typeId === typeId
    const slab = onSlab ? block : neighbour(block, blockFace)
    if (slab?.typeId !== typeId) return false

    let wouldBe = clickedHalf(blockFace, faceLocation)
    if (onSlab) wouldBe = wouldBe === 'top' ? 'bottom' : 'top' // flip

    const half = slab.permutation.getState('minecraft:vertical_half')
    if (!half || half !== wouldBe) return false

    data.cancel = true
    system.run(() => {
        try {
            const current = player.dimension.getBlock(slab.location)
            if (current?.typeId !== typeId) return

            current.setType(typeId.replace('_slab', '_double_slab'))
            swing(player, 'off')
            if (!creative) useOffhand(player)
        } catch (e) { debug(`[offhand] slabMerge ${e}`) }
    })
    return true
}

const upOn = (e: number, threshold = 0.8) => e % 1 >= threshold ? Math.ceil(e) : Math.floor(e)

// vanilla: can't place inside own hitbox
const insidePlayer = (player: Player, spot: Vector3) => {
    const { x, y, z } = player.location
    if (disSqu(sumLoc(spot, { x: 0.5, y: 0, z: 0.5 }), player.location) <= SELF_RANGE) return true

    return upOn(spot.x) === upOn(x) && spot.y === y + 1 && upOn(spot.z) === upOn(z)
}

export const blockHandle = (data: PlayerInteractWithBlockBeforeEvent, creative: boolean) => {
    const { player, block, blockFace, faceLocation } = data

    const typeId = getHeld(player, EquipmentSlot.Offhand)?.typeId
    if (!typeId) return
    if (SEED_TO_PLANT[typeId] || TORCH_ID.has(typeId)) return // other handlers
    if (isDoorItem(typeId) || !isBlockItem(typeId)) return

    if ((usesOnClick(block) || getInv(block)) && !player.isSneaking) return

    if (typeId.endsWith('_slab') && !typeId.endsWith('double_slab') && slabMerge(data, typeId, creative)) return

    const target = neighbour(block, blockFace)
    if (!target || !isReplaceableTarget(target)) return

    const { dimension } = player
    const yaw = player.getRotation().y
    const special = getSpecialPermutation(typeId, blockFace, faceLocation, block, target, yaw)
    if (special === undefined) return

    const permutation = special ?? resolveOrientedPermutation(typeId, blockFace, yaw)
    if (permutation.isLiquidBlocking(LiquidType.Water)) {
        if (insidePlayer(player, target.location)) return
        if (hasEntityInBlock(dimension, target.location, player.id)) return
    }

    data.cancel = true
    system.run(() => {
        try {
            const spot = dimension.getBlock(target.location)
            if (!spot || !isReplaceableTarget(spot)) return
            if (hasEntityInBlock(dimension, target.location, player.id)) return

            spot.setPermutation(permutation)
            swing(player, 'off')
            if (!creative) useOffhand(player)
        } catch (e) { debug(`[offhand] blockHandle ${e}`) }
    })
}
