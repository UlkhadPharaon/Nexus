export function cleanTextForTTS(text: string): string {
  // Removes text between asterisks (narrative actions)
  // Example: "Il soupira. *Regarde au loin* Je ne sais pas." becomes "Il soupira. Je ne sais pas."
  return text.replace(/\*.*?\*/g, '').replace(/\n/g, ' ').trim();
}

export interface Voice {
  voice_id: string;
  name: string;
  preview_url: string;
  labels: Record<string, string>;
  category?: string;
}

export async function getVoices(customApiKey?: string): Promise<Voice[]> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (customApiKey) {
      headers['x-custom-elevenlabs-key'] = customApiKey;
    }
    const res = await fetch('/api/voices', { headers });
    if (!res.ok) throw new Error('Failed to fetch voices');
    const data = await res.json();
    
    const voices: Voice[] = data.voices || [];
    // Only return 'premade' voices to avoid 402 API errors on Free Tier keys
    // which cannot use 'library' (community) or 'cloned' voices via API.
    return voices.filter(v => v.category === 'premade');
  } catch (error) {
    console.error(error);
    return [];
  }
}
