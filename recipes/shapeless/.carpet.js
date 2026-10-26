
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const colour = [
    "white", "light_gray", "gray", "black", "brown",
    "red", "orange", "yellow", "lime", "green", "cyan",
    "light_blue", "blue", "pink", "purple", "magenta"
]

const special = {
    moss_carpet: { output: "moss_block", usage: 3, result: 2 },
    pale_moss_carpet: { output: "pale_moss_block", usage: 3, result: 2 }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = __dirname
const dir = path.join(ROOT, "carpet")
fs.mkdirSync(dir, { recursive: true })

const recipe = (input, output, usage = 3, result = 2) => ({
    format_version: "1.20.10",
    "minecraft:recipe_shapeless": {
        description: { identifier: `minecraft:${input}_to_${output}` },
        tags: ["crafting_table"],
        ingredients: Array.from({ length: usage }, () => ({
            item: `minecraft:${input}`
        })),
        result: {
            item: `minecraft:${output}`,
            count: result
        },
        unlock: [{ item: `minecraft:${input}` }]
    }
})

for (const c of colour) {
    const input = `${c}_carpet`
    const output = `${c}_wool`

    fs.writeFileSync(
        path.join(dir, `${input}_to_${output}.json`),
        JSON.stringify(recipe(input, output), null, 4)
    )
}

for (const [input, { output, usage, result }] of Object.entries(special)) {
    fs.writeFileSync(
        path.join(dir, `${input}_to_${output}.json`),
        JSON.stringify(recipe(input, output, usage, result), null, 4)
    )
}
