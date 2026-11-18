import { Block, Dimension, Entity, Vector3 } from "@minecraft/server"
import { checkRandom, playSound } from "../../lib"
import { Kind, isIron, kindOf } from "./lib"

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

export const playToggleSound = (dim: Dimension, loc: Vector3, typeId: string, kind: Kind, open: boolean) => {
    const s = soundOf(typeId, kind, open)
    playSound(dim, loc, { ID: s.id, VOLUME: s.volume, PITCH: checkRandom(s.pitch) })
}

export function playLinkedSounds(dim: Dimension, loc: Vector3, blocks: Block[], kind: Kind, open: boolean) {
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

export type Played = { id: string, dim: string, loc: Vector3 }
export function playOnce(played: Played[], dim: Dimension, loc: Vector3, typeId: string, kind: Kind, open: boolean) {
    const s = soundOf(typeId, kind, open)
    const dup = played.some(p =>
        p.id === s.id && p.dim === dim.id &&
        (p.loc.x - loc.x) ** 2 + (p.loc.y - loc.y) ** 2 + (p.loc.z - loc.z) ** 2 <= 16)
    if (dup) return
    played.push({ id: s.id, dim: dim.id, loc })
    playSound(dim, loc, { ID: s.id, VOLUME: s.volume, PITCH: checkRandom(s.pitch) })
}

// shop bell
export function ringBell(dim: Dimension, loc: Vector3) {
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

// knocking
export function playKnock(block: Block, knocker: Entity) {
    if (kindOf(block.typeId) !== "door") return
    const { dimension, location } = block

    let repeats = 1
    let sound = "mob.zombie.wood"
    const volume = 4
    const PITCH = checkRandom([0.8, 1.2])

    switch (block.typeId) {
        case "minecraft:iron_door":
            sound = "hit.netherite"
            repeats = 2
            break
        case "minecraft:crimson_door":
        case "minecraft:warped_door":
            sound = "hit.nether_wart"
            break
        // minecraft:cherry_door, idk which sound to use
        case "minecraft:bamboo_door":
            sound = "fall.bamboo_wood"
            repeats = 4
            break
        default:
            if (block.typeId.endsWith("copper_door")) {
                repeats = 2
                sound = "break.copper_grate"
            }
            break
    }

    // stacked louder
    repeats += knocker.isFalling || !knocker.isOnGround ? 3 : 0
    for (let i = 0; i < repeats; i++)
        playSound(dimension, location, { ID: sound, VOLUME: volume, PITCH })
}
