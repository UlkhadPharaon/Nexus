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
            chat_template_kwargs: { enable_thinking: true },
            reasoning_budget: 16384
          }
        } : {}),
        ...(modelKey === 'mistral-small' ? {
          reasoning_effort: 'high'
        } : {})
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `Erreur API: ${response.status} ${response.statusText}`;
      toast.error(`Erreur de connexion IA: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('ReadableStream non supporté');
    
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
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
            // Ignorer les lignes malformées
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
