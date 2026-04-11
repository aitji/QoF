import { system, world } from "@minecraft/server";
import { RUNTIME } from "../_store"; // "cache" got use in "lib" as lazy import, use setting from store directly
const { DEBUG } = RUNTIME;
// maps, "core/cache" is [ONLY] for caching globally
export const playerData = new Map();
export const worldData = new Map();
// map typing fix
const typeMap = {
    player: playerData,
    world: worldData
};
// internal
system.run(() => {
    const allPlayers = world.getAllPlayers();
    for (const player of allPlayers)
        player_init_update(player);
});
// external
export const getPlayer = (player, get) => {
    const id = typeof player === 'string' ? player : player.id;
    let data = playerData.get(id);
    if (!data) {
        if (typeof player === 'string') {
            if (DEBUG)
                console.warn('[cache] cannot update player data throw empy string as return');
            return '';
        }
        data = player_init_update(player);
    }
    return get ? data[get] : data;
};
export const update = (type, id, kv) => {
    const cache = typeMap[type];
    const prev = cache.get(id);
    const next = { ...(prev || {}), ...kv };
    cache.set(id, next);
    return next;
};
export const player_init_update = (player) => {
    const { id, name } = player;
    const platformType = player.clientSystemInfo.platformType;
    const gameMode = player.getGameMode();
    return update('player', id, {
        name,
        platformType,
        gameMode
    });
};
export const player_gamemode_update = (data) => {
    const { player, toGameMode } = data;
    update('player', player.id, { gameMode: toGameMode });
};
//# sourceMappingURL=cache.js.map