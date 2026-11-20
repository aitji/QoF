import {
    type Dimension, GameMode, type GameRuleChangeAfterEvent,
    type PlatformType, type Player, type PlayerGameModeChangeAfterEvent,
    type PlayerHotbarSelectedSlotChangeAfterEvent, type PlayerLeaveAfterEvent,
    type PlayerPermissionLevel, type PlayerSpawnAfterEvent,
    system, world
} from "@minecraft/server"
import { RUNTIME } from "../_store"
const { DEBUG } = RUNTIME

const PlayerDataShape = {
    name: '' as string,
    platformType: '' as PlatformType,
    gameMode: '' as GameMode,
    permissionLevel: 0 as PlayerPermissionLevel,
    selectedSlotIndex: 0 as number
}

const WorldDataShape = {
    gamerule: {
        keepInventory: false as boolean | number,
        doMobLoot: false as boolean | number
    },
}

export const WORLD_CACHE_ID = "world"

export type PlayerData = typeof PlayerDataShape
export type WorldData = typeof WorldDataShape
export type TrackedGameRule = keyof WorldData['gamerule']
export type CacheData = keyof PlayerData

export const playerDataKeys = Object.keys(PlayerDataShape) as (keyof PlayerData)[]
export const worldGameRuleKeys = Object.keys(WorldDataShape.gamerule) as TrackedGameRule[]
const trackedGameRuleSet = new Set<string>(worldGameRuleKeys)

// maps, "core/cache" is [ONLY] for caching globally
export const playerData = new Map<string, PlayerData>()
export const worldData = new Map<string, WorldData>()

let cachedPlayers: Player[] = []
const cachedDimensions = new Map<string, Dimension>()

// map typing fix
const typeMap = {
    player: playerData,
    world: worldData
} as const

// helper type
type TypeMap = typeof typeMap
type CacheType = keyof TypeMap
type CacheValue<T extends CacheType> = TypeMap[T] extends Map<any, infer V> ? V : never
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

// internal
system.run(() => {
    const allPlayers = world.getAllPlayers()
    cachedPlayers = allPlayers

    for (const player of allPlayers)
        player_init_update(player)

    world_init_update()
})

// external routes
export const world_init_update = () => {
    const gamerule = {} as WorldData['gamerule']

    for (const rule of worldGameRuleKeys) {
        const val = (world.gameRules as any)[rule]
        gamerule[rule] = (typeof val === 'boolean' || typeof val === 'number') ? val : false
    }

    return update('world', WORLD_CACHE_ID, { gamerule })
}

export const gamerule_update = (data: GameRuleChangeAfterEvent) => {
    const rule = data.rule as unknown as string
    if (!trackedGameRuleSet.has(rule)) return

    return update('world', WORLD_CACHE_ID, {
        gamerule: { [rule]: data.value } as Partial<WorldData['gamerule']>
    })
}

export const player_init_update = (player: Player) => {
    const { id, name, playerPermissionLevel: permissionLevel, selectedSlotIndex } = player
    const { platformType } = player.clientSystemInfo
    const gameMode = player.getGameMode()

    return update('player', id, {
        name,
        platformType,
        gameMode,
        permissionLevel,
        selectedSlotIndex
    })
}

export const player_gamemode_update = (data: PlayerGameModeChangeAfterEvent) => {
    const { player, toGameMode } = data
    update('player', player.id, { gameMode: toGameMode })
}

export const player_playerHotbarSelectedSlotChange = (data: PlayerHotbarSelectedSlotChangeAfterEvent) => {
    const { player, newSlotSelected } = data
    update('player', player.id, { selectedSlotIndex: newSlotSelected })
}

export const player_track_start = (data: PlayerSpawnAfterEvent) => {
    const { player, initialSpawn } = data
    if (!initialSpawn) return
    if (!cachedPlayers.includes(player)) cachedPlayers.push(player)
}

export const player_track_stop = (data: PlayerLeaveAfterEvent) => {
    const { playerId } = data
    cachedPlayers = cachedPlayers.filter(p => p.id !== playerId)
    playerData.delete(playerId)
}

// modules call
export const update = <T extends CacheType>
    (type: T, id: string, kv: DeepPartial<CacheValue<T>>) => {
    const cache = typeMap[type] as Map<string, CacheValue<T>>
    const prev = cache.get(id)

    const next = {
        ...(prev || {}),
        ...kv,
        ...(type === 'world' ? {
            gamerule: {
                ...(prev as WorldData | undefined)?.gamerule,
                ...(kv as DeepPartial<WorldData>).gamerule
            }
        } : {})
    } as CacheValue<T>

    cache.set(id, next)
    return next
}

export function getPlayer(player: Player): PlayerData
export function getPlayer<K extends CacheData>(player: Player, get: K): PlayerData[K]
export function getPlayer(player: Player, get?: CacheData) {
    const data = playerData.get(player.id) ?? player_init_update(player)
    return get ? data[get] : data
}

export const getGameRule = (rule: TrackedGameRule): boolean | number | null => {
    const data = worldData.get(WORLD_CACHE_ID)
    if (!data) return null
    return data.gamerule[rule]
}

export const getCachedPlayers = (): Player[] => cachedPlayers
export const getCachedDimension = (dimensionId: string): Dimension | null => {
    const cached = cachedDimensions.get(dimensionId)
    if (cached) return cached

    try {
        const dim = world.getDimension(dimensionId)
        cachedDimensions.set(dimensionId, dim)
        return dim
    } catch (e) {
        if (DEBUG) console.warn(`[cache] dimension "${dimensionId}" not found`)
        return null
    }
}