import { list } from '@vercel/blob';

export const config = { runtime: 'edge' };

const CORS = { 'Access-Control-Allow-Origin': '*' };

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400, headers: CORS });

  try {
    const { blobs } = await list({ prefix: `shares/${id}.json`, limit: 1 });
    if (!blobs.length) return new Response('Not found', { status: 404, headers: CORS });

    const dataResp = await fetch(blobs[0].url);
    if (!dataResp.ok) return new Response('Not found', { status: 404, headers: CORS });

    return new Response(await dataResp.text(), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
}
