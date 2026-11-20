import { type Block } from "@minecraft/server"
import { Dir, RUNTIME, StateName } from "../../lib"

export const cfg = RUNTIME.OPENABLE
export type Kind = "door" | "gate" | "trapdoor"
export const DIRECTION: Dir[] = ["south", "west", "north", "east"]

export const kindOf = (id?: string): Kind | undefined => {
    if (!id) return undefined
    if (id.endsWith("_door")) return "door"
    if (id.endsWith("fence_gate")) return "gate"
    if (id.endsWith("trapdoor")) return "trapdoor"
    return undefined
}

export const isIron = (id: string) => id.includes("iron_")
export const getState = (b: Block, key: string) => {
    try { return b.permutation.getState(key as StateName) }
    catch { return undefined }
}

export const flag = (b: Block, key: string) => !!getState(b, key)
export const facingOf = (b: Block): Dir | undefined => {
    const cardinal = getState(b, "minecraft:cardinal_direction")
    if (typeof cardinal === "string") return cardinal as Dir

    const index = getState(b, "direction")
    return typeof index === "number" ? DIRECTION[index] : undefined
}

export const setOpen = (blocks: Block[], open: boolean, facingFrom?: Block) => {
    for (const b of blocks) {
        try {
            let perm = b.permutation.withState("open_bit", open)
            if (facingFrom) {
                const cardinal = getState(facingFrom, "minecraft:cardinal_direction")
                const direction = getState(facingFrom, "direction")
                if (cardinal !== undefined) perm = perm.withState("minecraft:cardinal_direction" as StateName, cardinal)
                else if (direction !== undefined) perm = perm.withState("direction" as StateName, direction)
            }
            b.setPermutation(perm)
        } catch { }
    }
}

const locKey = (b: Block) => `${b.x},${b.y},${b.z}`
export const flood = (start: Block, sides: Dir[], accept: (n: Block) => boolean): Block[] => {
    const out: Block[] = []
    const seen = new Set([locKey(start)])
    const queue = [start]

    for (const cur of queue) {
        if (out.length >= cfg.MAX_LINKED) break

        for (const side of sides) {
            const next = cur[side]()
            if (!next || seen.has(locKey(next))) continue

            seen.add(locKey(next))
            if (!accept(next)) continue

            out.push(next)
            queue.push(next)
        }
    }
    return out
}
