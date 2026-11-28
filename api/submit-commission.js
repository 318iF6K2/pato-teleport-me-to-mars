const DISCORD_USER_ID = '610128494290141200';
const CLOSED_PHRASE = 'Currently not open for any work';

const ALLOWED_ORIGINS = [
  'https://318iF6K2.github.io',
  'https://crazyben.dev',
  'https://www.crazyben.dev'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return res.status(200).json({ closed: false });
  }

  try {
    const discordRes = await fetch(
      `https://discord.com/api/v10/users/${DISCORD_USER_ID}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      }
    );

    if (!discordRes.ok) {
      console.error('Discord user fetch failed:', discordRes.status);
      return res.status(200).json({ closed: false });
    }

    const user = await discordRes.json();
    const bio = typeof user.bio === 'string' ? user.bio : '';
    const closed = bio.toLowerCase().includes(CLOSED_PHRASE.toLowerCase());

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ closed });
  } catch (err) {
    console.error('Error checking Discord bio:', err);
    return res.status(200).json({ closed: false });
  }
}
