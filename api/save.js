export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS });

  try {
    const body = await req.text();
    const id = Math.random().toString(36).slice(2, 8);

    const r = await fetch(`https://blob.vercel-storage.com/shares/${id}.json`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        'x-content-type': 'application/json',
        'x-add-random-suffix': '0',
      },
      body,
    });

    if (!r.ok) throw new Error(`Blob PUT failed: ${r.status}`);

    return new Response(JSON.stringify({ id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
