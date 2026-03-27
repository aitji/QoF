import { readFileSync } from "fs"
import { resolve } from "path"
import { appendFileSync } from "fs"

const parse = v => Array.isArray(v) ? v : String(v).split(".").map(Number)

const manifestPath = resolve(process.argv[2] || "manifest.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const version = parse(manifest.header.version).join(".")

const output = process.env.GITHUB_OUTPUT
appendFileSync(output, `rp_version=${version}\n`)

console.log(`RP Version: ${version}`)