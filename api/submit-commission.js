const DISCORD_USER_ID = '610128494290141200';
const CLOSED_PHRASE = 'Currently not open for any work';

const ipCache = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

const ALLOWED_ORIGINS = [
  'https://318iF6K2.github.io',
  'https://crazyben.dev',
  'https://www.crazyben.dev'
];

async function isCommissionClosed() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return false;

  try {
    const res = await fetch(`https://discord.com/api/v10/users/${DISCORD_USER_ID}`, {
      headers: { Authorization: `Bot ${botToken}` }
    });
    if (!res.ok) return false;
    const user = await res.json();
    const bio = typeof user.bio === 'string' ? user.bio : '';
    return bio.toLowerCase().includes(CLOSED_PHRASE.toLowerCase());
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (await isCommissionClosed()) {
      return res.status(403).json({ message: 'Commissions are currently closed.' });
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : req.socket?.remoteAddress || 'unknown';

    const now = Date.now();
    const lastSubmitTime = ipCache.get(clientIp);

    if (lastSubmitTime && now - lastSubmitTime < COOLDOWN_MS) {
      const remainingMinutes = Math.ceil(
        (COOLDOWN_MS - (now - lastSubmitTime)) / 60000
      );
      return res.status(429).json({
        message: `Too many requests. Please wait ${remainingMinutes} minute(s).`
      });
    }

    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { contact, details } = body;

    if (
      typeof contact !== 'string' ||
      typeof details !== 'string' ||
      !contact.trim() ||
      !details.trim()
    ) {
      return res.status(400).json({ message: 'Missing or invalid fields' });
    }

    if (contact.length > 1024 || details.length > 1024) {
      return res.status(400).json({
        message: 'Contact and details must be under 1024 characters.'
      });
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('Missing DISCORD_WEBHOOK_URL');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const payload = {
      embeds: [
        {
          title: 'New Commission Request',
          color: 45768,
          fields: [
            { name: 'Contact Info', value: contact.trim(), inline: false },
            { name: 'Request Details', value: details.trim(), inline: false },
            { name: 'Client IP', value: clientIp.slice(0, 100), inline: false }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    };

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      console.error('Discord webhook error:', discordRes.status, errorText);
      return res.status(502).json({ message: 'Failed to send commission request' });
    }

    ipCache.set(clientIp, now);
    return res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Commission API error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
