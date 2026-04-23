import { NVIDIA_CONFIG, ModelKey } from '../config/nvidia';
import toast from 'react-hot-toast';

export async function streamChatCompletion(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  modelKey: ModelKey,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
  onError: (error: Error) => void,
  signal?: AbortSignal,
  options?: { temperature?: number; top_p?: number }
): Promise<void> {
  const model = NVIDIA_CONFIG.models[modelKey];

  try {
    const response = await fetch("/api/chat", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model: model.id,
        messages,
        max_tokens: model.maxTokens,
        temperature: options?.temperature ?? model.temperature,
        top_p: options?.top_p ?? model.topP,
        stream: true,
        ...(modelKey === 'nemotron-nano' ? {
          extra_body: {
            chat_template_kwargs: { enable_thinking: false }
          }
        } : {}),
        ...(modelKey === 'mistral-small' ? {
          reasoning_effort: 'high'
        } : {})
      }),
    });

    if (!response.ok) {
      if (response.status === 504) {
        toast.error("Le modèle met trop de temps à répondre (Timeout Vercel). Essayez de relancer votre message ou d'utiliser le modèle Standard.");
        throw new Error("Timeout 504: Le serveur a mis trop de temps à répondre.");
      }
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `Erreur API: ${response.status} ${response.statusText}`;
      toast.error(`Erreur de connexion IA: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('ReadableStream non supporté');
    
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Garder la dernière ligne qui pourrait être incomplète
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') {
            onComplete(fullResponse);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              const content = delta.content;
              
              if (content) {
                fullResponse += content;
                onChunk(content);
              }
            }
          } catch {
            // Ignorer les lignes malformées qui sont complètes mais invalides
          }
        }
      }
    }
    
    onComplete(fullResponse);
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    
    const err = error as Error;
    // Toast already shown for response.ok errors, show here if not generic abort
    if (!err.message.includes('API Error') && !err.message.includes('Erreur API')) {
        toast.error(`Erreur lors de la génération avec l'IA: ${err.message}`);
    }
    
    onError(err);
  }
}
