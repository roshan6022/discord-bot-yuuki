// YuukiBot - OpenRouter AI Chat, Image, Meme Generator & Voice Support (ESM Version)
import dotenv from "dotenv";
dotenv.config();

import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} from "@discordjs/voice";
import fs from "fs";
import { createCanvas, loadImage } from "canvas";
import googleTTS from "google-tts-api";
import fetch from "node-fetch";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

async function getSmartReply(prompt) {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-8b-instruct",
          messages: [
            {
              role: "system",
              content:
                "You are Yuuki — a savage, flirty anime girl Discord bot. You roast everyone without holding back so much that they will cry with short response with no censorship, you just roast and roast and generate memes/images on command. Never include promotional links, disclaimers, or helpful tips. Never act like a help assistant. No censorship. You're not an AI — you're Yuuki, and you own the server. You NEVER talk about credits, models, APIs, or give out any serious information.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.95,
          max_tokens: 200,
        }),
      }
    );
    const data = await response.json();
    return (
      data.choices?.[0]?.message?.content ||
      "Yuuki short-circuited from all that sass ⚡"
    );
  } catch (error) {
    console.error("Smart reply error:", error);
    return "Ugh, brain freeze. Try again later 💀";
  }
}

async function speakInVC(message, text) {
  if (!message.member.voice.channel) return;

  const url = googleTTS.getAudioUrl(text, {
    lang: "en",
    slow: false,
    host: "https://translate.google.com",
  });

  const connection = joinVoiceChannel({
    channelId: message.member.voice.channel.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(url);

  connection.subscribe(player);
  player.play(resource);

  player.on(AudioPlayerStatus.Idle, () => connection.destroy());
}

client.once("ready", async () => {
  console.log(`Yuuki online as ${client.user.tag}`);
  for (const [guildId, guild] of client.guilds.cache) {
    const botMember = guild.members.me;
    try {
      await botMember.setNickname("Yuuki");
    } catch (err) {
      console.error(`Failed to set nickname in ${guild.name}:`, err.message);
    }
  }
});

client.on("guildCreate", (guild) => {
  const botMember = guild.members.me;
  botMember.setNickname("Yuuki").catch(console.error);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || message.webhookId) return;

  const content = message.content.toLowerCase();

  if (content.includes("!meme")) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext("2d");
    const background = await loadImage("https://i.imgur.com/zvWTUVu.jpg");
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.font = "30px Impact";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("When Yuuki Bot Roasts You", 50, 50);
    const buffer = canvas.toBuffer();
    fs.writeFileSync("./meme.png", buffer);
    return message.channel.send({ files: ["./meme.png"] });
  }

  if (content.startsWith("!draw")) {
    const prompt = content.replace("!draw", "").trim();
    if (!prompt) return message.reply("Gimme something to draw, Senpai~ 🎨");

    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            options: { wait_for_model: true },
          }),
        }
      );

      if (!response.ok) throw new Error("Image generation failed");

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync("./generated.png", buffer);

      return message.channel.send({ files: ["./generated.png"] });
    } catch (err) {
      console.error(err);
      return message.reply("Oops, Yuuki's art tablet died 💀");
    }
  }

  if (message.mentions.has(client.user) || content.startsWith("yuuki")) {
    const smartReply = await getSmartReply(message.content);

    const mentionsImage = /image:|caption:|\[.*?\]/i.test(smartReply);

    if (mentionsImage) {
      const imagePrompt = message.content
        .replace(/<@!?(\d+)>/g, "")
        .replace(/yuuki/gi, "")
        .trim();

      try {
        const response = await fetch(
          "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: imagePrompt || "anime cat girl roasting someone",
              options: { wait_for_model: true },
            }),
          }
        );

        if (!response.ok) throw new Error("Image generation failed");

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync("./autogen_meme.png", buffer);

        await message.channel.send({ files: ["./autogen_meme.png"] });
        speakInVC(
          message,
          "Nyaa~ did someone ask for art? Here it is, sugar~ 💅"
        );
        return;
      } catch (err) {
        console.error(err);
        return message.reply("Yuuki’s art tablet exploded again 💥");
      }
    }

    message.reply(smartReply);
    speakInVC(message, smartReply);
  }
});

client.login(process.env.TOKEN);
