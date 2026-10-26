
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const colour = [
    "white", "light_gray", "gray", "black", "brown",
    "red", "orange", "yellow", "lime", "green", "cyan",
    "light_blue", "blue", "pink", "purple", "magenta"
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = __dirname

const recipe = (input, output) => ({
    format_version: "1.20.10",
    "minecraft:recipe_furnace": {
        description: { identifier: `minecraft:${input}_to_${output}` },
        tags: ["blast_furnace", "furnace"],
        input: `minecraft:${input}`,
        output: `minecraft:${output}`,
        unlock: [{ item: `minecraft:${input}` }]
    }
})

for (const c of colour) {
    const dir = path.join(ROOT, '')
    fs.mkdirSync(dir, { recursive: true })

    const inp = `${c}_concrete`
    const out = `${c}_concrete_powder`
    fs.writeFileSync(
        path.join(dir, `${inp}_to_${out}.json`),
        JSON.stringify(recipe(inp, out), null, 4)
    )
}