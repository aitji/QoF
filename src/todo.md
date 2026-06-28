## info
this file is only for top priority todo, if something like refactor some code or simple todo put it inline

## aitji
- [x] (light-weight) dynamic light
- [x] repair anvil (with ingot)
- [x] migrate addon manifest to format_version v3
- [x] wet powder concrete
    - [x] delay on water keep track for x second before turn in to concrete
- [x] composter (poisonous potato, rotten flesh, spider ...)
- [x] carried chest
    - [x] support other container
- [x] /README.md
- [x] offhand items
- [x] bug fix
  - [x] fix hoe/shovel cannot use with dynamic light
  - [x] fix seeds not work on farmlands
  - [x] support edge case for offhand like buckets
- [x] harvest crop
- [x] offhand work with seed
  - [x] offhand seed work with [harvest], auto replant from offhand
- [x] harvest support more things like coco bean cocoa ["direction"=0-3], this might be hard with offhand
- [x] ongoing problem ; might ship without fix this
  - [x] composter not work with piston
  - [x] (24-Mar-2026) piston is change state to air when extract it will del piston
        ; (25-Mar-2026) still no clue how to fix "cleanly" tho\
        ; (25-Mar-2026) found problem! vanilla light block is pushable by piston (???) idk why they not [pop] it\
        ; (26-Mar-2026) i found workaround, by create `qof:light_block` that have all vanilla components but make it popped on piston moving\
          \ trade off: it show warning that it missing geometry because i use invaild geometry so it doesn't have a block textures but i will ship the resoure pack to fix that, if users didn't install pack and have warning GUIs enabled, warning will show once on world init
  - [x] player break block are showing light block particle ; after block become air it got replace to light block and minecraft decide to render it
- [x] add changelog/*.md and github action bot pull file and update it
- [x] picker is on vacation ; make everything config-able tmr(28 Mar 2026)
- [x] add more thing for wet concrete powders, e.g. cauldron?
- [x] add more config for new modules
  - [won't changed] should powder concrete dye in cauldron turn into soild concrete?
  - [x] max 16 each time player click cauldron (behave like tripped arrow)
- [x] if player have full inventory, container addItem will fail silently

## picker
- [x] update light level to new version
- [x] add mob light emit
- [x] [aitji/composter] and add composte list
- [x] entity loot drops
- [x] bat barter
  - [x] lure with glow berry
  - [x] trade
    - [x] loot table control
    - [x] cooldown
  - [x] float movement
- [x] recipes
  - [x] add more config in manifest pack (i add/update it for you but don't know about gramma tho --aitji)
    - [x] offhand's settings
      - [x] update _config
      - [x] update _store
      - [x] update manifest.json
    - [x] crop
      - [x] update _config
      - [x] update _store
      - [x] update manifest.json

## shared
- [x] syntax error: blocks/light_block.json | Unexpected version for the loaded data
- [ ] bat barter setting
  - [x] control interact `properties bool qof:bat_barter`
  - [ ] control ai float_tempt