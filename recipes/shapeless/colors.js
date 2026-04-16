import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = __dirname
const dir = path.join(ROOT, "colors")
fs.mkdirSync(dir, { recursive: true })

const combinations = [
    // color-theory rule
    { id: "purple_yellow_to_brown", ingredients: ["purple_dye", "yellow_dye"], result: "brown_dye", count: 2 },
    { id: "orange_blue_to_brown", ingredients: ["orange_dye", "blue_dye"], result: "brown_dye", count: 2 },
    { id: "cyan_red_to_brown", ingredients: ["cyan_dye", "red_dye"], result: "brown_dye", count: 2 },
    { id: "magenta_green_to_brown", ingredients: ["magenta_dye", "green_dye"], result: "brown_dye", count: 2 },
    { id: "red_green_to_brown", ingredients: ["red_dye", "green_dye"], result: "brown_dye", count: 2 },
    // muddy brown
    { id: "rgb_to_brown", ingredients: ["red_dye", "blue_dye", "yellow_dye"], result: "brown_dye", count: 3 },
    // dark-warm combos
    { id: "black_yellow_to_brown", ingredients: ["black_dye", "yellow_dye"], result: "brown_dye", count: 2 },
    { id: "black_green_to_brown", ingredients: ["black_dye", "green_dye"], result: "brown_dye", count: 2 },

    // lime
    { id: "yellow_green_to_lime", ingredients: ["yellow_dye", "green_dye"], result: "lime_dye", count: 2 },
    { id: "green_white_to_lime", ingredients: ["green_dye", "white_dye"], result: "lime_dye", count: 2 },

    // light blue
    { id: "cyan_white_to_light_blue", ingredients: ["cyan_dye", "white_dye"], result: "light_blue_dye", count: 2 },
    { id: "blue_white_to_light_blue", ingredients: ["blue_dye", "white_dye"], result: "light_blue_dye", count: 2 },

    // magenta
    { id: "red_blue_white_to_magenta", ingredients: ["red_dye", "blue_dye", "white_dye"], result: "magenta_dye", count: 3 },
    { id: "purple_pink_to_magenta", ingredients: ["purple_dye", "pink_dye"], result: "magenta_dye", count: 2 },
    { id: "red_purple_to_magenta", ingredients: ["red_dye", "purple_dye"], result: "magenta_dye", count: 2 },

    // pink
    { id: "magenta_white_to_pink", ingredients: ["magenta_dye", "white_dye"], result: "pink_dye", count: 2 },
    { id: "orange_white_to_pink", ingredients: ["orange_dye", "white_dye"], result: "pink_dye", count: 2 },

    // cyan
    { id: "lime_blue_to_cyan", ingredients: ["lime_dye", "blue_dye"], result: "cyan_dye", count: 2 },
    { id: "light_blue_green_to_cyan", ingredients: ["light_blue_dye", "green_dye"], result: "cyan_dye", count: 2 },

    // purple
    { id: "magenta_blue_to_purple", ingredients: ["magenta_dye", "blue_dye"], result: "purple_dye", count: 2 },
    { id: "pink_blue_to_purple", ingredients: ["pink_dye", "blue_dye"], result: "purple_dye", count: 2 },

    // orange
    { id: "pink_yellow_to_orange", ingredients: ["pink_dye", "yellow_dye"], result: "orange_dye", count: 2 },
    { id: "red_lime_to_orange", ingredients: ["red_dye", "lime_dye"], result: "orange_dye", count: 2 },

    // gray
    { id: "bww_to_light_gray", ingredients: ["black_dye", "white_dye", "white_dye"], result: "light_gray_dye", count: 3 },
    { id: "light_blue_gray_to_light_gray", ingredients: ["light_blue_dye", "gray_dye"], result: "light_gray_dye", count: 2 },

    // green
    { id: "blue_yellow_to_green", ingredients: ["blue_dye", "yellow_dye"], result: "green_dye", count: 2 },
    { id: "cyan_yellow_to_green", ingredients: ["cyan_dye", "yellow_dye"], result: "green_dye", count: 2 },
    { id: "lime_black_to_green", ingredients: ["lime_dye", "black_dye"], result: "green_dye", count: 2 },
]

for (const combo of combinations) {
    const data = {
        "format_version": "1.20.10",
        "minecraft:recipe_shapeless": {
            "description": { "identifier": combo.id },
            "tags": ["crafting_table"],
            "ingredients": combo.ingredients.map(item => ({ "item": `minecraft:${item}` })),
            "result": {
                "item": `minecraft:${combo.result}`,
                "count": combo.count
            },
            "unlock": combo.ingredients.map(item => ({ "item": `minecraft:${item}` }))
        }
    }
    fs.writeFileSync(path.join(dir, `${combo.id}.json`), JSON.stringify(data, null, 4))
}

console.log(`\nwritten to ./${path.relative(ROOT, dir)}/`)