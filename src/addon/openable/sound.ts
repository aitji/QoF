import { type Block, type Dimension, type Entity, type Vector3 } from "@minecraft/server"
import { checkRandom, disSqu, playSound, sumLoc } from "../../lib"
import { Kind, kindOf } from "./lib"

type Pitch = [number, number]
type Sound = { id: string, volume: number, pitch: Pitch }

const STD: Pitch = [0.9, 1.0]
const NAME: Record<Kind, string> = { door: "door", gate: "fence_gate", trapdoor: "trapdoor" }
const RULES: Record<Kind, [match: string, prefix: string, volume: number, pitch: Pitch][]> = {
    door: [
        ["iron_", "iron_", 0.9, STD],
        ["cherry", "cherry_wood_", 1, STD],
        ["bamboo", "bamboo_wood_", 0.9, STD],
        ["crimson", "nether_wood_", 1, STD],
        ["warped", "nether_wood_", 1, STD],
        ["", "wooden_", 0.9, STD],
    ],
    gate: [
        ["cherry", "cherry_wood_", 1, STD],
        ["bamboo", "bamboo_wood_", 0.9, [0.99, 1.1]],
        ["crimson", "nether_wood_", 1, STD],
        ["warped", "nether_wood_", 1, STD],
        ["", "", 0.9, STD],
    ],
    trapdoor: [
        ["iron_", "iron_", 0.9, STD],
        ["cherry", "cherry_wood_", 1, STD],
        ["bamboo", "bamboo_wood_", 1, STD],
        ["crimson", "nether_wood_", 1, STD],
        ["warped", "nether_wood_", 1, STD],
        ["", "wooden_", 0.9, STD],
    ],
}

const soundOf = (typeId: string, kind: Kind, open: boolean): Sound => {
    const o = open ? "open" : "close"

    if (typeId.includes("copper") && kind !== "gate") {
        if (kind === "door") return { id: `${o}_door.copper`, volume: 1, pitch: open ? [1.0, 1.1] : [1.0, 1.0] }
        return { id: open ? "open_trapdoor.copper" : "close_door.copper", volume: 1, pitch: [1.0, 1.1] } // close_door is not a typo
    }

    const [, prefix, volume, pitch] = RULES[kind].find(([match]) => typeId.includes(match))!
    return { id: `${o}.${prefix}${NAME[kind]}`, volume, pitch }
}

const emit = (dim: Dimension, loc: Vector3, { id, volume, pitch }: Sound) =>
    playSound(dim, loc, { ID: id, VOLUME: volume, PITCH: pitch })

export const playToggleSound = (dim: Dimension, loc: Vector3, typeId: string, kind: Kind, open: boolean) =>
    emit(dim, loc, soundOf(typeId, kind, open))

export const playLinkedSounds = (dim: Dimension, loc: Vector3, blocks: Block[], kind: Kind, open: boolean) => {
    const done = new Set<string>()
    for (const b of blocks) {
        try {
            const sound = soundOf(b.typeId, kind, open)
            if (done.has(sound.id)) continue

            done.add(sound.id)
            emit(dim, loc, sound)
        } catch { }
    }
}

export type Played = { id: string, dim: string, loc: Vector3 }
export const playOnce = (played: Played[], dim: Dimension, loc: Vector3, typeId: string, kind: Kind, open: boolean) => {
    const sound = soundOf(typeId, kind, open)
    if (played.some(p => p.id === sound.id && p.dim === dim.id && disSqu(p.loc, loc) <= 16)) return

    played.push({ id: sound.id, dim: dim.id, loc })
    emit(dim, loc, sound)
}

// shop bell
const BELL_OFFSETS: Vector3[] = []
for (let y = 0; y <= 3; y++)
    for (let x = -2; x <= 2; x++)
        for (let z = -2; z <= 2; z++) BELL_OFFSETS.push({ x, y, z })

export const ringBell = (dim: Dimension, loc: Vector3) => {
    for (const offset of BELL_OFFSETS) {
        try {
            const block = dim.getBlock(sumLoc(loc, offset))
            if (block?.typeId !== "minecraft:bell") continue

            playSound(dim, block.location, { ID: "block.bell.hit", VOLUME: 2, PITCH: 1 })
            return
        } catch { }
    }
}

// knocking: [sound, repeats]
const KNOCK: Record<string, [string, number]> = {
    "minecraft:iron_door": ["hit.netherite", 2],
    "minecraft:crimson_door": ["hit.nether_wart", 1],
    "minecraft:warped_door": ["hit.nether_wart", 1],
    // minecraft:cherry_door, idk which sound to use
    "minecraft:bamboo_door": ["fall.bamboo_wood", 4],
}

export const playKnock = (block: Block, knocker: Entity) => {
    const { typeId, dimension, location } = block
    if (kindOf(typeId) !== "door") return

    const [sound, base] = KNOCK[typeId] ?? (typeId.endsWith("copper_door") ? ["break.copper_grate", 2] : ["mob.zombie.wood", 1])
    const pitch = checkRandom([0.8, 1.2])

    // stacked louder
    const repeats = base + (knocker.isFalling || !knocker.isOnGround ? 3 : 0)
    for (let i = 0; i < repeats; i++) playSound(dimension, location, { ID: sound, VOLUME: 4, PITCH: pitch })
}
