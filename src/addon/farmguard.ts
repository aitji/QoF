import { type Player, EntityDamageCause, EquipmentSlot, GameMode } from "@minecraft/server"
import { cache, getEqu, isCreative, isSolid, playSound, RUNTIME } from "../lib"
const { FARMGUARD: { FOOTPRINT, SAFE_FALL, LOOKAHEAD_TICKS, REQUIRE_SAFE, MAX_SAFE_FALL, PROTECTED, FALL_DMG } } = RUNTIME

// helpers
type FallState = { topY: number; guarded: boolean; block?: string }
const states = new Map<string, FallState>()

function hasFF(player: Player) {
    try {
        const boots = getEqu(player).getEquipment(EquipmentSlot.Feet)
        if (!boots) return false
        const ench = boots.getComponent("minecraft:enchantable")
        if (!ench) return false

        if (ench.hasEnchantment("minecraft:feather_falling")) return true
    } catch { return false }
    return false
}

function isSafe(player: Player, fallen: number) {
    if (!REQUIRE_SAFE) return true
    if (player.isSneaking && fallen <= MAX_SAFE_FALL) return true
    return hasFF(player)
}

// caller
export const farmguard_playerLeave = (id: string) => states.delete(id)
export const farmguard_player = (player: Player) => {
    if (cache.getPlayer(player, "gameMode") === GameMode.Spectator) return

    const { x, y, z } = player.location
    const { x: vx, y: vy, z: vz } = player.getVelocity()
    const state = states.get(player.id) ?? { topY: y, guarded: false }
    states.set(player.id, state)

    // land
    if (player.isOnGround) {
        if (state.guarded) {
            const dist = state.topY - y
            const dmg = Math.ceil(dist - SAFE_FALL)
            const fx = (state.block && PROTECTED.get(state.block)) || { sound: { ID: '', VOLUME: 0, PITCH: 1 }, particle: '' }
            const dim = player.dimension
            const pos = { x, y, z }

            if (dmg > 0) {
                player.applyDamage(dmg, { cause: EntityDamageCause.fall })

                dim.spawnParticle(fx.particle, { x, y: y - vy, z })
                playSound(dim, pos, fx.sound)

                if (!isCreative(player)) {
                    if (dist > FALL_DMG.BLOCKS) playSound(dim, pos, FALL_DMG.BIG)
                    else playSound(dim, pos, FALL_DMG.SMALL)
                }
            } else {
                fx.sound.VOLUME = 0.1
                playSound(dim, pos, fx.sound)
            }
        }
        state.topY = y
        state.guarded = false
        state.block = undefined
    } else state.topY = Math.max(state.topY, y)

    // guard
    const falling = player.isFalling && vy < -0.1
    const reach = falling ? Math.abs(vy) * 2 + 1.5 : 0.5

    const hit = findProtected(player, reach, vx, vz)
    if (hit) {
        if (isSafe(player, state.topY - y)) {
            if (!player.getEffect("minecraft:slow_falling") || state.guarded) {
                player.addEffect("minecraft:slow_falling", 1, { showParticles: false })
                if (!player.isOnGround) {
                    state.guarded = true
                    state.block = hit
                }
            }
        } else state.guarded = false
    }
}

// another helper
function findProtected(player: Player, reach: number, vx: number, vz: number): string | undefined {
    const { x, y, z } = player.location
    const dim = player.dimension
    const topY = Math.floor(y)
    const bottomY = Math.floor(y - reach)
    const checked = new Set<number>()

    const moving = vx * vx + vz * vz > 0.0025
    const steps = moving ? LOOKAHEAD_TICKS : 0

    for (let t = 0; t <= steps; t++) {
        const px = x + vx * t
        const pz = z + vz * t

        for (const [dx, dz] of FOOTPRINT) {
            const bx = Math.floor(px + dx)
            const bz = Math.floor(pz + dz)

            const key = ((bx & 0xffff) << 16) | (bz & 0xffff)
            if (checked.has(key)) continue
            checked.add(key)

            for (let by = topY; by >= bottomY; by--) {
                let block
                try { block = dim.getBlock({ x: bx, y: by, z: bz }) }
                catch { break }

                if (!block) break
                if (PROTECTED.has(block.typeId)) return block.typeId
                if (isSolid(block)) break
            }
        }
    }
    return undefined
}
