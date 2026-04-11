import { system, world } from "@minecraft/server";
import { RUNTIME } from "../lib";
const { DEBUG } = RUNTIME;
function getNeighborDoorBlock(lowerBlock) {
    const above = lowerBlock.above();
    const hingeRight = above.permutation.getState("door_hinge_bit");
    const dir = lowerBlock.permutation.getState("direction");
    switch (dir) {
        case 0: return hingeRight ? lowerBlock.north() : lowerBlock.south();
        case 1: return hingeRight ? lowerBlock.east() : lowerBlock.west();
        case 2: return hingeRight ? lowerBlock.south() : lowerBlock.north();
        case 3: return hingeRight ? lowerBlock.west() : lowerBlock.east();
        default:
            if (DEBUG)
                world.sendMessage(`[door] ?? ${dir}`);
            return undefined;
    }
}
const isDoor = (typeId) => typeId?.endsWith('_door') && typeId !== 'minecraft:iron_door';
export const door_playerInteractWithBlock = (event) => {
    const { block, player, itemStack } = event;
    if (!isDoor(block.typeId))
        return;
    if (player.isSneaking && itemStack)
        return;
    const lower = block.permutation.getState("upper_block_bit") ? block.below() : block;
    let neighbor;
    try {
        neighbor = getNeighborDoorBlock(lower);
    }
    catch {
        return;
    }
    if (!neighbor)
        return;
    if (!isDoor(neighbor?.typeId))
        return;
    const neighborLower = neighbor.permutation.getState("upper_block_bit") ? neighbor.below() : neighbor;
    const clickedWillOpen = !lower.permutation.getState("open_bit");
    system.run(() => {
        try {
            neighborLower.setPermutation(neighborLower.permutation.withState("open_bit", clickedWillOpen));
        }
        catch { }
    });
};
//# sourceMappingURL=door.js.map