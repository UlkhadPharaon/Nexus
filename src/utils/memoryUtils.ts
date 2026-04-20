import { Message } from '../types';
import { streamChatCompletion } from '../services/aiService';

export async function summarizeConversation(messages: Message[]): Promise<string> {
  const historyText = messages
    .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
    .join('\n');
    
  const summaryPrompt = `Voici l'historique d'une conversation RP :\n\n${historyText}\n\n
  Fais un résumé condensé des points clés, relations, secrets découverts, et l'état actuel de la relation pour injecter dans le contexte de l'IA. Sois très concis.`;
  
  // Utilisation d'un appel simple pour le résumé
  // Note: besoin d'adapter selon le service AI utilisé
  // Ici on simule un retour simple pour la structure
  return "Résumé de la mémoire longue...";
}
