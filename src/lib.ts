import {
    type Block, type Dimension, type Entity, type EntityEquippableComponent, type Vector3,
    BlockPermutation, Direction, EntityComponentTypes, EquipmentSlot, GameMode, system,
    ItemComponentTypes, ItemStack, LiquidType, Player, PlayerPermissionLevel, world
} from "@minecraft/server"
import { RUNTIME } from "./_store"
import * as cache from "./core/cache"

export { RUNTIME, cache }
export { swing } from "./core/swing"
export { pickupCooldown } from "./core/pickup"
export { createThrottle } from "./core/throttle"
const { DEBUG, LIGHT: { LIGHT_BLOCK } } = RUNTIME

// type
export type StateName = Parameters<BlockPermutation['getState']>[0]
export type Dir = 'north' | 'south' | 'east' | 'west'
export const OPPOSITE: Record<Dir, Dir> = { north: 'south', south: 'north', east: 'west', west: 'east' }
export type SoundDef = { ID: string, VOLUME?: number | number[], PITCH?: number | number[] }

// helpers
export const debug = (message: string) => DEBUG && world.sendMessage(message)
export const rand = (min: number, max: number) => Math.random() * (max - min) + min
export const checkRandom = (value: number | number[]) => Array.isArray(value) ? rand(value[0], value[1]) : value
export const clamp = (n: number, min: number = 0, max: number = 8) => Math.max(min, Math.min(max, Math.ceil(n)))
export const disSqu = (a: Vector3, b: Vector3) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
export const sumLoc = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
export const floorLoc = (loc: Vector3): Vector3 => ({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) })

export function* roundRobin<T>(items: readonly T[], cursor: number, budget: number): Generator<T> {
    const total = items.length
    if (total === 0) return

    const count = Math.min(budget, total)
    for (let i = 0; i < count; i++) yield items[(cursor + i) % total]
}
export const cursor = (cursor: number, total: number, budget: number) =>
    total === 0 ? 0 : (cursor + Math.min(budget, total)) % total
export const isCreative = (player: Player) => cache.getPlayer(player, 'gameMode') === GameMode.Creative
export const checkPerm = (player: Player): boolean => {
    const level = cache.getPlayer(player, "permissionLevel")
    return level !== PlayerPermissionLevel.Custom && level !== PlayerPermissionLevel.Visitor
}

export const isSolid = (block?: Block): boolean =>
    !!block && !block.isAir &&
    !block.permutation.matches(LIGHT_BLOCK) &&
    !block.isLiquid && !block.isWaterlogged &&
    block.isLiquidBlocking(LiquidType.Water) &&
    !block.permutation.canBeDestroyedByLiquidSpread(LiquidType.Water)

const FACE_TO_METHOD = {
    [Direction.Up]: 'above', [Direction.Down]: 'below',
    [Direction.North]: 'north', [Direction.South]: 'south',
    [Direction.East]: 'east', [Direction.West]: 'west',
} as const
export const neighbour = (block: Block, face: Direction): Block | undefined => block[FACE_TO_METHOD[face]]()

const permutations = new Map<string, BlockPermutation>()
export const permOf = (typeId: string) => {
    let perm = permutations.get(typeId)
    if (!perm) {
        perm = BlockPermutation.resolve(typeId)
        permutations.set(typeId, perm)
    }
    return perm
}

const blockItems = new Map<string, boolean>()
export const isBlockItem = (typeId: string) => {
    let known = blockItems.get(typeId)
    if (known === undefined) {
        try { known = !!BlockPermutation.resolve(typeId) }
        catch { known = false }
        blockItems.set(typeId, known)
    }
    return known
}

export const isLightBlock = (block?: Block) => block?.permutation?.matches(LIGHT_BLOCK) ?? false
export const isAirOrLight = (block?: Block) => !!block && (block.isAir || block.permutation.matches(LIGHT_BLOCK))

export const getEqu = (entity: Entity) => entity.getComponent(EntityComponentTypes.Equippable)!
export const getInv = (entity: Entity | Block | ItemStack) => entity.getComponent(EntityComponentTypes.Inventory)!
export const getHeld = (entity: Entity, slot: EquipmentSlot = EquipmentSlot.Mainhand) => getEqu(entity)?.getEquipment(slot)

export const tryRemove = (entity: Entity): boolean => {
    try {
        entity.remove()
        return true
    } catch { }

    try {
        entity.kill()
        return true
    } catch {
        return false
    }
}

export const playSound = (dimension: Dimension, location: Vector3, sound: SoundDef) => {
    const play = () => dimension.playSound(sound.ID, location, {
        volume: checkRandom(sound.VOLUME ?? 1),
        pitch: checkRandom(sound.PITCH ?? 1)
    })

    try { play() }
    catch { system.run(play) }
}

export const setEqu = (entity: Entity, item?: ItemStack, slot: EquipmentSlot = EquipmentSlot.Mainhand, ignoreCreative = false, equ?: EntityEquippableComponent) => {
    if (ignoreCreative && entity instanceof Player && isCreative(entity)) return false
    if (!equ) equ = getEqu(entity)

    try {
        equ.setEquipment(slot, item && item.amount > 0 ? item : undefined)
        return true
    } catch {
        debug(`[lib] setEqu failed: entity=${typeof entity}, item=${typeof item}, slot=${slot}`)
        return false
    }
}

export const reduceItem = (item: ItemStack) => {
    if (item.amount <= 1) return new ItemStack("minecraft:air", 1)

    const reduced = item.clone()
    reduced.amount -= 1
    return reduced
}

export const applyItemDamage = (player: Player, item: ItemStack) => { // only for weapon, not armor
    const enchant = item.getComponent(ItemComponentTypes.Enchantable)
    const durability = item.getComponent(ItemComponentTypes.Durability)
    if (!enchant || !durability) {
        debug(`[lib] ${item.typeId} should be a tool with durability that can be enchanted`)
        return { changed: false, item }
    }

    const unbreaking = enchant.getEnchantment("unbreaking")
    if (unbreaking?.level && Math.random() >= 1 / (unbreaking.level + 1)) return { changed: false, item }

    const worn = durability.damage + 1
    if (worn >= durability.maxDurability) {
        playSound(player.dimension, player.location, { ID: "random.break", VOLUME: 1, PITCH: 0.9 })
        return { changed: true, item: new ItemStack("minecraft:air", 1) }
    }

    durability.damage = worn
    return { changed: true, item }
}

export const addItem = (player: Player, item: ItemStack, amount: number = item.amount): boolean => {
    const container = getInv(player)?.container
    if (!container) return false

    for (let left = amount; left > 0; left -= item.maxAmount) {
        const stack = item.clone()
        stack.amount = Math.min(left, item.maxAmount)

        const overflow = container.addItem(stack)
        if (overflow) player.dimension.spawnItem(overflow, player.location)
    }
    return true
}

export const setOffhand = (player: Player, typeId: string, amount: number, data = 0) => {
    // no native support :sadge:
    return player.runCommand(`replaceitem entity @s slot.weapon.offhand 0 ${typeId} ${amount} ${data}`).successCount === 1
}

export const consumeOffhand = (player: Player, offhand: ItemStack) => {
    if (offhand.amount <= 1) return setEqu(player, undefined, EquipmentSlot.Offhand, false)
    return setOffhand(player, offhand.typeId, offhand.amount - 1) ?? false
}

export const heldAfterDelay = (player: Player, slot: number) => {
    if (cache.getPlayer(player, "selectedSlotIndex") !== slot) player.selectedSlotIndex = slot
    return getHeld(player)
}
