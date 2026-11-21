import {
    type PlayerPlaceBlockAfterEvent,
    type EntityDieAfterEvent, type Entity,
    type Container, type Player,
    type PlayerInteractWithBlockBeforeEvent,
    type Block, type RawText,
    world, system, ItemStack, BlockPermutation,
    ItemLockMode, InputPermissionCategory, EntityComponentTypes
} from "@minecraft/server"
import { type Dir, RUNTIME, checkPerm, debug, getInv, getHeld, isCreative, playSound, cache } from "../lib"
const {
    CARRIED_CHEST: {
        CARRY_TAG, ENTITY_TYPE, CHEST_ID, SLOWNESS_DURATION,
        SLOWNESS_AMPLIFIER, SOUND_PICK_UP, APPLY_IMPULSE,
        PLAYER_JUMP, CONTAINER_NAMETAG, MAX_DISPLAY,
        DOUBLE_CHEST_SIZE, MAX_REGIONS, MAX_SETTLE_TICKS,
        PLACE_WINDOW, KICK_TICK
    }
} = RUNTIME

const STORAGE = 'qof:chest.storage'
const REGIONS = 'qof:chest.regions'
const REGION_TAG = 'region '
const ALERT = 'qof.chest.alert'
const HALF = DOUBLE_CHEST_SIZE / 2
const SIDES: Record<Dir, [left: Dir, right: Dir]> = {
    north: ['west', 'east'],
    south: ['east', 'west'],
    east: ['north', 'south'],
    west: ['south', 'north'],
}

const placing = new Map<string, number>()
const picking = new Set<string>()

type CarryData = { selectedSlotIndex: number, blockTypeId: string }
type Snapshot = (ItemStack | undefined)[]
type Region = 0 | 1 // 0=top 0-26, 1=bottom 27-53
type Pair = {
    items: Snapshot
    seen?: Region
    known?: Region
    ruleRegion: Region
}

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

const flip = (region: Region): Region => region === 0 ? 1 : 0
const regionKey = (block: Block) => `${block.dimension.id}|${block.x}|${block.y}|${block.z}`
const readRegions = (): Record<string, Region> => {
    const raw = world.getDynamicProperty(REGIONS)
    try { return typeof raw === 'string' ? JSON.parse(raw) : {} }
    catch { return {} }
}

const writeRegions = (map: Record<string, Region>) => {
    const keys = Object.keys(map)
    keys.slice(0, Math.max(0, keys.length - MAX_REGIONS)).forEach(k => delete map[k])
    world.setDynamicProperty(REGIONS, Object.keys(map).length ? JSON.stringify(map) : undefined)
}

const setRegion = (block: Block, region: Region) => {
    const map = readRegions()
    const key = regionKey(block)
    delete map[key]

    map[key] = region
    writeRegions(map)
}

const takeRegion = (block: Block): Region | undefined => {
    const map = readRegions()
    const key = regionKey(block)
    const region = map[key]
    if (region === undefined) return

    delete map[key]
    writeRegions(map)
    return region
}

const regionOf = (entity: Entity): Region | undefined => {
    const tag = entity.getTags().find(t => t.startsWith(REGION_TAG))
    if (!tag) return
    return tag.substring(REGION_TAG.length) === '1' ? 1 : 0
}

const setJump = (player: Player, allow: boolean) => {
    if (!PLAYER_JUMP.NO_JUMP_HOLD_CHEST) return

    debug(`§7${player.name} jump=${allow}`)
    try { player.inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, allow) }
    catch (e) { debug(`§7Can't set jump ${player.name} to ${allow}:§8 ${e}`) }
}

const isCarryItem = (item?: ItemStack) => !!item && item.nameTag === CONTAINER_NAMETAG && item.lockMode === ItemLockMode.slot
const clearCarryItems = (player: Player, keepSlot?: number) => {
    const inv = getInv(player)?.container
    if (!inv) return

    for (let i = 0; i < inv.size; i++) {
        if (i === keepSlot) continue
        if (isCarryItem(inv.getItem(i))) inv.setItem(i, undefined)
    }
}

// no longer carry
const dropCarry = (player: Player) => {
    try { clearCarryItems(player) }
    catch { }
    player.removeTag(CARRY_TAG)
    setJump(player, true)
    player.setDynamicProperty(STORAGE, undefined)
}

const copyInv = (container: Container): Snapshot => Array.from({ length: container.size }, (_, i) => container.getItem(i))
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

    for (const id of ["overworld", "nether", "the_end"]) {
        const found = cache.getCachedDimension(`minecraft:${id}`)!.getEntities(query)
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

const block2inv = (block: Block, heldInv: Entity): Region | undefined => {
    const container = getInv(block)?.container
    if (!container) return
    const heldCont = getInv(heldInv)!.container!

    if (container.size !== DOUBLE_CHEST_SIZE) {
        for (let i = 0; i < container.size; i++)
            if (container.getItem(i))
                safeMove(container, i, heldCont, i)

        // leftover half?
        return takeRegion(block)
    }

    const facing = block.permutation.getState("minecraft:cardinal_direction") as Dir
    const sides = SIDES[facing]
    if (!sides) return

    const left = block[sides[0]]()
    const hasLeft = isFaceChest(left, facing)
    const partner = hasLeft ? left : block[sides[1]]()
    const ours = hasLeft ? 0 : HALF
    const theirs = hasLeft ? HALF : 0
    const region: Region = hasLeft ? 0 : 1

    for (let i = ours; i < ours + HALF; i++)
        if (container.getItem(i))
            safeMove(container, i, heldCont, i - ours)

    if (partner && isFaceChest(partner, facing)) setRegion(partner, flip(region))

    // partner half surv
    const parked = Array.from({ length: HALF }, (_, i) => theirs + i).filter(i => container.getItem(i))
    if (parked.length === 0 || !partner) return region

    const relay = block.dimension.spawnEntity(ENTITY_TYPE as any, block.location)
    const relayCont = getInv(relay)!.container!
    for (const i of parked) safeMove(container, i, relayCont, i - theirs)

    system.runTimeout(() => {
        try {
            const partnerCont = getInv(partner)?.container
            if (!partnerCont) return

            for (const i of parked) safeMove(relayCont, i - theirs, partnerCont, i - theirs)
        } finally { relay.remove() }
    }, 1)

    return region
}

const fillSingle = (heldInv: Entity, block: Block, region?: Region) => {
    const container = getInv(block)?.container
    if (!container) return
    const heldCont = getInv(heldInv)!.container!

    for (let i = 0; i < container.size; i++) safeMove(heldCont, i, container, i)
    heldInv.remove()

    // may get partner
    if (region !== undefined) setRegion(block, region)
}

const readPair = (block: Block): Pair | undefined => {
    const cont = getInv(block)?.container
    if (cont?.size !== DOUBLE_CHEST_SIZE) return

    const facing = block.permutation.getState("minecraft:cardinal_direction") as Dir
    const sides = SIDES[facing]
    if (!sides) return

    const left = block[sides[0]]()
    const hasLeft = isFaceChest(left, facing)
    const partner = hasLeft ? left : block[sides[1]]()
    const ruleRegion: Region = hasLeft ? 0 : 1

    const view = copyInv(cont)
    const lo = view.slice(0, HALF)
    const hi = view.slice(HALF)
    const loUsed = lo.some(Boolean)
    const hiUsed = hi.some(Boolean)

    let seen: Region | undefined
    if (loUsed !== hiUsed) seen = loUsed ? 0 : 1
    else if (loUsed) seen = flip(ruleRegion)

    const items: Snapshot = seen === 1 ? hi : seen === 0 ? lo : new Array(HALF).fill(undefined)
    const known = partner && isFaceChest(partner, facing) ? takeRegion(partner) : undefined
    return { items, seen, known, ruleRegion }
}

const fillPair = (heldInv: Entity, block: Block, perm: BlockPermutation, mine: Region, partnerItems: Snapshot, waited = 0) => {
    if (!heldInv.isValid) return

    const dest = getInv(block)?.container
    if (dest?.size !== DOUBLE_CHEST_SIZE) {
        if (waited < MAX_SETTLE_TICKS) {
            if (waited === KICK_TICK) {
                try {
                    block.setType("minecraft:air")
                    block.setPermutation(perm)
                } catch (e) { debug(`§7[chest] re-place failed:§8 ${e}`) }
            }

            system.runTimeout(() => fillPair(heldInv, block, perm, mine, partnerItems, waited + 1), 1)
            return
        }

        debug(`§c[chest] pair did not settle, falling back to single fill`)
        if (dest) {
            const heldCont = getInv(heldInv).container!
            for (let i = 0; i < dest.size; i++) safeMove(heldCont, i, dest, i)
        }
        heldInv.remove()
        return
    }

    try {
        const heldCont = getInv(heldInv)!.container!
        const theirs = flip(mine)

        for (let i = 0; i < HALF; i++) {
            dest.setItem(mine * HALF + i, heldCont.getItem(i))
            dest.setItem(theirs * HALF + i, partnerItems[i])
        }
    } finally { heldInv.remove() }
}

const pickUp = (player: Player, block: Block, slot: number) => {
    if (player.hasTag(CARRY_TAG) || !getInv(block)) return

    const inv = getInv(player)?.container
    if (!inv || inv.getItem(slot)) return

    const blockTypeId = block.typeId
    if (blockTypeId.includes('lit_') || blockTypeId === "minecraft:jukebox") return

    const holdingEntity = spawnInv(player)
    holdingEntity.addTag(`type ${blockTypeId}`)

    const region = block2inv(block, holdingEntity)
    if (region !== undefined) holdingEntity.addTag(`${REGION_TAG}${region}`)

    inv.setItem(slot, buildCarryItem(blockTypeId, player, getInv(holdingEntity)?.container))
    player.setDynamicProperty(STORAGE, JSON.stringify({ selectedSlotIndex: slot, blockTypeId }))
    player.addTag(CARRY_TAG)
    setJump(player, false)
    playSound(player.dimension, player.location, SOUND_PICK_UP)
    block.setType("minecraft:air")

    if (!findInv(player)) dropCarry(player)
}

export const chest_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, itemStack } = data

    if (player.hasTag(CARRY_TAG) && isCarryItem(itemStack)) placing.set(player.id, system.currentTick)
    if (!player.isSneaking || player.hasTag(CARRY_TAG) || getHeld(player)) return
    if (!checkPerm(player) || !getInv(block)) return
    if (picking.has(player.id)) return

    data.cancel = true
    picking.add(player.id)

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.runTimeout(() => {
        try { pickUp(player, block, slot) }
        catch (e) {
            dropCarry(player)
            debug(`§cContainer pickup error: ${e}`)
        }
        finally { picking.delete(player.id) }
    }, 1)
}

export const chest_playerPlaceBlock = ({ player, block }: PlayerPlaceBlockAfterEvent) => {
    if (!block || !getInv(block) || !player.hasTag(CARRY_TAG)) return

    const usedAt = placing.get(player.id)
    const viaCarry = usedAt !== undefined && system.currentTick - usedAt <= PLACE_WINDOW
    if (!viaCarry && carryData(player)?.selectedSlotIndex !== cache.getPlayer(player, "selectedSlotIndex")) return
    placing.delete(player.id)

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

    try {
        const perm = block.permutation
        const mine = regionOf(holdingEntity)

        const pair = blockTypeId === CHEST_ID ? readPair(block) : undefined
        const partnerRegion = pair && (pair.known ?? pair.seen)
        const mineRegion: Region = mine ?? (partnerRegion !== undefined ? flip(partnerRegion) : pair?.ruleRegion ?? 0)

        // fresh block
        dimension.setBlockType(location, "minecraft:air")
        const placed = dimension.getBlock(location)!
        placed.setPermutation(perm)

        if (pair) fillPair(holdingEntity, placed, perm, mineRegion, pair.items)
        else fillSingle(holdingEntity, placed, mine)
    } catch (e) {
        debug(`§c[chest] place error: ${e}`)
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
    if (!data) return

    const { selectedSlotIndex: slot, blockTypeId } = data
    const inv = getInv(player)?.container
    if (!inv) return

    clearCarryItems(player, slot)

    const item = inv.getItem(slot)
    if (item?.typeId === blockTypeId && isCarryItem(item)) return

    if (item) {
        if (!player.hasTag(ALERT)) player.sendMessage(`§7§ohotbar Slot #${slot + 1} need to be empty.`)
        player.addTag(ALERT)
        return
    }

    // item gone, give it back
    const holding = findInv(player)
    if (!holding) {
        player.removeTag(CARRY_TAG)
        player.sendMessage(`§7§ocould not find saved inventory...`)
        return
    }

    inv.setItem(slot, buildCarryItem(blockTypeId, player, getInv(holding)?.container))
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
