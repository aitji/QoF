import { Block } from "@minecraft/server"
import { cfg, Dir, Kind, OPP, direction, flag, flood, getState, isIron, kindOf, step } from "./lib"

// door
const DOOR_PARTNER: Record<Dir, [Dir, Dir]> = {
    east: [OPP.east, "east"],
    south: [OPP.south, "south"],
    west: [OPP.west, "west"],
    north: [OPP.north, "north"],
}

export const doorLower = (b: Block) => (flag(b, "upper_block_bit") ? b.below()! : b)
const doorHinge = (lower: Block) => flag(lower.above()!, "door_hinge_bit")
const doorFacing = (lower: Block): Dir | undefined => {
    const c = getState(lower, "minecraft:cardinal_direction")
    if (typeof c === "string") return c as Dir
    const n = getState(lower, "direction")
    return typeof n === "number" ? direction[n] : undefined
}

// debug only
export function dumpNeighbors(lower: Block): string {
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

// entry
export function findLinked(base: Block, kind: Kind): Block[] {
    switch (kind) {
        case "door": return linkedDoor(base)
        case "gate": return linkedGates(base)
        case "trapdoor": return linkedTrapdoors(base)
    }
}
