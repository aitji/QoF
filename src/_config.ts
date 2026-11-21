// helpers
const mc = (...names: string[]) => names.map(name => `minecraft:${name}`)
export const COLORS = [
    'white', 'light_gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow',
    'lime', 'green', 'cyan', 'light_blue', 'blue', 'pink', 'purple', 'magenta'
] as const
const eachColor = (suffix: string) => COLORS.map(color => `${color}_${suffix}`)
const COPPER_LANTERNS = ['', 'exposed_', 'weathered_', 'oxidized_'].flatMap(age => [`${age}copper_lantern`, `waxed_${age}copper_lantern`])

// types
type Sound = { ID: string, VOLUME: number, PITCH: number | number[] }
type LightInfo = { light: number, inLiquid?: boolean }
type LightGroup = { always?: string[], dry?: string[], wet?: string[] }
type LightDir = 'up' | 'down' | 'north' | 'south' | 'east' | 'west'

// table help
const lightTable = (levels: Record<number, LightGroup>) => {
    const table: Record<string, LightInfo> = {}
    for (const [level, { always = [], dry = [], wet = [] }] of Object.entries(levels)) {
        const light = Number(level)
        for (const n of always) table[n] = { light }
        for (const n of dry) table[n] = { light, inLiquid: false }
        for (const n of wet) table[n] = { light, inLiquid: true }
    }
    return table
}

const chanceTable = (tiers: Record<number, string[]>) => {
    const table: Record<string, number> = {}
    for (const [chance, names] of Object.entries(tiers))
        for (const id of mc(...names))
            table[id] = Number(chance)
    return table
}

// default cfg
export const SETTINGS = Object.freeze({
    DEBUG: true, // auto set to false on released
    DISABLED_COMMANDFEEDBACK: false,
    INTERVAL_DELAY: 1,
    BLOCK_INTERACTION_DELAY: 4,

    LIGHT: {
        DECAY_LIGHT_TICK: 2,
        LIGHT_REDUCE_LINEAR: 2,
        LIGHT_RENDER_RADIUS: 32,
        LIGHT_RENDER_PER_PLAYER: 12,
        LIGHT_FIRE_LEVEL: 10,
        LIGHT_PENDING_BATCH: 64,
        LIGHT_PLAYER_BATCH: 64,
        LIGHT_PRIORITY: 'brightest',
        LIGHT_BLOCK: 'qof:light_block',
        VANILLA_LIGHT: 'minecraft:light_block',
        RESCAN_TICK: 20,
        SKIP_RECHECK: 20,
        GRAVITY: new Set([
            'minecraft:sand', 'minecraft:red_sand', 'minecraft:gravel',
            'minecraft:suspicious_sand', 'minecraft:suspicious_gravel',
            'minecraft:dragon_egg',
            'minecraft:anvil', 'minecraft:chipped_anvil', 'minecraft:damaged_anvil'
        ]),
        PLUS_3D: Object.freeze([
            { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
            { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
        ] as const),
        PLUS: Object.freeze([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const),
        SIDES: Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]] as const),

        FAIL_SOUND_INTERVAL: 30,
        FAIL_PARTICLE: 'minecraft:water_evaporation_bucket_emitter',
        SOUND_FAIL: { ID: 'cauldron_drip.water.pointed_dripstone', VOLUME: 1, PITCH: [0.8, 1.0] } as Sound,
        PARTICLE_OFFSET: { x: -.5, y: 0, z: -.5 },

        // bug patched //
        PATCHER: {
            SEEDTOBLOCK: {
                'minecraft:wheat_seeds': { asBlock: 'minecraft:wheat', pot: 'minecraft:farmland', sound: 'nature' },
                'minecraft:carrot': { asBlock: 'minecraft:carrots', pot: 'minecraft:farmland', sound: 'nature' },
                'minecraft:potato': { asBlock: 'minecraft:potatoes', pot: 'minecraft:farmland', sound: 'nature' },
                'minecraft:beetroot_seeds': { asBlock: 'minecraft:beetroot', pot: 'minecraft:farmland', sound: 'nature' },
                'minecraft:nether_wart': { asBlock: 'minecraft:nether_wart', pot: 'minecraft:soul_sand', sound: 'nether' },
            } as Record<string, { asBlock: string, pot: string, sound: 'nature' | 'nether' }>,
            SOUND_SHOVEL_USE: { ID: 'use.grass', VOLUME: 1.0, PITCH: 0.8 } as Sound,
            SOUND_HOE_USE: { ID: 'use.gravel', VOLUME: 1.0, PITCH: 0.8 } as Sound,
            FIRE_ITEM: {
                'minecraft:flint_and_steel': { ID: 'fire.ignite', VOLUME: 1.0, PITCH: [0.8, 1.2] },
                'minecraft:fire_charge': { ID: 'mob.ghast.fireball', VOLUME: 1.0, PITCH: 1.0, REDUCE_ITEM: true },
            } as Record<string, Sound & { REDUCE_ITEM?: boolean }>,
            REFUNED: {
                FACING_BY_INDEX: ['down', 'up', 'north', 'south', 'west', 'east'],
                OPPOSITE: {
                    up: 'down', down: 'up', north: 'south',
                    south: 'north', east: 'west', west: 'east'
                } as Record<LightDir, LightDir>,
                LEVER_SUPPORT: {
                    down_east_west: 'up', down_north_south: 'up',
                    up_east_west: 'down', up_north_south: 'down',
                    east: 'west', west: 'east', south: 'north', north: 'south'
                } as Record<string, LightDir>,
                GROUND_BLOCKS: new Set([ // solid
                    'minecraft:twisting_vines',
                    'minecraft:redstone_wire',
                    'minecraft:powered_repeater', 'minecraft:unpowered_repeater',
                    'minecraft:powered_comparator', 'minecraft:unpowered_comparator',
                    'minecraft:turtle_egg',
                    'minecraft:flower_pot',
                    'minecraft:cactus_flower',
                    'minecraft:leaf_litter',
                    'minecraft:cake',
                    'minecraft:dragon_egg',
                    'minecraft:anvil',
                    'minecraft:chipped_anvil',
                    'minecraft:damaged_anvil',
                    'minecraft:snow_layer',
                    'minecraft:brown_mushroom',
                    'minecraft:red_mushroom',

                    // just check ground is ok
                    'minecraft:glow_lichen',
                    'minecraft:sculk_vein',
                    'minecraft:resin_clump'
                ]),
                REFUND_ITEM: {
                    'minecraft:redstone_wire': 'minecraft:redstone',
                    'minecraft:powered_repeater': 'minecraft:repeater',
                    'minecraft:unpowered_repeater': 'minecraft:repeater',
                    'minecraft:powered_comparator': 'minecraft:comparator',
                    'minecraft:unpowered_comparator': 'minecraft:comparator'
                } as Record<string, string>,
            }
        },

        LIGHT_WIKI: lightTable({
            15: {
                always: [
                    'beacon', 'conduit', 'glowstone', 'lit_pumpkin', 'sea_lantern', 'shroomlight',
                    'ochre_froglight', 'pearlescent_froglight', 'verdant_froglight',
                ],
                dry: ['campfire', 'lantern', 'lava_bucket', ...COPPER_LANTERNS],
            },
            14: { always: ['end_rod', 'glow_berries'], dry: ['torch', 'copper_torch'] },
            10: { always: ['crying_obsidian'], dry: ['soul_campfire', 'soul_lantern', 'soul_torch'] },
            7: { always: ['enchanting_table', 'ender_chest', 'glow_lichen'], dry: ['redstone_torch'] },
            6: { always: ['sculk_catalyst', 'vault'], wet: ['sea_pickle'] },
            5: { always: ['amethyst_cluster'] },
            4: { always: ['large_amethyst_bud', 'trial_spawner'] },
            3: { always: ['magma'] },
            2: { always: ['medium_amethyst_bud', 'firefly_bush'] },
            1: {
                always: [
                    'brewing_stand', 'brown_mushroom', 'calibrated_sculk_sensor', 'dragon_egg',
                    'end_portal_frame', 'sculk_sensor', 'small_amethyst_bud',
                ]
            },
        }),
        LIGHT_ENTITY: {
            'minecraft:blaze': { light: 12 },
            'minecraft:glow_squid': { light: 10 },
            'minecraft:allay': { light: 10 },
            'minecraft:vex': { light: 10 },
            'minecraft:magma_cube': { light: 9 },
            'minecraft:warden': { light: 6 },
        } as Record<string, LightInfo>,
    },

    REPAIR_ANVIL: {
        ENABLED: true,
        ITEM_TYPEID: 'minecraft:iron_ingot',
        REPAIR_HELD_DELAY: 7,
        REPAIRABLE_ANVIL: {
            'minecraft:damaged_anvil': 'minecraft:chipped_anvil',
            'minecraft:chipped_anvil': 'minecraft:anvil',
            'minecraft:anvil': null,
        } as Record<string, string | null>,
        REPAIR_SOUND: { ID: 'smithing_table.use', VOLUME: 1.0, PITCH: 1.0 } as Sound,
    },

    WATER_CONCRETE: {
        SLOW_BASE: 60,
        SLOW_MULTIPLIER: 10,
        PROCESS_DELAY: 4,
        KEEP_VELOCITY: true,
        BATCH_SIZE: 12,
        DONE_PARTICLE: 'minecraft:water_evaporation_bucket_emitter',
        DONE_SOUND: { ID: 'mob.happy_ghast.harness_unequip', VOLUME: 0.8, PITCH: [1.6, 1.8] } as Sound,
    },

    COMPOSTER: {
        HOPPER_INTERVAL_TICK: 8,
        HOPPER_TYPEID: 'minecraft:hopper',
        BLOCK_TYPEID: 'minecraft:composter',
        DELAY_BEFORE_READY: 17, // tick
        DATA_LOSS_DYP: 'qof.composter.timeout',
        DATA_COMPOSTER_LOCATION: 'qof:composterSet', // for hopper
        PARTICLE_FILL_SUCCESS: 'minecraft:crop_growth_emitter',
        SOUND_FILL_SUCCESS: { ID: 'block.composter.fill_success', VOLUME: 1.3, PITCH: 1.0 } as Sound,
        SOUND_FILL_BONEMEAL: { ID: 'item.bone_meal.use', VOLUME: 2.0, PITCH: [0.9, 1.1] } as Sound,
        SOUND_READY: { ID: 'block.composter.ready', VOLUME: 1.0, PITCH: 1.0 } as Sound,
        SOUND_FILL: { ID: 'block.composter.fill', VOLUME: 1.3, PITCH: 0.8 } as Sound,

        ITEMS: chanceTable({
            0.3: [
                'podzol', 'mycelium', 'dirt_with_roots',
                'egg', 'brown_egg', 'blue_egg', 'turtle_egg',
            ],
            0.5: [
                'bamboo', 'deadbush', 'honeycomb', 'sugar',
                'string', 'blaze_powder', 'ghast_tear',
                'chicken', 'porkchop', 'beef', 'mutton', 'rabbit', 'feather',
                'ink_sac', 'glow_ink_sac', 'rabbit_hide', 'rabbit_foot', 'frog_spawn',
                'cod', 'salmon', 'tropical_fish', 'pufferfish',
            ],
            0.65: [
                'poisonous_potato', 'chorus_fruit', 'resin_clump', 'lit_pumpkin', 'paper',
                'rotten_flesh', 'web', 'gunpowder', 'magma_cream', 'slime_ball', 'spider_eye',
                'leather', 'phantom_membrane',
                'leather_horse_armor', 'leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots',

                // ooked
                'cooked_chicken', 'cooked_porkchop', 'cooked_beef', 'cooked_mutton',
                'cooked_rabbit', 'cooked_cod', 'cooked_salmon',
                'golden_carrot', 'golden_dandelion', 'glistering_melon_slice',
            ],
            0.85: [
                'book', 'fermented_spider_eye', 'dried_ghast', 'blaze_rod', 'slime', 'magma',
                ...eachColor('wool'),

                // ooked
                'popped_chorus_fruit', 'mushroom_stew', 'suspicious_stew', 'beetroot_soup', 'golden_apple',
            ],
            1: [
                'enchanted_golden_apple', 'rabbit_stew', 'nether_star'
            ],
        }),
    },

    CARRIED_CHEST: {
        CARRY_TAG: 'carrying',
        MAX_DISPLAY: 5,
        APPLY_IMPULSE: { // in water
            ENABLED: true,
            VECTOR: { x: 0, y: -0.008, z: 0 },
        },
        PLAYER_JUMP: {
            ALLOW_JUMP_IN_WATER: true,
            ALLOW_JUMP_IN_LAVA: true,
            ALLOW_JUMP_IN_SCAFFOLDING: true,
            ALLOW_JUMP_IN_LADDER: true,
        },
        ENTITY_TYPE: 'qof:chest',
        CHEST_ID: 'minecraft:chest',
        CONTAINER_NAMETAG: '§r§fCarried Container',
        SLOWNESS_DURATION: .5 * 20,
        SLOWNESS_AMPLIFIER: 2,
        SOUND_PICK_UP: { ID: 'armor.equip_leather', VOLUME: 1.0, PITCH: 0.8 } as Sound,
        // don't edit
        DOUBLE_CHEST_SIZE: 54,
        MAX_REGIONS: 128,
        MAX_SETTLE_TICKS: 10,
        PLACE_WINDOW: 3,
        KICK_TICK: 2,
    },

    OFFHAND: {
        DOUBLE_SNEAK_WINDOW_MOBILE: 20,
        DOUBLE_SNEAK_WINDOW_CONSOLE: 16,
        DOUBLE_SNEAK_WINDOW_DEFAULT: 12,
        FAIL_PARTICLE: 'minecraft:villager_angry',
        SOUND_FAIL: { ID: 'note.bd', VOLUME: 0.3, PITCH: [0.8, 1.0] } as Sound,
        PARTICLE_OFFSET: { x: 0, y: 2, z: 0 },
        PLACE_SOUND: { ID: 'dig.wood', VOLUME: 1.0, PITCH: 0.8 } as Sound,

        FACE_TO_TORCH_DIR: {
            Up: 'top', Down: 'top',
            North: 'south', South: 'north',
            East: 'west', West: 'east',
        } as Record<string, string>,

        // false = 2 block tall /neig-check
        ALLOW_REPLACE: {
            ...Object.fromEntries(mc(
                'short_grass', 'short_dry_grass', 'bush', 'deadbush', 'fern', 'nether_sprouts', 'vine',
                'glow_lichen', 'snow_layer', 'crimson_roots', 'warped_roots', 'seagrass', 'fire', 'soul_fire',
                'sculk_vein', 'leaf_litter', 'wildflowers', 'pink_petals',
            ).map(id => [id, true])),
            'minecraft:tall_grass': false,
            'minecraft:large_fern': false,
        } as Record<string, boolean>,

        NEED_SNEAK: new Set(mc(
            'crafting_table', 'crafter', 'barrel', 'smithing_table', 'noteblock', 'jukebox',
            'furnace', 'lit_furnace', 'blast_furnace', 'lit_blast_furnace', 'smoker', 'lit_smoker',
            'command_block', 'chain_command_block', 'repeating_command_block',
        )),

        TORCH_ID: new Set(mc('torch', 'redstone_torch', 'copper_torch', 'soul_torch')),

        CAN_ALWAYS_USE: new Set(mc(
            // misc
            'wind_charge', 'snowball', 'ender_eye', 'ender_pearl', 'goat_horn', 'firework_rocket',
            'armor_stand', 'turtle_helmet', 'sugar_cane', 'empty_map', 'banner', 'name_tag',
            // stew
            'suspicious_stew', 'mushroom_stew', 'rabbit_stew', 'beetroot_soup',
            // buckets
            'bucket', 'axolotl_bucket', 'cod_bucket', 'pufferfish_bucket', 'salmon_bucket',
            'tadpole_bucket', 'tropical_fish_bucket', 'water_bucket', 'lava_bucket', 'powder_snow_bucket',
            // potions & bottles
            'potion', 'lingering_potion', 'splash_potion', 'ominous_bottle', 'experience_bottle',
            'honey_bottle', 'glass_bottle',
            // eggs
            'egg', 'brown_egg', 'blue_egg',
            // tools & weapons
            'bow', 'crossbow', 'fishing_rod', 'carrot_on_a_stick',
            'warped_fungus_on_a_stick', 'shears', 'flint_and_steel',
            'wooden_spear', 'stone_spear', 'copper_spear', 'golden_spear',
            'iron_spear', 'diamond_spear', 'netherite_spear',
            // mounts
            'lead', 'saddle', 'wolf_armor',
            'leather_horse_armor', 'copper_horse_armor', 'golden_horse_armor',
            'iron_horse_armor', 'diamond_horse_armor', 'netherite_horse_armor',
            // redstone
            'repeater', 'comparator', 'redstone', 'redstone_torch',
        )),

        DISALLOWED_ITEM: new Set(mc(
            'bundle', ...eachColor('bundle'),
            'undyed_shulker_box', ...eachColor('shulker_box'),
            // potion
            'potion', 'lingering_potion', 'splash_potion', 'ominous_bottle',
            // dyeable leather
            'leather_horse_armor', 'leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots',
            'wolf_armor',
            // bucket
            'axolotl_bucket', 'cod_bucket', 'pufferfish_bucket', 'salmon_bucket',
            'tadpole_bucket', 'tropical_fish_bucket',
            // bees
            'bee_nest', 'beehive',
            // misc
            'arrow', // tripped arrow
            'banner', 'bed', 'goat_horn', 'suspicious_stew', 'firework_rocket', 'firework_star',
            'shield', 'filled_map', 'empty_map',
            'bow', 'fishing_rod', 'crossbow',
            // dev
            'command_block', 'chain_command_block', 'repeating_command_block',
        )),

        FOOD: new Set(mc(
            'apple', 'beetroot', 'carrot', 'chorus_fruit', 'glow_berries', 'golden_carrot', 'melon_slice',
            'potato', 'poisonous_potato', 'pumpkin_pie', 'sweet_berries', 'golden_apple', 'enchanted_golden_apple',
            'baked_potato', 'cooked_beef', 'cooked_chicken', 'cooked_cod', 'cooked_mutton', 'cooked_porkchop',
            'cooked_rabbit', 'cooked_salmon', 'beef', 'chicken', 'cod', 'mutton', 'porkchop', 'rabbit', 'salmon',
            'pufferfish', 'tropical_fish', 'beetroot_soup', 'mushroom_stew', 'rabbit_stew', 'suspicious_stew',
            'bread', 'cookie', 'dried_kelp', 'honey_bottle', 'rotten_flesh', 'spider_eye',
        )),
        FOOD_ALWAYS_EDIBLE: new Set(mc( // canAlwaysEat
            'apple', 'chorus_fruit', 'golden_apple',
            'enchanted_golden_apple', 'suspicious_stew', 'honey_bottle',
        )),
    },

    HARVEST: {
        PLANT_LEVEL: {
            'minecraft:wheat': { level: 7, seed: 'minecraft:wheat_seeds' },
            'minecraft:carrots': { level: 7, seed: 'minecraft:carrot' },
            'minecraft:potatoes': { level: 7, seed: 'minecraft:potato' },
            'minecraft:beetroot': { level: 7, seed: 'minecraft:beetroot_seeds' },
            'minecraft:nether_wart': { level: 3, seed: 'minecraft:nether_wart' },
            'minecraft:sweet_berry_bush': {
                level: 2, seed: 'minecraft:sweet_berries',
                harvested: 1, harvested_state: 'growth'
            },
        } as Record<string, { level: number, seed: string, harvested?: number, harvested_state?: string }>,
        COCOA_VALID_LOGS: new Set(mc('jungle_log', 'stripped_jungle_log', 'jungle_wood', 'stripped_jungle_wood')),
        COCOA_DIRECTIONS: [
            { x: 0, z: 1, dir: 0 }, // south
            { x: -1, z: 0, dir: 1 }, // west
            { x: 0, z: -1, dir: 2 }, // north
            { x: 1, z: 0, dir: 3 }, // east
        ],
        STEM: new Set(['minecraft:melon_stem', 'minecraft:pumpkin_stem'])
    },

    OPENABLE: {
        IRON_BY_HAND: true,
        AUTO_CLOSE: false,
        SHOP_BELL: true,

        DOOR: true, GATE: true, TRAPDOOR: true,
        AUTO_CLOSE_RADIUS: 1,
        AUTO_CLOSE_DELAY: 10,
        MAX_LINKED: 16,
    },

    WAXED_OF: { ENABLED: true },
    BONEMEAL: { ENABLED: true },
    FARMGUARD: {
        ENABLED: true,
        REQUIRE_SAFE: true,
        MIN_FEATHER_LEVEL: 1,
        FOOTPRINT: [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]],
        SAFE_FALL: 3,
        LOOKAHEAD_TICKS: 1,
        MAX_SAFE_FALL: 8,
        PROTECTED: new Map<string, { particle: string; sound: Sound }>([
            ["minecraft:farmland", { particle: "qof:break_dirt", sound: { ID: "fall.gravel", VOLUME: 0.4, PITCH: 1.0 } }],
            ["minecraft:turtle_egg", { particle: "qof:break_turtle_egg", sound: { ID: "fall.egg", VOLUME: 0.4, PITCH: 1.0 } }],
        ]),
        FALL_DMG: {
            BLOCKS: 8,
            BIG: {
                ID: 'damage.fallbig',
                PITCH: 0.7
            } as Sound,
            SMALL: {
                ID: 'damage.fallsmall',
                PITCH: 0.75
            } as Sound
        }
    },
})
