import { getRanking, ranking } from "./api/ranking";
import { createProblemTable } from "./images/problem";
import { atcoderProblems, problems, login, AtCoderFetch } from "./api/getProblems";
import { updateTaskTable, contestData } from "./api/tasks";
import { setData, getData } from "./data";
import { APref, CreateContestRanking } from "./images/ranking";
import { Client, IntentsBitField, SlashCommandBuilder, ChannelType, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { config } from "dotenv";
import path from "path";
config({ path: path.join(__dirname, "../.env") });

let client = new Client({
    intents: [IntentsBitField.Flags.Guilds],
});

let contests: contestData[] = [];

process.stdout.write("\x1bc");
client.on("ready", () => {
    console.log("Ready!");
    client.application?.commands.set([
        new SlashCommandBuilder()
            .setName("set_channel")
            .setDescription("通知するチャンネルを設定します")
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
    let lastUpdateDate = new Date().getDate() - 1;
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
        if (interaction.commandName == "set_channel") {
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
                    guildsConfig[interaction.guildId] = { channel: channel.id, member: [] };
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
        } else {
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
                            guildsConfig[interaction.guildId] = { channel: channel.id, member: [] };
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
        member: string[];
    };
} = {};

async function main() {
    let temp = JSON.parse(await getData("loadedContest.json"));
    loadedContest = temp.loadedContest;
    oneHourNotion = temp.oneHourNotion;
    NotionData = temp.NotionData;
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
        setData("loadedContest.json", JSON.stringify({ loadedContest, oneHourNotion, NotionData }));
    });
}

main();
login();

let token = process.env.TOKEN;
process.env.debug = "no";
if (!process.argv.includes("--main")) {
    token = process.env.DEV_TOKEN;
    process.env.debug = "yes";
}

client.login(token);
