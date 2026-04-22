import { Message } from '../types';
import { streamChatCompletion } from '../services/aiService';

export async function summarizeConversation(messages: Message[], currentMemory: string = ''): Promise<string> {
  if (messages.length === 0) return currentMemory;

  const historyText = messages
    .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
    .join('\n');
    
  const summaryPrompt = `Tu es une IA spécialisée dans la synthèse de mémoire à long terme pour des personnages de Roleplay.
Ton but est de maintenir une mémoire cohérente, condensée et à jour.

[ANCIENNE MÉMOIRE] :
${currentMemory || 'Aucune.'}

[NOUVEAUX ÉCHANGES] :
${historyText}

Tâche : Rédige une nouvelle mémoire longue consolidée. Inclus les points clés, les événements importants, les secrets révélés et l'évolution des relations. Sois très concis et objectif. N'écris QUE le contenu de la mémoire (aucun préambule ni métadonnées).`;

  return new Promise((resolve, reject) => {
    let result = '';
    streamChatCompletion(
      [{ role: 'system', content: summaryPrompt }],
      'nemotron-nano', // Fast and cheap model for background tasks
      (chunk) => {
        result += chunk;
      },
      (fullText) => {
        resolve(fullText);
      },
      (error) => {
        console.error("Error summarizing memory", error);
        resolve(currentMemory); // Fallback to current memory on error
      }
    );
  });
}
