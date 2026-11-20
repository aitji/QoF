import {
    type Block, type Player,
    type BlockFluidContainerComponent,
    type PlayerInteractWithBlockBeforeEvent,
    BlockComponentTypes, FluidType,
    ItemStack, system
} from "@minecraft/server"
import { addItem, cache, checkPerm, clamp, createThrottle, heldAfterDelay, playSound, RUNTIME, setEqu } from "../../lib"
const { DEBUG, WATER_CAULDRON: { FIND_NEAR_COLOR, HARDENED_POWDER } } = RUNTIME

const RGB_PRECISION = 4 // hardcode, don't make config
const DYE_COLORS: { name: string; r: number; g: number; b: number }[] = [
    { name: 'white', r: 0.9412, g: 0.9412, b: 0.9412 },
    { name: 'light_gray', r: 0.6157, g: 0.6157, b: 0.5922 },
    { name: 'gray', r: 0.2784, g: 0.3098, b: 0.3216 },
    { name: 'black', r: 0.1137, g: 0.1137, b: 0.1294 },
    { name: 'brown', r: 0.5137, g: 0.3294, b: 0.1961 },
    { name: 'red', r: 0.6902, g: 0.1804, b: 0.1490 },
    { name: 'orange', r: 0.9765, g: 0.5020, b: 0.1137 },
    { name: 'yellow', r: 0.9961, g: 0.8471, b: 0.2392 },
    { name: 'lime', r: 0.5020, g: 0.7804, b: 0.1216 },
    { name: 'green', r: 0.3686, g: 0.4863, b: 0.0863 },
    { name: 'cyan', r: 0.0863, g: 0.6118, b: 0.6118 },
    { name: 'light_blue', r: 0.2275, g: 0.7020, b: 0.8549 },
    { name: 'blue', r: 0.2353, g: 0.2667, b: 0.6667 },
    { name: 'pink', r: 0.9529, g: 0.5451, b: 0.6667 },
    { name: 'purple', r: 0.5373, g: 0.1961, b: 0.7216 },
    { name: 'magenta', r: 0.7804, g: 0.3059, b: 0.7412 },
]

// helper
const toKey = (r: number, g: number, b: number) => `${r.toFixed(RGB_PRECISION)},${g.toFixed(RGB_PRECISION)},${b.toFixed(RGB_PRECISION)}`
const DYE_COLOR_MAP = new Map(DYE_COLORS.map(({ name, r, g, b }) => [toKey(r, g, b), name]))

const getNearestDye = (r: number, g: number, b: number) => {
    const exact = DYE_COLOR_MAP.get(toKey(r, g, b))
    if (exact) return { color: exact, distance: 0 }
    if (!FIND_NEAR_COLOR) return

    let nearest = DYE_COLORS[0]
    let minDist = Infinity
    for (const dye of DYE_COLORS) {
        const dist = 0.299 * (r - dye.r) ** 2 + 0.587 * (g - dye.g) ** 2 + 0.114 * (b - dye.b) ** 2
        if (dist < minDist) {
            minDist = dist
            nearest = dye
        }
    }
    return { color: nearest.name, distance: minDist }
}

type Dyeable = {
    match: (id: string) => boolean
    dyed: (id: string, dye: string) => string | undefined
    clean: (id: string) => string
    allowClean?: boolean
}

// *_part <-> white_part
const plain = (part: string, clean = `white_${part}`): Dyeable => ({
    match: id => id.includes(part),
    dyed: (_, dye) => `minecraft:${dye}_${part}`,
    clean: () => `minecraft:${clean}`
})
const powder = (id: string) => !HARDENED_POWDER && id.endsWith('_powder') ? '_powder' : ''
const pane = (id: string) => id.endsWith('_pane') ? '_pane' : ''
const glazed = (id: string) => id.includes('_glazed') ? '_glazed' : ''

const DYEABLE: Dyeable[] = [
    plain('wool_slab'),
    plain('wool_stairs'),
    plain('concrete_slab'),
    plain('concrete_stairs'),
    plain('carpet'),
    plain('wool'),
    plain('candle', 'candle'),
    { ...plain('cushion'), match: id => id.endsWith('_cushion') },
    {
        match: id => id.includes('concrete'),
        dyed: (id, dye) => `minecraft:${dye}_concrete${powder(id)}`,
        clean: id => `minecraft:white_concrete${powder(id)}`,
    },
    {
        match: id => id.includes('glass'),
        dyed: (id, dye) => `minecraft:${dye}_stained_glass${pane(id)}`,
        clean: id => `minecraft:glass${pane(id)}`,
    },
    {
        match: id => id.includes('hardened_clay') || id.includes('terracotta'),
        dyed: (id, dye) => `minecraft:${dye}${glazed(id)}_terracotta`,
        clean: id => glazed(id) ? 'white_glazed_terracotta' : 'hardened_clay',
    },
    {
        match: id => id === 'minecraft:arrow',
        dyed: () => undefined,
        clean: () => 'minecraft:arrow',
        allowClean: true,
    },
    // (shulkers, banners, bundles) have nbt cannot safe replace
]

const reduceWaterState = (block: Block, fluid: BlockFluidContainerComponent) => {
    if (fluid.fillLevel <= 0) return

    block.setPermutation(block.permutation.withState('fill_level', fluid.fillLevel - 1))
    playSound(block.dimension, block.center(), { ID: "cauldron.dyearmor", VOLUME: 1.0, PITCH: 1.0 })
}

const applyDye = (player: Player, block: Block, fluid: BlockFluidContainerComponent, itemStack: ItemStack, dye?: string) => {
    const id = itemStack.typeId
    const entry = DYEABLE.find(e => e.match(id))
    if (!entry) return

    const clean = entry.clean(id)
    const resultId = dye ? entry.dyed(id, dye) : clean
    if (!resultId) return

    const { allowClean } = entry
    if (!dye && clean === id && !allowClean) return // wash the wash
    if (resultId === id && !allowClean) return reduceWaterState(block, fluid)

    const used = clamp(itemStack.amount, 1, 16)
    const remain = itemStack.amount - used

    setEqu(player, remain > 0 ? new ItemStack(id, remain) : undefined)
    addItem(player, new ItemStack(resultId, used))

    reduceWaterState(block, fluid)
}

// caller
const throttled = createThrottle(8)
export const cauldron_playerInteractWithBlock = (data: PlayerInteractWithBlockBeforeEvent) => {
    const { player, block, itemStack, isFirstEvent } = data
    if (throttled(player.id, isFirstEvent)) return
    if (!checkPerm(player)) return
    if (!itemStack || block.typeId !== 'minecraft:cauldron') return

    const fluid = block.getComponent(BlockComponentTypes.FluidContainer)
    if (!fluid || fluid.fillLevel <= 0) return

    const slot = cache.getPlayer(player, "selectedSlotIndex")
    system.run(() => {
        if (heldAfterDelay(player, slot)?.typeId !== itemStack.typeId) return
        if (fluid.getFluidType() !== FluidType.Water) return

        const { red, green, blue, alpha } = fluid.fluidColor
        const isWater = red === 0 && green === 0 && blue === 0
        const nearest = getNearestDye(red, green, blue)
        if (!nearest) return

        if (DEBUG) console.log(
            `nearest dye: ${nearest.color} §8~${nearest.distance.toFixed(6)} §r§7` +
            `(RGBA=${red.toFixed(2)},${green.toFixed(2)},${blue.toFixed(2)},${alpha})`
        )

        applyDye(player, block, fluid, itemStack, isWater ? undefined : nearest.color)
    })
}
