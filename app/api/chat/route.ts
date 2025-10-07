// app/api/openai/v1/chat/completions/route.ts
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const base  = process.env.DEEPSEEK_BASE  ?? 'https://api.deepseek.com';
  const key   = process.env.DEEPSEEK_API_KEY;
  if (!key) return new Response('Missing DEEPSEEK_API_KEY', { status: 500 });

  // forward the original JSON body
  const body = await req.text();

  const upstream = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(text || 'Upstream error', { status: upstream.status || 500 });
  }

  // passthrough SSE unchanged
  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
