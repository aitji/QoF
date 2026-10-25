import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname
const _ = path.join(ROOT, 'glass')
fs.mkdirSync(_, { recursive: true })

const colour = [
    "white", "light_gray", "gray", "black", "brown",
    "red", "orange", "yellow", "lime", "green", "cyan",
    "light_blue", "blue", "pink", "purple", "magenta"
]

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
    const input = `${colourName}_stained_glass`
    const output = `${colourName}_stained_glass_pane`

    fs.writeFileSync(
        path.join(_, `${colourName}.json`),
        recipe(input, output, 16)
    )
}