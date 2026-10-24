import fs from 'fs'
import path from 'path'
import { minify as minifyJS } from 'terser'

const IS_RP = process.argv.includes('--rp')
const ROOT = IS_RP ? '_rp' : '.'

const MINIFY_JSON = Object.freeze(new Set(['.json', '.jsonc']))
const MINIFY_JS = Object.freeze(new Set(['.js']))

const SKIP = Object.freeze(new Set([
    'node_modules',
    '.git',
    '.github',
]))

const CONCURRENCY = 4
const walk = dir => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const files = []
    for (const e of entries) {
        if (SKIP.has(e.name)) continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) files.push(...walk(full))
        else files.push(full)
    }
    return files
}

const minifyJSONFile = file => {
    try {
        const src = fs.readFileSync(file, 'utf8')
        const minified = JSON.stringify(JSON.parse(src))
        const saved = src.length - minified.length
        fs.writeFileSync(file, minified)
        console.log(`[JSON] ${file}  (saved ${saved} bytes)`)
    } catch (err) {
        console.error(`[JSON] ERROR ${file}: ${err.message}`)
    }
}

const minifyJSFile = async file => {
    try {
        const src = fs.readFileSync(file, 'utf8')
        const result = await minifyJS(src, {
            compress: {
                passes: 2,
                drop_console: true,
                unsafe: true
            },
            mangle: { toplevel: true, keep_fnames: true },
            format: { comments: false }
        })
        const saved = src.length - result.code.length
        fs.writeFileSync(file, result.code)
        console.log(`[JS]   ${file}  (saved ${saved} bytes)`)
    } catch (err) {
        console.error(`[JS]   ERROR ${file}: ${err.message}`)
    }
}

const pool = async (tasks, limit) => {
    const results = []
    let i = 0
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
        while (i < tasks.length) {
            const task = tasks[i++]
            results.push(await task())
        }
    })
    await Promise.all(workers)
    return results
}

(async () => {
    console.log(`\nMinifying pack at: ${path.resolve(ROOT)}\n`)
    const files = walk(ROOT)
    let jsonCount = 0
    const jsTasks = []
    for (const file of files) {
        const ext = path.extname(file).toLowerCase()

        if (MINIFY_JSON.has(ext)) {
            minifyJSONFile(file)
            jsonCount++
            continue
        }

        if (MINIFY_JS.has(ext)) jsTasks.push(() => minifyJSFile(file))
    }

    await pool(jsTasks, CONCURRENCY)
    console.log(`\nDone, minified ${jsonCount} JSON file(s) and ${jsTasks.length} JS file(s).`)
})()