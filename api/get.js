export const config = { runtime: 'edge' };

const CORS = { 'Access-Control-Allow-Origin': '*' };

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400, headers: CORS });

  // List blobs with prefix to find the public URL
  const listResp = await fetch(
    `https://blob.vercel-storage.com/?prefix=shares/${id}.json&limit=1`,
    { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } }
  );
  const { blobs } = await listResp.json();
  if (!blobs?.length) return new Response('Not found', { status: 404, headers: CORS });

  const dataResp = await fetch(blobs[0].url);
  if (!dataResp.ok) return new Response('Not found', { status: 404, headers: CORS });

  return new Response(await dataResp.text(), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
