import {
    type PlayerBreakBlockBeforeEvent, type Block,
    type Entity, type Player, type Vector3,
    type PlayerPlaceBlockAfterEvent,
    type EntityRemoveAfterEvent,
    system, BlockPermutation,
    EntityComponentTypes,
    EquipmentSlot,
    world,
} from "@minecraft/server"
import { StateName, cache, clamp, cursor, debug, floorLoc, getHeld, isLightBlock, permOf, playSound, roundRobin, RUNTIME, sumLoc } from "../../lib"

const {
    LIGHT: {
        LIGHT_WIKI: light, ENABLED, LIGHT_ENTITY, DECAY_LIGHT_TICK, REDUCE_LIGHT,
        LIGHT_RENDER_RADIUS, LIGHT_RENDER_PER_PLAYER, LIGHT_FIRE_LEVEL, LIGHT_REDUCE_LINEAR,
        FAIL_PARTICLE, PARTICLE_OFFSET, LIGHT_BLOCK, SOUND_FAIL, FAIL_SOUND_INTERVAL,
        LIGHT_PENDING_BATCH, LIGHT_PLAYER_BATCH, PRIORITY
    }
} = RUNTIME

const SEP = '|'
const FOREVER = 'Infinity'
const SUPP_BREAK = 8
const LEVEL = 'qof:light_level' as StateName
const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]

type Pos = { dim: string, x: number, y: number, z: number }
type Entry = Pos & { time: number, level: number, isWater: boolean, owner: string }

const lightMap = new Map<string, Entry>()
const frameSet = new Set<string>()
const entityLights = new Map<string, Set<string>>()
const suppressedLocs = new Map<string, number>()
const frozenKeys = new Set<string>()
const frozenDypKeys = new Map<string, string>()

// helper
const clamp15 = (n: number) => clamp(n, 0, 15)
const isLightable = (b: Block, liquid: boolean) => b.isAir || (liquid && b.isLiquid) || isLightBlock(b)
const isFrame = (b: Block) => b.typeId === 'minecraft:frame' || b.typeId === 'minecraft:glow_frame'
const shortId = (id: string) => id.split(':')[1]?.toLowerCase()

const lightPerms: BlockPermutation[] = []
const lightPerm = (level: number) => {
    const n = clamp15(level)
    return lightPerms[n] ??= permOf(LIGHT_BLOCK).withState(LEVEL, n)
}

const bKey = (dim: string, x: number | string, y: number | string, z: number | string) => `${dim}${SEP}${x}${SEP}${y}${SEP}${z}`
const blockKey = (b: Block) => bKey(b.dimension.id, b.x, b.y, b.z)
const parseKey = (key: string): Pos => {
    const [dim, x, y, z] = key.split(SEP)
    return { dim, x: +x, y: +y, z: +z }
}

const frameDypId = (key: string) => `frame${SEP}${key}`
const addEntry = (key: string, level: number, isWater: boolean, owner: string, time: number) => lightMap.set(key, { time, level, isWater, owner, ...parseKey(key) })
const trackOwner = (owner: string, key: string) => {
    if (owner === FOREVER) return

    let keys = entityLights.get(owner)
    if (!keys) {
        keys = new Set()
        entityLights.set(owner, keys)
    }
    keys.add(key)
}

const mirrorFreeze = (key: string, e: Entry) => {
    try {
        const next = `frozen${SEP}${key}${SEP}${e.level}${SEP}${e.isWater}${SEP}${e.owner}`
        const prev = frozenDypKeys.get(key)
        if (prev === next) return
        if (prev) world.setDynamicProperty(prev, undefined)
        world.setDynamicProperty(next, true)
        frozenDypKeys.set(key, next)
    } catch { }
}

const mirrorThaw = (key: string) => {
    const prev = frozenDypKeys.get(key)
    if (!prev) return

    try { world.setDynamicProperty(prev, undefined) } catch { }
    frozenDypKeys.delete(key)
}

const forget = (key: string) => {
    lightMap.delete(key)
    if (frozenKeys.delete(key)) mirrorThaw(key)
}

export const suppressLight = (block: Block, clean: boolean) => {
    if (!ENABLED) return

    const key = blockKey(block)
    forget(key)
    suppressedLocs.set(key, system.currentTick + SUPP_BREAK)

    if (clean) block.setPermutation(permOf('minecraft:air'))
}

function* restoreFromDYP() {
    let n = 0
    let migrated = 0

    for (const dy of world.getDynamicPropertyIds()) {
        const legacy = !dy.includes(SEP)
        const sep = legacy ? ':' : SEP
        const p = dy.split(sep)

        // legacy
        const keyAt = (i: number) => bKey(legacy && !p[i].includes(':') ? `minecraft:${p[i]}` : p[i], p[i + 1], p[i + 2], p[i + 3])
        const loadAt = (i: number) => {
            const key = keyAt(i)
            const owner = p.slice(i + 6).join(sep)
            if (!lightMap.has(key)) addEntry(key, +p[i + 4], p[i + 5] === 'true', owner, 0)
            return { key, owner }
        }

        switch (p[0]) {
            case 'light': {
                loadAt(1)
                world.setDynamicProperty(dy, undefined)
                if (legacy) migrated++
                break
            }
            case 'chuck_unload': // tech debt
            case 'chunk_unload': {
                loadAt(2)
                world.setDynamicProperty(dy, undefined)
                if (legacy) migrated++
                break
            }
            case 'frozen': {
                const { key, owner } = loadAt(1)
                if (!entityLights.get(owner)?.has(key)) trackOwner(owner, key)
                frozenKeys.add(key)

                if (legacy) {
                    world.setDynamicProperty(dy, undefined)
                    mirrorFreeze(key, lightMap.get(key)!)
                    migrated++
                } else frozenDypKeys.set(key, dy)
                break
            }
            case 'frame': {
                const key = keyAt(1)
                frameSet.add(key)

                if (legacy) {
                    world.setDynamicProperty(frameDypId(key), 1)
                    world.setDynamicProperty(dy, undefined)
                    migrated++
                }
                break
            }
            case 'supp':
                world.setDynamicProperty(dy, undefined)
                break
        }
        if (++n % 200 === 0) yield
    }
    if (migrated > 0) debug(`§7light migration ${migrated} entries`)
}

if (ENABLED) system.run(() => system.runJob(restoreFromDYP()))

const getItemLight = (id: string | undefined, en: Entity, tick: number) => {
    if (!id) return 0

    const data = light[shortId(id)]
    if (!data) return 0
    if (data.inLiquid === undefined) return data.light ?? 0

    const above = en.dimension.getBlock(floorLoc(en.location))?.above()
    const inLiquid = en.isSwimming ? en.isInWater : (above?.isLiquid || above?.isWaterlogged)
    if (data.inLiquid === inLiquid) return data.light ?? 0

    // dry
    if (!data.inLiquid && tick % FAIL_SOUND_INTERVAL === 0) {
        const { location, dimension } = en
        dimension.spawnParticle(FAIL_PARTICLE, sumLoc(location, PARTICLE_OFFSET))
        playSound(dimension, location, SOUND_FAIL)
    }
    return 0
}

const putLight = (block: Block, level: number, owner: string) => {
    const key = blockKey(block)
    const until = suppressedLocs.get(key)
    if (until !== undefined && system.currentTick < until) return

    const { typeId } = block
    if (block.isLiquid && block.permutation.getState('liquid_depth') !== 0) return
    if (typeId === 'minecraft:lava' || typeId === 'minecraft:fire') return

    const known = lightMap.get(key)
    if (known) {
        known.time = DECAY_LIGHT_TICK
        known.level = level
        return
    }

    const isWater = typeId === 'minecraft:water'
    addEntry(key, level, isWater, owner, DECAY_LIGHT_TICK)
    trackOwner(owner, key)

    if (isLightable(block, isWater)) block.setPermutation(lightPerm(level))
}

const spreadOffsets = new Map<number, Vector3[]>()
const offsetsFor = (height: number) => {
    let list = spreadOffsets.get(height)
    if (!list) {
        list = []
        for (let y = 0; y < height - 1; y++) {
            for (const [x, z] of PLUS) list.push({ x, y, z })
        }
        list.push({ x: 0, y: height - 1, z: 0 })
        spreadOffsets.set(height, list)
    }
    return list
}

const spreadLight = (origin: Block | undefined, level: number, owner: string, height = 2) => {
    if (!origin) return

    for (const offset of offsetsFor(height)) {
        try {
            const block = origin.offset(offset)
            if (!block || block.below()?.typeId === 'minecraft:grass_path') continue
            if (isLightable(block, true)) putLight(block, level, owner)
        } catch { }
    }
}

const pickLight = (a: number, b: number): number => {
    let level = 0
    switch (PRIORITY) {
        case 'main':
            level = clamp15(a > 0 ? a : b)
            break
        case 'off':
            level = clamp15(b > 0 ? b : a)
            break
        case 'combined':
            level = clamp15(a + b)
            break
        case 'hypot':
            level = clamp15(Math.hypot(a, b))
            break
        case 'brightest':
        default:
            level = clamp15(a > b ? a : b)
            break
    }
    level *= REDUCE_LIGHT
    return level
}

const lightUp = (en: Entity, mainId: string | undefined, offId: string | undefined, height: number, tick: number) => {
    try {
        const a = getItemLight(mainId, en, tick)
        const b = getItemLight(offId, en, tick)
        if (!(a || b)) return
        const level = pickLight(a, b)
        if (level <= 0) return

        spreadLight(en.dimension.getBlock(en.location), level, en.id, height)
    } catch (e) { debug(`§7e: ${e}`) }
}

// true=ded
const stepLight = (key: string, entry: Entry, thaw: boolean) => {
    const frozen = frozenKeys.has(key)
    if (frozen && !thaw) {
        entry.time -= LIGHT_REDUCE_LINEAR
        return false
    }

    try {
        const dimension = cache.getCachedDimension(entry.dim)
        if (!dimension) return true

        const block = dimension.getBlock(entry)
        if (!block) { // chunk not loaded
            frozenKeys.add(key)
            if (!frozen) {
                mirrorFreeze(key, entry)
                entry.time -= LIGHT_REDUCE_LINEAR
            }
            return false
        }

        if (frozen) {
            frozenKeys.delete(key)
            mirrorThaw(key)
        }

        const lightable = isLightable(block, entry.isWater)
        if (entry.time >= 0) {
            if (lightable) block.setPermutation(lightPerm(entry.level))
        } else { // fade out
            const current = block.permutation.getState(LEVEL) as number ?? 0
            if (current <= 0) {
                if (lightable) block.setPermutation(permOf(entry.isWater ? 'minecraft:water' : 'minecraft:air'))
                return true
            }
            if (lightable) block.setPermutation(lightPerm(current - LIGHT_REDUCE_LINEAR))
        }
        entry.time -= LIGHT_REDUCE_LINEAR
    } catch { }
    return false
}

let pendingKeys: string[] = []
let pendingSize = 0
let pendingCursor = 0

export const light_pending = (tick: number) => {
    if (tick % 200 === 0) // 10sec
        for (const [key, until] of suppressedLocs)
            if (until <= tick)
                suppressedLocs.delete(key)

    const size = lightMap.size
    if (size === 0) {
        pendingCursor = 0
        return
    }

    if (pendingKeys.length === 0 || Math.abs(pendingSize - size) > Math.max(10, size * 0.1)) {
        pendingKeys = [...lightMap.keys()]
        pendingSize = size
        pendingCursor %= pendingKeys.length
    }

    const thaw = tick % 20 === 0
    const dead: string[] = []
    for (const key of roundRobin(pendingKeys, pendingCursor, LIGHT_PENDING_BATCH)) {
        const entry = lightMap.get(key)
        if (entry && stepLight(key, entry, thaw)) dead.push(key)
    }
    pendingCursor = cursor(pendingCursor, pendingKeys.length, LIGHT_PENDING_BATCH)

    if (dead.length === 0) return

    for (const key of dead) {
        const owner = lightMap.get(key)?.owner
        if (owner) entityLights.get(owner)?.delete(key)
        forget(key)
    }
    pendingKeys.length = 0 // rebuild
}

const EXCLUDED = [
    'minecraft:xp_orb', 'minecraft:xp_bottle',
    'minecraft:command_block_minecart', 'minecraft:hopper_minecart',
    'minecraft:splash_potion'
]
const EXCLUDED_O1 = new Set(EXCLUDED)

let queue: Entity[] = []
let queueTick = -1
let queueCursor = 0

// every player shares one queue per tick
const buildQueue = (tick: number) => {
    queueTick = tick
    queue = []

    const seen = new Set<string>()
    for (const player of world.getPlayers()) {
        const nearby = player.dimension.getEntities({
            location: player.location,
            maxDistance: LIGHT_RENDER_RADIUS,
            closest: LIGHT_RENDER_PER_PLAYER,
            excludeTypes: EXCLUDED
        })
        for (const en of nearby) {
            if (EXCLUDED_O1.has(en.typeId) || seen.has(en.id)) continue
            seen.add(en.id)
            queue.push(en)
        }
    }

    queueCursor = queue.length ? queueCursor % queue.length : 0
}

export const light_player = (player: Player, tick: number) => {
    lightUp(player, getHeld(player)?.typeId, getHeld(player, EquipmentSlot.Offhand)?.typeId, 3, tick)

    if (queueTick !== tick) buildQueue(tick)
    if (queue.length === 0) return

    for (const en of roundRobin(queue, queueCursor, LIGHT_PLAYER_BATCH)) {
        if (!en.isValid) continue

        if (en.typeId === 'minecraft:item') {
            lightUp(en, en.getComponent(EntityComponentTypes.Item)?.itemStack?.typeId, undefined, 2, tick)
            continue
        }

        let level = en.getComponent(EntityComponentTypes.OnFire) ? LIGHT_FIRE_LEVEL * REDUCE_LIGHT : 0

        const glow = LIGHT_ENTITY[en.typeId]
        if (glow) level = pickLight(glow.light, level)
        if (level <= 0) continue

        spreadLight(en.dimension.getBlock(en.location), clamp15(level), en.id)
    }

    queueCursor = cursor(queueCursor, queue.length, LIGHT_PLAYER_BATCH)
}

export const light_entityRemove = ({ removedEntityId }: EntityRemoveAfterEvent) => {
    const keys = entityLights.get(removedEntityId)
    if (!keys) return

    for (const key of keys) {
        forget(key)

        const { dim, x, y, z } = parseKey(key)
        const dimension = cache.getCachedDimension(dim)
        if (!dimension) continue

        try { dimension.getBlock({ x, y, z })?.setPermutation(permOf('minecraft:air')) }
        catch { try { dimension.runCommand(`setblock ${x} ${y} ${z} air`) } catch { } }
    }
    entityLights.delete(removedEntityId)
    pendingKeys.length = 0
}

export const light_playerPlaceBlock = ({ block }: PlayerPlaceBlockAfterEvent) => {
    const key = blockKey(block)
    suppressedLocs.set(key, system.currentTick + SUPP_BREAK)
    if (!isFrame(block)) return

    frameSet.add(key)
    world.setDynamicProperty(frameDypId(key), 1)
    debug(`§7+ add frame: ${key}`)
}

export const light_processFrames = () => {
    const dead: string[] = []

    for (const key of frameSet) {
        try {
            const { dim, x, y, z } = parseKey(key)
            const dimension = cache.getCachedDimension(dim)
            const block = dimension?.getBlock({ x, y, z })
            if (!block || block.isAir) {
                dead.push(key)
                continue
            }

            const item = block.getItemStack(1)
            const data = item && light[shortId(item.typeId)]
            if (!data || typeof data.light !== 'number') continue

            spreadLight(block, clamp15(data.light * REDUCE_LIGHT), FOREVER)
        } catch { }
    }

    for (const key of dead) {
        frameSet.delete(key)
        world.setDynamicProperty(frameDypId(key), undefined)
        debug(`§7/ clear frame: ${key}`)
    }
}

export const light_playerBreakBlock = ({ block }: PlayerBreakBlockBeforeEvent) => {
    suppressedLocs.set(blockKey(block), system.currentTick + SUPP_BREAK)
}