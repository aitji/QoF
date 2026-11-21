import {
    type Block, type Player,
    type PlayerInteractWithBlockBeforeEvent,
    BlockPermutation, EquipmentSlot, system
} from "@minecraft/server"
import { cache, checkPerm, createThrottle, getHeld, isSolid, reduceItem, setEqu, swing, isCreative, playSound, checkRandom, isAirOrLight } from "../lib"

type Grower = (block: Block, player: Player) => boolean

const throttled = createThrottle(4)
export const bonemeal_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, itemStack, isFirstEvent } = data
    if (itemStack?.typeId !== 'minecraft:bone_meal') return
    if (!checkPerm(player)) return
    if (throttled(player.id, isFirstEvent)) return

    if (GROWERS[block.typeId]?.(block, player)) takeItem(player)
}

const takeItem = (player: Player): void => {
    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        if (slot !== cache.getPlayer(player, "selectedSlotIndex")) return

        const current = getHeld(player)
        if (current?.typeId !== 'minecraft:bone_meal') return

        setEqu(player, reduceItem(current), EquipmentSlot.Mainhand, true)
        swing(player, 'main')
    })
}

// helpers
const puff = (at: Block, small = false) => {
    const center = at.center()
    const { dimension } = at

    try {
        dimension.spawnParticle(
            small ? 'minecraft:crop_growth_emitter' : 'qof:crop_growth_emitter',
            center
        )

        playSound(dimension, center, {
            ID: 'item.bone_meal.use',
            PITCH: checkRandom([0.9, 1.1])
        })
    } catch { }
}

const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

// cactus
const CACTUS_FLOWER = { SMALL: .10, FULL: .25 }
const isOK = (b?: Block): boolean =>
    !!b && b.isAir &&
    [b.north(), b.south(), b.east(), b.west()].every(n => !n || !isSolid(n))

const isFlowerOK = (b?: Block): boolean =>
    !!b && b.isAir &&
    [b.north(), b.south(), b.east(), b.west()].every(n => !n || isAirOrLight(n))

const cactus: Grower = (block, player) => {
    let top = block
    while (top.above()?.typeId === 'minecraft:cactus') top = top.above()!

    let height = 1
    for (let b = top.below(); b?.typeId === 'minecraft:cactus'; b = b.below()) height++

    let room = 0
    while (room < 3 - height && isOK(top.above(room + 1))) room++

    if (room === 0 && !isFlowerOK(top.above())) return false

    let add: number
    let flower: boolean

    const chance = height >= 3 ? CACTUS_FLOWER.FULL : CACTUS_FLOWER.SMALL
    flower = Math.random() < chance && isFlowerOK(top.above())
    if (isCreative(player)) {
        if (height >= 3) flower = isFlowerOK(top.above())
        add = room
    } else add = flower ? 0 : Math.min(room, 1)

    system.run(() => {
        try {
            let tip = top
            for (let i = 1; i <= add; i++) {
                const t = top.above(i)
                if (!isOK(t)) break
                t!.setType('minecraft:cactus')
                puff(t!)
                tip = t!
            }
            if (flower) {
                const f = tip.above()
                if (isFlowerOK(f)) {
                    f!.setType('minecraft:cactus_flower')
                    puff(f!, true)
                }
            }

            if (add === 0 && !flower) puff(top, true)
        } catch { }
    })
    return true
}

// nether wart
const netherWart: Grower = (block, player) => {
    const age = block.permutation.getState('age') as number
    if (age >= 3) return false
    const next = isCreative(player) ? 3 : age + 1
    system.run(() => {
        try {
            block.setPermutation(block.permutation.withState('age', next))
            puff(block, true)
        } catch { }
    })
    return true
}

// extend downward (vine)
const hanging: Grower = (block) => {
    const id = block.typeId
    let bottom = block
    for (let i = 0; i < 32; i++) { // cap 32
        const next = bottom.below()
        if (next?.typeId !== id) break
        bottom = next
    }
    const target = bottom.below()
    if (!target?.isAir) return false

    system.run(() => {
        try {
            if (!target.isAir) return
            target.setPermutation(bottom.permutation)
            puff(target, true)
        } catch { }
    })
    return true
}

// stem
const SIDE: Record<number, (b: Block) => Block | undefined> = {
    2: b => b.north(), 3: b => b.south(), 4: b => b.west(), 5: b => b.east()
}

const isFruitSoil = (b?: Block): boolean =>
    !!b && (b.hasTag('dirt') || b.typeId === 'minecraft:farmland' || b.typeId === 'minecraft:grass_path')

const stem = (fruit: string, chance = 0.5): Grower => (block, player) => {
    const perm = block.permutation
    if (perm.getState('growth') !== 7) return false
    if (perm.getState('facing_direction') !== 0) return false

    const creative = isCreative(player)
    const p = creative ? 1 : chance
    const order = creative ? shuffle([2, 3, 4, 5]) : [2 + Math.floor(Math.random() * 4)]

    system.run(() => {
        try {
            puff(block, true)
            if (Math.random() >= p) return
            for (const facing of order) {
                const target = SIDE[facing](block)
                if (!target?.isAir) continue
                if (!isFruitSoil(target.below())) continue
                target.setType(fruit)
                block.setPermutation(block.permutation.withState('facing_direction', facing))
                puff(target)
                return
            }
        } catch { }
    })
    return true
}

// chorus
const CHORUS = {
    SURVIVAL_CYCLES: { MIN: 2, MAX: 4 },
    CREATIVE_MAX_STEPS: 1000,
    CREATIVE_FX_EVERY: 4
}

type Plan = () => Block[]
const HORIZONTAL: Array<(b: Block) => Block | undefined> = [b => b.north(), b => b.east(), b => b.south(), b => b.west()]
const OPPOSITE = [2, 3, 0, 1]

const neighboursEmpty = (b: Block, skip = -1): boolean =>
    HORIZONTAL.every((side, i) => i === skip || !!side(b)?.isAir)

const setFlower = (b: Block, age: number) =>
    b.setPermutation(BlockPermutation.resolve('minecraft:chorus_flower', { age }))

const randInt = (min: number, max: number) =>
    min + Math.floor(Math.random() * (max - min + 1))

const canGrow = (f: Block): boolean => {
    try {
        return f.typeId === 'minecraft:chorus_flower' &&
            (f.permutation.getState('age') as number) < 5 &&
            !!f.above()?.isAir
    } catch { return false }
}

const chorusPlan = (flower: Block): Plan | undefined => {
    if (!canGrow(flower)) return

    const age = flower.permutation.getState('age') as number
    const above = flower.above()!

    const below = flower.below()
    let up = false
    let stoneBase = false

    if (below?.typeId === 'minecraft:end_stone') up = true
    else if (below?.typeId === 'minecraft:chorus_plant') {
        let j = 1
        for (let k = 0; k < 4; k++) {
            const s = flower.below(j + 1)
            if (s?.typeId === 'minecraft:chorus_plant') j++
            else {
                if (s?.typeId === 'minecraft:end_stone') stoneBase = true
                break
            }
        }
        if (j < 2 || Math.floor(Math.random() * (stoneBase ? 5 : 4)) >= j) up = true
    } else if (below?.isAir) up = true

    // grow up
    if (up && neighboursEmpty(above) && above.above()?.isAir) {
        return () => {
            flower.setType('minecraft:chorus_plant')
            setFlower(above, age)
            return [above]
        }
    }

    // branch
    if (age < 4) {
        let tries = Math.floor(Math.random() * 4)
        if (stoneBase) tries++

        const targets: Block[] = []
        const used = new Set<number>()
        for (let i = 0; i < tries; i++) {
            const d = Math.floor(Math.random() * 4)
            if (used.has(d)) continue
            const t = HORIZONTAL[d](flower)
            if (t?.isAir && t.below()?.isAir && neighboursEmpty(t, OPPOSITE[d])) {
                used.add(d)
                targets.push(t)
            }
        }

        if (targets.length > 0) {
            return () => {
                flower.setType('minecraft:chorus_plant')
                for (const t of targets) setFlower(t, age + 1)
                return targets
            }
        }
    }

    return () => {
        setFlower(flower, 5)
        return []
    }
}

const collectFlowers = (start: Block, limit = 512): Block[] => {
    const seen = new Set<string>([`${start.x},${start.y},${start.z}`])
    const queue: Block[] = [start]
    const flowers: Block[] = []

    while (queue.length && seen.size < limit) {
        const b = queue.shift()!
        for (const n of [b.above(), b.below(), b.north(), b.south(), b.east(), b.west()]) {
            if (!n) continue
            const key = `${n.x},${n.y},${n.z}`
            if (seen.has(key)) continue
            seen.add(key)
            if (n.typeId === 'minecraft:chorus_plant') queue.push(n)
            else if (n.typeId === 'minecraft:chorus_flower') flowers.push(n)
        }
    }
    return flowers
}

const stepChorus = (pool: Block[], fx: boolean): boolean => {
    while (pool.length) {
        const i = Math.floor(Math.random() * pool.length)
        const flower = pool[i]
        pool[i] = pool[pool.length - 1]
        pool.pop()

        try {
            const plan = chorusPlan(flower)
            if (!plan) continue
            if (fx) puff(flower, true)
            pool.push(...plan())
            return true
        } catch { }
    }
    return false
}

function* creativeGrow(pool: Block[]): Generator<void, void, void> {
    for (let n = 0; n < CHORUS.CREATIVE_MAX_STEPS; n++) {
        if (!stepChorus(pool, n % CHORUS.CREATIVE_FX_EVERY === 0)) return
        yield
    }
}

const runChorus = (flowers: Block[], player: Player): boolean => {
    if (!flowers.some(canGrow)) return false
    const pool = [...flowers]

    if (isCreative(player)) system.runJob(creativeGrow(pool))
    else {
        system.run(() => {
            const cycles = randInt(CHORUS.SURVIVAL_CYCLES.MIN, CHORUS.SURVIVAL_CYCLES.MAX)
            for (let i = 0; i < cycles; i++) {
                if (!stepChorus(pool, true)) break
            }
        })
    }
    return true
}

const chorusFlower: Grower = (block, player) => runChorus([block], player)
const chorusPlant: Grower = (block, player) => runChorus(collectFlowers(block), player)

const GROWERS: Record<string, Grower> = {
    'minecraft:cactus': cactus,
    'minecraft:nether_wart': netherWart,
    'minecraft:vine': hanging,
    'minecraft:melon_stem': stem('minecraft:melon_block'),
    'minecraft:pumpkin_stem': stem('minecraft:pumpkin'),
    'minecraft:chorus_flower': chorusFlower,
    'minecraft:chorus_plant': chorusPlant,
}