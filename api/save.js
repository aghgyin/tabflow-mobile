export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const body = JSON.stringify(req.body);
    const id = Math.random().toString(36).slice(2, 8);
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    console.log('[save] called, id:', id, 'token present:', !!token);

    const r = await fetch(`https://blob.vercel-storage.com/shares/${id}.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-version': '7',
        'x-content-type': 'application/json',
        'x-add-random-suffix': '0',
      },
      body,
    });

    if (!r.ok) {
      const errText = await r.text();
      console.log('[save] blob error:', r.status, errText);
      return res.status(500).json({ error: `Blob ${r.status}: ${errText}` });
    }
    console.log('[save] success, id:', id);

    res.status(200).json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
