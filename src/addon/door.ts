import { Block, EntityHitBlockAfterEvent, PlayerInteractWithBlockBeforeEvent, system, world } from "@minecraft/server"
import { checkPerm, checkRandom, playSound, RUNTIME } from "../lib"
const { DEBUG } = RUNTIME

// internal
const isDoor = (typeId: string) => typeId?.endsWith('_door')
// && typeId !== 'minecraft:iron_door'

function getNeighborDoorBlock(lowerBlock: Block) {
    const above = lowerBlock.above()!
    const hingeRight = above.permutation.getState("door_hinge_bit")
    const dir = lowerBlock.permutation.getState("direction")

    switch (dir) {
        case 0: return hingeRight ? lowerBlock.north() : lowerBlock.south()
        case 1: return hingeRight ? lowerBlock.east() : lowerBlock.west()
        case 2: return hingeRight ? lowerBlock.south() : lowerBlock.north()
        case 3: return hingeRight ? lowerBlock.west() : lowerBlock.east()
        default:
            if (DEBUG) world.sendMessage(`[door] ?? ${dir}`)
            return undefined
    }
}

// double door
export const door_playerInteractWithBlock = (event: PlayerInteractWithBlockBeforeEvent) => {
    const { block, player, itemStack } = event
    if (checkPerm(player) === false) return
    if (!isDoor(block.typeId)) return
    if (player.isSneaking && itemStack) return
    const lower = block.permutation.getState("upper_block_bit") ? block.below()! : block!

    let neighbor: Block | undefined
    try { neighbor = getNeighborDoorBlock(lower) }
    catch { return }
    if (!neighbor) return

    if (!isDoor(neighbor?.typeId as string)) return
    const neighborLower = neighbor.permutation.getState("upper_block_bit") ? neighbor.below()! : neighbor!
    const clickedWillOpen = !lower.permutation.getState("open_bit")

    system.run(() => {
        try { neighborLower.setPermutation(neighborLower.permutation.withState("open_bit", clickedWillOpen)) }
        catch { }
    })
}

// knocking
export const door_entityHitBlock = (event: EntityHitBlockAfterEvent) => {
    const { damagingEntity: player, hitBlock: block } = event
    if (!isDoor(block.typeId)) return
    const { dimension, location } = block

    var volume = 1
    var sound = 'mob.zombie.wood'
    var range = 4 // 64 block (4x16)
    var PITCH = checkRandom([0.8, 1.2])

    switch (block.typeId) {
        case 'minecraft:iron_door':
            sound = 'hit.netherite'
            volume = 2
            break
        case "minecraft:crimson_door":
        case "minecraft:warped_door":
            sound = 'hit.nether_wart'
            break
        // minecraft:cherry_door, idk which sound to use
        case "minecraft:bamboo_door":
            sound = "fall.bamboo_wood"
            volume = 4
            break
        default:
            if (block.typeId.endsWith('copper_door')) {
                volume = 2
                sound = "break.copper_grate"
            }
            break
    }

    volume += player.isFalling || !player.isOnGround ? 3 : 0 // aka volume
    for (let i = 0; i < volume; i++)
        playSound(dimension, location, { ID: sound, VOLUME: range, PITCH })
}