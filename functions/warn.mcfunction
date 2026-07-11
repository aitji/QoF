execute unless score counter "aitjilib" matches ..99999 run scoreboard objectives add "aitjilib" dummy
execute unless score counter "aitjilib" matches ..99999 run scoreboard players set counter "aitjilib" 80
execute unless score counter "aitjilib" matches ..99999 run scoreboard players set addon "aitjilib" 0
execute unless score counter "aitjilib" matches ..99999 run scoreboard players set heartbeat "aitjilib" 0
execute unless score counter "aitjilib" matches ..99999 run scriptevent aitji-lib:heartbeat

execute unless score heartbeat "aitjilib" matches 1 run scriptevent aitji-lib:heartbeat qof
execute unless score heartbeat "aitjilib" matches 1 run scoreboard players set heartbeat "aitjilib" 1

scoreboard players remove counter "aitjilib" 1
execute if score addon "aitjilib" matches 2.. run scoreboard players operation counter "aitjilib" += addon "aitjilib"
execute if score addon "aitjilib" matches 2.. run scoreboard players remove counter "aitjilib" 1

execute unless score api "aitjilib" matches 1 if score counter "aitjilib" matches ..0 run tellraw @a {"rawtext":[{"translate":"§c§c@aitji Library §l§cCan't§r§7 install §cQ§fo§cF§7 addon\n\nPlease §cenable§7 the §l§fBeta APIs§r§7 to allow §cQ§fo§cF§7 to work correctly"}]}
execute unless score api "aitjilib" matches 1 if score counter "aitjilib" matches ..0 run tellraw @a {"rawtext":[{"translate":"\n§7Here is how to enable it: §fSettings §7-> §fExperiments §7-> §cBeta APIs§r\n§7*If you have already §8enabled§7 it, please try updating the §caddon §7or report the issue on our GitHub§r"}]}
execute unless score api "aitjilib" matches 1 if score counter "aitjilib" matches ..0 run tellraw @a {"rawtext":[{"translate":"\n§7Addon by §caitji, pickerth-12 §7(beta-stable)\n§7Download the addon at §cgithub.com/aitji/QoF\n§7----------------------------"}]}

execute unless score api "aitjilib" matches 0 if score counter "aitjilib" matches ..0 run scoreboard players set api "aitjilib" 0
execute if score counter "aitjilib" matches ..0 run scoreboard players set counter "aitjilib" 300

scoreboard players set addon "aitjilib" 0
scoreboard players set heartbeat "aitjilib" 0
