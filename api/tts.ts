import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = (req.headers['x-custom-elevenlabs-key'] as string) || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "ElevenLabs API key not configured" });
    }

    const { text, voiceId } = req.body;
    if (!text || !voiceId) {
      return res.status(400).json({ error: "Missing text or voiceId" });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    if (response.body) {
      // @ts-ignore
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("TTS API Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
