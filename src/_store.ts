import { world } from "@minecraft/server"
import { SETTINGS } from "./_config"

function buildRuntime() {
    const S = SETTINGS
    let ps = {} as Record<string, boolean | number | string>
    try { ps = world.getPackSettings() }
    catch (e) { if (S.DEBUG) world.sendMessage(`§cpack setting unable to load, using fallback: ${e}`) }

    const g = <T>(name: string, def: T): T => {
        const v = ps[name]
        return (v !== undefined && typeof v === typeof def) ? v as T : def
    }

    const L = S.LIGHT
    const A = S.REPAIR_ANVIL
    const W = S.WATER_CONCRETE
    const C = S.COMPOSTER
    const CH = S.CARRIED_CHEST
    const OH = S.OFFHAND
    const CR = S.HARVEST
    const DD = S.DOUBLE_DOOR
    const WF = S.WAXED_OF

    // player helper
    const consumeDurability = g("qof:CONSUME_DURABILITY", true)
    const LIGHT_MODE: Record<string, { ENABLED: boolean; BRIGHTNESS: number }> = {
        off: { ENABLED: false, BRIGHTNESS: L.REDUCE_LIGHT },
        dim: { ENABLED: true, BRIGHTNESS: 4 },
        normal: { ENABLED: true, BRIGHTNESS: L.REDUCE_LIGHT },
        bright: { ENABLED: true, BRIGHTNESS: 10 },
    }
    const lightMode = LIGHT_MODE[g("qof:LIGHT.MODE", "normal")] ?? LIGHT_MODE.normal

    const CONCRETE_MODE: Record<string, { ENABLED: boolean; SLOW_BASE: number; SLOW_MULTIPLIER: number }> = {
        off: { ENABLED: false, SLOW_BASE: W.SLOW_BASE, SLOW_MULTIPLIER: W.SLOW_MULTIPLIER },
        slow: { ENABLED: true, SLOW_BASE: W.SLOW_BASE * 2, SLOW_MULTIPLIER: W.SLOW_MULTIPLIER * 2 },
        normal: { ENABLED: true, SLOW_BASE: W.SLOW_BASE, SLOW_MULTIPLIER: W.SLOW_MULTIPLIER },
        fast: { ENABLED: true, SLOW_BASE: Math.round(W.SLOW_BASE / 3), SLOW_MULTIPLIER: Math.round(W.SLOW_MULTIPLIER / 2) },
    }
    const concreteMode = CONCRETE_MODE[g("qof:WATER_CONCRETE.MODE", "normal")] ?? CONCRETE_MODE.normal

    const COMPOSTER_MODE: Record<string, { ENABLED: boolean; WORK_WITH_HOPPER: boolean }> = {
        off: { ENABLED: false, WORK_WITH_HOPPER: false },
        basic: { ENABLED: true, WORK_WITH_HOPPER: false },
        hopper: { ENABLED: true, WORK_WITH_HOPPER: true },
    }
    const composterMode = COMPOSTER_MODE[g("qof:COMPOSTER.MODE", "hopper")] ?? COMPOSTER_MODE.hopper

    const CARRIED_CHEST_MODE: Record<string, { ENABLED: boolean; NO_JUMP_HOLD_CHEST: boolean }> = {
        off: { ENABLED: false, NO_JUMP_HOLD_CHEST: false },
        jump: { ENABLED: true, NO_JUMP_HOLD_CHEST: false },
        no_jump: { ENABLED: true, NO_JUMP_HOLD_CHEST: true },
    }
    const carriedChestMode = CARRIED_CHEST_MODE[g("qof:CARRIED_CHEST.MODE", "jump")] ?? CARRIED_CHEST_MODE.jump

    const OFFHAND_MODE: Record<string, { ENABLED: boolean; ALLOW_BLOCK_PLACEMENT: boolean }> = {
        off: { ENABLED: false, ALLOW_BLOCK_PLACEMENT: false },
        on: { ENABLED: true, ALLOW_BLOCK_PLACEMENT: false },
        on_blocks: { ENABLED: true, ALLOW_BLOCK_PLACEMENT: true },
    }
    const offhandMode = OFFHAND_MODE[g("qof:OFFHAND.MODE", "on_blocks")] ?? OFFHAND_MODE.on_blocks

    const HARVEST_MODE: Record<string, { ENABLED: boolean; LOSS_SEED: boolean }> = {
        off: { ENABLED: false, LOSS_SEED: false },
        free: { ENABLED: true, LOSS_SEED: false },
        consume: { ENABLED: true, LOSS_SEED: true },
    }
    const harvestMode = HARVEST_MODE[g("qof:HARVEST.MODE", "consume")] ?? HARVEST_MODE.consume

    const CAULDRON_MODE: Record<string, { ENABLED: boolean; FIND_NEAR_COLOR: boolean; HARDENED_POWDER: boolean }> = {
        off: { ENABLED: false, FIND_NEAR_COLOR: false, HARDENED_POWDER: false },
        dye: { ENABLED: true, FIND_NEAR_COLOR: true, HARDENED_POWDER: false },
        concrete: { ENABLED: true, FIND_NEAR_COLOR: false, HARDENED_POWDER: true },
        both: { ENABLED: true, FIND_NEAR_COLOR: true, HARDENED_POWDER: true },
    }
    const cauldronMode = CAULDRON_MODE[g("qof:WATER_CAULDRON.MODE", "both")] ?? CAULDRON_MODE.both



    // configs
    return Object.freeze({
        DEBUG: g("qof:DEBUG", S.DEBUG),
        DISABLED_COMMANDFEEDBACK: S.DISABLED_COMMANDFEEDBACK,
        DISABLED_HEARTBEAT: S.DISABLED_HEARTBEAT,
        INTERVAL_DELAY: g("qof:INTERVAL_DELAY", S.INTERVAL_DELAY),
        BAT_ENABLED: g("qof:BAT.ENABLED", S.BAT_ENABLED),

        // share config
        BLOCK_INTERACTION_DELAY: S.BLOCK_INTERACTION_DELAY,

        // helper
        SLICE_PREFIX: S.SLICE_PREFIX,
        BLOCKFACE_TO_DIR: S.BLOCKFACE_TO_DIR,

        LIGHT: Object.freeze({
            ENABLED: lightMode.ENABLED,
            REDUCE_LIGHT: parseFloat((lightMode.BRIGHTNESS / 10).toFixed(1)),
            LIGHT_REDUCE_LINEAR: L.LIGHT_REDUCE_LINEAR,

            // static
            DECAY_LIGHT_TICK: L.DECAY_LIGHT_TICK,
            LIGHT_RENDER_RADIUS: L.LIGHT_RENDER_RADIUS,
            LIGHT_RENDER_PER_PLAYER: L.LIGHT_RENDER_PER_PLAYER,
            LIGHT_FIRE_LEVEL: L.LIGHT_FIRE_LEVEL,

            LIGHT_BLOCK: OH.LIGHT, // use from offhand
            LIGHT_WIKI: L.LIGHT_WIKI,
            LIGHT_ENTITY: L.LIGHT_ENTITY,
            FAIL_SOUND_INTERVAL: L.FAIL_SOUND_INTERVAL,
            FAIL_PARTICLE: L.FAIL_PARTICLE,
            SOUND_FAIL: L.SOUND_FAIL,
            PARTICLE_OFFSET: L.PARTICLE_OFFSET,
            SEEDTOBLOCK: L.SEEDTOBLOCK,
            FARMLAND_BLOCK: L.FARMLAND_BLOCK,
            SOUND_SHOVEL_USE: L.SOUND_SHOVEL_USE,
            SOUND_HOE_USE: L.SOUND_HOE_USE,
            FIRE_ITEM: L.FIRE_ITEM,
            LIGHT_PENDING_BATCH: L.LIGHT_PENDING_BATCH,
            LIGHT_PLAYER_BATCH: L.LIGHT_PLAYER_BATCH,
        }),

        REPAIR_ANVIL: Object.freeze({
            ENABLED: g("qof:REPAIR_ANVIL.ENABLED", A.ENABLED),
            REPAIR_HELD_DELAY: A.REPAIR_HELD_DELAY,

            // static
            ITEM_TYPEID: A.ITEM_TYPEID,
            REPAIRABLE_ANVIL: A.REPAIRABLE_ANVIL,
            REPAIR_SOUND: A.REPAIR_SOUND,
        }),

        WATER_CONCRETE: Object.freeze({
            ENABLED: concreteMode.ENABLED,
            SLOW_BASE: concreteMode.SLOW_BASE,
            SLOW_MULTIPLIER: concreteMode.SLOW_MULTIPLIER,

            // static
            MAX_PROCESS: W.MAX_PROCESS,
            KEEP_VELOCITY: W.KEEP_VELOCITY,
            ITEM_PREFIX: W.ITEM_PREFIX,
            PROCESS_DELAY: W.PROCESS_DELAY,
            TYPEID_ENDSWITH: W.TYPEID_ENDSWITH,
            DONE_PARTICLE: W.DONE_PARTICLE,
            DONE_SOUND: W.DONE_SOUND,
            BATCH_SIZE: W.BATCH_SIZE,
        }),

        COMPOSTER: Object.freeze({
            ENABLED: composterMode.ENABLED,
            WORK_WITH_HOPPER: composterMode.WORK_WITH_HOPPER,

            // static
            HOPPER_TYPEID: C.HOPPER_TYPEID,
            BLOCK_TYPEID: C.BLOCK_TYPEID,
            DATA_LOSS_DYP: C.DATA_LOSS_DYP,
            DATA_COMPOSTER_LOCATION: C.DATA_COMPOSTER_LOCATION,
            PARTICLE_FILL_SUCCESS: C.PARTICLE_FILL_SUCCESS,
            SOUND_FILL_SUCCESS: C.SOUND_FILL_SUCCESS,
            SOUND_FILL_BONEMEAL: C.SOUND_FILL_BONEMEAL,
            SOUND_READY: C.SOUND_READY,
            SOUND_FILL: C.SOUND_FILL,
            DELAY_BEFORE_READY: C.DELAY_BEFORE_READY,
            HOPPER_INTERVAL_TICK: C.HOPPER_INTERVAL_TICK,
            // VANILA_COMPOSTE: C.VANILA_COMPOSTE, // didn't use anymore
            ITEMS: C.ITEMS,
        }),

        CARRIED_CHEST: Object.freeze({
            ENABLED: carriedChestMode.ENABLED,
            PLAYER_JUMP: Object.freeze({
                NO_JUMP_HOLD_CHEST: carriedChestMode.NO_JUMP_HOLD_CHEST,
                ALLOW_JUMP_IN_WATER: CH.PLAYER_JUMP.ALLOW_JUMP_IN_WATER,
                ALLOW_JUMP_IN_LAVA: CH.PLAYER_JUMP.ALLOW_JUMP_IN_LAVA,
                ALLOW_JUMP_IN_SCAFFOLDING: CH.PLAYER_JUMP.ALLOW_JUMP_IN_SCAFFOLDING,
                ALLOW_JUMP_IN_LADDER: CH.PLAYER_JUMP.ALLOW_JUMP_IN_LADDER,
            }),

            // static
            MAX_DISPLAY: CH.MAX_DISPLAY,
            SLOWNESS_DURATION: CH.SLOWNESS_DURATION,
            SLOWNESS_AMPLIFIER: CH.SLOWNESS_AMPLIFIER,
            CARRY_TAG: CH.CARRY_TAG,
            APPLY_IMPULSE: CH.APPLY_IMPULSE,
            ENTITY_TYPE: CH.ENTITY_TYPE,
            CHEST_ID: CH.CHEST_ID,
            CONTAINER_NAMETAG: CH.CONTAINER_NAMETAG,
            DOUBLE_CHEST_SIZE: CH.DOUBLE_CHEST_SIZE,
            SOUND_PICK_UP: CH.SOUND_PICK_UP,
        }),
        OFFHAND: Object.freeze({
            ENABLED: offhandMode.ENABLED,
            ALLOW_BLOCK_PLACEMENT: offhandMode.ALLOW_BLOCK_PLACEMENT,
            DOUBLE_SNEAK_WINDOW_MOBILE: g("qof:OFFHAND.DOUBLE_SNEAK_WINDOW_MOBILE", OH.DOUBLE_SNEAK_WINDOW_MOBILE),
            DOUBLE_SNEAK_WINDOW_CONSOLE: g("qof:OFFHAND.DOUBLE_SNEAK_WINDOW_CONSOLE", OH.DOUBLE_SNEAK_WINDOW_CONSOLE),
            DOUBLE_SNEAK_WINDOW_DEFAULT: g("qof:OFFHAND.DOUBLE_SNEAK_WINDOW_DEFAULT", OH.DOUBLE_SNEAK_WINDOW_DEFAULT),

            // static
            FACE_TO_TORCH_DIR: OH.FACE_TO_TORCH_DIR,
            FACE_TO_NEIGHBOUR: OH.FACE_TO_NEIGHBOUR,
            ALLOW_REPLACE: OH.ALLOW_REPLACE,
            NEED_SNEAK: OH.NEED_SNEAK,
            LIGHT: OH.LIGHT,
            TORCH_ID: OH.TORCH_ID,
            PLACE_SOUND: OH.PLACE_SOUND,
            ITEMBUTBLOCK: OH.ITEMBUTBLOCK,
            DISALLOWED_ITEM: OH.DISALLOWED_ITEM,
            FOOD_DATA: OH.FOOD_DATA,
            CAN_ALWAYS_USE: OH.CAN_ALWAYS_USE
        }),
        HARVEST: Object.freeze({
            ENABLED: harvestMode.ENABLED,
            LOSS_SEED: harvestMode.LOSS_SEED,
            DURABILITY: consumeDurability,

            // static
            PLANT_LEVEL: CR.PLANT_LEVEL,
            COCOA_VALID_LOGS: CR.COCOA_VALID_LOGS,
            COCOA_DIRECTIONS: CR.COCOA_DIRECTIONS,
        }),
        DOUBLE_DOOR: Object.freeze({
            ENABLED: g("qof:DOUBLE_DOOR.ENABLED", DD.ENABLED),
        }),
        WAXED_OF: Object.freeze({
            ENABLED: g("qof:WAXED_OF.ENABLED", WF.ENABLED),
            DURABILITY: consumeDurability,
        }),
        WATER_CAULDRON: Object.freeze({
            ENABLED: cauldronMode.ENABLED,
            FIND_NEAR_COLOR: cauldronMode.FIND_NEAR_COLOR,
            HARDENED_POWDER: cauldronMode.HARDENED_POWDER,
        }),
    })
}

export const RUNTIME = buildRuntime()