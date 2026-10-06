// Vercel Edge Function — proxies requests to Groq API
// Keeps the API key server-side in production
export const config = { runtime: 'edge' }

declare const process: { env: Record<string, string | undefined> }

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'GROQ_API_KEY not configured on server.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.text()

  const orRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  return new Response(orRes.body, {
    status: orRes.status,
    headers: {
      'Content-Type': orRes.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
