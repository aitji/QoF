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

export type LootEntry =
    | {
        type?: "item"
        item: ItemId
        /** default 1 */
        weight?: number
        /** added to weight per looting level, can be negative (effective weight min 0) */
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
                            { function: "set_count", count: { min: 0, max: 6 } }
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
    }
}
