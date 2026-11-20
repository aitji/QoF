import {
    type Dimension, type EntityRemoveAfterEvent,
    type EntitySpawnAfterEvent, type Vector3,
    EntityComponentTypes, world, system, ItemStack
} from "@minecraft/server"
import { cursor, debug, playSound, tryRemove, roundRobin, RUNTIME } from "../../lib"
const { WATER_CONCRETE: { KEEP_VELOCITY, BATCH_SIZE, PROCESS_DELAY, DONE_PARTICLE, DONE_SOUND, SLOW_BASE, SLOW_MULTIPLIER } } = RUNTIME

const NAMESPACE = 'minecraft:'
const POWDER = '_concrete_powder'

type Powder = { color: string, amount: number, dimension: Dimension, readyAt: number, location: Vector3, velocity: Vector3 }
const queue = new Map<string, Powder>()
let position = 0

const wetDelay = (amount: number) => SLOW_BASE + Math.floor(Math.sqrt(amount - 1) * SLOW_MULTIPLIER)
export const powder_entityRemove = ({ removedEntityId }: EntityRemoveAfterEvent) => queue.delete(removedEntityId)
export const powder_entitySpawn = ({ entity }: EntitySpawnAfterEvent) => {
    if (!entity?.isValid || entity.typeId !== 'minecraft:item') return
    if (entity.dimension.id === 'minecraft:nether') return

    const itemStack = entity.getComponent(EntityComponentTypes.Item)?.itemStack
    if (!itemStack) return

    const { typeId, amount } = itemStack
    if (!typeId.startsWith(NAMESPACE) || !typeId.endsWith(POWDER)) return

    const color = typeId.slice(NAMESPACE.length, -POWDER.length)
    if (!color) return

    debug(`§7spawn: ${color} x${amount}`)
    queue.set(entity.id, {
        color, amount,
        dimension: entity.dimension,
        readyAt: 0,
        location: entity.location,
        velocity: entity.getVelocity(),
    })
}

const process = (id: string, now: number) => {
    const powder = queue.get(id)
    const entity = world.getEntity(id)
    if (!powder || !entity) return queue.delete(id)

    const wet = powder.readyAt !== 0
    if (!wet && !entity.isInWater) return

    if (!wet) {
        powder.readyAt = now + wetDelay(powder.amount)
        debug(`| wet delay ${(wetDelay(powder.amount) / 20).toFixed(2)}s.`)
    }

    if (now < powder.readyAt) {
        powder.location = entity.location
        powder.velocity = entity.getVelocity()
        return
    }

    queue.delete(id)

    const { color, amount, dimension, location, velocity } = powder
    system.runTimeout(() => {
        if (!entity.isValid) return

        const concrete = dimension.spawnItem(new ItemStack(`${NAMESPACE}${color}_concrete`, amount), location)
        dimension.spawnParticle(DONE_PARTICLE, concrete.location)
        playSound(dimension, concrete.location, DONE_SOUND)

        if (KEEP_VELOCITY) concrete.applyImpulse(velocity)

        // cannot remove entity ; try to remove concrete
        if (!tryRemove(entity)) tryRemove(concrete)
    }, PROCESS_DELAY)
}

export const powder_pending = () => {
    const now = system.currentTick
    const ids = [...queue.keys()]

    for (const id of roundRobin(ids, position, BATCH_SIZE)) process(id, now)
    position = cursor(position, ids.length, BATCH_SIZE)
}
