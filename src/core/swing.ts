import {
    type Player, type Entity, type PlayAnimationOptions,
    system
} from "@minecraft/server"

// internal
type swingHand = "main" | "off"
export type swingTarget = swingHand | "both"

interface SwingOptions extends PlayAnimationOptions {
    animation?: string | Partial<Record<swingHand, string>>
    cooldown?: number
}

const anim: Record<swingHand, string> = {
    main: "animation.qof.swing.main",
    off: "animation.qof.swing.off",
}

// caller
const lastSwing = new Map<string, number>()
export function swing(player: Player | Entity, hand: swingTarget = "main", options: SwingOptions = {}): boolean {
    const { animation, cooldown = 6, ...playOptions } = options
    const hands: swingHand[] = hand === "both" ? ["main", "off"] : [hand]
    const now = system.currentTick
    let played = false

    for (const h of hands) {
        const key = `${player.id}:${h}`
        if (now - (lastSwing.get(key) ?? -Infinity) < cooldown) continue
        lastSwing.set(key, now)

        const animName = (typeof animation === "string" ? animation : animation?.[h]) ?? anim[h]
        player.playAnimation(animName, {
            controller: `qof:swing_${h}`,
            nextState: "none",
            stopExpression: "query.all_animations_finished",
            blendOutTime: 0.1,
            ...playOptions,
        })
        played = true
    }

    return played
}

export const swing_playerSpawn = (player: Player) =>
    system.runTimeout(() => player.isValid && swing(player, 'main'), 80)
export const swing_playerLeave = (id: string) => {
    lastSwing.delete(`${id}:main`)
    lastSwing.delete(`${id}:off`)
}