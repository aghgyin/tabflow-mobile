export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    const listResp = await fetch(
      `https://blob.vercel-storage.com/?prefix=shares/${id}.json&limit=1`,
      { headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '7' } }
    );

    if (!listResp.ok) return res.status(500).json({ error: `List ${listResp.status}` });

    const { blobs } = await listResp.json();
    if (!blobs?.length) return res.status(404).json({ error: 'Not found' });

    const dataResp = await fetch(blobs[0].url);
    if (!dataResp.ok) return res.status(404).json({ error: 'Not found' });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(await dataResp.text());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
