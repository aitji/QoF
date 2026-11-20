import {
    type PlayerPlaceBlockAfterEvent,
    type EntityDieAfterEvent, type Entity,
    type Container, type Player,
    type PlayerInteractWithBlockBeforeEvent,
    type Block, type RawText,
    world, system, ItemStack, BlockPermutation, EquipmentSlot,
    ItemLockMode, InputPermissionCategory, EntityComponentTypes
} from "@minecraft/server"
import { type Dir, RUNTIME, checkPerm, debug, getEqu, getInv, getHeld, isCreative, playSound, cache } from "../lib"
const {
    CARRIED_CHEST: {
        CARRY_TAG, ENTITY_TYPE, CHEST_ID, DOUBLE_CHEST_SIZE,
        SLOWNESS_DURATION, SLOWNESS_AMPLIFIER, SOUND_PICK_UP,
        APPLY_IMPULSE, PLAYER_JUMP, CONTAINER_NAMETAG, MAX_DISPLAY
    }
} = RUNTIME

const STORAGE = 'qof:chest.storage'
const ALERT = 'qof.chest.alert'
const HALF = DOUBLE_CHEST_SIZE / 2
const SIDES: Record<Dir, [left: Dir, right: Dir]> = {
    north: ['west', 'east'],
    south: ['east', 'west'],
    east: ['north', 'south'],
    west: ['south', 'north'],
}

type CarryData = { selectedSlotIndex: number, blockTypeId: string }
const STATE_KEYS = ['minecraft:cardinal_direction', 'facing_direction', 'direction'] as const
const JUMP_BLOCKS = new Set<string>([
    ...(PLAYER_JUMP.ALLOW_JUMP_IN_LAVA ? ['minecraft:lava', 'minecraft:flowing_lava'] : []),
    ...(PLAYER_JUMP.ALLOW_JUMP_IN_SCAFFOLDING ? ['minecraft:scaffolding'] : []),
    ...(PLAYER_JUMP.ALLOW_JUMP_IN_LADDER ? ['minecraft:ladder'] : []),
])

// helper
const reName = (typeId: string) => typeId.split(':')[1]
    .split('_')
    .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

const carryData = (player: Player): CarryData | undefined => {
    const raw = player.getDynamicProperty(STORAGE)
    return typeof raw === 'string' ? JSON.parse(raw) : undefined
}

const isFaceChest = (block: Block | undefined, facing: string) =>
    block?.typeId === CHEST_ID &&
    block.permutation.getState("minecraft:cardinal_direction") === facing

const setJump = (player: Player, allow: boolean) => {
    if (!PLAYER_JUMP.NO_JUMP_HOLD_CHEST) return

    debug(`§7${player.name} jump=${allow}`)
    try { player.inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, allow) }
    catch (e) { debug(`§7Can't set jump ${player.name} to ${allow}:§8 ${e}`) }
}

// no longer carry
const dropCarry = (player: Player) => {
    try { getEqu(player)?.setEquipment(EquipmentSlot.Mainhand) } catch { }
    player.removeTag(CARRY_TAG)
    setJump(player, true)
    player.setDynamicProperty(STORAGE, undefined)
}

const copyInv = (container: Container) => Array.from({ length: container.size }, (_, i) => container.getItem(i))
const safeMove = (from: Container, fromSlot: number, to: Container, toSlot: number) => {
    try { from.moveItem(fromSlot, toSlot, to) }
    catch { }
}

const spawnInv = (player: Player) => {
    const entity = player.dimension.spawnEntity(ENTITY_TYPE as any, player.location)
    entity.nameTag = player.name
    return entity
}

const findInv = (player: Player) => {
    const query = { type: ENTITY_TYPE, name: player.name }
    const near = player.dimension.getEntities({ ...query, location: player.location, closest: 1 })
    if (near.length) return near[0]

    for (const id of ["overworld", "nether", "the_end"]) { // todo: cringe, need entity track in cache, use this as fallback
        const found = world.getDimension(id).getEntities(query)
        if (found.length) return found[0]
    }
}

const buildCarryItem = (blockTypeId: string, player: Player, container?: Container) => {
    const carry = new ItemStack(blockTypeId, 1)
    carry.nameTag = CONTAINER_NAMETAG
    carry.lockMode = ItemLockMode.slot

    if (!container) {
        carry.setLore([`§r§7${player.name}§r§7's Carried Container`])
        return carry
    }

    const stacks = new Map<string, { localization: string, typeId: string, nameTag?: string, amount: number }>()
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i)
        if (!item) continue

        const known = stacks.get(item.typeId)
        if (known) known.amount += item.amount
        else stacks.set(item.typeId, { localization: item.localizationKey, typeId: item.typeId, nameTag: item.nameTag, amount: item.amount })
    }

    const entries = [...stacks.values()]
    const lore: RawText[] = entries.slice(0, MAX_DISPLAY).map(entry => {
        const loz = entry.localization
        const name = entry.nameTag ?? (loz?.endsWith('.name') ? reName(entry.typeId) : loz ?? '')
        const amount = entry.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        return { rawtext: [{ text: '§r§7' }, { translate: name }, { text: ' §r§7x' }, { text: amount }] }
    })

    if (lore.length === 0) lore.push({ rawtext: [{ text: `§r§7(empty container)` }] })
    if (entries.length > MAX_DISPLAY) lore.push({ rawtext: [{ text: `§r§7and ${entries.length - MAX_DISPLAY} more...` }] })

    carry.setLore(lore)
    return carry
}

// chest to entity
const block2inv = (block: Block, heldInv: Entity) => {
    const container = getInv(block)?.container
    if (!container) return
    const heldCont = getInv(heldInv)!.container!

    if (container.size !== DOUBLE_CHEST_SIZE) {
        for (let i = 0; i < container.size; i++)
            if (container.getItem(i))
                safeMove(container, i, heldCont, i)
        return
    }

    const facing = block.permutation.getState("minecraft:cardinal_direction") as Dir
    const sides = SIDES[facing]
    if (!sides) return

    const left = block[sides[0]]()
    const hasLeft = isFaceChest(left, facing)
    const partner = hasLeft ? left : block[sides[1]]()
    const ours = hasLeft ? 0 : HALF
    const theirs = hasLeft ? HALF : 0

    for (let i = ours; i < ours + HALF; i++)
        if (container.getItem(i))
            safeMove(container, i, heldCont, i - ours)

    // partner half surv
    const parked = Array.from({ length: HALF }, (_, i) => theirs + i).filter(i => container.getItem(i))
    if (parked.length === 0 || !partner) return

    const relay = block.dimension.spawnEntity(ENTITY_TYPE as any, block.location)
    const relayCont = getInv(relay)!.container!
    for (const i of parked) safeMove(container, i, relayCont, i)

    system.runTimeout(() => {
        try {
            const partnerCont = getInv(partner)?.container
            if (!partnerCont) return

            for (const i of parked) safeMove(relayCont, i, partnerCont, i - theirs)
        } finally { relay.remove() }
    }, 1)
}

// entity to chest
const inv2block = (heldInv: Entity, block: Block, neighbourInv: (ItemStack | undefined)[][]) => {
    const container = getInv(block)?.container
    if (!container) return
    const heldCont = getInv(heldInv)!.container!

    if (container.size !== DOUBLE_CHEST_SIZE) {
        for (let i = 0; i < container.size; i++) safeMove(heldCont, i, container, i)
        heldInv.remove()
        return
    }

    system.runTimeout(() => {
        const dest = getInv(block)!.container!
        for (let i = 0; i < HALF; i++) safeMove(heldCont, i, dest, i)

        const their = neighbourInv[0] ?? []
        their.forEach((item, i) => { if (item) dest.setItem(HALF + i, item) })
        heldInv.remove()
    }, 1)
}

const pickUp = (player: Player, block: Block) => {
    if (!getInv(block)) return

    const blockTypeId = block.typeId
    if (blockTypeId.includes('lit_') || blockTypeId === "minecraft:jukebox") return

    const holdingEntity = spawnInv(player)
    holdingEntity.addTag(`type ${blockTypeId}`)
    block2inv(block, holdingEntity)

    getEqu(player)!.setEquipment(EquipmentSlot.Mainhand, buildCarryItem(blockTypeId, player, getInv(holdingEntity)?.container))
    player.setDynamicProperty(STORAGE, JSON.stringify({ selectedSlotIndex: cache.getPlayer(player, "selectedSlotIndex"), blockTypeId }))
    player.addTag(CARRY_TAG)
    setJump(player, false)
    playSound(player.dimension, player.location, SOUND_PICK_UP)
    block.setType("minecraft:air")

    if (!findInv(player)) dropCarry(player)
}

export const chest_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block } = data
    if (!player.isSneaking || player.hasTag(CARRY_TAG) || getHeld(player)) return
    if (!checkPerm(player) || !getInv(block)) return

    data.cancel = true
    system.runTimeout(() => {
        try { pickUp(player, block) }
        catch (e) {
            dropCarry(player)
            debug(`§cContainer pickup error: ${e}`)
        }
    }, 1)
}

export const chest_playerPlaceBlock = ({ player, block }: PlayerPlaceBlockAfterEvent) => {
    if (!block || !getInv(block) || !player.hasTag(CARRY_TAG)) return
    if (carryData(player)?.selectedSlotIndex !== cache.getPlayer(player, "selectedSlotIndex")) return

    const holdingEntity = findInv(player)
    if (!holdingEntity) {
        system.runTimeout(() => {
            player.sendMessage("§o§7could §nnot§7 find saved inventory...")
            dropCarry(player)
        }, 1)
        return
    }

    const blockTypeId = holdingEntity.getTags().find(t => t.startsWith("type "))?.substring(5) ?? CHEST_ID
    if (block.typeId !== blockTypeId) return

    const { dimension, location } = block
    const neighbourSnapshots: (ItemStack | undefined)[][] = []

    try {
        const perm = block.permutation
        if (blockTypeId === CHEST_ID) {
            const facing = perm.getState("minecraft:cardinal_direction") as Dir
            for (const side of SIDES[facing] ?? []) {
                const neighbour = block[side]()
                const container = getInv(neighbour!)?.container
                if (container && isFaceChest(neighbour, facing)) neighbourSnapshots.push(copyInv(container))
            }
        }

        // fresh block
        dimension.setBlockType(location, "minecraft:air")
        dimension.setBlockType(location, blockTypeId)
        const placed = dimension.getBlock(location)!

        const key = STATE_KEYS.find(k => perm.getState(k))
        if (key) placed.setPermutation(BlockPermutation.resolve(placed.typeId, { [key]: perm.getState(key)! }))

        inv2block(holdingEntity, placed, neighbourSnapshots)
    } catch {
        try { holdingEntity.teleport(player.location, { dimension: player.dimension }) }
        catch { }

        player.sendMessage("§o§7could not place the container. §iInventory restored...")
    } finally { dropCarry(player) }
}

const canJumpNow = (player: Player) => {
    if (PLAYER_JUMP.NO_JUMP_HOLD_CHEST && !APPLY_IMPULSE.ENABLED) return false

    let allow = false
    if (PLAYER_JUMP.ALLOW_JUMP_IN_WATER && player.isInWater) {
        allow = true
        if (APPLY_IMPULSE.ENABLED) player.applyImpulse(APPLY_IMPULSE.VECTOR)
    }

    const standingIn = player.dimension.getBlock(player.location)?.typeId
    return allow || (!!standingIn && JUMP_BLOCKS.has(standingIn))
}

export const chest_player = (player: Player) => {
    if (!player.hasTag(CARRY_TAG)) {
        if (PLAYER_JUMP.NO_JUMP_HOLD_CHEST && !player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Jump)) setJump(player, true)
        if (player.hasTag(ALERT)) player.removeTag(ALERT)
        return
    }

    player.addEffect("slowness", SLOWNESS_DURATION, { showParticles: false, amplifier: SLOWNESS_AMPLIFIER })

    const canJump = player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Jump)
    const allowJump = isCreative(player) || canJumpNow(player)
    if (allowJump !== canJump) setJump(player, allowJump)

    const data = carryData(player)
    if (data?.selectedSlotIndex !== cache.getPlayer(player, "selectedSlotIndex")) return

    const { selectedSlotIndex: slot, blockTypeId } = data
    const item = getHeld(player)
    const isCarryItem = item?.typeId === blockTypeId && item.nameTag === CONTAINER_NAMETAG
    if (isCarryItem) return

    if (item) {
        if (!player.hasTag(ALERT)) player.sendMessage(`§7§ohotbar Slot #${slot + 1} need to be empty.`)
        player.addTag(ALERT)
        return
    }

    // item gone, give it back
    const inv = findInv(player)
    if (!inv) {
        player.removeTag(CARRY_TAG)
        player.sendMessage(`§7§ocould not find saved inventory...`)
        return
    }

    getEqu(player)!.setEquipment(EquipmentSlot.Mainhand, buildCarryItem(blockTypeId, player, getInv(inv)?.container))
    player.removeTag(ALERT)
}

export const chest_entityDie = ({ deadEntity }: EntityDieAfterEvent) => {
    const player = deadEntity as Player
    if (!player.hasTag(CARRY_TAG)) return

    const { location, dimension } = player
    const container = getInv(player)?.container!
    const inv = findInv(player)
    if (!inv) return player.removeTag(CARRY_TAG)

    inv.teleport(location, { dimension })
    inv.kill()

    system.runTimeout(() => {
        container.clearAll()

        const drops = dimension.getEntities({ maxDistance: 3, type: "minecraft:item", location, closest: DOUBLE_CHEST_SIZE + container.size + 6 })
        for (const drop of drops) {
            if (!drop.isValid) continue

            const item = drop.getComponent(EntityComponentTypes.Item)?.itemStack
            if (item?.nameTag !== CONTAINER_NAMETAG) continue

            // back to a plain container
            try {
                dimension.spawnItem(new ItemStack(item.typeId, item.amount || 1), location)
                drop.remove()
            } catch { debug(`§c[chest] unexpected error while spawn normal container`) }
        }
    }, 1)
    player.removeTag(CARRY_TAG)
}
