import { writeFileSync } from 'fs'

const API_KEY = process.env.CF_API_KEY
const MOD_ID = '1500007'
const OUT_PATH = '/tmp/curseforge.json'

if (!API_KEY) {
    console.error('no CF_API_KEY - -;;')
    process.exit(1)
}

async function main() {
    const res = await fetch(`https://api.curseforge.com/v1/mods/${MOD_ID}`, {
        headers: {
            Accept: 'application/json',
            'x-api-key': API_KEY,
        }
    })

    if (!res.ok) throw new Error(`CurseAPI failed ${res.status}: ${res.statusText}`)

    const json = await res.json()
    const mod = json.data

    const output = {
        fetchedAt: new Date().toISOString(),
        ...mod
    }

    writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))
    console.log(`saved ${mod.name} (${mod.id}) to ${OUT_PATH}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})