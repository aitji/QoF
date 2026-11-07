import {
    type Entity,
    type EntityItemPickupBeforeEvent,
    type EntityRemoveAfterEvent,
    system,
} from "@minecraft/server"
const COOLDOWN_ENTITY = new Map<string, number>()
export const pickupCooldown = (item: Entity, cooldown = 10) => {
    if (COOLDOWN_ENTITY.has(item.id)) return
    COOLDOWN_ENTITY.set(item.id, system.currentTick + cooldown)
}

export const helper_entityItemPickup = (data: EntityItemPickupBeforeEvent) => {
    const until = COOLDOWN_ENTITY.get(data.item.id)
    if (until === undefined) return

    if (system.currentTick < until) {
        data.cancel = true
        return
    }
    COOLDOWN_ENTITY.delete(data.item.id)
}

export const helper_entityRemove = (data: EntityRemoveAfterEvent) => {
    COOLDOWN_ENTITY.delete(data.removedEntityId)
}