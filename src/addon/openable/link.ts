import { type Block } from "@minecraft/server"
import { type Dir, OPPOSITE } from "../../lib"
import { type Kind, cfg, facingOf, flag, flood, getState, isIron, kindOf } from "./lib"

const SIDES = { x: ["east", "west"], z: ["north", "south"] } as const satisfies Record<string, Dir[]>
type Axis = keyof typeof SIDES

// door
export const doorLower = (b: Block) => flag(b, "upper_block_bit") ? b.below()! : b
const doorHinge = (lower: Block) => flag(lower.above()!, "door_hinge_bit")
const linkedDoor = (lower: Block): Block[] => {
    const facing = facingOf(lower)
    if (!facing) return []

    const hinge = doorHinge(lower)
    const next = lower[hinge ? OPPOSITE[facing] : facing]()
    if (!next || kindOf(next.typeId) !== "door") return []
    if (isIron(next.typeId) && !cfg.IRON_BY_HAND) return []

    const nextLower = doorLower(next)
    if (facingOf(nextLower) !== facing || doorHinge(nextLower) === hinge) return []
    return [nextLower]
}

// fence gate
const gateAxis = (b: Block): Axis | undefined => {
    const facing = facingOf(b)
    if (!facing) return undefined
    return facing === "north" || facing === "south" ? "x" : "z"
}
const linkedGates = (b: Block): Block[] => {
    const axis = gateAxis(b)
    if (!axis) return []
    return flood(b, [...SIDES[axis]], n => kindOf(n.typeId) === "gate" && gateAxis(n) === axis)
}

// trapdoor
const trapAxis = (b: Block): Axis | undefined => {
    const n = getState(b, "direction")
    if (n === 0 || n === 1) return "z"
    if (n === 2 || n === 3) return "x"

    const c = getState(b, "minecraft:cardinal_direction")
    if (c === "east" || c === "west") return "z"
    if (c === "north" || c === "south") return "x"
    return undefined
}

const linkedTrapdoors = (b: Block): Block[] => {
    const axis = trapAxis(b)
    if (!axis) return []

    // spreads other axis
    const sides = SIDES[axis === "z" ? "z" : "x"]
    const direction = getState(b, "direction")
    const cardinal = getState(b, "minecraft:cardinal_direction")
    const upsideDown = getState(b, "upside_down_bit")

    return flood(b, [...sides], n =>
        kindOf(n.typeId) === "trapdoor" &&
        (!isIron(n.typeId) || cfg.IRON_BY_HAND) &&
        getState(n, "direction") === direction &&
        getState(n, "minecraft:cardinal_direction") === cardinal &&
        getState(n, "upside_down_bit") === upsideDown
    )
}

export const findLinked = (base: Block, kind: Kind): Block[] => {
    switch (kind) {
        case "door": return linkedDoor(base)
        case "gate": return linkedGates(base)
        case "trapdoor": return linkedTrapdoors(base)
    }
}
