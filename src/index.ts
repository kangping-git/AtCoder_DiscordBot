import { getRanking } from "./api/ranking";
import { createProblemTable } from "./images/problem";
import { atcoderProblems, problems, login, AtCoderFetch } from "./api/getProblems";
import { updateTaskTable, contestData } from "./api/tasks";
import { setData, getData } from "./data";
import { APref, CreateContestRanking } from "./images/ranking";
import { Client, IntentsBitField, SlashCommandBuilder, ChannelType, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { config } from "dotenv";
import path from "path";
import { createTable, textTable, userTable } from "./images/table";
config({ path: path.join(__dirname, "../.env") });

function ordinal_suffix_of(i: number) {
    let j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) {
        return i + "st";
    }
    if (j === 2 && k !== 12) {
        return i + "nd";
    }
    if (j === 3 && k !== 13) {
        return i + "rd";
    }
    return i + "th";
}

let client = new Client({
    intents: [IntentsBitField.Flags.Guilds],
});

let contests: contestData[] = [];
let lastUpdateEpochTime = 0;

process.stdout.write("\x1bc");
client.on("ready", async () => {
    console.log("Ready!");
    client.application?.commands.set([
        new SlashCommandBuilder()
            .setName("set_channel")
            .setDescription("通知するチャンネルを設定します")
            .addChannelOption((option) => option.setName("channel").setRequired(false).setDescription("通知するチャンネル")),
        new SlashCommandBuilder()
            .setName("set_shojin_channel")
            .setDescription("精進ポイントを通知するチャンネルを設定します")
            .addChannelOption((option) => option.setName("channel").setRequired(false).setDescription("通知するチャンネル")),
        new SlashCommandBuilder()
            .setName("add_user")
            .setDescription("ユーザーを追加します")
            .addStringOption((option) => option.setName("username").setRequired(true).setDescription("AtCoderのユーザーID")),
        new SlashCommandBuilder()
            .setName("get_diff")
            .setDescription("コンテストのdiffを取得します")
            .addStringOption((option) => option.setName("contest").setRequired(true).setDescription("コンテストID")),
    ]);

    let lastUpdateTime = new Date().getMinutes() - 1;
    let lastUpdateDate = new Date().getDate();
    await login();
    contests = await updateTaskTable();
    setInterval(async () => {
        if (lastUpdateDate != new Date().getDate()) {
            lastUpdateDate = new Date().getDate();
            await login();
            await load_day();
        }
        if (lastUpdateTime != new Date().getMinutes()) {
            load();
            lastUpdateTime = new Date().getMinutes();
        }
    }, 1000);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.guildId) return;
    if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
            case "set_channel":
                let optionChannel = interaction.options.getChannel("channel");
                let channel = optionChannel ? optionChannel : interaction.channel;
                if (channel?.type == ChannelType.GuildText) {
                    if (interaction.guildId in guildsConfig) {
                        guildsConfig[interaction.guildId].channel = channel.id;
                        interaction.reply({
                            content: "設定チャンネルを更新しました",
                            ephemeral: true,
                        });
                    } else {
                        guildsConfig[interaction.guildId] = { shojinChannel: "", shojinMessage: "", channel: channel.id, member: [] };
                        interaction.reply({
                            content: "チャンネルを設定しました",
                            ephemeral: true,
                        });
                    }
                    setData("guilds.json", JSON.stringify(guildsConfig));
                } else {
                    interaction.reply({
                        content: "テキストチャンネルを指定してください",
                        ephemeral: true,
                    });
                }
                break;
            case "set_shojin_channel":
                let shojinChannel = interaction.options.getChannel("channel");
                let shojinChannel2 = shojinChannel ? shojinChannel : interaction.channel;
                if (shojinChannel2?.type == ChannelType.GuildText) {
                    if (interaction.guildId in guildsConfig) {
                        guildsConfig[interaction.guildId].shojinChannel = shojinChannel2.id;
                        interaction.reply({
                            content: "設定チャンネルを更新しました",
                            ephemeral: true,
                        });
                    } else {
                        guildsConfig[interaction.guildId] = { shojinChannel: shojinChannel2.id, shojinMessage: "", channel: "", member: [] };
                        interaction.reply({
                            content: "チャンネルを設定しました",
                            ephemeral: true,
                        });
                    }
                    setData("guilds.json", JSON.stringify(guildsConfig));
                } else {
                    interaction.reply({
                        content: "テキストチャンネルを指定してください",
                        ephemeral: true,
                    });
                }
                break;
            case "add_user":
                let user = interaction.options.getString("username");
                if (interaction.guildId in guildsConfig && user) {
                    interaction.reply({
                        content: "追加しました",
                        ephemeral: true,
                    });
                    guildsConfig[interaction.guildId].member.push(user?.toLowerCase());
                    setData("guilds.json", JSON.stringify(guildsConfig));
                } else {
                    interaction.reply({
                        content: "まずテキストチャンネルを指定してください",
                        ephemeral: true,
                    });
                }
                break;
            case "get_diff":
                let contest = interaction.options.getString("contest", true);
                if (cache[contest] && cache[contest].problems[0].difficulty) {
                    let img = await createProblemTable(cache[contest]);
                    let attach = new AttachmentBuilder(img);
                    interaction.reply({
                        files: [attach],
                    });
                } else {
                    interaction.reply("コンテストが存在しないまたはコンテストのdiffが発表されていません");
                }
                break;
        }
    }
});

let cache: problems = {};

function getDifferent(l: string[]) {
    let d = [];
    for (let i in cache) {
        if (!l.includes(i)) {
            d.push(i);
        }
    }
    return d;
}

let loadedContest: string[] = [];
let oneHourNotion: string[] = [];
let NotionData: { [keys: string]: { [keys: string]: string } } = {};
let todayContests: contestData[] = [];
let guildsConfig: {
    [keys: string]: {
        channel: string;
        shojinChannel: string;
        shojinMessage: string;
        member: string[];
    };
} = {};

async function main() {
    let temp = JSON.parse(await getData("loadedContest.json"));
    loadedContest = temp.loadedContest;
    oneHourNotion = temp.oneHourNotion;
    NotionData = temp.NotionData;
    lastUpdateEpochTime = 0;
    guildsConfig = JSON.parse(await getData("guilds.json"));
}

async function load_day() {
    contests = await updateTaskTable();
    todayContests = [];
    let embeds: EmbedBuilder[] = [];
    for (let j in contests) {
        let startTime = contests[j].startTime;
        let endTime = contests[j].endTime;
        if (new Date(startTime.toDateString()).getTime() <= new Date(new Date().toDateString()).getTime()) {
            let embed = new EmbedBuilder()
                .setTitle(contests[j].contest)
                .setFooter({ text: "AtCoder通知Bot" })
                .addFields({
                    name: "開催時間",
                    value: "<t:" + Math.floor(startTime.getTime() / 1000) + ":f>(<t:" + Math.floor(startTime.getTime() / 1000) + ":R>)",
                })
                .addFields({
                    name: "終了時間",
                    value: "<t:" + Math.floor(endTime.getTime() / 1000) + ":f>(<t:" + Math.floor(endTime.getTime() / 1000) + ":R>)",
                })
                .addFields({
                    name: "Rated対象",
                    value: "`" + contests[j].ratingRangeRaw + "`",
                })
                .setURL("https://atcoder.jp" + contests[j].url);
            embeds.push(embed);
            todayContests.push(contests[j]);
        }
    }

    if (embeds.length > 0) {
        for (let i in guildsConfig) {
            client.channels
                .fetch(guildsConfig[i].channel)
                .then((value) => {
                    if (value?.isTextBased()) {
                        value.send({ embeds: embeds });
                    }
                })
                .catch(() => {});
        }
    }
    NotionData = {};
}

async function load() {
    let nowTime = "<t:" + Math.floor(new Date().getTime() / 1000) + ":f>(<t:" + Math.floor(new Date().getTime() / 1000) + ":R>)";
    for (let i of contests) {
        if (i.startTime.getTime() <= new Date().getTime() && i.endTime.getTime() >= new Date().getTime() && i.contestID in NotionData) {
            let rankingRaw = await getRanking(i.contestID);
            let APerf: APref = await (await fetch("https://data.ac-predictor.com/aperfs/" + i.contestID + ".json")).json();
            for (let guild in guildsConfig) {
                let file = await CreateContestRanking(i, guildsConfig[guild].member, rankingRaw, APerf);
                let Attach = new AttachmentBuilder(file);
                client.channels
                    .fetch(guildsConfig[guild].channel)
                    .then((value) => {
                        if (value?.isTextBased()) {
                            value.messages
                                .fetch(NotionData[i.contestID][guild])
                                .then((value) => {
                                    value.edit({ files: [Attach], content: "最終更新:" + nowTime });
                                })
                                .catch(() => {
                                    value.send({ files: [Attach], content: "最終更新:" + nowTime }).then((value) => {
                                        NotionData[i.contestID][guild] = value.id;
                                    });
                                });
                        }
                    })
                    .catch(() => {});
            }
        }
        if (i.startTime.getTime() <= new Date().getTime() && i.endTime.getTime() >= new Date().getTime() && !(i.contestID in NotionData)) {
            NotionData[i.contestID] = {};
            let rankingRaw = await getRanking(i.contestID);
            let APerf: APref = await (await fetch("https://data.ac-predictor.com/aperfs/" + i.contestID + ".json")).json();
            for (let guild in guildsConfig) {
                let file = await CreateContestRanking(i, guildsConfig[guild].member, rankingRaw, APerf);
                let Attach = new AttachmentBuilder(file);
                client.channels
                    .fetch(guildsConfig[guild].channel)
                    .then((value) => {
                        if (value?.isTextBased()) {
                            value.send({ files: [Attach], content: "最終更新:" + nowTime }).then((value) => {
                                NotionData[i.contestID][guild] = value.id;
                            });
                        }
                    })
                    .catch(() => {});
            }
        }
        if (i.startTime.getTime() - 60 * 1000 * 60 <= new Date().getTime() && !oneHourNotion.includes(i.contestID)) {
            let embed = new EmbedBuilder()
                .setTitle(i.contest + "が1時間後に実施されます")
                .setFooter({ text: "AtCoder通知Bot" })
                .addFields({
                    name: "開催時間",
                    value: "<t:" + Math.floor(i.startTime.getTime() / 1000) + ":f>(<t:" + Math.floor(i.startTime.getTime() / 1000) + ":R>)",
                })
                .addFields({
                    name: "終了時間",
                    value: "<t:" + Math.floor(i.endTime.getTime() / 1000) + ":f>(<t:" + Math.floor(i.endTime.getTime() / 1000) + ":R>)",
                })
                .addFields({
                    name: "Rated対象",
                    value: "`" + i.ratingRangeRaw + "`",
                })
                .setURL("https://atcoder.jp" + i.url);
            for (let i in guildsConfig) {
                client.channels
                    .fetch(guildsConfig[i].channel)
                    .then((value) => {
                        if (value?.isTextBased()) {
                            value.send({ embeds: [embed], content: "@everyone" });
                        }
                    })
                    .catch(() => {});
            }
            oneHourNotion.push(i.contestID);
        }
    }
    atcoderProblems().then(async (val) => {
        cache = val;
        let d = getDifferent(loadedContest);
        for (let i in d) {
            if (cache[d[i]].problems[0] && cache[d[i]].problems[0].difficulty) {
                let img = await createProblemTable(cache[d[i]]);
                let attach = new AttachmentBuilder(img);
                for (let i in guildsConfig) {
                    client.channels
                        .fetch(guildsConfig[i].channel)
                        .then((value) => {
                            if (value?.isTextBased()) {
                                value.send({
                                    files: [attach],
                                });
                            }
                        })
                        .catch(() => {});
                }
                loadedContest.push(d[i]);
            }
        }
        if (new Date().getTime() / 1000 - lastUpdateEpochTime >= 5 * 60) {
            let set = new Set<string>();
            for (let i in guildsConfig) {
                for (let j of guildsConfig[i].member) {
                    set.add(j);
                }
            }
            let userList = [...set];
            let index = 0;
            let userScore: {
                [keys: string]: { score: number; rating: number };
            } = {};
            async function getAPI() {
                let user: string = userList[index];
                let epoch = 0;
                let AC_problems = new Set<string>();
                let problems: {
                    [keys: string]: number;
                } = {};
                let json = await (await fetch("https://atcoder.jp/users/" + user + "/history/json")).json();
                let rate = 0;
                if (json[json.length - 1]) {
                    rate = json[json.length - 1].NewRating;
                }
                await new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve(0);
                    }, 100);
                });
                while (true) {
                    let json = await (
                        await fetch("https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=" + user + "&from_second=" + epoch)
                    ).json();
                    for (let i of json) {
                        if (i.result == "AC") {
                            AC_problems.add(i.problem_id);
                            problems[i.problem_id] = i.contest_id;
                        }
                    }
                    if (json.length > 0) {
                        epoch = json[json.length - 1].epoch_second + 1;
                    } else {
                        break;
                    }
                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve(0);
                        }, 100);
                    });
                }
                let AC_problems_array = [...AC_problems];
                let score = 0;
                for (let i of AC_problems_array) {
                    if (cache[problems[i]]) {
                        let problem_data = cache[problems[i]].problems.filter((val) => val.id == i)[0];
                        if (problem_data && problem_data.difficulty) {
                            score += 2 ** ((problem_data.difficulty - rate) / 400) * 1000;
                        }
                    }
                }
                userScore[user] = { score: score, rating: rate };
                if (userList.length > index + 1) {
                    setTimeout(getAPI, 100);
                } else {
                    for (let i in guildsConfig) {
                        let guildConfig = guildsConfig[i];
                        if (guildConfig.shojinChannel) {
                            let member = guildConfig.member;
                            member.sort((a, b) => {
                                return userScore[b].score - userScore[a].score;
                            });
                            let shojinTableRank: textTable = {
                                name: "rank",
                                type: "text",
                                width: 70,
                                data: guildConfig.member.map((value, index) => {
                                    return {
                                        value: ordinal_suffix_of(index + 1),
                                        color: "white",
                                    };
                                }),
                                align: "start",
                            };
                            let shojinTable: userTable = {
                                name: "user",
                                type: "user",
                                width: 120,
                                data: guildConfig.member.map((value) => {
                                    return {
                                        name: value,
                                        rating: userScore[value].rating,
                                    };
                                }),
                            };
                            let shojinTableScore: textTable = {
                                name: "point",
                                type: "text",
                                width: 300,
                                data: guildConfig.member.map((value) => {
                                    return {
                                        value: userScore[value].score.toFixed(2),
                                        color: "white",
                                    };
                                }),
                                align: "end",
                            };
                            let image = await createTable("精進ランキング", [shojinTableRank, shojinTable, shojinTableScore], true);
                            let attach = new AttachmentBuilder(image);
                            client.channels
                                .fetch(guildsConfig[i].shojinChannel)
                                .then((value) => {
                                    if (value?.isTextBased() && !guildConfig.shojinMessage) {
                                        value
                                            .send({
                                                files: [attach],
                                            })
                                            .then((value) => {
                                                guildConfig.shojinMessage = value.id;
                                                setData("guilds.json", JSON.stringify(guildsConfig));
                                            });
                                    } else if (value?.isTextBased()) {
                                        value.messages.fetch(guildConfig.shojinMessage).then((value) => {
                                            value.edit({
                                                files: [attach],
                                            });
                                        });
                                    }
                                })
                                .catch(() => {});
                        }
                    }
                }
                index += 1;
            }
            getAPI();
            lastUpdateEpochTime = new Date().getTime() / 1000;
            setData("loadedContest.json", JSON.stringify({ loadedContest, oneHourNotion, NotionData, lastUpdateEpochTime }));
        }
        setData("loadedContest.json", JSON.stringify({ loadedContest, oneHourNotion, NotionData, lastUpdateEpochTime }));
    });
}

main();
login();

let token = process.env.TOKEN;
process.env.debug = "no";
if (process.argv.includes("--debug")) {
    token = process.env.DEV_TOKEN;
    process.env.debug = "yes";
}

client.login(token);
