import {
    type Block, type Dimension, type Vector3,
    system, BlockPermutation, Direction
} from "@minecraft/server"
import { Dir, StateName, isSolid, OPPOSITE, RUNTIME } from "../../lib"

const VANILLA_REPLACEABLE = new Set([
    'minecraft:tallgrass', 'minecraft:short_grass', 'minecraft:fern',
    'minecraft:short_dry_grass', 'minecraft:tall_dry_grass',
    'minecraft:deadbush', 'minecraft:snow_layer', 'minecraft:fire',
    'minecraft:soul_fire', 'minecraft:vine', 'minecraft:nether_sprouts',
    'minecraft:crimson_roots', 'minecraft:warped_roots', 'minecraft:seagrass',
    RUNTIME.LIGHT.LIGHT_BLOCK, 'minecraft:light_block'
])

export const isReplaceableTarget = (b: Block): boolean => b.isAir || b.isLiquid || VANILLA_REPLACEABLE.has(b.typeId)

export const hasEntityInBlock = (dimension: Dimension, loc: Vector3, excludeId?: string): boolean => {
    try {
        const center = { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }

        for (const e of dimension.getEntities({ location: center, maxDistance: 2 })) {
            if (e.id === excludeId) continue

            // AABB overlap: entity box vs block box [loc, loc+1]
            const { center: c, extent: x } = e.getAABB()
            if (
                c.x + x.x > loc.x && c.x - x.x < loc.x + 1 &&
                c.y + x.y > loc.y && c.y - x.y < loc.y + 1 &&
                c.z + x.z > loc.z && c.z - x.z < loc.z + 1
            ) return true
        }
    } catch { }
    return false
}

export const yawToCardinal = (yaw: number): Dir => {
    const y = ((yaw % 360) + 360) % 360
    if (y >= 315 || y < 45) return 'south'
    if (y < 135) return 'west'
    if (y < 225) return 'north'
    return 'east'
}

const CARDINAL_TO_FACING: Record<Dir, number> = { north: 2, south: 3, west: 4, east: 5 }
const CARDINAL_TO_WEIRDO: Record<Dir, number> = { east: 0, west: 1, south: 2, north: 3 }
const CARDINAL_TO_DIR: Record<Dir, number> = { south: 0, west: 1, north: 2, east: 3 }
const FACE_CARDINAL: Partial<Record<Direction, Dir>> = {
    [Direction.North]: 'north', [Direction.South]: 'south',
    [Direction.East]: 'east', [Direction.West]: 'west',
}
const FACE_ATTACH_FACING: Record<Direction, number> = {
    [Direction.Down]: 0, [Direction.Up]: 1,
    [Direction.North]: 2, [Direction.South]: 3, [Direction.West]: 4, [Direction.East]: 5,
}
// bits: south=1 west=2 north=4 east=8, set the face touching the wall
const VINE_BITS: Partial<Record<Direction, number>> = {
    [Direction.North]: 1, [Direction.South]: 4,
    [Direction.East]: 2, [Direction.West]: 8,
}
const LICHEN_BITS: Partial<Record<Direction, number>> = {
    [Direction.Up]: 1, [Direction.Down]: 2,
    [Direction.North]: 4, [Direction.South]: 16,
    [Direction.East]: 8, [Direction.West]: 32,
}

export const isDoorItem = (typeId: string) => typeId.endsWith('_door')

// facing like ladder, Up = literal
const ATTACH = new Set(['minecraft:observer', 'minecraft:ladder', 'minecraft:amethyst_cluster'])
const isAttach = (id: string) => ATTACH.has(id) || id.endsWith('_amethyst_bud') || id.endsWith('_shelf')
// floor = 1, ceiling = 0, sides same
const isVerticalAttach = (id: string) => id === 'minecraft:end_rod' || id === 'minecraft:lightning_rod' || id.endsWith('_button')

const flipFacing = (blockFace: Direction, yaw: number) => {
    if (blockFace === Direction.Up) return CARDINAL_TO_FACING[yawToCardinal(yaw)]
    if (blockFace === Direction.Down) return 0
    return CARDINAL_TO_FACING[OPPOSITE[FACE_CARDINAL[blockFace]!]]
}

const facingFor = (typeId: string, blockFace: Direction, yaw: number) => {
    if (isVerticalAttach(typeId)) return FACE_ATTACH_FACING[blockFace]
    if (isAttach(typeId)) return blockFace === Direction.Up ? CARDINAL_TO_FACING[yawToCardinal(yaw)] : FACE_ATTACH_FACING[blockFace]
    return flipFacing(blockFace, yaw) // output toward player
}

const tryState = (base: BlockPermutation, state: StateName, value: string | number | boolean) => {
    try { return base.withState(state, value) } catch { }
}

// generic orientation, first state the block has wins
export const resolveOrientedPermutation = (typeId: string, blockFace: Direction, yaw: number): BlockPermutation => {
    const base = BlockPermutation.resolve(typeId)
    const faceDir = FACE_CARDINAL[blockFace]
    const lookDir = faceDir ?? yawToCardinal(yaw)

    const axis = blockFace === Direction.Up || blockFace === Direction.Down ? 'y'
        : blockFace === Direction.North || blockFace === Direction.South ? 'z' : 'x'

    return tryState(base, 'pillar_axis', axis) ??
        tryState(base, 'facing_direction', facingFor(typeId, blockFace, yaw)) ??
        tryState(base, 'minecraft:cardinal_direction', faceDir ? OPPOSITE[faceDir] : lookDir) ?? // flip
        tryState(base, 'direction', CARDINAL_TO_DIR[lookDir]) ?? // same, trapdoor / fence_gate
        base
}

type SupportFn = (support: Block) => boolean
const hasDirt: SupportFn = b => b.hasTag('dirt')
const hasMoss: SupportFn = b => b.typeId === 'minecraft:moss_block'
const hasClayOrMoss: SupportFn = b => b.typeId === 'minecraft:clay' || hasMoss(b)
const hasKelp: SupportFn = b => isSolid(b) || b.typeId === 'minecraft:kelp'
const hasDeadBush: SupportFn = b => b.hasTag('sand') || hasDirt(b) || b.typeId === 'minecraft:terracotta'

const SUPPORT_RULES = new Map<string, SupportFn>()
const addSupport = (ids: string[], rule: SupportFn) => ids.forEach(id => SUPPORT_RULES.set(id, rule))

addSupport([ // saplings + ground-cover flowers/grass
    'minecraft:oak_sapling', 'minecraft:spruce_sapling', 'minecraft:birch_sapling',
    'minecraft:jungle_sapling', 'minecraft:acacia_sapling', 'minecraft:dark_oak_sapling',
    'minecraft:mangrove_propagule', 'minecraft:cherry_sapling',
    'minecraft:short_grass', 'minecraft:fern', 'minecraft:tall_grass', 'minecraft:large_fern',
    'minecraft:poppy', 'minecraft:dandelion', 'minecraft:blue_orchid',
    'minecraft:allium', 'minecraft:azure_bluet', 'minecraft:cornflower',
    'minecraft:red_tulip', 'minecraft:orange_tulip', 'minecraft:white_tulip',
    'minecraft:pink_tulip', 'minecraft:oxeye_daisy', 'minecraft:lily_of_the_valley',
    'minecraft:wither_rose', 'minecraft:torchflower', 'minecraft:pitcher_plant',
    'minecraft:open_eyeblossom', 'minecraft:closed_eyeblossom',
], hasDirt)
addSupport(['minecraft:azalea', 'minecraft:flowering_azalea'], hasMoss)
addSupport(['minecraft:big_dripleaf', 'minecraft:small_dripleaf_block'], hasClayOrMoss)
addSupport(['minecraft:kelp'], hasKelp)
addSupport(['minecraft:dead_bush'], hasDeadBush)

const BAMBOO = new Set(['minecraft:bamboo', 'minecraft:bamboo_sapling'])

// stalk gets thick once 3 tall
const bambooHeight = (top: Block, max: number) => {
    let count = 0
    for (let cur: Block | undefined = top; cur?.typeId === 'minecraft:bamboo' && count < max; cur = cur.below()) count++
    return count
}

const thickenDown = (start: Block) => {
    let index = 0
    for (let cur: Block | undefined = start; cur?.typeId === 'minecraft:bamboo'; cur = cur.below()) {
        const perm = cur.permutation
        if (++index > 3 && perm.getState('bamboo_stalk_thickness') === 'thick') break

        cur.setPermutation(perm.withState('bamboo_stalk_thickness', 'thick'))
    }
}

const bambooPermutation = (block: Block, target: Block) => {
    const below = target.below()
    if (!below || !(below.hasTag('dirt') || BAMBOO.has(below.typeId))) return

    if (!BAMBOO.has(block.typeId)) return block.hasTag('dirt') ? BlockPermutation.resolve('minecraft:bamboo_sapling') : undefined

    const sameColumn = block.location.x === below.location.x && block.location.z === below.location.z
    if (!sameColumn && below.hasTag('dirt')) return BlockPermutation.resolve('minecraft:bamboo_sapling')

    const belowThick = below.permutation.getState('bamboo_stalk_thickness') as string ?? 'thin'
    const thick = belowThick === 'thick' || bambooHeight(block, 3) >= 3
    if (thick && belowThick === 'thin') system.run(() => thickenDown(below))

    return BlockPermutation.resolve('minecraft:bamboo')
        .withState('bamboo_leaf_size', thick ? 'large_leaves' : 'small_leaves')
        .withState('bamboo_stalk_thickness', thick ? 'thick' : 'thin')
}

// null = nothing special, undefined = can't place here
export const getSpecialPermutation = (
    typeId: string, blockFace: Direction, faceLocation: Vector3, block: Block, target: Block, yaw: number
): BlockPermutation | null | undefined => {
    const supportRule = SUPPORT_RULES.get(typeId)
    if (supportRule && (blockFace !== Direction.Up || !supportRule(block))) return

    const base = BlockPermutation.resolve(typeId)
    const upperHalf = faceLocation.y > 0.5

    if (typeId === 'minecraft:lantern' || typeId === 'minecraft:soul_lantern') return base.withState('hanging', blockFace === Direction.Down)

    if (typeId === 'minecraft:bell') {
        const attachment = blockFace === Direction.Up ? 'standing' : blockFace === Direction.Down ? 'hanging' : 'side'
        return base.withState('attachment', attachment).withState('direction', CARDINAL_TO_DIR[yawToCardinal(yaw)])
    }

    if (typeId.endsWith('_slab') && !typeId.endsWith('double_slab')) {
        const half = blockFace === Direction.Up ? 'bottom' : blockFace === Direction.Down ? 'top' : upperHalf ? 'top' : 'bottom'
        return base.withState('minecraft:vertical_half', half)
    }

    if (typeId.endsWith('_stairs')) {
        const upside = blockFace === Direction.Down || (blockFace !== Direction.Up && upperHalf)
        return base.withState('weirdo_direction', CARDINAL_TO_WEIRDO[yawToCardinal(yaw)]).withState('upside_down_bit', upside)
    }

    if (typeId.endsWith('rail')) {
        const cardinal = yawToCardinal(yaw)
        return base.withState('rail_direction', cardinal === 'north' || cardinal === 'south' ? 1 : 0)
    }

    if (typeId === 'minecraft:pointed_dripstone') return base.withState('hanging', blockFace === Direction.Down).withState('dripstone_thickness', 'tip')

    if (typeId === 'minecraft:vine') {
        const bits = VINE_BITS[blockFace]
        return bits === undefined ? undefined : base.withState('vine_direction_bits', bits) // no floor/ceiling vine
    }

    if (typeId === 'minecraft:glow_lichen' || typeId === 'minecraft:sculk_vein') return base.withState('multi_face_direction_bits', LICHEN_BITS[blockFace] ?? 1)

    if (BAMBOO.has(typeId)) return bambooPermutation(block, target)

    if (typeId === 'minecraft:kelp' || typeId === 'minecraft:seagrass' || typeId === 'minecraft:sea_pickle') return target.isLiquid ? base : undefined

    return null
}
