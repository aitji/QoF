/**
 * Why do we use scripts to control loot tables?
 *    ...because entities that don't drop anything
 * are declared with the path 'loot_tables/empty.json',
 * which require maintainers to copy the whole entity
 * files in order to add mob loot that doesn't support.
 * Another downfall of that is every time Minecraft
 * update these entities, QoF add-on needs to bump
 * to another version to fix it.
 *  -aitji & pickerth-12
 */

import {
    type Dimension,
    type Entity,
    type EntityDamageCause,
    type EntityDieAfterEvent,
    EntityComponentTypes,
    EquipmentSlot,
    ItemStack,
    type Vector3
} from "@minecraft/server"
import { getEqu, pickupCooldown, rand, RUNTIME } from "../../lib"
const { DEBUG } = RUNTIME
import {
    LOOT_TABLES,
    type LootCondition,
    type LootEntry,
    type LootFunction,
    type LootTable,
    type Range,
} from "./tables"

interface LootContext {
    killedByPlayer: boolean
    killedByPlayerOrPet: boolean
    looting: number
    onFire: boolean
    isBaby: boolean
    cause: EntityDamageCause
}

const DROP_VELOCITY = { // hard code
    horizontal: { min: 0.02, max: 0.06 },
    vertical: { min: 0.08, max: 0.14 },
}

// helper
const passes = (conditions: LootCondition[] | undefined, ctx: LootContext) => !conditions || conditions.every((c) => check(c, ctx))
const randIntInc = (min: number, max: number) => {
    const lo = Math.ceil(Math.min(min, max))
    const hi = Math.floor(Math.max(min, max))
    return lo + Math.floor(Math.random() * (hi - lo + 1))
}
const resRange = (r: Range) => (typeof r === "number" ? r : randIntInc(r.min, r.max))
const resFloat = (r: Range) => (typeof r === "number" ? r : rand(r.min, r.max))
const getLooting = (killer: Entity): number => {
    const hand = getEqu(killer)?.getEquipment(EquipmentSlot.Mainhand)
    const enchants = hand?.getComponent("minecraft:enchantable")?.getEnchantments() ?? []
    for (const e of enchants)
        if (e.type.id === "looting" || e.type.id === "minecraft:looting")
            return e.level
    return 0
}

const buildCtx = (data: EntityDieAfterEvent): LootContext => {
    const { damageSource: dmg, deadEntity: ded } = data
    const killer = dmg.damagingEntity?.isValid ? dmg.damagingEntity : undefined

    const isPlayer = killer?.typeId === 'minecraft:player'
    const isPet = !!killer && !isPlayer && killer.hasComponent("minecraft:is_tamed")
    const fire = ded.getComponent(EntityComponentTypes.OnFire)?.onFireTicksRemaining ?? 0

    return {
        killedByPlayer: isPlayer,
        killedByPlayerOrPet: isPlayer || isPet,
        looting: killer ? getLooting(killer) : 0,
        onFire: fire > 0,
        isBaby: ded.hasComponent("minecraft:is_baby"),
        cause: dmg.cause,
    }
}

const check = (c: LootCondition, ctx: LootContext): boolean => {
    switch (c.condition) {
        case "killed_by_player": return ctx.killedByPlayer
        case "killed_by_player_or_pets": return ctx.killedByPlayerOrPet
        case "random_chance": return Math.random() < c.chance
        case "random_chance_with_looting": return Math.random() < c.chance + c.looting_multiplier * ctx.looting
        case "on_fire": return ctx.onFire === (c.value ?? true)
        case "is_baby": return ctx.isBaby === (c.value ?? true)
        case "damage_cause": return c.causes.includes(ctx.cause)
        default: {
            // const _e: never = c
            return false
        }
    }
}

const weightOf = (e: LootEntry, ctx: LootContext) => Math.max(0, (e.weight ?? 1) + (e.quality ?? 0) * ctx.looting)
const pickEntry = (entries: LootEntry[], ctx: LootContext): LootEntry | undefined => {
    const pass = entries.filter((e) => passes(e.conditions, ctx) && weightOf(e, ctx) > 0)
    const total = pass.reduce((sum, e) => sum + weightOf(e, ctx), 0)
    if (total <= 0) return undefined

    let roll = Math.random() * total
    for (const entry of pass) {
        roll -= weightOf(entry, ctx)
        if (roll < 0) return entry
    }
    return pass[pass.length - 1]
}

const applyFn = (functions: LootFunction[] | undefined, ctx: LootContext): { count: number; durability?: number } => {
    let count = 1
    let durability: number | undefined
    for (const fn of functions ?? []) {
        switch (fn.function) {
            case "set_count":
                count = resRange(fn.count)
                break
            case "looting_enchant":
                if (ctx.looting > 0) {
                    const r = typeof fn.count === "number" ? { min: fn.count, max: fn.count } : fn.count
                    count += randIntInc(r.min * ctx.looting, r.max * ctx.looting)
                }
                if (fn.limit !== undefined) count = Math.min(count, fn.limit)
                break
            case "set_durability":
                durability = Math.min(1, Math.max(0, resFloat(fn.durability)))
                break
            default: { const _e: never = fn }
        }
    }
    return { count: Math.max(0, Math.floor(count)), durability }
}

const rollTable = (table: LootTable, ctx: LootContext): [id: string, amount: number, durability?: number][] => {
    const drops: [string, number, number?][] = []

    for (const pool of table.pools) {
        if (!passes(pool.conditions, ctx)) continue

        const rolls = Math.max(0, resRange(pool.rolls ?? 1))
        for (let i = 0; i < rolls; i++) {
            const entry = pickEntry(pool.entries, ctx)
            if (!entry || entry.type === "empty") continue

            const { count, durability } = applyFn(entry.functions, ctx)
            if (count > 0) drops.push([entry.item, count, durability])
        }
    }
    return drops
}

const dropVEL = (): Vector3 => {
    const angle = rand(0, Math.PI * 2)
    const speed = rand(DROP_VELOCITY.horizontal.min, DROP_VELOCITY.horizontal.max)
    return {
        x: Math.cos(angle) * speed,
        y: rand(DROP_VELOCITY.vertical.min, DROP_VELOCITY.vertical.max),
        z: Math.sin(angle) * speed,
    }
}

const spawnDrop = (dimension: Dimension, location: Vector3, id: string, amount: number, pickupDelay?: number, durability?: number) => {
    let remaining = amount
    while (remaining > 0) {
        const stack = new ItemStack(id, 1)
        stack.amount = Math.min(remaining, stack.maxAmount)
        remaining -= stack.amount

        const dur = durability === undefined ? undefined : stack.getComponent("minecraft:durability")
        if (dur) dur.damage = Math.min(dur.maxDurability - 1, Math.round(dur.maxDurability * (1 - durability!)))

        const drop = dimension.spawnItem(stack, location)
        drop.clearVelocity()
        drop.applyImpulse(dropVEL())

        pickupCooldown(drop, pickupDelay)
    }
}


const getLootTable = (typeId: string): LootTable | undefined => (LOOT_TABLES as Record<string, LootTable | undefined>)[typeId]
export const loots_entityDie = (data: EntityDieAfterEvent) => {
    const { deadEntity } = data
    const table = getLootTable(deadEntity.typeId)
    if (!table || !deadEntity.isValid) return

    try {
        const { dimension, location } = deadEntity
        const ctx = buildCtx(data)

        for (const [id, amount, durability] of rollTable(table, ctx)) {
            try { spawnDrop(dimension, location, id, amount, table.pickupDelay, durability) }
            catch (e) { if (DEBUG) console.warn(`[loot] could not drop "${id}" x${amount} for ${deadEntity.typeId}: ${e}`) }
        }
    } catch (e) { if (DEBUG) console.warn(`[loot] ${deadEntity.typeId} died but loot failed: ${e}`) }
}
