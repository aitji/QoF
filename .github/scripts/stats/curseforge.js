import { writeFileSync } from 'fs'

const API_KEY = process.env.CF_API_KEY
const MOD_ID = '1500007'
const OUT_DIR = '/tmp'

if (!API_KEY) {
    console.error('no CF_API_KEY - -;;')
    process.exit(1)
}

// badge rendering (code from qof.aitji.xyz/api)
const PALETTE = {
  bg: '#161b22',
  labelBg: '#0e1217',
  border: '#30363d',
  gold: '#ffd84d',
  outline: '#21262d',
  labelText: '#e6edf3',
  errorGold: '#e5325f',
}

const esc = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textWidth = (str, charW) => Math.round(str.length * charW)

function buildBadgeSvg({ label, value, rounded = true }) {
  const labelFontSize = 11
  const valueFontSize = 14
  const labelCharW = 6.5
  const valueCharW = 8.1

  const labelPadX = 20
  const valuePadX = 15
  const height = 32
  const radius = rounded ? 4 : 0

  const labelStr = label.toUpperCase()
  const labelW = textWidth(labelStr, labelCharW) + labelPadX * 2
  const valueW = textWidth(value, valueCharW) + valuePadX * 2
  const totalW = labelW + valueW

  const gold = PALETTE.gold
  const labelX = labelW / 2
  const valueX = labelW + valueW / 2
  const midY = height / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${height}" viewBox="0 0 ${totalW} ${height}" role="img" aria-label="${esc(labelStr)}: ${esc(value)}">
  <defs>
    <clipPath id="clip"><rect width="${totalW}" height="${height}" rx="${radius}"/></clipPath>
    <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="0.14" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.86" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="0" height="${height}" fill="${PALETTE.bg}"/>
    <rect x="0" width="${labelW}" height="${height}" fill="${PALETTE.labelBg}"/>
    <rect x="${labelW}" width="${valueW}" height="${height}" fill="${PALETTE.bg}"/>
    <rect x="-0.5" width="1" height="${height}" fill="#000000" opacity="0.35"/>
    <rect x="${labelW - 0.5}" width="1" height="${height}" fill="#000000" opacity="0.35"/>

    <text x="${labelX}" y="${midY + 4}" font-family="Verdana, 'Segoe UI', sans-serif" font-size="${labelFontSize}" font-weight="700" letter-spacing="0.6" fill="${PALETTE.labelText}" text-anchor="middle">${esc(labelStr)}</text>

    <text x="${valueX}" y="${(midY + 4.6).toFixed(1)}" font-family="Verdana, 'Segoe UI', sans-serif" font-size="${valueFontSize}" font-weight="700" letter-spacing="0.2" fill="${gold}" stroke="${PALETTE.outline}" stroke-width="1.8" stroke-linejoin="round" paint-order="stroke" text-anchor="middle">${esc(value)}</text>
    <rect width="${totalW}" height="${height}" rx="${radius}" fill="url(#bevel)"/>
  </g>
  <rect x="0.5" y="0.5" width="${totalW - 1}" height="${height - 1}" rx="${radius}" fill="none" stroke="${PALETTE.border}"/>
</svg>`
}

function formatVersion(mod) {
  try {
    const files = mod.latestFiles || []
    const main = files.find((f) => f.id === mod.mainFileId) || files[files.length - 1]
    const match = main.fileName.match(/QoF[-_]v?(\d+(?:\.\d+)*)/i)
    return match ? `v${match[1]}` : main.displayName || 'unknown'
  } catch { return 'unknown' }
}

function writeBadgePair(baseName, label, value) {
  writeFileSync(`${OUT_DIR}/${baseName}.svg`, buildBadgeSvg({ label, value, rounded: true }))
  writeFileSync(`${OUT_DIR}/${baseName}-square.svg`, buildBadgeSvg({ label, value, rounded: false }))
}

// fetch + write
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

    writeFileSync(`${OUT_DIR}/curseforge.json`, JSON.stringify(output, null, 2))

    writeBadgePair('downloads', 'downloads', Number(mod.downloadCount || 0).toLocaleString('en-US'))
    writeBadgePair('version', 'version', formatVersion(mod))

    console.log(`saved ${mod.name} (${mod.id}) + badges to ${OUT_DIR}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
