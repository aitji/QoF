import { Block, Dimension, EntityHitBlockAfterEvent, PlayerInteractWithBlockBeforeEvent, Vector3, system, world } from "@minecraft/server"
import { checkPerm } from "../../lib"
import { cfg, Kind, flag, isIron, kindOf, setOpen } from "./lib"
import { doorLower, findLinked } from "./link"
import { Played, playKnock, playLinkedSounds, playOnce, playToggleSound, ringBell } from "./sound"
const on = (v?: boolean) => v !== false

// auto close
type Tracked = { dim: Dimension, loc: Vector3, since: number }
const opened = new Map<string, Tracked>()
const keyOf = (dim: Dimension, loc: Vector3) => `${dim.id}|${loc.x}|${loc.y}|${loc.z}`
let nextScan = 0

function track(b: Block, tick: number) {
    const kind = kindOf(b.typeId)
    if ((kind !== "door" && kind !== "gate") || flag(b, "upper_block_bit")) return
    opened.set(keyOf(b.dimension, b.location), { dim: b.dimension, loc: b.location, since: tick })
}

// index call
export const openable_pending = (tick: number) => {
    if (!cfg.ENABLED || !cfg.AUTO_CLOSE || opened.size === 0 || tick < nextScan) return
    nextScan = tick + 20

    const players = world.getAllPlayers()
    const r2 = cfg.AUTO_CLOSE_RADIUS * cfg.AUTO_CLOSE_RADIUS
    const played: Played[] = []

    for (const [key, e] of opened) {
        let b: Block | undefined
        try { b = e.dim.getBlock(e.loc) } catch { }
        const kind = kindOf(b?.typeId)
        if (!b || !kind || !flag(b, "open_bit")) { opened.delete(key); continue }
        if (tick - e.since < cfg.AUTO_CLOSE_DELAY) continue

        const near = players.some(p =>
            p.dimension.id === e.dim.id &&
            (p.location.x - (e.loc.x + 0.5)) ** 2 +
            (p.location.y - (e.loc.y + 0.5)) ** 2 +
            (p.location.z - (e.loc.z + 0.5)) ** 2 <= r2)
        if (near) continue

        setOpen([b], false)
        playOnce(played, e.dim, e.loc, b.typeId, kind, false)
        opened.delete(key)
    }
}

// events
const delay: Record<string, number> = {}
export const openable_playerInteractWithBlock = (event: PlayerInteractWithBlockBeforeEvent) => {
    if (!cfg.ENABLED) return

    const { block, player, itemStack, isFirstEvent } = event
    if (checkPerm(player) === false) return
    const iron = isIron(block.typeId)
    if (iron && cfg.IRON_BY_HAND) {
        const now = system.currentTick
        if (!isFirstEvent) {
            const stamp = delay[player.id] ?? -1
            if (stamp === now + 5) return
            if (stamp > now) return
        }
        delay[player.id] = now + 5
    }

    const kind = kindOf(block.typeId)
    if (!kind) return
    if (!on({ door: cfg.DOOR, gate: cfg.GATE, trapdoor: cfg.TRAPDOOR }[kind])) return
    if (player.isSneaking && itemStack) return
    if (iron && !cfg.IRON_BY_HAND) return

    const base = kind === "door" ? doorLower(block) : block
    const willOpen = !flag(base, "open_bit")

    let linked: Block[] = []
    try { linked = findLinked(base, kind) }
    catch { }

    if (iron) event.cancel = true

    const { dimension } = base
    const loc = base.location
    const typeId = base.typeId

    system.run(() => {
        const tick = system.currentTick

        if (iron) {
            setOpen([base], willOpen)
            playToggleSound(dimension, loc, typeId, kind, willOpen)
        }

        if (linked.length) {
            let src: Block | undefined
            if (kind === "gate" && willOpen) { try { src = dimension.getBlock(loc) } catch { } }

            setOpen(linked, willOpen, src)
            playLinkedSounds(dimension, loc, linked, kind, willOpen)
        }

        if (cfg.AUTO_CLOSE) {
            if (willOpen) { track(base, tick); for (const l of linked) track(l, tick) }
            else opened.delete(keyOf(dimension, loc))
        }

        if (willOpen && kind === "door" && cfg.SHOP_BELL) ringBell(dimension, loc)
    })
}

export const openable_entityHitBlock = (event: EntityHitBlockAfterEvent) => {
    if (!cfg.ENABLED || !cfg.KNOCK) return
    playKnock(event.hitBlock, event.damagingEntity)
}
