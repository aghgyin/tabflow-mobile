import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const { blobs } = await list({ prefix: `shares/${id}.json`, limit: 1 });
    if (!blobs.length) return res.status(404).json({ error: 'Not found' });

    const dataResp = await fetch(blobs[0].url);
    if (!dataResp.ok) return res.status(404).json({ error: 'Not found' });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(await dataResp.text());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
