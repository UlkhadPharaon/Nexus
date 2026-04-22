export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  
  const apiKey = req.headers.get('x-custom-elevenlabs-key') || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ElevenLabs API key not configured" }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
