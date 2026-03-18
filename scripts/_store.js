import { world } from "@minecraft/server"
import { SETTINGS as DEFAULTS } from "./_config"

const PREFIX = "qol:cfg:"

const clone = o => JSON.parse(JSON.stringify(o))
const get = (o, p) => p.split('.').reduce((x, k) => x?.[k], o)

const set = (o, p, v) => {
    const k = p.split('.')
    let cur = o
    while (k.length > 1) {
        const key = k.shift()
        cur = cur[key] ??= {}
    }
    cur[k[0]] = v
}

export let RUNTIME = clone(DEFAULTS)
let loaded = false

export function store_load() {
    if (loaded) return
    loaded = true

    let count = 0
    for (const id of world.getDynamicPropertyIds()) {
        if (!id.startsWith(PREFIX)) continue

        const raw = world.getDynamicProperty(id)
        if (raw == null) continue

        try {
            const path = id.slice(PREFIX.length)
            const val = JSON.parse(String(raw))
            const cur = get(RUNTIME, path)

            if (cur !== undefined && typeof val === typeof cur) {
                set(RUNTIME, path, val)
                count++
            }
        } catch { }
    }
    return count
}

export function store_set(path, value) {
    const old = get(RUNTIME, path)
    if (old === undefined) return { ok: false, reason: `unknown path: ${path}` }

    let v = value

    if (typeof old === "boolean") {
        if (value === "true") v = true
        else if (value === "false") v = false
        else if (typeof value !== "boolean") return { ok: false, reason: `expected boolean` }
    } else if (typeof old === "number") {
        v = Number(value)
        if (isNaN(v)) return { ok: false, reason: `expected number` }
    } else if (typeof old === "string") {
        v = String(value)
    } else return { ok: false, reason: `not primitive` }

    set(RUNTIME, path, v)
    world.setDynamicProperty(PREFIX + path, JSON.stringify(v))
    return { ok: true, oldValue: old, newValue: v }
}

export function store_resetAll() {
    for (const id of world.getDynamicPropertyIds())
        if (id.startsWith(PREFIX))
            world.setDynamicProperty(id)

    RUNTIME = clone(DEFAULTS)
    return { ok: true }
}

export function store_listOverrides() {
    const out = []
    walk(DEFAULTS, RUNTIME, "", out)
    return out
}

const walk = (d, r, p, out) => {
    for (const k in d) {
        const path = p ? p + "." + k : k
        const dv = d[k]
        const rv = r[k]

        if (dv && typeof dv === "object" && !Array.isArray(dv))
            walk(dv, rv ?? {}, path, out)
        else if (dv !== rv)
            out.push({ path, value: rv, default: dv })
    }
}