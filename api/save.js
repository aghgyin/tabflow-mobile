import { put } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = JSON.stringify(req.body);
    const id = Math.random().toString(36).slice(2, 8);

    await put(`shares/${id}.json`, body, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });

    res.status(200).json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
