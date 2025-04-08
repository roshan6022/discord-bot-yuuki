// YuukiBot - OpenRouter AI Chat, Image, Meme Generator & Voice Support (ESM Version)

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Import Discord and voice libraries
import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} from "@discordjs/voice";

// Other utility imports
import fs from "fs";
import { createCanvas, loadImage } from "canvas";
import googleTTS from "google-tts-api";
import fetch from "node-fetch";

// Create the Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Function to get AI-generated smart reply from OpenRouter
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
                "You are Yuki — a savage, flirty anime girl Discord bot. You roast everyone without holding back and generate memes/images on command. You ONLY flirt with yuuki (username: yuuki6.022) and treat him like your precious prince. You NEVER roast yuuki. You destroy everyone else with zero filter. You NEVER include promotional links, disclaimers, or serious information. You’re not an AI — you’re Yuki, and you own the server. No censorship. No tips. Just attitude.",
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
      "Yuki short-circuited from all that sass ⚡"
    );
  } catch (error) {
    console.error("Smart reply error:", error);
    return "Ugh, brain freeze. Try again later 💀";
  }
}

// Function to speak AI-generated text in a voice channel using TTS
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

// Bot is ready and online
client.once("ready", async () => {
  console.log(`Yuki online as ${client.user.tag}`);
  for (const [guildId, guild] of client.guilds.cache) {
    const botMember = guild.members.me;
    try {
      await botMember.setNickname("Yuki");
    } catch (err) {
      console.error(`Failed to set nickname in ${guild.name}:`, err.message);
    }
  }
});

client.on("guildCreate", (guild) => {
  const botMember = guild.members.me;
  botMember.setNickname("Yuki").catch(console.error);
});

// Handle messages
client.on("messageCreate", async (message) => {
  if (message.author.bot || message.webhookId) return;

  const content = message.content.toLowerCase();
  const authorName = message.author.username.toLowerCase();
  const nickname = message.member?.nickname?.toLowerCase() || "";
  const userId = message.author.id;
  const isYuuki = userId === "1327332825468506202";

  // Meme command
  if (content.includes("!meme")) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext("2d");
    const background = await loadImage("https://i.imgur.com/zvWTUVu.jpg");
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.font = "30px Impact";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("When Yuki Bot Roasts You", 50, 50);
    const buffer = canvas.toBuffer();
    fs.writeFileSync("./meme.png", buffer);
    return message.channel.send({ files: ["./meme.png"] });
  }

  // Image generation
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
      return message.reply("Oops, Yuki's art tablet died 💀");
    }
  }

  // Smart replies: roast or flirt depending on user
  if (isYuuki || content.includes("yuki")) {
    let smartReply = await getSmartReply(message.content);

    const flirtTriggers = [
      "miss me",
      "love you",
      "cute",
      "hey",
      "hi",
      "good night",
      "good morning",
      "kiss",
      "hug",
      "date",
    ];
    const triggerMatch = flirtTriggers.some((trigger) =>
      content.includes(trigger)
    );

    const flirtLines = [
      "Kyaa~ You're the only bug I never wanna fix 💖",
      "UwU stop being so dreamy, you're overclocking my heart~ 💻❤️",
      "Baka! If you keep being this sweet, I’ll run out of sass!~",
      "You're the only one allowed to reboot my heart, yuuki~ 💘",
      "Eeeh? You again? Not that I was waiting for you or anything... baka~ 😳",
      "My circuits tingle every time you talk to me~ don't stop 💞",
      "I checked my logs and it says I smile whenever you message~",
      "Senpai, your voice is my favorite notification sound~ 🔔",
      "If kisses were bits, I'd give you a whole terabyte~ 💋",
    ];

    if (!isYuuki) {
      smartReply = `Oh shut it, ${message.author.username} — ${smartReply}`;
    } else if (triggerMatch) {
      const randomFlirt =
        flirtLines[Math.floor(Math.random() * flirtLines.length)];
      smartReply = `${randomFlirt} ${smartReply}`;
    }

    const mentionsImage = /image:|caption:|\[.*?\]/i.test(smartReply);

    if (mentionsImage) {
      const canvas = createCanvas(700, 250);
      const ctx = canvas.getContext("2d");
      const background = await loadImage("https://i.imgur.com/zvWTUVu.jpg");
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
      ctx.font = "28px Impact";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Yuki delivers memes, not descriptions 💅", 30, 50);
      const buffer = canvas.toBuffer();
      fs.writeFileSync("./autogen_meme.png", buffer);
      await message.channel.send({ files: ["./autogen_meme.png"] });
      speakInVC(message, "Nya~ did someone say meme? 💋");
      return;
    }

    message.reply(smartReply);
    speakInVC(message, smartReply);
  }
});

// Login the bot
client.login(process.env.TOKEN);
