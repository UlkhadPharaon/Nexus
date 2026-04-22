import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Readable } from "stream";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy route for NVIDIA NIM
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "NVIDIA API key not configured on server" });
      }

      console.log("Sending request to NVIDIA API...");

      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("NVIDIA API Error:", response.status, text);
        return res.status(response.status).json({ error: text });
      }

      // Proxy the stream
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (response.body) {
        // @ts-ignore - native fetch body is ReadableStream
        Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Server API Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Proxy route for ElevenLabs TTS
  app.post("/api/tts", async (req, res) => {
    try {
      const apiKey = req.headers['x-custom-elevenlabs-key'] as string || process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "ElevenLabs API key not configured" });
      }

      const { text, voiceId } = req.body;
      if (!text || !voiceId) {
        return res.status(400).json({ error: "Missing text or voiceId" });
      }

      console.log("Sending request to ElevenLabs...");

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
        console.error("ElevenLabs API Error:", response.status, errorText);
        return res.status(response.status).json({ error: errorText });
      }

      // Proxy the audio stream
      res.setHeader('Content-Type', 'audio/mpeg');
      if (response.body) {
        // @ts-ignore
        Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("TTS Server Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Proxy route to fetch available ElevenLabs voices
  app.get("/api/voices", async (req, res) => {
    try {
      const apiKey = req.headers['x-custom-elevenlabs-key'] as string || process.env.ELEVENLABS_API_KEY;
      const response = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: apiKey ? { "xi-api-key": apiKey } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs Voices API Error:", response.status, errorText);
        return res.status(response.status).json({ error: errorText });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Voices Server Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // New Proxy route for ElevenLabs Quota
  app.get("/api/quota", async (req, res) => {
      try {
        const apiKey = req.headers['x-custom-elevenlabs-key'] as string || process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return res.status(401).json({ error: "ElevenLabs API key not configured" });
        }
        
        const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
            headers: { "xi-api-key": apiKey },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs Subscription API Error:", response.status, errorText);
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Quota Server Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
  });

  // Proxy route for NVIDIA NIM Image Generation (FLUX)
  app.post("/api/generate-image", async (req, res) => {
    try {
      const apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "NVIDIA API key not configured on server" });
      }

      console.log("Sending image generation request to NVIDIA API...");

      const response = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("NVIDIA Image API Error:", response.status, text);
        return res.status(response.status).json({ error: text });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Image Generation Server Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
