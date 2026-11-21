import { system, world, type Player } from "@minecraft/server"
import { RUNTIME } from "./_store"
import * as debug from "./core/debug"
import * as cache from "./core/cache"
import * as swing from "./core/swing"
import * as pickup from "./core/pickup"
import * as throttle from "./core/throttle"

// light
import * as light from "./addon/light/core"
import * as light_patcher from "./addon/light/patcher"
// water
import * as concrete from "./addon/water/entity"
import * as cauldron from "./addon/water/cauldron"
import * as splash from "./addon/water/splash"

import * as anvil from "./addon/anvil"
import * as composter from "./addon/composter"
import * as chest from "./addon/chest"
import * as offhand from "./addon/offhand/core"
import * as harvest from "./addon/harvest"
import * as openable from "./addon/openable/core"
import * as waxedOff from "./addon/waxedOff"
import * as loots from "./addon/loot_tables/core"
import * as bonemeal from "./addon/bonemeal"

const {
    LIGHT, WATER_CONCRETE, CARRIED_CHEST, COMPOSTER, OFFHAND, OPENABLE,
    REPAIR_ANVIL, WAXED_OF, WATER_CAULDRON, BONEMEAL, HARVEST, DEBUG
} = RUNTIME
const hopperComposter = COMPOSTER.ENABLED && COMPOSTER.WORK_WITH_HOPPER
const OFFHANDBLOCKS = OFFHAND.ENABLED && OFFHAND.ALLOW_BLOCK_PLACEMENT

type Hook<A extends unknown[]> = [enabled: boolean, handler: (...args: A) => void]
const enabledOnly = <A extends unknown[]>(hooks: Hook<A>[]) => hooks.filter(([enabled]) => enabled).map(([, handler]) => handler)

// gate-keeper
const on = <E>(signal: { subscribe(callback: (event: E) => void): unknown }, hooks: Hook<[E]>[]) => {
    const handlers = enabledOnly(hooks)
    if (handlers.length === 0) return

    signal.subscribe(event => { for (const handle of handlers) handle(event) })
}

// tick
system.run(() => {
    const everyTick = enabledOnly<[number]>([
        [LIGHT.ENABLED, light.light_pending],
        [LIGHT.ENABLED, light.light_processFrames],
        [WATER_CONCRETE.ENABLED, concrete.powder_pending],
        [WATER_CONCRETE.ENABLED, splash.splash_pending],
        [hopperComposter, composter.composter_pending],
        [OPENABLE.ENABLED && OPENABLE.AUTO_CLOSE, openable.openable_pending],
    ])
    const perPlayer = enabledOnly<[Player, number]>([
        [LIGHT.ENABLED, light.light_player],
        [CARRIED_CHEST.ENABLED, chest.chest_player],
        [OFFHAND.ENABLED, offhand.offhand_player],
    ])

    system.runInterval(() => {
        const tick = system.currentTick
        const isCacheUp = tick % 1200 === 0

        for (const run of everyTick) run(tick)
        for (const player of cache.getCachedPlayers()) {
            for (const run of perPlayer) run(player, tick)
            if (isCacheUp) cache.update("player", player.id, { permissionLevel: player.playerPermissionLevel })
        }

        if (DEBUG) debug.debug_pending()
    }, RUNTIME.INTERVAL_DELAY)
})

// world handlers
on(world.afterEvents.entityDie, [
    [CARRIED_CHEST.ENABLED, ((d) =>
        cache.getGameRule("keepInventory") === false &&
        d.deadEntity?.typeId === 'minecraft:player' &&
        chest.chest_entityDie(d))
    ],
    [true, ((d) =>
        cache.getGameRule("doMobLoot") === true &&
        loots.loots_entityDie(d))
    ]
])

on(world.afterEvents.entityRemove, [
    [LIGHT.ENABLED, light.light_entityRemove],
    [WATER_CONCRETE.ENABLED, concrete.powder_entityRemove],
    [true, pickup.helper_entityRemove],
])
on(world.afterEvents.playerPlaceBlock, [
    [LIGHT.ENABLED, light.light_playerPlaceBlock],
    [LIGHT.ENABLED, light_patcher.light_playerPlaceBlock],
    [CARRIED_CHEST.ENABLED, chest.chest_playerPlaceBlock],
    [hopperComposter, composter.composter_playerPlaceBlock],
    [DEBUG, debug.debug_playerPlaceBlock],
])
on(world.beforeEvents.playerBreakBlock, [
    [LIGHT.ENABLED, light.light_playerBreakBlock],
    [HARVEST.ENABLED, harvest.harvest_playerBreakBlock],
])
on(world.beforeEvents.playerInteractWithBlock, [
    [LIGHT.ENABLED, light_patcher.light_playerInteractWithBlock], // patcher
    [REPAIR_ANVIL.ENABLED, anvil.anvil_playerInteractWithBlock],
    [COMPOSTER.ENABLED, composter.composter_playerInteractWithBlock],
    [CARRIED_CHEST.ENABLED, chest.chest_playerInteractWithBlock],
    [OFFHANDBLOCKS, offhand.offhand_playerInteractWithBlock],
    [OPENABLE.ENABLED, openable.openable_playerInteractWithBlock],
    [WAXED_OF.ENABLED, waxedOff.waxedOff_playerInteractWithBlock],
    [WATER_CAULDRON.ENABLED, cauldron.cauldron_playerInteractWithBlock],
    [WATER_CONCRETE.ENABLED, splash.splash_playerInteractWithBlock],
    [BONEMEAL.ENABLED, bonemeal.bonemeal_playerInteractWithBlock],
])
on(world.beforeEvents.playerInteractWithEntity, [
    [OFFHANDBLOCKS, offhand.offhand_playerInteractWithEntity],
])
on(world.afterEvents.entitySpawn, [
    [WATER_CONCRETE.ENABLED, concrete.powder_entitySpawn],
])
on(world.afterEvents.playerSpawn, [
    [true, cache.player_track_start],
    [true, ({ player, initialSpawn }) => {
        if (!initialSpawn) return

        cache.player_init_update(player)
    }],
])
on(world.afterEvents.playerLeave, [
    [OFFHAND.ENABLED, offhand.offhand_playerLeave],
    [true, cache.player_track_stop],
    [true, ({ playerId: id }) => {
        swing.swing_playerLeave(id)
        throttle.throttle_playerLeave(id)
    }],
])
on(world.afterEvents.playerHotbarSelectedSlotChange, [[true, cache.player_playerHotbarSelectedSlotChange]])
on(world.afterEvents.playerGameModeChange, [[true, cache.player_gamemode_update]])
on(world.afterEvents.gameRuleChange, [[true, cache.gamerule_update]])
on(world.afterEvents.pistonActivate, [[hopperComposter, composter.composter_pistonActivate]])

if (OPENABLE.ENABLED && OPENABLE.KNOCK) {
    world.afterEvents.entityHitBlock.subscribe(
        openable.openable_entityHitBlock,
        { entityTypes: ["minecraft:player"] }
    )
}

on(world.afterEvents.projectileHitBlock, [[WATER_CAULDRON.ENABLED, (d) => splash.projectileHit(d.projectile, d.getBlockHit()?.block?.location, d.dimension)]])
on(world.afterEvents.projectileHitEntity, [[WATER_CAULDRON.ENABLED, (d) => splash.projectileHit(d.projectile, d.getEntityHit()?.entity?.location, d.dimension)]])

// core routes
world.beforeEvents.entityItemPickup.subscribe(pickup.helper_entityItemPickup)
system.beforeEvents.startup.subscribe(debug.debug_startup)
system.afterEvents.scriptEventReceive.subscribe(debug.debug_scriptEventReceive)
