import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname

const colour = [
    "white", "light_gray", "gray", "black", "brown",
    "red", "orange", "yellow", "lime", "green", "cyan",
    "light_blue", "blue", "pink", "purple", "magenta"
]

const types = {
    wool_slab: 2,
    wool_stairs: 1,
    cushion: 1,
}

const recipe = (input, output, count) => `{
    "format_version": "1.20.10",
    "minecraft:recipe_shapeless": {
        "description": {
            "identifier": "minecraft:stonecutter_${input}_to_${output}"
        },
        "tags": ["stonecutter"],
        "ingredients": [{ "item": "minecraft:${input}" }],
        "result": {
            "item": "minecraft:${output}",
            "count": ${count}
        },
        "unlock": [{ "item": "minecraft:${input}" }]
    }
}`

for (const colourName of colour) {
    const dir = path.join(ROOT, colourName)
    fs.mkdirSync(dir, { recursive: true })

    for (const [type, count] of Object.entries(types)) {
        const input = `${colourName}_wool`
        const output = `${colourName}_${type}`

        fs.writeFileSync(
            path.join(dir, `${type}.json`),
            recipe(input, output, count)
        )
    }
}