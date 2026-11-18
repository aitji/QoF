import { Block, Dimension, EntityHitBlockAfterEvent, PlayerInteractWithBlockBeforeEvent, Vector3, system, world } from "@minecraft/server"
import { checkPerm, checkRandom, playSound, RUNTIME } from "../lib"
const cfg = RUNTIME.DOUBLE_DOOR

// helpers
type Kind = "door" | "gate" | "trapdoor"
type Dir = "east" | "south" | "west" | "north"
const direction: Dir[] = ["south", "west", "north", "east"]

const on = (v?: boolean) => v !== false
const kindOf = (id?: string): Kind | undefined => {
    if (!id) return undefined
    if (id.endsWith("_door")) return "door"
    if (id.endsWith("fence_gate")) return "gate"
    if (id.endsWith("trapdoor")) return "trapdoor"
    return undefined
}

const isIron = (id: string) => id.includes("iron_")
const getState = (b: Block, key: string) => {
    try { return b.permutation.getState(key as any) }
    catch { return undefined }
}
const flag = (b: Block, key: string) => !!getState(b, key)
const step = (b: Block, d: Dir): Block | undefined => {
    switch (d) {
        case "east": return b.east()
        case "west": return b.west()
        case "north": return b.north()
        case "south": return b.south()
        default: return undefined
    }
}

const locKey = (b: Block) => `${b.x},${b.y},${b.z}`
const setOpen = (blocks: Block[], open: boolean, facingFrom?: Block) => {
    for (const b of blocks) {
        try {
            let p = b.permutation.withState("open_bit", open)
            if (facingFrom) {
                const c = getState(facingFrom, "minecraft:cardinal_direction")
                if (c !== undefined) p = p.withState("minecraft:cardinal_direction" as any, c as any)
                else {
                    const d = getState(facingFrom, "direction")
                    if (d !== undefined) p = p.withState("direction" as any, d as any)
                }
            }
            b.setPermutation(p)
        } catch { }
    }
}

function flood(start: Block, sides: Dir[], accept: (n: Block) => boolean): Block[] {
    const out: Block[] = []
    const seen = new Set<string>([locKey(start)])
    const queue: Block[] = [start]
    while (queue.length && out.length < cfg.MAX_LINKED) {
        const cur = queue.shift()!
        for (const s of sides) {
            const n = step(cur, s)
            if (!n) continue
            const k = locKey(n)
            if (seen.has(k)) continue
            seen.add(k)
            if (!accept(n)) continue
            out.push(n)
            queue.push(n)
        }
    }
    return out
}

// door
const OPP: Record<Dir, Dir> = { east: "west", west: "east", north: "south", south: "north" }
const DOOR_PARTNER: Record<Dir, [Dir, Dir]> = {
    east: [OPP.east, "east"],
    south: [OPP.south, "south"],
    west: [OPP.west, "west"],
    north: [OPP.north, "north"],
}

const doorLower = (b: Block) => (flag(b, "upper_block_bit") ? b.below()! : b)
const doorHinge = (lower: Block) => flag(lower.above()!, "door_hinge_bit")
const doorFacing = (lower: Block): Dir | undefined => {
    const c = getState(lower, "minecraft:cardinal_direction")
    if (typeof c === "string") return c as Dir
    const n = getState(lower, "direction")
    return typeof n === "number" ? direction[n] : undefined
}

function dumpNeighbors(lower: Block): string {
    return direction.map(s => {
        const n = step(lower, s)
        if (!n || kindOf(n.typeId) !== "door") return `${s}=${n?.typeId ?? "none"}`
        const nl = doorLower(n)
        return `${s}=door(${doorFacing(nl)},hinge=${doorHinge(nl)})`
    }).join(" ")
}

function linkedDoor(lower: Block): Block[] {
    const facing = doorFacing(lower)
    if (!facing) return []

    const hinge = doorHinge(lower)
    const side = DOOR_PARTNER[facing][hinge ? 0 : 1]
    const n = step(lower, side)
    if (!n || kindOf(n.typeId) !== "door") return []
    if (isIron(n.typeId) && !cfg.IRON_BY_HAND) return []

    const nLower = doorLower(n)
    const nFacing = doorFacing(nLower)
    const nHinge = doorHinge(nLower)
    if (nFacing !== facing) return []
    if (nHinge === hinge) return []
    return [nLower]
}

// fence gate
const gateFacing = (b: Block): Dir | undefined => {
    const c = getState(b, "minecraft:cardinal_direction")
    if (typeof c === "string") return c as Dir
    const n = getState(b, "direction")
    return typeof n === "number" ? direction[n] : undefined
}

const gateAxis = (b: Block): "x" | "z" | undefined => {
    const f = gateFacing(b)
    if (!f) return undefined
    return f === "north" || f === "south" ? "x" : "z"
}

function linkedGates(b: Block): Block[] {
    const axis = gateAxis(b)
    if (!axis) return []
    const sides: Dir[] = axis === "x" ? ["east", "west"] : ["north", "south"]
    return flood(b, sides, n => kindOf(n.typeId) === "gate" && gateAxis(n) === axis)
}

// trapdoor
const trapAxis = (b: Block): "x" | "z" | undefined => {
    const n = getState(b, "direction")
    if (n === 0 || n === 1) return "z"
    if (n === 2 || n === 3) return "x"
    const c = getState(b, "minecraft:cardinal_direction")
    if (c === "east" || c === "west") return "z"
    if (c === "north" || c === "south") return "x"
    return undefined
}

function linkedTrapdoors(b: Block): Block[] {
    const axis = trapAxis(b)
    if (!axis) return []
    const sides: Dir[] = axis === "z" ? ["north", "south"] : ["east", "west"]
    const dir = getState(b, "direction")
    const card = getState(b, "minecraft:cardinal_direction")
    const up = getState(b, "upside_down_bit")
    return flood(b, sides, n =>
        kindOf(n.typeId) === "trapdoor" &&
        (!isIron(n.typeId) || !!cfg.IRON_BY_HAND) &&
        getState(n, "direction") === dir &&
        getState(n, "minecraft:cardinal_direction") === card &&
        getState(n, "upside_down_bit") === up
    )
}

function findLinked(base: Block, kind: Kind): Block[] {
    switch (kind) {
        case "door": return linkedDoor(base)
        case "gate": return linkedGates(base)
        case "trapdoor": return linkedTrapdoors(base)
    }
}

// sound
type Snd = { id: string, volume: number, pitch: [number, number] }

function soundOf(typeId: string, kind: Kind, open: boolean): Snd {
    const o = open ? "open" : "close"

    if (kind === "door") {
        if (typeId.includes("copper")) return { id: `${o}_door.copper`, volume: 1, pitch: open ? [1.0, 1.1] : [1.0, 1.0] }
        if (isIron(typeId)) return { id: `${o}.iron_door`, volume: 0.9, pitch: [0.9, 1.0] }
        if (typeId.includes("cherry")) return { id: `${o}.cherry_wood_door`, volume: 1, pitch: [0.9, 1.0] }
        if (typeId.includes("bamboo")) return { id: `${o}.bamboo_wood_door`, volume: 0.9, pitch: [0.9, 1.0] }
        if (typeId.includes("crimson") || typeId.includes("warped")) return { id: `${o}.nether_wood_door`, volume: 1, pitch: [0.9, 1.0] }
        return { id: `${o}.wooden_door`, volume: 0.9, pitch: [0.9, 1.0] }
    }

    if (kind === "gate") {
        if (typeId.includes("cherry")) return { id: `${o}.cherry_wood_fence_gate`, volume: 1, pitch: [0.9, 1.0] }
        if (typeId.includes("bamboo")) return { id: `${o}.bamboo_wood_fence_gate`, volume: 0.9, pitch: [0.99, 1.1] }
        if (typeId.includes("crimson") || typeId.includes("warped")) return { id: `${o}.nether_wood_fence_gate`, volume: 1, pitch: [0.9, 1.0] }
        return { id: `${o}.fence_gate`, volume: 0.9, pitch: [0.9, 1.0] }
    }

    // trapdoor
    if (typeId.includes("copper")) return { id: open ? "open_trapdoor.copper" : "close_door.copper", volume: 1, pitch: [1.0, 1.1] }
    if (isIron(typeId)) return { id: `${o}.iron_trapdoor`, volume: 0.9, pitch: [0.9, 1.0] }
    if (typeId.includes("cherry")) return { id: `${o}.cherry_wood_trapdoor`, volume: 1, pitch: [0.9, 1.0] }
    if (typeId.includes("bamboo")) return { id: `${o}.bamboo_wood_trapdoor`, volume: 1, pitch: [0.9, 1.0] }
    if (typeId.includes("crimson") || typeId.includes("warped")) return { id: `${o}.nether_wood_trapdoor`, volume: 1, pitch: [0.9, 1.0] }
    return { id: `${o}.wooden_trapdoor`, volume: 0.9, pitch: [0.9, 1.0] }
}

const playToggleSound = (dim: Dimension, loc: Vector3, typeId: string, kind: Kind, open: boolean) => {
    const s = soundOf(typeId, kind, open)
    playSound(dim, loc, { ID: s.id, VOLUME: s.volume, PITCH: checkRandom(s.pitch) })
}

function playLinkedSounds(dim: Dimension, loc: Vector3, blocks: Block[], kind: Kind, open: boolean) {
    const done = new Set<string>()
    for (const b of blocks) {
        try {
            const s = soundOf(b.typeId, kind, open)
            if (done.has(s.id)) continue
            done.add(s.id)
            playSound(dim, loc, { ID: s.id, VOLUME: s.volume, PITCH: checkRandom(s.pitch) })
        } catch { }
    }
}

type Played = { id: string, dim: string, loc: Vector3 }
function playOnce(played: Played[], dim: Dimension, loc: Vector3, typeId: string, kind: Kind, open: boolean) {
    const s = soundOf(typeId, kind, open)
    const dup = played.some(p =>
        p.id === s.id && p.dim === dim.id &&
        (p.loc.x - loc.x) ** 2 + (p.loc.y - loc.y) ** 2 + (p.loc.z - loc.z) ** 2 <= 16)
    if (dup) return
    played.push({ id: s.id, dim: dim.id, loc })
    playSound(dim, loc, { ID: s.id, VOLUME: s.volume, PITCH: checkRandom(s.pitch) })
}

// shop bell
function ringBell(dim: Dimension, loc: Vector3) {
    const r = 2
    for (let dy = 0; dy <= 3; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        try {
            const b = dim.getBlock({ x: loc.x + dx, y: loc.y + dy, z: loc.z + dz })
            if (b?.typeId !== "minecraft:bell") continue
            playSound(dim, b.location, { ID: "block.bell.hit", VOLUME: 2, PITCH: 1 })
            return
        } catch { }
    }
}

// auto close
type Tracked = { dim: Dimension, loc: Vector3, since: number }
const opened = new Map<string, Tracked>()
const keyOf = (dim: Dimension, loc: Vector3) => `${dim.id}|${loc.x}|${loc.y}|${loc.z}`
let nextScan = 0

function track(b: Block, tick: number) {
    const kind = kindOf(b.typeId)
    if ((kind !== "door" && kind !== "gate") || flag(b, "upper_block_bit")) return
    opened.set(keyOf(b.dimension, b.location), { dim: b.dimension, loc: b.location, since: tick })
}

// index call
export const door_pending = (tick: number) => {
    if (!cfg.ENABLED || !cfg.AUTO_CLOSE || opened.size === 0 || tick < nextScan) return
    nextScan = tick + 20

    const players = world.getAllPlayers()
    const r2 = cfg.AUTO_CLOSE_RADIUS * cfg.AUTO_CLOSE_RADIUS
    const played: Played[] = []

    for (const [key, e] of opened) {
        let b: Block | undefined
        try { b = e.dim.getBlock(e.loc) } catch { }
        const kind = kindOf(b?.typeId)
        if (!b || !kind || !flag(b, "open_bit")) { opened.delete(key); continue }
        if (tick - e.since < cfg.AUTO_CLOSE_DELAY) continue

        const near = players.some(p =>
            p.dimension.id === e.dim.id &&
            (p.location.x - (e.loc.x + 0.5)) ** 2 +
            (p.location.y - (e.loc.y + 0.5)) ** 2 +
            (p.location.z - (e.loc.z + 0.5)) ** 2 <= r2)
        if (near) continue

        setOpen([b], false)
        playOnce(played, e.dim, e.loc, b.typeId, kind, false)
        opened.delete(key)
    }
}

// events
const delay: Record<string, number> = {}
export const door_playerInteractWithBlock = (event: PlayerInteractWithBlockBeforeEvent) => {
    const { block, player, itemStack, isFirstEvent } = event
    if (checkPerm(player) === false) return
    const iron = isIron(block.typeId)
    if (iron && cfg.IRON_BY_HAND) {
        const now = system.currentTick
        if (!isFirstEvent) {
            const stamp = delay[player.id] ?? -1
            if (stamp === now + 5) return
            if (stamp > now) return
        }
        delay[player.id] = now + 5
    }

    const kind = kindOf(block.typeId)
    if (!kind) return
    if (!on({ door: cfg.DOOR, gate: cfg.GATE, trapdoor: cfg.TRAPDOOR }[kind])) return
    if (player.isSneaking && itemStack) return
    if (iron && !cfg.IRON_BY_HAND) return

    const base = kind === "door" ? doorLower(block) : block
    const willOpen = !flag(base, "open_bit")

    let linked: Block[] = []
    try { linked = findLinked(base, kind) }
    catch { }

    if (iron) event.cancel = true

    const { dimension } = base
    const loc = base.location
    const typeId = base.typeId

    system.run(() => {
        const tick = system.currentTick

        if (iron) {
            setOpen([base], willOpen)
            playToggleSound(dimension, loc, typeId, kind, willOpen)
        }

        if (linked.length) {
            let src: Block | undefined
            if (kind === "gate" && willOpen) { try { src = dimension.getBlock(loc) } catch { } }

            setOpen(linked, willOpen, src)
            playLinkedSounds(dimension, loc, linked, kind, willOpen)
        }

        if (cfg.AUTO_CLOSE) {
            if (willOpen) { track(base, tick); for (const l of linked) track(l, tick) }
            else opened.delete(keyOf(dimension, loc))
        }

        if (willOpen && kind === "door" && cfg.SHOP_BELL) ringBell(dimension, loc)
    })
}

// knocking
export const door_entityHitBlock = (event: EntityHitBlockAfterEvent) => {
    const { damagingEntity: player, hitBlock: block } = event
    if (kindOf(block.typeId) !== "door") return
    const { dimension, location } = block

    var volume = 1
    var sound = 'mob.zombie.wood'
    var range = 4
    var PITCH = checkRandom([0.8, 1.2])

    // knock sound
    switch (block.typeId) {
        case 'minecraft:iron_door':
            sound = 'hit.netherite'
            volume = 2
            break
        case "minecraft:crimson_door":
        case "minecraft:warped_door":
            sound = 'hit.nether_wart'
            break
        // minecraft:cherry_door, idk which sound to use
        case "minecraft:bamboo_door":
            sound = "fall.bamboo_wood"
            volume = 4
            break
        default:
            if (block.typeId.endsWith('copper_door')) {
                volume = 2
                sound = "break.copper_grate"
            }
            break
    }

    volume += player.isFalling || !player.isOnGround ? 3 : 0 // aka volume
    for (let i = 0; i < volume; i++)
        playSound(dimension, location, { ID: sound, VOLUME: range, PITCH })
}