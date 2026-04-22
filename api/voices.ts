export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  
  const apiKey = req.headers.get('x-custom-elevenlabs-key') || process.env.ELEVENLABS_API_KEY;

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["xi-api-key"] = apiKey;
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers });

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
