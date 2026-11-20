import {
    type PlayerInteractWithBlockBeforeEvent,
    type EntityHitBlockAfterEvent,
    type Block, type Dimension,
    type Vector3,
    system
} from "@minecraft/server"
import { cache, checkPerm, createThrottle, disSqu, swing } from "../../lib"
import { cfg, Kind, flag, isIron, kindOf, setOpen } from "./lib"
import { doorLower, findLinked } from "./link"
import { Played, playKnock, playLinkedSounds, playOnce, playToggleSound, ringBell } from "./sound"

const KIND_ON: Record<Kind, boolean> = { door: cfg.DOOR, gate: cfg.GATE, trapdoor: cfg.TRAPDOOR }
const throttled = createThrottle(5)

// auto close
type Tracked = { dim: Dimension, loc: Vector3, center: Vector3, since: number }
const opened = new Map<string, Tracked>()
const keyOf = (dim: Dimension, loc: Vector3) => `${dim.id}|${loc.x}|${loc.y}|${loc.z}`
let nextScan = 0

const track = (b: Block, tick: number) => {
    const kind = kindOf(b.typeId)
    if ((kind !== "door" && kind !== "gate") || flag(b, "upper_block_bit")) return

    opened.set(
        keyOf(b.dimension, b.location), {
        dim: b.dimension,
        loc: b.location,
        center: b.center(),
        since: tick
    })
}

// caller
export const openable_pending = (tick: number) => {
    if (opened.size === 0 || tick < nextScan) return
    nextScan = tick + 20

    const players = cache.getCachedPlayers()
    const range = cfg.AUTO_CLOSE_RADIUS ** 2
    const played: Played[] = []

    for (const [key, e] of opened) {
        let b: Block | undefined
        try { b = e.dim.getBlock(e.loc) } catch { }

        const kind = kindOf(b?.typeId)
        if (!b || !kind || !flag(b, "open_bit")) {
            opened.delete(key)
            continue
        }
        if (tick - e.since < cfg.AUTO_CLOSE_DELAY) continue

        const near = players.some(p => p.dimension.id === e.dim.id && disSqu(p.location, e.center) <= range)
        if (near) continue

        setOpen([b], false)
        playOnce(played, e.dim, e.loc, b.typeId, kind, false)
        opened.delete(key)
    }
}

// events
export const openable_entityHitBlock = (event: EntityHitBlockAfterEvent) => playKnock(event.hitBlock, event.damagingEntity)
export const openable_playerInteractWithBlock = (event: PlayerInteractWithBlockBeforeEvent) => {
    const { block, player, isFirstEvent } = event

    const kind = kindOf(block.typeId)
    if (!kind || !KIND_ON[kind]) return
    if (!checkPerm(player)) return

    const iron = isIron(block.typeId)
    if (iron && cfg.IRON_BY_HAND && throttled(player.id, isFirstEvent)) return
    if (player.isSneaking) return
    if (iron && !cfg.IRON_BY_HAND) return

    const base = kind === "door" ? doorLower(block) : block
    const willOpen = !flag(base, "open_bit")

    let linked: Block[] = []
    try { linked = findLinked(base, kind) }
    catch { }

    if (iron) event.cancel = true

    const { dimension, location, typeId } = base
    system.run(() => {
        if (iron) {
            setOpen([base], willOpen)
            playToggleSound(dimension, location, typeId, kind, willOpen)
            swing(player, 'main')
        }

        if (linked.length) {
            let src: Block | undefined
            if (kind === "gate" && willOpen) {
                try { src = dimension.getBlock(location) }
                catch { }
            }

            setOpen(linked, willOpen, src)
            playLinkedSounds(dimension, location, linked, kind, willOpen)
        }

        if (cfg.AUTO_CLOSE) {
            if (willOpen) {
                const tick = system.currentTick
                for (const b of [base, ...linked]) track(b, tick)
            } else opened.delete(keyOf(dimension, location))
        }

        if (willOpen && kind === "door" && cfg.SHOP_BELL) ringBell(dimension, location)
    })
}
