import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function testNvidia() {
  const apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.log("No API key");
    return;
  }
  
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log("Valid models:", data.data.slice(0, 10).map((m: any) => m.id));
      fs.writeFileSync('models_list.json', JSON.stringify(data.data.map((m: any) => m.id), null, 2));
    } else {
      console.log("Failed", res.status, await res.text());
    }
  } catch (e) {
    console.error(e);
  }
}
testNvidia();
