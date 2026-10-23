<div align="center">

<picture>
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/brand/github%20banner.png" alt="QoF's Banner">
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@stats/data/downloads.svg" height="30px" alt="QoF's Downloads">
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@stats/data/version.svg" height="30px" alt="QoF's Version">
</picture>


<h1>${\color{#fff000}\textsf{Q}}\textsf{uality }{\color{#fff000}\textsf{o}}\textsf{f }{\color{#fff000}\textsf{F}}\textsf{eature}$</h1>

[Releases](https://github.com/aitji/QoF/releases/latest) | [Curseforge](https://www.curseforge.com/minecraft-bedrock/addons/quality-of-feature) & [MCPEDL](https://mcpedl.com/quality-of-feature) | [Behavior Code](https://github.com/aitji/QoF/tree/behavior_packs) | [Resource Code](https://github.com/aitji/QoF/tree/resource_packs) | [WiKi](https://qof.aitji.xyz) | [LICENSE](./LICENSE) & [COPYRIGHT](./COPYRIGHT.md)

</div>

> [!NOTE]
> A Minecraft Bedrock addon that adds small ${\color{#fff000}\textsf{vanilla-friendly}}$ features. Each module is configurable through the in-game pack settings panel. ${\color{#fff000}\textsf{Requires \textbf{BetaAPIs} enabled under Experiments.}}$

<details open>
  <summary><strong><b>Table of Contents</b></strong></summary>

- [Overview](#overview)
- [Changelog](#changelog)
- [Installation](#installation)
- [Modules](#modules)
  - [Dynamic Light](#dynamic-light)
  - [Double Door](#double-door)
  - [Anvil Repairing](#anvil-repairing)
  - [Hardens Concrete Powder](#hardens-concrete-powder)
  - [Cauldron+](#cauldron)
  - [Composter+](#composter)
  - [Offhand](#offhand)
  - [Unwaxed Sign](#unwaxed-sign)
  - [Carrying Container](#carrying-container)
  - [Harvest](#harvest)
  - [Mob Loot+](#mob-loot)
  - [Recipe+](#recipe)
- [Configuration References](#configuration-references)
- [Take a Look](#take-a-look)
- [License](#license)
- [Disclosure](#disclosure)
- [Credits](#credits)

</details>

## Overview

- [x] Dynamic lighting
- [x] Open adjacent doors with a single interaction
- [x] Repair damaged anvils with iron ingot
- [x] Hardens Concrete powder when touches water
- [x] Composter, Cauldron accepts more items
- [x] Carry containers while preserving their contents
- [x] Swap mainhand and offhand with a double sneak
- [x] Harvest crops with automatic seed replanting, supports offhand seed priority
- [x] Extra mob drops
- [x] Battering Bat with ${\color{#fff000}\textsf{glow berry}}$
- [x] Extra crafting and smelting recipes

## Changelog

<details open>
  <summary><strong>QoF's Releases</strong></summary>

- QoF **Well Equipped** [v1.5.0](https://github.com/aitji/QoF/releases/tag/v1.5.0)
  - `Pre-Releases` Qof [v1.4.1](https://github.com/aitji/QoF/releases/tag/v1.4.1)
- QoF **Seamless** [v1.4.0](https://github.com/aitji/QoF/releases/tag/v1.4.0)
  - `Pre-Releases` Qof [v1.3.4](https://github.com/aitji/QoF/releases/tag/v1.3.4)
  - `Pre-Releases` Qof [v1.3.3](https://github.com/aitji/QoF/releases/tag/v1.3.3)
  - `Pre-Releases` Qof [v1.3.2](https://github.com/aitji/QoF/releases/tag/v1.3.2)
  - `Pre-Releases` Qof [v1.3.1](https://github.com/aitji/QoF/releases/tag/v1.3.1)
- QoF **In Sync** [v1.3.0](https://github.com/aitji/QoF/releases/tag/v1.3.0)
  - `Pre-Releases` QoF [v1.2.3](https://github.com/aitji/QoF/releases/tag/v1.2.3)
  - `Pre-Releases` QoF [v1.2.2](https://github.com/aitji/QoF/releases/tag/v1.2.2)
  - `Pre-Releases` QoF [v1.2.1](https://github.com/aitji/QoF/releases/tag/v1.2.1)
- QoF **Take Control** [v1.2.0](https://github.com/aitji/QoF/releases/tag/v1.2.0)
  - `Pre-Releases` QoF [v1.1.1](https://github.com/aitji/QoF/releases/tag/v1.1.1)
- QoF **Subtle Shift** [v1.1.0](https://github.com/aitji/QoF/releases/tag/v1.1.0)

</details>

## Installation

Download the `QoF` addon from one of these sources:

- GitHub: https://github.com/aitji/QoF/releases
- CurseForge: https://www.curseforge.com/minecraft-bedrock/addons/quality-of-feature
- MCPEDL: https://mcpedl.com/quality-of-feature

1. Download the latest `.mcaddon` file from the releases page.
2. Open the file, Minecraft will automatically import the addon.
3. Open or create a world.
4. Go to **Behavior Packs** and activate **QoF**.
5. In **Experiments**, enable **Beta APIs**.
6. Configure settings in the pack settings panel inside the world settings.

> Still having trouble? try shooting it here: [/w/Installation](https://qof.aitji.xyz/w/Installation)

> [!IMPORTANT]
> **Beta APIs must be enabled**, otherwise the pack will not function.

## Modules

### Dynamic Light

Held and dropped items emit light based on their type. The light smoothly fades after the source moves away or is removed. `burning entities`, `glowing entities` and `item frames` also emit light based on what they contain.

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/light-water.gif" alt="Player holds conduit while swimming in ocean, light visible underwater" width="1080">

> **alt-message** In the open ocean, the player rows a boat while holding a lantern, making the water surface glow below. They stop, jump in, switch to a conduit, and swim deeper. The `qof:light_block` is placed inside the water itself, illuminating the seafloor and kelp.

**How It Works:**

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/light-fade.gif" alt="Player picks up soul lantern in mushroom cave, light fades after drop" width="1080">

> **alt-message** In a mushroom cave, a soul lantern sits on the ground emitting light. The player walks in from the right, picks it up, and the room goes dark. And then drops it back in the same spot and walks away.
>
> - When a player holds or drops a ${\color{#fff000}\textsf{light-emitting}}$ item, a `qof:light_block` is placed at the relevant position each tick.
> - When the source is gone, the light level decreases linearly each tick until it reaches zero, then the block is restored to air or water.


<details>
  <summary><strong>Dynamic Light List</strong></summary>
  <div align="center">

| Item               | Reaction                        | Level |
| ------------------ | ------------------------------- | ----- |
| Campfire           | Won't emit light underwater     | 15    |
| Lantern            | Won't emit light underwater     | 15    |
| Lava Bucket        | Won't emit light underwater     | 15    |
| All Copper Lantern | Won't emit light underwater     | 15    |
|                    |                                 | <br>  |
| Torch              | Won't emit light underwater     | 14    |
| Copper Torch       | Won't emit light underwater     | 14    |
|                    |                                 | <br>  |
| Soul Campfire      | Won't emit light underwater     | 10    |
| Soul Lantern       | Won't emit light underwater     | 10    |
| Soul Torch         | Won't emit light underwater     | 10    |
|                    |                                 | <br>  |
| Redstone Torch     | Won't emit light underwater     | 7     |
|                    |                                 | <br>  |
| Sea Pickle         | **Only** emits light underwater | 6     |

</div>
</details>

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/light-fire.gif" alt="Player shoots flame arrows into targets, picks up arrow, walks away" width="1080">

> **alt-message** A flaming arrow is fired into a target block. While the arrow is burning, it emits light. The player walks through the lit area, picks the arrow up, and leaves. Light disappears when the source is gone.
>
> - Nearby glowing or burning entities also emit light passively.

<details>
  <summary><strong>Items That Emit Light</strong></summary>
  <div align="center">

| Item                           | Light Level                               |
| ------------------------------ | ----------------------------------------- |
|                                | <div align="center"><b>Level 15</b></div> |
| Beacon                         | 15                                        |
| Campfire                       | 15                                        |
| Conduit                        | 15                                        |
| Ochre Froglight                | 15                                        |
| Pearlescent Froglight          | 15                                        |
| Verdant Froglight              | 15                                        |
| Glowstone                      | 15                                        |
| Lit Pumpkin                    | 15                                        |
| Lantern                        | 15                                        |
| Lava Bucket                    | 15                                        |
| Sea Lantern                    | 15                                        |
| ShroomLight                    | 15                                        |
| Copper Lantern                 | 15                                        |
| Waxed Copper Lantern           | 15                                        |
| Exposed Copper Lantern         | 15                                        |
| Waxed Exposed Copper Lantern   | 15                                        |
| Weathered Copper Lantern       | 15                                        |
| Waxed Weathered Copper Lantern | 15                                        |
| Oxidized Copper Lantern        | 15                                        |
| Waxed Oxidized Copper Lantern  | 15                                        |
|                                | <div align="center"><b>Level 14</b></div> |
| End Rod                        | 14                                        |
| Glow Berries                   | 14                                        |
| Torch                          | 14                                        |
| Copper Torch                   | 14                                        |
|                                | <div align="center"><b>Level 10</b></div> |
| Crying Obsidian                | 10                                        |
| Soul Campfire                  | 10                                        |
| Soul Lantern                   | 10                                        |
| Soul Torch                     | 10                                        |
|                                | <div align="center"><b>Level 7</b></div>  |
| Enchanting Table               | 7                                         |
| Ender Chest                    | 7                                         |
| Glow Lichen                    | 7                                         |
| Redstone Torch                 | 7                                         |
|                                | <div align="center"><b>Level 6</b></div>  |
| Sculk Catalyst                 | 6                                         |
| Sea Pickle                     | 6                                         |
| Vault                          | 6                                         |
|                                | <div align="center"><b>Level 5</b></div>  |
| Amethyst Cluster               | 5                                         |
|                                | <div align="center"><b>Level 4</b></div>  |
| Large Amethyst Bud             | 4                                         |
| Trial Spawner                  | 4                                         |
|                                | <div align="center"><b>Level 3</b></div>  |
| Magma                          | 3                                         |
|                                | <div align="center"><b>Level 2</b></div>  |
| Medium Amethyst Bud            | 2                                         |
| Firefly Bush                   | 2                                         |
|                                | <div align="center"><b>Level 1</b></div>  |
| Brewing Stand                  | 1                                         |
| Brown Mushroom                 | 1                                         |
| Calibrated Sculk Sensor        | 1                                         |
| Dragon Egg                     | 1                                         |
| End Portal Frame               | 1                                         |
| Sculk Sensor                   | 1                                         |
| Small Amethyst Bud             | 1                                         |

</div>
</details>

<details>
  <summary><strong>Entities That Emit The Light</strong></summary>
  <div align="center">

| Entity      | Light Level |
| ----------- | ----------- |
| Blaze       | 12          |
| Glow Squid  | 10          |
| Allay       | 10          |
| Vex         | 10          |
| Magma Cubes | 9           |
| Warden      | 6           |

</div>
</details>


### Double Door

<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/doubledoor.gif" alt="Double door opening both sides simultaneously" width="1080">
</div>

Interacting with one door automatically opens or closes the adjacent door at the same time. Works with all door types, keeping paired doors in sync without any extra input.

<p>*script might take up to 2 ticks to update block permutation.</p>

### Anvil Repairing

Damaged anvils can be repaired by interacting with them while holding an iron ingot. The anvil steps up one stage per ingot consumed.

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/repair-anvil.gif" alt="Player repairs anvil twice, mines it, places damaged one, and walks out" width="1080">

> **alt-message** The player walks into a cozy spruce house, repairs a damaged anvil twice to bring it back to full, mines it with an iron pickaxe, places a new damaged anvil, and walks out.

**Repair chain:**

```
Damaged Anvil  ->  Chipped Anvil  ->  Anvil
```

> [!TIP]
> Hold the interact button to repair continuously. A short delay between repairs is applied to prevent accidental over-use.

### Hardens Concrete Powder

Concrete powder items will automatically convert to concrete when they enter water. The conversion happens after a short delay that scales with the stack size*, and the resulting concrete.

<small>*non linearly</small>

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/powder-result.gif" alt="Top-down view: player throws concrete powder into water pool, allay nearby, powder converts to concrete" width="1080">

> **alt-message** Top-down view centered on a water pool with an allay floating nearby emitting soft light. The player walks in from the bottom-center and throws concrete powder into the pool. After a short delay the powder converts, and the player picks up the resulting concrete and walks off.

### Cauldron+

> [!NOTE]
> Sorry we didn't have a GIFs to show (yet)

Cauldrons in Bedrock Edition now have expanded functionality with $\color{#fff000}\textsf{QoF (Quality of Feature)}$

| Item                  | Dye                    | Clean                   |
| --------------------- | ---------------------- | ----------------------- |
| Carpet                | `#` Carpet             | White Carpet            |
| Wool                  | `#` Wool               | White Wool              |
| Concrete              | `#` Concrete           | White Concrete          |
| Concrete Powder       | `#` Concrete Powder    | White Concrete Powder   |
| Glass                 | `#` Stained Glass      | Glass                   |
| Glass Pane            | `#` Stained Glass Pane | Glass Pane              |
| Hardened Clay         | `#` Terracotta         | Hardened Clay           |
| `#` Terracotta        | `#` Terracotta         | Hardened Clay           |
| `#` Glazed Terracotta | `#` Glazed Terracotta  | White Glazed Terracotta |

> Note
> `#` represents any color\
> Shulkers, banners, and bundles are not supported due to NBT limitations

### Composter+

Expands the composter to accept many more item types not supported in vanilla, including mob drops, food, wool, and various materials.

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/composter-work_hopper.gif" alt="Player composts string, places hopper on top, throws rotten flesh in, composter fills automatically" width="1080">

> **alt-message** The player manually composts some string _`(not in the vanilla list)`_, then places a hopper above the composter and throws in rotten flesh _`(also not in the vanilla list)`_. The hopper feeds the composter automatically until it fills and becomes ready.

**How It Works:** $\color{#ffa500}\textsf{(nerd warning)}$

1. Player interaction with supported items triggers compost fill with a per-item success chance.
2. On reaching level 7, a short delay passes before the composter becomes ready (level 8).
3. Hoppers check for composting items on a configurable interval and process one item per check.

> [!WARNING]
> Enabling hopper integration **with many composters** and hoppers in a loaded area may affect performance. Tune the hopper interval setting *if needed.*

<details>
  <summary><strong>Additional Compostable Items (QoF Only)</strong></summary>

These are items added by QoF on top of the vanilla compost table. Vanilla items are handled by Minecraft natively and are excluded here to avoid double-processing.

<div align="center">

| Item                   | Success Chance                        |
| ---------------------- | ------------------------------------- |
|                        | <div align="center"><b>30%</b></div>  |
| podzol                 | 30%                                   |
| mycelium               | 30%                                   |
| rooted_dirt            | 30%                                   |
|                        | <div align="center"><b>50%</b></div>  |
| bamboo                 | 50%                                   |
| dead_bush              | 50%                                   |
| honeycomb              | 50%                                   |
| sugar                  | 50%                                   |
| blaze_powder           | 50%                                   |
| ghast_tear             | 50%                                   |
| string                 | 50%                                   |
| chicken                | 50%                                   |
| porkchop               | 50%                                   |
| beef                   | 50%                                   |
| mutton                 | 50%                                   |
| rabbit                 | 50%                                   |
| feather                | 50%                                   |
| ink_sac                | 50%                                   |
| glow_ink_sac           | 50%                                   |
| rabbit_hide            | 50%                                   |
| rabbit_foot            | 50%                                   |
| frog_spawn             | 50%                                   |
| cod                    | 50%                                   |
| salmon                 | 50%                                   |
| tropical_fish          | 50%                                   |
| pufferfish             | 50%                                   |
|                        | <div align="center"><b>65%</b></div>  |
| poisonous_potato       | 65%                                   |
| chorus_fruit           | 65%                                   |
| resin_clump            | 65%                                   |
| lit_pumpkin            | 65%                                   |
| rotten_flesh           | 65%                                   |
| web                    | 65%                                   |
| gunpowder              | 65%                                   |
| magma_cream            | 65%                                   |
| slime_ball             | 65%                                   |
| leather                | 65%                                   |
| phantom_membrane       | 65%                                   |
| cooked_chicken         | 65%                                   |
| cooked_porkchop        | 65%                                   |
| cooked_beef            | 65%                                   |
| cooked_mutton          | 65%                                   |
| cooked_rabbit          | 65%                                   |
| cooked_cod             | 65%                                   |
| cooked_salmon          | 65%                                   |
| golden_carrot          | 65%                                   |
| golden_dandelion       | 65%                                   |
| glistering_melon_slice | 65%                                   |
|                        | <div align="center"><b>85%</b></div>  |
| blaze_rod              | 85%                                   |
| fermented_spider_eye   | 85%                                   |
| dried_ghast            | 85%                                   |
| black_wool             | 85%                                   |
| blue_wool              | 85%                                   |
| brown_wool             | 85%                                   |
| cyan_wool              | 85%                                   |
| gray_wool              | 85%                                   |
| green_wool             | 85%                                   |
| light_blue_wool        | 85%                                   |
| light_gray_wool        | 85%                                   |
| lime_wool              | 85%                                   |
| magenta_wool           | 85%                                   |
| orange_wool            | 85%                                   |
| pink_wool              | 85%                                   |
| red_wool               | 85%                                   |
| purple_wool            | 85%                                   |
| white_wool             | 85%                                   |
| yellow_wool            | 85%                                   |
| popped_chorus_fruit    | 85%                                   |
| mushroom_stew          | 85%                                   |
| suspicious_stew        | 85%                                   |
| beetroot_soup          | 85%                                   |
| golden_apple           | 85%                                   |
|                        | <div align="center"><b>100%</b></div> |
| enchanted_golden_apple | 100%                                  |
| rabbit_stew            | 100%                                  |
| nether_star            | 100%                                  |

</div>

</details>


### Offhand

Allows players to double-sneak to swap items between their mainhand and offhand. Additionally, torches and other light sources held in the offhand can be placed directly without switching slots. **All seed types** can now be planted directly from the offhand.

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/offhand.png" alt="Offhand swap and torch placement banner" width="1080">
</p>

**How It Works:**

- $\color{#fff000}\textsf{Double sneak}$ within a time window to swap mainhand and offhand.
- Block placed from the offhand will consume the offhand item stack.
- Seeds held in the offhand can be planted directly this also $\color{#fff000}\textsf{integrates}$ with the Harvest module for auto-replanting priority.

> [!NOTE]
> Enchantments and item color cannot be transferred between hands due to API limitations that do not allow editing the offhand cleanly.

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/offhand-swap.gif" alt="Player double sneaks to swap sword and torch, places torch from offhand" width="1080">

> **alt-message** First-person view. The player is holding a `Trident` in the main hand and a `Soul Torch` in the offhand. They double-sneak, causing the `Trident` and `Soul Torch` to swap places, while another player walks across the screen.


### Unwaxed Sign

> [!NOTE]
> Sorry we didn't have a GIFs to show (yet)

Signs can now be $\color{#fff000}\textsf{unwaxed using an axe}$.
Durability is consumed by default, but this can be configured in the in-game settings panel.

### Carrying Container

Allows players to pick up $\color{#fff000}\textsf{chests and other containers}$ while preserving their contents. Sneaking and interacting with a container picks it up. Placing the carried item puts the container back down with all items restored.

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/chest-slownessdouble.gif" alt="Player picks up chest near sheep, walks slowly, places it into double chest formation" width="1080">

> **alt-message** The player runs in, picks up a chest next to a black sheep, then visibly slows down while carrying it. They walk to a second chest and place theirs beside it, forming a double chest. Contents from both halves are preserved.

- Slowness is applied continuously.
- Players in Creative mode are exempt from jump restrictions.

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/chest-flow.gif" alt="Player puts cod in barrel, picks it up, walks to composter area, places barrel on hopper" width="1080">

> **alt-message** The player walks in holding a cod, places it inside a barrel, then picks the barrel up. They carry it slowly across the scene, with slowness visible, and place it on top of a hopper. The barrel lands with its contents intact.

<details>
  <summary><strong>Supported Containers</strong></summary>

Any block with a `minecraft:inventory` component can be picked up. Common examples include:

<div align="center">

| Container     | Chest support | Double Chest |
| ------------- | ------------- | ------------ |
| Chest         | yes           | yes          |
| Trapped Chest | yes           | yes          |
| Copper Chest  | yes           | yes`**`      |
| Barrel        | yes           | no           |
| Hopper        | yes           | no           |
| Dispenser     | yes           | no           |
| Dropper       | yes           | no           |
| Blast Furnace | yes`*`        | no           |
| Furnace       | yes`*`        | no           |
| Smoker        | yes`*`        | no           |
| Brewing Stand | yes           | no           |
| Crafter       | no            | no           |
| Shulker Box   | yes           | no           |

</div>

> [!NOTE]
> `*` For furnace items, the contents remain. However, the heat state is lost.\
> `**` Copper chests currently have a bug in Minecraft vanilla where the oxidized state of copper affects the behavior of double chests.

</details>

### Harvest

Allows players to $\color{#fff000}\textsf{harvest fully grown crops}$ while holding any hoe. Seeds are automatically replanted after harvesting, and the hoe loses durability on each harvest to balance the automation. And **Cocoa Beans** are supported harvest them using an axe. Seeds placed in the **offhand** are prioritized for replanting over inventory seeds.

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/harvesting.gif" alt="Player harvesting wheat field with hoe" width="1080">
</p>

> **alt-message** First-person view. The player holds a hoe and interacts with a fully grown wheat crop. The wheat is harvested, the drops are collected, and a wheat seed is automatically replanted in the same spot.

### Mob Loot+

Adds drops to $\color{#fff000}\textsf{previously mobs without loot}$, making them more rewarding to farm.

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/mobloot.gif" alt="Mob Loot+ showcase banner" width="1080">
</p>

<details>
  <summary><strong>Mob Loot Table</strong></summary>

**1. Goat drops `Raw Mutton`**

$$ P(\text{drop}) \in \langle 1,\ 2 + L \rangle, \quad L \in \langle 0,\ \text{Looting} \rangle $$

<div align="center">

| Looting Level | Min Drop | Max Drop |
| ------------- | -------- | -------- |
| None          | 1        | 2        |
| I             | 1        | 3        |
| II            | 1        | 4        |
| III           | 1        | 5        |

</div>

> **Goat on Fire** will cook `Raw Mutton` into `Cooked Mutton`

**2. Silverfish drops `String`**

$$ P(\text{drop}) = \frac{1}{5} = 20\% $$

<div align="center">

| Outcome  | Weight | Chance |
| -------- | ------ | ------ |
| Nothing  | 4      | 80%    |
| `String` | 1      | 20%    |

</div>

> Only drops when killed by a **player or pet**

**3. Sniffer drops `Moss Block`**

$$ \text{Drop} = 1 $$

> Looting does not affect the drop quantity

**4. Piglin Brute drops `Gilded Blackstone`**

$$ P(\text{Drop}) \in \langle 0,\ 1 \rangle $$

> Looting does not affect the drop quantity

</details>

### Recipe+

Adds new $\color{#fff000}\textsf{crafting, smelting, and stonecutter}$ recipes for a more accessible way to obtain items.

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/showcase/recipe.png" alt="Recipe+ banner showing various crafting and smelting screens" width="1080">
</p>

> [!NOTE]
> This may be `outdated`. You can find the most up-to-date information here: [w/Recipe](https://qof.aitji.xyz/w/Recipe)

## Configuration References

All settings are accessible through the $\color{#fff000}\textsf{pack settings panel in-game}$. No manual file editing is required.

<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/setting.png" alt="QoF's how to enter settings pannels from version 1.5.1 'till today" width="1080">
<img src="https://cdn.jsdelivr.net/gh/aitji/QoF@sources/.github/img/settings/v1.5.3.png" alt="QoF's settings pannels from version 1.5.3 'till today" width="1080">

## Take a Look
If you enjoyed this project, be sure to check out our other project:

- [CoM (Chain o' Mining)](https://github.com/aitji/CoM) breaking a single block to instantly mine an entire $\color{#ffa500}\textsf{ore vein, tree, crop field, or cluster of leaves.}$

## License

This project's software components, including source code, scripts, behavior definitions, configuration files, and compiled addon files (`.mcaddon` / `.mcpack`), are licensed under the [QoF Noncommercial License 1.0](./LICENSE).

The software may be used, modified, and redistributed for free noncommercial purposes with proper attribution. Commercial use, monetized distribution, or inclusion in paid products requires separate written permission from the maintainers.

Branding, trademarks, media, documentation, screenshots, promotional materials, and other non-code assets are not covered by the software license and remain subject to separate restrictions. See [COPYRIGHT.md](./COPYRIGHT.md) for full details.

## Disclosure

All gameplay footage, images, and GIFs were recorded using [Vibrant Visual](https://www.minecraft.net/en-us/vibrant-visuals-update) and [Action And Stuff](https://www.minecraft.net/en-us/article/let-s-play--actions---stuff).

LLMs were used to assist with wording and grammar in this documentation.\
English is not our native language. Thank you for your understanding!

## Credits

- [$\color{#ff0000}\textsf{@aitji}$](https://github.com/aitji) scripting & design
- [$\color{#add8e6}\textsf{@pickerth-12}$](https://github.com/pickerth-12) design, json & molang

$\color{#fff000}\textsf{@QoF™ / Quality of Features™}$ Copyright © 2026 [$\color{#ff0000}\textsf{@aitji}$](https://github.com/aitji) & [$\color{#add8e6}\textsf{@pickerth-12}$](https://github.com/pickerth-12)

Software licensed under the [QoF Noncommercial License 1.0](./LICENSE).  
Branding, media, and other protected materials are reserved under [COPYRIGHT.md](./COPYRIGHT.md).

```
  README INFO
Version: v1.5.0
Last updated: 23 Oct 2026
Has README Update: False

  PACK INFO
Last Release: v1.5.0
Last Pre-Release: v1.5.3
Last Minecraft Version: 26.33
Used Dependencies: ^2.9.0-beta.1.26.33-stable
```
