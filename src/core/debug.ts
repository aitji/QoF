import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, DisplaySlotId, EquipmentSlot, MemoryTier, Player, PlayerPlaceBlockAfterEvent, ScoreboardObjective, StartupEvent, system, world } from "@minecraft/server"
import { clamp, dumpMeThatComp, getEqu, RUNTIME } from "../lib"
const { DEBUG, DISABLED_COMMANDFEEDBACK } = RUNTIME
import * as cache from "./cache"

// small helper
let dyp: ScoreboardObjective
const score = (k: string, v: number) => { try { dyp.setScore(k, v) } catch { dyp.addScore(k, v) } }
const player_dampening = new Map() as Map<string, number>

system.run(() => {
    if (DISABLED_COMMANDFEEDBACK) world.gameRules.sendCommandFeedback = false
    if (DEBUG) {
        const host = world.getPlayers().find(e => e.id === "-4294967295")
        system.beforeEvents.watchdogTerminate.subscribe((d) => {
            if (host && host.clientSystemInfo.memoryTier === MemoryTier.High) d.cancel = true

            const msg = `§c[o7]... §7${d.terminateReason}`
            console.warn(msg)
            world.sendMessage(msg)
        })

        world.sendMessage('§7qof loaded')
        world.sendMessage(`§8${world.getAllPlayers().map(e => ` ${e.name} = ${e.id} §7(${e.clientSystemInfo.platformType})`).join('\n§8 ')}`)
    }
})

export const debug_pending = () => {
    world.scoreboard.removeObjective("dyp")
    dyp = world.scoreboard.addObjective("dyp", "Dynamic Props")
    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: dyp })

    const ids = world.getDynamicPropertyIds()
    const bytes = world.getDynamicPropertyTotalByteCount()
    score("§eTotal props", ids.length)
    score("§eTotal bytes", bytes)

    for (const id of ids) {
        const val = world.getDynamicProperty(id)
        score(`§7${id.slice(0, 16)}`, typeof val === "number" ? val : typeof val === "boolean" ? (val ? 1 : 0) : typeof val === "string" ? val.length : typeof val === "object" ? 1 : -1)
    }
}

const PREFIX = 'qof:' // kept ":"
const MB_1 = 1048576
const to3 = (i: number) => i.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
const logAs = (msg: string, log: string) => {
    switch (log) {
        case "console":
            console.log(msg)
            break
        case "world":
        default:
            world.sendMessage(msg)
            break
    }
}
export const debug_startup = (event: StartupEvent) => {
    if (!DEBUG) return
    const reg = event.customCommandRegistry

    reg.registerEnum(`${PREFIX}dyp_action`, ['list', 'list-value', 'bulk'])
    reg.registerEnum(`${PREFIX}log`, ['world', 'console'])
    reg.registerEnum(`${PREFIX}components`, ['item', 'block'])

    // dyp
    reg.registerCommand({
        name: `${PREFIX}dyp`,
        description: `dynamic property action tools`,
        optionalParameters: [
            { name: 'dyp_action', type: CustomCommandParamType.Enum, enumName: `${PREFIX}dyp_action` },
            { name: 'log', type: CustomCommandParamType.Enum, enumName: `${PREFIX}log` }
        ],
        permissionLevel: CommandPermissionLevel.GameDirectors
    }, (_, dyp_action = '', log = '') => {

        const ids = world.getDynamicPropertyIds()
        const len = ids.length
        const total = world.getDynamicPropertyTotalByteCount()

        let msg = `There is ${len} world dynamic property in the list:\n§7> usaged: ${to3(total)}/${to3(MB_1)} §8(${((total / MB_1) * 100).toFixed(2)}%%)§7\n\n`

        switch (dyp_action) {
            case 'list-value': {
                for (let i = 0; i < len; i++) {
                    const id = ids[i]
                    msg += `§8${i + 1} §7${id} §e${world.getDynamicProperty(id)}\n`
                }
                break
            }

            case 'bulk':
                world.clearDynamicProperties()
                msg = '§7dynamic property has been removed'
                break

            case 'list':
            default:
                for (let i = 0; i < len; i++) {
                    const id = ids[i]
                    msg += `§8${i + 1} §7${id}\n`
                }
                break
        }

        logAs(msg, log)
        return { status: CustomCommandStatus.Success, message: 'yay' }
    })

    // cache
    reg.registerCommand({
        name: `${PREFIX}cache`,
        description: `get cache from player/world`,
        optionalParameters: [
            { name: 'player', type: CustomCommandParamType.PlayerSelector },
            { name: 'log', type: CustomCommandParamType.Enum, enumName: `${PREFIX}log` }
        ],
        permissionLevel: CommandPermissionLevel.Admin
    }, (_, players: Player[], log: string) => {
        let msg = ''
        if (!players) {
            const data = cache.worldData
            msg = `There is ${data.size} world data §7(cache)§r in the list\n`
            let index = 0
            for (const [key, value] of data) {
                index++
                msg += `§8${index}. §7${key} §e${value}§r\n`
            }
        } else {
            const plr = players.map(p => world.getEntity(p.id) as Player)
            const data = cache.playerData
            msg = `There is ${data.size} player data §7(cache)§r in the list\n`
            let index = 0
            for (const player of plr) {
                if (!player) continue
                index++
                const { name, platformType, gameMode } = data.get(player.id)!
                msg += `§8${index}. §7${player.name} §8${player.id}\n`
                msg += `§8| §7name=§e${name}§7, platformType=§e${platformType}§7, gameMode=§e${gameMode}\n`
            }
        }

        logAs(msg, log)
        return { status: CustomCommandStatus.Success, message: 'yay' }
    })

    // components
    reg.registerCommand({
        name: `${PREFIX}components`,
        description: `dump the block/item components list`,
        optionalParameters: [
            { name: 'type', type: CustomCommandParamType.Enum, enumName: `${PREFIX}components` },
            { name: 'log', type: CustomCommandParamType.Enum, enumName: `${PREFIX}log` }
        ],
        permissionLevel: CommandPermissionLevel.Admin
    }, (origin, types: string, log: string) => {
        const player = origin.sourceEntity as Player
        if (player.typeId !== 'minecraft:player') return { status: CustomCommandStatus.Failure, message: "origin not player" }

        let msg = '' // messy, look away
        switch (types) {
            case 'block':
                const target = player.getBlockFromViewDirection({ includeLiquidBlocks: true, includePassableBlocks: true, maxDistance: 12 })
                if (!target?.block) return { status: CustomCommandStatus.Failure, message: 'cannot find target block in player direction within 12 blocks' }
                let v = target?.block.getComponents()
                msg = `There is ${v.length} components type in this block\n§7TypeId: §e${target.block.typeId}\n§7Face: §e${target.face}\n§7FaceLoc: §e${target.faceLocation.x.toFixed(2)}, ${target.faceLocation.y.toFixed(2)}, ${target.faceLocation.z.toFixed(2)}\n\n`
                msg += v.map((e, i) => `§8${i + 1}. §7${e.typeId}`).join('\n')
                break
            case 'item':
            default:
                const equ = getEqu(player)!
                const item = equ.getEquipment(EquipmentSlot.Mainhand)
                if (!item) return { status: CustomCommandStatus.Failure, message: 'cannot find item in mainhand' }
                let v2 = item.getComponents()
                msg = `There is ${v2.length} components type in this item\n§7TypeId: §e${item.typeId}\n§7NameTag: §e${item?.nameTag ?? '[null]'}\n\n`
                msg += v2.map((e, i) => `§8${i + 1}. §7${e.typeId}`).join('\n')
                break
        }

        logAs(msg, log)
        return { status: CustomCommandStatus.Success, message: 'yay' }
    })

    // light damp
    reg.registerCommand({
        name: `${PREFIX}dampening`,
        description: `set dampening block placement`,
        optionalParameters: [
            { name: 'light_dampening', type: CustomCommandParamType.Integer }
        ],
        permissionLevel: CommandPermissionLevel.Admin
    }, (origin, light_dampening: number) => {
        const player = origin.sourceEntity as Player
        if (player.typeId !== 'minecraft:player') return { status: CustomCommandStatus.Failure, message: "origin not player" }

        player_dampening.set(player.id, clamp(light_dampening, 0, 15))
        return { status: CustomCommandStatus.Success, message: 'yay' }
    })
}

export const debug_playerPlaceBlock = (data: PlayerPlaceBlockAfterEvent) => {
    const { player, dimension, block } = data

    if (block && block.typeId === 'qof:light_damp_dev') {
        const damp = player_dampening.get(player.id)
        if (!damp) return

        const perm = block.permutation
            .withState('qof:light_dampening' as any, damp)
        block.setPermutation(perm)
    }
}