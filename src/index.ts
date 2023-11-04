import { createProblemTable } from "./images/problem";
import { atcoderProblems, problems } from "./api/getProblems";
import { setData, getData } from "./data";
import { Client, IntentsBitField, SlashCommandBuilder, ChannelType } from "discord.js";
import { config } from "dotenv";
config();

let client = new Client({
    intents: [IntentsBitField.Flags.Guilds],
});

client.on("ready", () => {
    process.stdout.write("\x1bc");
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
    ]);

    let lastUpdateTime = new Date().getMinutes() - 1;
    setInterval(() => {
        if (lastUpdateTime != new Date().getMinutes()) {
            load();
            lastUpdateTime = new Date().getMinutes();
        }
    }, 1000);
});

client.on("interactionCreate", (interaction) => {
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
            } else {
                interaction.reply({
                    content: "テキストチャンネルを指定してください",
                    ephemeral: true,
                });
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

let l: string[] = [];
let guildsConfig: {
    [keys: string]: {
        channel: string;
        member: string[];
    };
} = {};

async function main() {
    l = JSON.parse(await getData("loadedContest.json"));
    guildsConfig = JSON.parse(await getData("guilds.json"));
}

async function load() {
    atcoderProblems().then((val) => {
        cache = val;
        let d = getDifferent(l);
        for (let i in d) {
            createProblemTable(cache[d[i]]);
            l.push(d[i]);
        }
        setData("loadedContest.json", JSON.stringify(l));
    });
}

main();

let token = process.env.TOKEN;
if (!process.argv.includes("--main")) {
    token = process.env.DEV_TOKEN;
}

client.login(token);
