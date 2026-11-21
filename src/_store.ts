import { world } from "@minecraft/server"
import { SETTINGS as S } from "./_config"

// helpers
type PackValue = string[] | boolean | number | string
const loadPackSettings = (): Record<string, PackValue> => {
    try {
        return world.getPackSettings()
    } catch (e) {
        if (S.DEBUG) world.sendMessage(`§cpack setting unable to load, using fallback: ${e}`)
        return {}
    }
}

const packSettings = loadPackSettings()
const setting = <T extends PackValue>(name: string, fallback: T): T => {
    const value = packSettings[name]
    return value !== undefined && typeof value === typeof fallback ? value as T : fallback
}

const mode = <T>(name: string, presets: Record<string, T>, fallbackKey: string): T =>
    presets[setting(name, fallbackKey)] ?? presets[fallbackKey]

// dropdown presets
const lightMode = mode('qof:LIGHT.MODE', {
    off: { ENABLED: false, BRIGHTNESS: 7 },
    dim: { ENABLED: true, BRIGHTNESS: 4 },
    normal: { ENABLED: true, BRIGHTNESS: 7 },
    bright: { ENABLED: true, BRIGHTNESS: 10 },
}, 'normal')

const { SLOW_BASE, SLOW_MULTIPLIER } = S.WATER_CONCRETE
const concreteMode = mode('qof:WATER_CONCRETE.MODE', {
    off: { ENABLED: false, SLOW_BASE, SLOW_MULTIPLIER },
    slow: { ENABLED: true, SLOW_BASE: SLOW_BASE * 2, SLOW_MULTIPLIER: SLOW_MULTIPLIER * 2 },
    normal: { ENABLED: true, SLOW_BASE, SLOW_MULTIPLIER },
    fast: { ENABLED: true, SLOW_BASE: Math.round(SLOW_BASE / 3), SLOW_MULTIPLIER: Math.round(SLOW_MULTIPLIER / 2) },
}, 'normal')

const composterMode = mode('qof:COMPOSTER.MODE', {
    off: { ENABLED: false, WORK_WITH_HOPPER: false },
    basic: { ENABLED: true, WORK_WITH_HOPPER: false },
    hopper: { ENABLED: true, WORK_WITH_HOPPER: true },
}, 'hopper')

const chestMode = mode('qof:CARRIED_CHEST.MODE', {
    off: { ENABLED: false, NO_JUMP_HOLD_CHEST: false },
    jump: { ENABLED: true, NO_JUMP_HOLD_CHEST: false },
    no_jump: { ENABLED: true, NO_JUMP_HOLD_CHEST: true },
}, 'jump')

const offhandMode = mode('qof:OFFHAND.MODE', {
    off: { ENABLED: false, ALLOW_BLOCK_PLACEMENT: false },
    on: { ENABLED: true, ALLOW_BLOCK_PLACEMENT: false },
    on_blocks: { ENABLED: true, ALLOW_BLOCK_PLACEMENT: true },
}, 'on_blocks')

const harvestMode = mode('qof:HARVEST.MODE', {
    off: { ENABLED: false, LOSS_SEED: false },
    free: { ENABLED: true, LOSS_SEED: false },
    consume: { ENABLED: true, LOSS_SEED: true },
}, 'consume')

const cauldronMode = mode('qof:WATER_CAULDRON.MODE', {
    off: { ENABLED: false, FIND_NEAR_COLOR: false, HARDENED_POWDER: false },
    dye: { ENABLED: true, FIND_NEAR_COLOR: true, HARDENED_POWDER: false },
    concrete: { ENABLED: true, FIND_NEAR_COLOR: false, HARDENED_POWDER: true },
    both: { ENABLED: true, FIND_NEAR_COLOR: true, HARDENED_POWDER: true },
}, 'both')

const openableMode = mode('qof:OPENABLE.MODE', {
    off: { ENABLED: false, IRON_BY_HAND: false },
    on: { ENABLED: true, IRON_BY_HAND: false },
    iron: { ENABLED: true, IRON_BY_HAND: true },
}, S.OPENABLE.IRON_BY_HAND ? 'iron' : 'on')

const farmguardMode = mode('qof:FARMGUARD.MODE', {
    off: { ENABLED: false, REQUIRE_SAFE: false },
    on: { ENABLED: true, REQUIRE_SAFE: true },
    safe: { ENABLED: true, REQUIRE_SAFE: false },
}, S.FARMGUARD.ENABLED ? (S.FARMGUARD.REQUIRE_SAFE ? 'safe' : 'on') : 'off')

// harvest + waxed off
const consumeDurability = setting('qof:CONSUME_DURABILITY', true)

export const RUNTIME = Object.freeze({ // RUNTIME = _config + pack settings
    DEBUG: setting('qof:DEBUG', S.DEBUG),
    DISABLED_COMMANDFEEDBACK: S.DISABLED_COMMANDFEEDBACK,
    INTERVAL_DELAY: setting('qof:INTERVAL_DELAY', S.INTERVAL_DELAY),
    BLOCK_INTERACTION_DELAY: S.BLOCK_INTERACTION_DELAY,

    LIGHT: {
        ...S.LIGHT,
        ENABLED: lightMode.ENABLED,
        PRIORITY: setting('qof:LIGHT.PRIORITY', S.LIGHT.LIGHT_PRIORITY) as 'brightest' | 'main' | 'off' | 'combined' | 'hypot',
        REDUCE_LIGHT: parseFloat((lightMode.BRIGHTNESS / 10).toFixed(1)), // lightLevel * REDUCE_LIGHT
    },
    REPAIR_ANVIL: {
        ...S.REPAIR_ANVIL,
        ENABLED: setting('qof:REPAIR_ANVIL.ENABLED', S.REPAIR_ANVIL.ENABLED),
    },
    WATER_CONCRETE: { ...S.WATER_CONCRETE, ...concreteMode },
    COMPOSTER: { ...S.COMPOSTER, ...composterMode },
    CARRIED_CHEST: {
        ...S.CARRIED_CHEST,
        ENABLED: chestMode.ENABLED,
        PLAYER_JUMP: { ...S.CARRIED_CHEST.PLAYER_JUMP, NO_JUMP_HOLD_CHEST: chestMode.NO_JUMP_HOLD_CHEST },
    },
    OFFHAND: {
        ...S.OFFHAND,
        ...offhandMode,
        DOUBLE_SNEAK_WINDOW_MOBILE: setting('qof:OFFHAND.DOUBLE_SNEAK_WINDOW_MOBILE', S.OFFHAND.DOUBLE_SNEAK_WINDOW_MOBILE),
        DOUBLE_SNEAK_WINDOW_CONSOLE: setting('qof:OFFHAND.DOUBLE_SNEAK_WINDOW_CONSOLE', S.OFFHAND.DOUBLE_SNEAK_WINDOW_CONSOLE),
        DOUBLE_SNEAK_WINDOW_DEFAULT: setting('qof:OFFHAND.DOUBLE_SNEAK_WINDOW_DEFAULT', S.OFFHAND.DOUBLE_SNEAK_WINDOW_DEFAULT),
    },
    HARVEST: { ...S.HARVEST, ...harvestMode, DURABILITY: consumeDurability },
    OPENABLE: {
        ...S.OPENABLE,
        ...openableMode,
        SHOP_BELL: setting('qof:OPENABLE.SHOP_BELL', S.OPENABLE.SHOP_BELL),
        AUTO_CLOSE: setting('qof:OPENABLE.AUTO_CLOSE', S.OPENABLE.AUTO_CLOSE),
        KNOCK: setting('qof:OPENABLE.KNOCK', true),
    },
    WAXED_OF: { ENABLED: setting('qof:WAXED_OF.ENABLED', S.WAXED_OF.ENABLED), DURABILITY: consumeDurability },
    WATER_CAULDRON: cauldronMode,
    BONEMEAL: { ENABLED: setting('qof:BONEMEAL.ENABLED', S.BONEMEAL.ENABLED) },
    FARMGUARD: { ...S.FARMGUARD, ...farmguardMode },
})
