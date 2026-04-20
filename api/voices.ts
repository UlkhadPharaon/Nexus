import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = (req.headers['x-custom-elevenlabs-key'] as string) || process.env.ELEVENLABS_API_KEY;
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: apiKey ? { "xi-api-key": apiKey } : {},
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Voices API Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
