import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus,
    system,
    world
} from "@minecraft/server"
import { store_set, store_listOverrides, RUNTIME } from "./_store"

const ADDON_PATH = {
    "dynamic-light": "LIGHT.ENABLED",
    "repair-anvil": "REPAIR_ANVIL.ENABLED",
    "concrete-powder": "WET_POWDER_CONCRTE.ENABLED",
    "composter": "COMPOSTER.ENABLED",
    "carried-chest": "CARRIED_CHEST.ENABLED"
}

const fmt = {
    ok: m => `§a[Q§fo§aL]§r ${m}`,
    info: m => `§7[Q§fo§7L]§r ${m}`,
    val: v => typeof v === "boolean" ? (v ? "§aON§r" : "§cOFF§r") : `§e${v}§r`
}

const get = p => p.split('.').reduce((o, k) => o?.[k], RUNTIME)

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerEnum("qol:addon", Object.keys(ADDON_PATH))

    customCommandRegistry.registerCommand({
        name: "qol:toggle",
        description: "Enable or disable a QoL addon",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: false,
        mandatoryParameters: [{ name: "qol:addon", type: CustomCommandParamType.Enum }],
        optionalParameters: [{ name: "toggle", type: CustomCommandParamType.Boolean }]
    }, (_, addon, toggle) => {
        const path = ADDON_PATH[addon]
        if (!path) return { status: CustomCommandStatus.Failure, message: `Unknown addon: ${addon}` }

        const next = toggle ?? !get(path)
        const r = store_set(path, next)
        if (!r.ok) return { status: CustomCommandStatus.Failure, message: r.reason }

        system.run(() => world.sendMessage(fmt.ok(`${addon} = ${fmt.val(next)}`)))
        return { status: CustomCommandStatus.Success, message: `${addon} ${next ? "enabled" : "disabled"}` }
    })

    customCommandRegistry.registerCommand({
        name: "qol:override",
        description: "List overrides",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: false
    }, () => {
        const list = store_listOverrides()

        system.run(() => {
            if (!list.length) return world.sendMessage(fmt.info("No overrides"))

            world.sendMessage(fmt.info(
                `Overrides (${list.length}):\n` +
                list.map(o => ` §7${o.path}§r = ${fmt.val(o.value)} §8(${o.default})`).join('\n')
            ))
        })

        return { status: CustomCommandStatus.Success, message: `${list.length} override(s)` }
    })
})