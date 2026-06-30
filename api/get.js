export const config = { runtime: 'edge' };

const CORS = { 'Access-Control-Allow-Origin': '*' };

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400, headers: CORS });

  const r = await fetch(`${process.env.KV_REST_API_URL}/get/share:${id}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });

  const { result } = await r.json();
  if (!result) return new Response('Not found', { status: 404, headers: CORS });

  return new Response(result, {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
