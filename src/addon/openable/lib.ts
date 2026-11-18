import { Block } from "@minecraft/server"
import { RUNTIME } from "../../lib"
export const cfg = RUNTIME.OPENABLE

// types
export type Kind = "door" | "gate" | "trapdoor"
export type Dir = "east" | "south" | "west" | "north"

export const direction: Dir[] = ["south", "west", "north", "east"]
export const OPP: Record<Dir, Dir> = { east: "west", west: "east", north: "south", south: "north" }

// helpers
export const kindOf = (id?: string): Kind | undefined => {
    if (!id) return undefined
    if (id.endsWith("_door")) return "door"
    if (id.endsWith("fence_gate")) return "gate"
    if (id.endsWith("trapdoor")) return "trapdoor"
    return undefined
}

export const isIron = (id: string) => id.includes("iron_")
export const getState = (b: Block, key: string) => {
    try { return b.permutation.getState(key as any) }
    catch { return undefined }
}

export const flag = (b: Block, key: string) => !!getState(b, key)
export const step = (b: Block, d: Dir): Block | undefined => {
    switch (d) {
        case "east": return b.east()
        case "west": return b.west()
        case "north": return b.north()
        case "south": return b.south()
        default: return undefined
    }
}

export const locKey = (b: Block) => `${b.x},${b.y},${b.z}`
export const setOpen = (blocks: Block[], open: boolean, facingFrom?: Block) => {
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

export function flood(start: Block, sides: Dir[], accept: (n: Block) => boolean): Block[] {
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
