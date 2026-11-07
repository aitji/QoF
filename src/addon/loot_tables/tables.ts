import { EntityDamageCause } from "@minecraft/server"

export type ItemId = `${string}:${string}`
export type EntityId = `${string}:${string}`
export type Range = number | { min: number; max: number }

export type LootCondition =
    | { condition: "killed_by_player" }
    | { condition: "killed_by_player_or_pets" }
    /** flat chance, 0-1. */
    | { condition: "random_chance"; chance: number }
    /** [chance + looting_multiplier * lootingLevel], 0-1. */
    | { condition: "random_chance_with_looting"; chance: number; looting_multiplier: number }
    | { condition: "on_fire"; value?: boolean }
    | { condition: "is_baby"; value?: boolean }
    /** death cause is one of these */
    | { condition: "damage_cause"; causes: EntityDamageCause[] }

export type LootFunction =
    /** set the stack size */
    | { function: "set_count"; count: Range }
    /** adds [random(count) * lootingLevel] stack size & limit caps */
    | { function: "looting_enchant"; count: Range; limit?: number }
    /** 1=new, 0=broken */
    | { function: "set_durability"; durability: Range }

export type LootEntry =
    | {
        type?: "item"
        item: ItemId
        /** default 1 */
        weight?: number
        quality?: number
        conditions?: LootCondition[]
        functions?: LootFunction[]
    }
    /** nothing drops */
    | { type: "empty"; weight?: number; quality?: number; conditions?: LootCondition[] }

export interface LootPool {
    rolls?: Range
    conditions?: LootCondition[]
    entries: LootEntry[]
}

export interface LootTable {
    pickupDelay?: number
    pools: LootPool[]
}
export type LootTableMap = { [K in EntityId]?: LootTable } & { [custom: `${string}:${string}`]: LootTable | undefined }

// loot table...........................................
export const LOOT_TABLES: LootTableMap = {
    "minecraft:goat": {
        pools: [{
            rolls: 1,
            conditions: [{ condition: "is_baby", value: false }],
            entries: [
                {
                    // alive
                    item: "minecraft:mutton",
                    weight: 1,
                    conditions: [{ condition: "on_fire", value: false }],
                    functions: [
                        { function: "set_count", count: { min: 1, max: 2 } },
                        { function: "looting_enchant", count: { min: 0, max: 2 }, limit: 3 }
                    ]
                },
                {
                    // burn
                    item: "minecraft:cooked_mutton",
                    weight: 1,
                    conditions: [{ condition: "on_fire", value: true }],
                    functions: [
                        { function: "set_count", count: { min: 1, max: 2 } },
                        { function: "looting_enchant", count: { min: 0, max: 2 }, limit: 3 }
                    ]
                }
            ]
        }]
    },
    "minecraft:piglin_brute": {
        pools: [{
            rolls: 1,
            entries: [{
                item: "minecraft:gilded_blackstone",
                weight: 1,
                functions: [
                    { function: "set_count", count: { min: 0, max: 1 }, }
                ]
            }]
        }]
    },
    "minecraft:sniffer": {
        pools: [
            {
                rolls: 1,
                conditions: [{ condition: "killed_by_player_or_pets" }],
                entries: [
                    {
                        item: "minecraft:moss_block",
                        functions: [
                            { function: "set_count", count: { min: 0, max: 3 } }
                        ],
                    },
                ],
            },
            {
                rolls: 1,
                entries: [
                    {
                        item: "minecraft:moss_carpet",
                        functions: [
                            { function: "set_count", count: { min: 0, max: 3 } }
                        ],
                    },
                ],
            },
        ],
    },
    "minecraft:vex": {
        pools: [{
            rolls: 1,
            conditions: [{ condition: "random_chance", chance: 0.25 }],
            entries: [{
                item: "minecraft:iron_sword",
                // kept 10%-60%
                functions: [{ function: "set_durability", durability: { min: 0.1, max: 0.6 } }]
            }]
        }]
    },
    "minecraft:silverfish": {
        pools: [
            {
                rolls: 1,
                conditions: [{ condition: "killed_by_player_or_pets" }],
                entries: [
                    { type: "empty", weight: 4, quality: -1 },
                    { item: "minecraft:string", weight: 1, quality: 1 }
                ]
            }
        ]
    },
    "minecraft:wolf": {
        pools: [
            {
                rolls: 1,
                entries: [
                    {
                        item: "minecraft:bone",
                        weight: 1,
                        conditions: [{ condition: "is_baby", value: false }],
                        functions: [
                            { function: "set_count", count: { min: 0, max: 2 } },
                            { function: "looting_enchant", count: { min: 0, max: 1 }, limit: 3 }
                        ]
                    },
                ]
            }
        ]
    },
    "minecraft:armadillo": {
        pools: [
            {
                rolls: 1,
                conditions: [{ condition: "is_baby", value: false }],
                entries: [{
                    item: "minecraft:spider_eye",
                    weight: 1,
                    functions: [{ function: "set_count", count: { min: 0, max: 2 } }]
                }]
            },
            {
                rolls: 1,
                conditions: [{ condition: "is_baby", value: false }],
                entries: [
                    {
                        type: "empty",
                        weight: 4,
                        quality: -1
                    },
                    {
                        item: "minecraft:armadillo_scute",
                        weight: 1,
                        quality: 1,
                        functions: [{ function: "set_count", count: { min: 0, max: 2 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:ocelot": {
        pools: [
            {
                rolls: 1,
                conditions: [{ condition: "is_baby", value: false }],
                entries: [
                    {
                        item: "minecraft:string", weight: 1, quality: 1,
                        functions: [{ function: "set_count", count: { min: 0, max: 2 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:axolotl": {
        pools: [
            {
                rolls: 1,
                conditions: [{ condition: "is_baby", value: false }],
                entries: [
                    {
                        item: "minecraft:tropical_fish", weight: 1, quality: 1,
                        functions: [{ function: "set_count", count: { min: 0, max: 2 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:allay": {
        pools: [
            {
                rolls: 1,
                entries: [
                    { type: "empty", weight: 1 },
                    {
                        item: "minecraft:amethyst_shard", weight: 1,
                        functions: [{ function: "set_count", count: { min: 1, max: 2 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:villager_v2": {
        pools: [
            {
                rolls: 1,
                conditions: [
                    { condition: "is_baby", value: false }
                ],
                entries: [
                    {
                        item: "minecraft:emerald", weight: 1,
                        functions: [{ function: "set_count", count: { min: 0, max: 2 } }]
                    }
                ]
            },
            {
                rolls: 1,
                conditions: [
                    { condition: "random_chance", chance: 0.25 },
                    { condition: "is_baby", value: false }
                ],
                entries: [
                    {
                        item: "minecraft:leather_helmet", weight: 1,
                        functions: [{ function: "set_durability", durability: { min: 0, max: 0.4 } }]
                    },
                    {
                        item: "minecraft:leather_chestplate", weight: 1,
                        conditions: [{ condition: "random_chance", chance: 0.05 }],
                        functions: [{ function: "set_durability", durability: { min: 0, max: 0.4 } }]
                    },
                    {
                        item: "minecraft:leather_leggings", weight: 1,
                        functions: [{ function: "set_durability", durability: { min: 0, max: 0.4 } }]
                    },
                    {
                        item: "minecraft:leather_boots", weight: 1,
                        functions: [{ function: "set_durability", durability: { min: 0, max: 0.4 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:wandering_trader": {
        pools: [
            {
                rolls: 1,
                entries: [
                    {
                        item: "minecraft:emerald", weight: 1,
                        functions: [{ function: "set_count", count: { min: 0, max: 4 } }]
                    }
                ]
            },
            {
                rolls: 1,
                conditions: [{ condition: "random_chance", chance: 0.50 }],
                entries: [
                    {
                        item: "minecraft:leather_helmet", weight: 1,
                        functions: [{ function: "set_durability", durability: { min: 0, max: 1 } }]
                    },
                    {
                        item: "minecraft:leather_chestplate", weight: 1,
                        conditions: [{ condition: "random_chance", chance: 0.05 }],
                        functions: [{ function: "set_durability", durability: { min: 0, max: 1 } }]
                    },
                    {
                        item: "minecraft:leather_leggings", weight: 1,
                        functions: [{ function: "set_durability", durability: { min: 0, max: 1 } }]
                    },
                    {
                        item: "minecraft:leather_boots", weight: 1,
                        functions: [{ function: "set_durability", durability: { min: 0, max: 1 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:happy_ghast": {
        pools: [
            {
                rolls: 1,
                entries: [
                    {
                        item: "minecraft:ghast_tear",
                        functions: [{ function: "set_count", count: { min: 0, max: 1 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:endermite": {
        pools: [
            {
                rolls: 1,
                entries: [
                    {
                        item: "minecraft:popped_chorus_fruit",
                        functions: [{ function: "set_count", count: { min: 0, max: 1 } }]
                    }
                ]
            }
        ]
    },
    "minecraft:ender_dragon": {
        pools: [
            {
                rolls: 1,
                entries: [
                    {
                        item: "minecraft:dragon_head"
                    }
                ]
            },
            {
                rolls: 1,
                entries: [
                    {
                        item: "minecraft:phantom_membrane",
                        functions: [{ function: "set_count", count: { min: 2, max: 4 } }]
                    }
                ]
            }
        ]
    }
}
