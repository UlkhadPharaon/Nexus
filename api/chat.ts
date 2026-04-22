export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  
  const apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "NVIDIA API key not configured on server" }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await req.json();
    let response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    // Fallback logic if the requested model is not found for this account
    if (response.status === 404) {
      const errorText = await response.clone().text();
      if (errorText.includes("Not found for account")) {
        console.log("Model not authorized, attempting fallback...");
        // Fetch available models
        const modelsRes = await fetch("https://integrate.api.nvidia.com/v1/models", {
          headers: { "Authorization": `Bearer ${apiKey}` }
        });
        
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const availableModels = modelsData.data as {id: string}[];
          
          // Prioritize llama or mistral instruct models
          let fallbackModel = availableModels.find(m => m.id.includes("llama-3") && m.id.includes("instruct"))?.id
            || availableModels.find(m => m.id.includes("mistral") && m.id.includes("instruct"))?.id
            || availableModels.find(m => m.id.includes("instruct"))?.id
            || availableModels[0]?.id;

          if (fallbackModel) {
            console.log(`Using fallback model: ${fallbackModel}`);
            body.model = fallbackModel;
            // Retry
            response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
              },
              body: JSON.stringify(body),
            });
          }
        }
      }
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
