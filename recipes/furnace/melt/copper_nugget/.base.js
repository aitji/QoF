
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const base = ['bars', 'trapdoor', 'door', 'chain']
const variant = [
    '', 'exposed_', 'oxidized_', 'weathered_',
    'waxed_', 'waxed_exposed_', 'waxed_oxidized_', 'waxed_weathered_',
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

for (const b of base) {
    const dir = path.join(ROOT, b)
    fs.mkdirSync(dir, { recursive: true })

    for (const v of variant) {
        const inp = `${v}copper_${b}`
        const out = `copper_nugget`
        fs.writeFileSync(
            path.join(dir, `${inp}_to_${out}.json`),
            JSON.stringify(recipe(inp, out), null, 4)
        )
    }
}