import { type Player, world, EntityDamageCause } from "@minecraft/server"
import { isSolid } from "../lib"

// helpers
const FOOTPRINT = [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]
const SAFE_FALL = 3

type FallState = { topY: number; guarded: boolean }
const states = new Map<string, FallState>()

export const farmguard_playerLeave = (id: string) => states.delete(id)
export const farmguard_player = (player: Player) => {
    const { x, y, z } = player.location
    const vy = player.getVelocity().y
    const state = states.get(player.id) ?? { topY: y, guarded: false }
    states.set(player.id, state)

    // land
    if (player.isOnGround) {
        if (state.guarded) {
            const dist = state.topY - y
            const dmg = Math.ceil(dist - SAFE_FALL)
            if (dmg > 0) {
                player.applyDamage(dmg, { cause: EntityDamageCause.fall })
                player.dimension.spawnParticle('qof:break_dirt', { x, y: y - vy, z })
            }
        }
        state.topY = y
        state.guarded = false
    } else state.topY = Math.max(state.topY, y)

    // guard
    const falling = player.isFalling && vy < -0.1
    const reach = falling ? Math.abs(vy) * 2 + 1.5 : 0.5

    if (isOverFarmland(player, reach)) {
        if (!player.getEffect("minecraft:slow_falling") || state.guarded) {
            player.addEffect("minecraft:slow_falling", 1, { showParticles: false })
            if (!player.isOnGround) state.guarded = true
        }
    }
}

function isOverFarmland(player: Player, reach: number) {
    const { x, y, z } = player.location
    const dim = player.dimension
    const topY = Math.floor(y)
    const bottomY = Math.floor(y - reach)

    for (const [dx, dz] of FOOTPRINT) {
        const bx = Math.floor(x + dx)
        const bz = Math.floor(z + dz)

        for (let by = topY; by >= bottomY; by--) {
            let block
            try { block = dim.getBlock({ x: bx, y: by, z: bz }) }
            catch { break }

            if (!block) break
            if (block.typeId === "minecraft:farmland") return true
            if (isSolid(block)) break
        }
    }
    return false
}
