import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, DisplaySlotId, MemoryTier, ScoreboardObjective, system, world } from "@minecraft/server"
import { RUNTIME } from "../lib"
const { DEBUG, DISABLED_COMMANDFEEDBACK } = RUNTIME

// small helper
/** @type {ScoreboardObjective} */
let dyp
const score = (k, v) => { try { dyp.setScore(k, v) } catch { dyp.addScore(k, v) } }

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
const to3 = (i) => i.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")

export const debug_startup = (event) => {
    if (!DEBUG) return
    const reg = event.customCommandRegistry

    reg.registerEnum(`${PREFIX}dyp_action`, ['list', 'list-value', 'bulk'])
    reg.registerEnum(`${PREFIX}dyp_type`, ['world', 'console'])

    reg.registerCommand({
        name: `${PREFIX}dyp`,
        description: `dynamic property action tools`,
        optionalParameters: [
            { name: 'dyp_action', type: CustomCommandParamType.Enum, enumName: `${PREFIX}dyp_action` },
            { name: 'dyp_type', type: CustomCommandParamType.Enum, enumName: `${PREFIX}dyp_type` }
        ],
        permissionLevel: CommandPermissionLevel.GameDirectors
    }, (_, dyp_action = '', dyp_type = '') => {

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

        switch (dyp_type) {
            case "console":
                console.log(msg)
                break
            case "world":
            default:
                world.sendMessage(msg)
                break
        }

        return { status: CustomCommandStatus.Success, message: 'yay' }
    })
}