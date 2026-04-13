"""
Discord Embed Forwarder (Portfolio Edition)
-------------------------------------------
Listens to a source channel and forwards webhook embed messages
to multiple destination webhooks. Secrets come from environment variables.

Install:
  pip install discord.py requests python-dotenv

Run:
  python assets/code/discord_forwarder.py
"""

import os
import requests
import discord
from dotenv import load_dotenv

# ─── CONFIG (env) ─────────────────────────────────────────────────────
load_dotenv()  # loads variables from .env if present

BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
TARGET_CHANNEL_ID = int(os.getenv("TARGET_CHANNEL_ID", "0"))
DESTINATION_WEBHOOKS = os.getenv("DESTINATION_WEBHOOKS", "")
DESTINATION_WEBHOOKS = [w.strip() for w in DESTINATION_WEBHOOKS.split(",") if w.strip()]

if not BOT_TOKEN or not TARGET_CHANNEL_ID or not DESTINATION_WEBHOOKS:
    raise SystemExit("Missing env vars: DISCORD_BOT_TOKEN, TARGET_CHANNEL_ID, DESTINATION_WEBHOOKS")

# ─── DISCORD SETUP ────────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True
bot = discord.Client(intents=intents)

# ─── HELPERS ──────────────────────────────────────────────────────────
async def post_to_webhook(webhook_url, embeds, content, extra_field=None):
    filtered_embeds = []

    for embed in embeds:
        new_embed = discord.Embed(
            title=embed.title,
            description=embed.description,
            url=embed.url,
            color=embed.color or discord.Color.default()
        )

        if embed.author:
            new_embed.set_author(
                name=embed.author.name,
                icon_url=getattr(embed.author, "icon_url", "")
            )

        # Only copy max 2 fields, or allowed ones
        allowed_fields = ["Original Price", "Retail Price", "Quantity"]
        count = 0
        for field in embed.fields:
            if field.name in allowed_fields or count < 2:
                new_embed.add_field(
                    name=field.name,
                    value=field.value,
                    inline=field.inline
                )
                count += 1

        if embed.thumbnail:
            new_embed.set_thumbnail(url=embed.thumbnail.url)
        if embed.image:
            new_embed.set_image(url=embed.image.url)
        if embed.footer:
            new_embed.set_footer(text=embed.footer.text)

        if extra_field:
            new_embed.add_field(name="ANNOUNCEMENT", value=extra_field, inline=False)

        filtered_embeds.append(new_embed)

    if not filtered_embeds:
        print("⚠️ No embeds to send.")
        return

    payload = {
        "content": content,
        "embeds": [e.to_dict() for e in filtered_embeds]
    }

    headers = {"Content-Type": "application/json"}
    response = requests.post(webhook_url, json=payload, headers=headers)

    if response.status_code == 204:
        print(f"✅ Posted to webhook: {webhook_url}")
    else:
        print(f"❌ Failed to post: {webhook_url} | Status: {response.status_code} | Response: {response.text}")

# ─── EVENTS ───────────────────────────────────────────────────────────
@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user.name}")

@bot.event
async def on_message(message):
    if message.channel.id != TARGET_CHANNEL_ID:
        return

    if message.webhook_id and message.embeds:
        content = "Live Checkout! " + (message.content or "")
        announcement = os.getenv("EXTRA_ANNOUNCEMENT", "")
        for idx, webhook_url in enumerate(DESTINATION_WEBHOOKS):
            extra = announcement if idx == 0 and announcement else None
            await post_to_webhook(webhook_url, message.embeds, content, extra)

# ─── RUN ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    bot.run(BOT_TOKEN)
