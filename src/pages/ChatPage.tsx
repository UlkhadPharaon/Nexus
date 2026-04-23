import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { getCharacter, getConversation, subscribeToMessages, addMessage, updateMessage, createConversation, getConversations } from '../services/firestore';
import { streamChatCompletion } from '../services/aiService';
import { buildCharacterSystemPrompt, buildContextMessages } from '../utils/promptBuilder';
import { summarizeConversation } from '../utils/memoryUtils';
import { Character, Message, Conversation, User as UserType, Persona, Universe, LoreEntry, UniverseRoom } from '../types';
import { ModelSwitch } from '../components/chat/ModelSwitch';
import { PersonaSelector } from '../components/chat/PersonaSelector';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft, Send, Sparkles, StopCircle, User as UserIcon, Volume2, Edit2, Heart, Users, FileText, Plus, Map as MapIcon, Loader2, Settings, Globe, Book, Brain } from 'lucide-react';
import { cleanTextForTTS } from '../utils/ttsUtils';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { updateAffinity } from '../services/firestore';

export default function ChatPage() {
  const { customId } = useParams<{ customId: string }>(); // customId is actually characterId
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentModel, isGenerating, setIsGenerating, setAbortController, cancelGeneration } = useChatStore();
  
  const [characters, setCharacters] = useState<Character[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [loreEntries, setLoreEntries] = useState<LoreEntry[]>([]);
  const [rooms, setRooms] = useState<UniverseRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<UniverseRoom | null>(null);
  const [showCodex, setShowCodex] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [myCharacters, setMyCharacters] = useState<Character[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // Main character for single chat or focus in group
  const character = characters[0] || null;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const [streamingText, setStreamingText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [longTermMemory, setLongTermMemory] = useState<string>('');
  const [showNsfwPrompt, setShowNsfwPrompt] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [affinity, setAffinity] = useState(0);
  const [showScenarioPicker, setShowScenarioPicker] = useState(false);
  const [activeLoreExtras, setActiveLoreExtras] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial load
  useEffect(() => {
    if (!user || !customId) return;

    const loadChat = async () => {
      try {
        const char = customId.startsWith('narrator-') 
          ? ({ id: customId, name: 'Narrateur', avatarUrl: '', description: 'Narrateur de l\'univers' } as Character) 
          : await getCharacter(customId);
        
        if (!char) {
          toast.error("Personnage introuvable");
          navigate('/explore');
          return;
        }

        // Find existing conversation
        const convos = await getConversations(user.uid);
        const existing = convos.find(c => c.characterId === customId || c.characterIds?.includes(customId));
        
        if (existing) {
          setConversationId(existing.id);
          const conv = await getConversation(existing.id);
          setConversation(conv);
          setAffinity(conv?.affinity || 0);
          setLongTermMemory(conv?.longTermMemory || '');
          
          if (conv) {
             // Load linked universe if any
             if (conv.universeId) {
                const { getUniverse, getLoreEntries, getUniverseRooms } = await import('../services/firestore');
                const uni = await getUniverse(conv.universeId);
                if (uni) {
                  setUniverse(uni);
                  const [lore, rms] = await Promise.all([
                    getLoreEntries(uni.id),
                    getUniverseRooms(uni.id)
                  ]);
                  setLoreEntries(lore);
                  setRooms(rms);
                  if (conv.currentRoomId) {
                    const room = rms.find(r => r.id === conv.currentRoomId);
                    if (room) setCurrentRoom(room);
                  }
                }
             }

             // Load assigned persona if any
             if (conv.personaId) {
                const { getPersona } = await import('../services/firestore');
                const persona = await getPersona(conv.personaId);
                if (persona) setSelectedPersona(persona);
             }

             // Load participants
             if (conv.participantIds) {
                const { getUserProfile } = await import('../services/firestore');
                const profiles = await Promise.all(conv.participantIds.map(uid => getUserProfile(uid)));
                setParticipantUsers(profiles.filter(u => u !== null) as UserType[]);
             }
          }
          
          // Load all characters in group
          const ids = conv?.characterIds || [customId];
          const loadedChars = await Promise.all(ids.map(id => getCharacter(id)));
          setCharacters(loadedChars.filter(c => c !== null) as Character[]);
        } else {
          setCharacters([char]);
          // Show Persona Selector before starting
          setShowPersonaSelector(true);
        }
      } catch (err) {
        console.error(err);
        toast.error("Erreur d'initialisation");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadChat();
  }, [customId, user, navigate]);

  // Subscribe to messages
  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [conversationId]);

  async function startNewConversation(char: Character, firstMsg: string, scenarioId?: string, personaId?: string) {
    if (!user) return;
    const newConvId = await createConversation({
      userId: user.uid,
      characterId: char.id,
      characterIds: [char.id],
      characterName: char.name,
      characterAvatarUrl: char.avatarUrl,
      messageCount: 1,
      modelUsed: currentModel,
      lastMessage: firstMsg.substring(0, 50),
      scenarioId,
      personaId,
      affinity: 0,
      participantIds: [user.uid]
    });
    setConversationId(newConvId);
    
    await addMessage(newConvId, {
      role: 'assistant',
      content: firstMsg,
      model: currentModel
    });
    setAffinity(0);
    setShowScenarioPicker(false);
    setShowPersonaSelector(false);
  }

  const handlePersonaSelect = async (persona: Persona) => {
    setSelectedPersona(persona);
    if (!conversationId) {
      // Starting new chat
      if (character) {
        if (character.scenarios && character.scenarios.length > 0) {
          setShowScenarioPicker(true);
          setShowPersonaSelector(false);
        } else {
          await startNewConversation(character, character.persona.firstMessage, undefined, persona.id);
        }
      }
    } else {
      // Switching persona in existing chat
      const { updateConversation } = await import('../services/firestore');
      await updateConversation(conversationId, { personaId: persona.id });
      setConversation(prev => prev ? { ...prev, personaId: persona.id } : null);
      setShowPersonaSelector(false);
      toast.success(`Vous interagissez maintenant en tant que ${persona.name}`);
      
      // Optionally add a system message
      await addMessage(conversationId, {
        role: 'system',
        content: `L'utilisateur a changé de persona. Il est désormais perçu comme : ${persona.name}.`,
        model: currentModel
      });
    }
  };

  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [participantUsers, setParticipantUsers] = useState<UserType[]>([]);

  const toggleInviteModal = async () => {
    if (!user) return;
    setShowInviteModal(!showInviteModal);
    if (!showInviteModal) {
      setIsInviting(true);
      try {
        const { getPublicCharacters, getAllUsers } = await import('../services/firestore');
        const publicChars = await getPublicCharacters();
        const users = await getAllUsers();
        setMyCharacters(publicChars);
        setAllUsers(users.filter(u => u.uid !== user?.uid && !conversation?.participantIds?.includes(u.uid)));
      } finally { setIsInviting(false); }
    }
  };

  // Lock scroll when modals are open
  useEffect(() => {
    const isAnyModalOpen = showInviteModal || showParticipantsModal || showPersonaSelector || showNsfwPrompt || showScenarioPicker;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showInviteModal, showParticipantsModal, showPersonaSelector, showNsfwPrompt, showScenarioPicker]);

  // Update inviteUser
  const inviteUser = async (userToInvite: UserType) => {
    if (!conversationId || !conversation) return;
    
    const { addParticipantToConversation, addMessage } = await import('../services/firestore');
    await addParticipantToConversation(conversationId, userToInvite.uid);
    
    setConversation({ ...conversation, participantIds: [...(conversation.participantIds || []), userToInvite.uid] });
    setAllUsers(allUsers.filter(u => u.uid !== userToInvite.uid));
    setParticipantUsers([...participantUsers, userToInvite]);

    await addMessage(conversationId, {
      role: 'system',
      content: `${userToInvite.displayName} a été invité à la discussion.`,
      model: currentModel
    });
    
    toast.success(`${userToInvite.displayName} a été invité !`);
  };

  const switchRoom = async (room: UniverseRoom) => {
    if (!conversationId) return;
    setCurrentRoom(room);
    setShowRoomPicker(false);
    
    const { updateConversation, addMessage } = await import('../services/firestore');
    await updateConversation(conversationId, { currentRoomId: room.id });
    
    await addMessage(conversationId, {
      role: 'system',
      content: `L'action se déplace vers : **${room.name}**. ${room.description}`,
      model: currentModel
    });
    
    toast.success(`Déplacement vers ${room.name}`);
  };


  // Updating the invitiation UI part in JSX (searchUsers logic replaced)

  // ... (in JSX return)
  // Inside the <div className="space-y-6"> in the modal:
  // <div>
  //    <h4 className="text-sm font-bold text-text-muted mb-2">Utilisateurs</h4>
  //    <div className="mt-2 space-y-2">
  //      {allUsers.map(u => (
  //         <button key={u.uid} onClick={() => inviteUser(u)} className="w-full flex items-center gap-3 p-2 bg-surface-800 rounded-lg hover:bg-surface-700">
  //           <Avatar fallbackColor="bg-primary-500" size="sm" alt={u.displayName} />
  //           <span>{u.displayName}</span>
  //         </button>
  //      ))}
  //    </div>
  // </div>

  const inviteCharacter = async (char: Character) => {
    if (!conversationId || !conversation) return;
    const newIds = [...(conversation.characterIds || [conversation.characterId]), char.id];
    const { updateDoc, doc } = await import('firebase/firestore');
    const { db } = await import('../config/firebase');
    await updateDoc(doc(db, 'conversations', conversationId), {
      characterIds: newIds
    });
    setCharacters([...characters, char]);
    setConversation({ ...conversation, characterIds: newIds });
    setShowInviteModal(false);
    toast.success(`${char.name} a rejoint la discussion !`);
    
    // Announce departure/arrival
    await addMessage(conversationId, {
      role: 'assistant',
      content: `*${char.name} entre dans la pièce.* "Bonjour à tous !"`,
      model: currentModel
    });
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputMessage]);

  const nsfwKeywords = ['hot', 'sexe', 'nu', 'nsfw', 'câlin', 'sensuel'];
  
  const handleSendMessage = async () => {
    if (isGenerating || !character || !conversationId) return;

    let userText = inputMessage.trim();

    // If empty or just space, set a trigger message for the AI
    if (userText === '') {
      userText = "*L'utilisateur ne sait pas quoi dire, il laisse le silence s'installer...*";
    }
    
    // Check if message is NSFW and character is not
    if (!character.isNSFW && nsfwKeywords.some(keyword => userText.toLowerCase().includes(keyword))) {
        setPendingMessage(userText);
        setShowNsfwPrompt(true);
        return;
    }

    await proceedSendMessage(userText);
  };
  
  async function proceedSendMessage(userText: string) {
    if (!conversationId || !character) return;
    setInputMessage('');
    
    // Check for Lorebook triggers
    const relevantLore = character.lore?.filter(entry => 
      entry.keywords.some(kw => userText.toLowerCase().includes(kw.toLowerCase()))
    );
    
    let loreContext = "";
    if (relevantLore && relevantLore.length > 0) {
      loreContext = "\n\n[CONTEXTE DE L'UNIVERS (LORE)]:\n" + 
        relevantLore.map(l => `${l.title}: ${l.content}`).join('\n');
      setActiveLoreExtras(loreContext);
    } else {
      setActiveLoreExtras('');
    }

    const userMsgData: Omit<Message, 'id'|'timestamp'> = {
      role: 'user',
      userId: user!.uid,
      userName: user!.displayName,
      content: userText,
      model: currentModel
    };
    
    await addMessage(conversationId!, userMsgData);
    
    // Prepare for AI response
    setIsGenerating(true);
    setStreamingText('');
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      const historyForAI = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      historyForAI.push({ role: 'user', content: userText });
      
      // Include current user if they are not already in participantUsers
      const participantsWithUser = [...participantUsers];
      if (user && !participantsWithUser.some(p => p.uid === user.uid)) {
         participantsWithUser.push(user as UserType);
      }

      const personasForPrompt = participantsWithUser.map(p => {
        if (user && p.uid === user.uid && selectedPersona) {
          return {
            name: selectedPersona.name,
            age: selectedPersona.age,
            appearance: selectedPersona.appearance,
            mentality: selectedPersona.mentality,
            background: selectedPersona.background
          };
        }
        return p.persona || { name: p.displayName, age: 'Inconnu', appearance: 'Inconnue', mentality: 'Standard', background: 'Inconnu' };
      });

    // Detect mentioned character for focal response
    const mentionedChar = characters.find(c => userText.includes(`@${c.name}`));
    const mentionedUser = participantUsers.find(u => userText.includes(`@${u.displayName}`));
    
    let focalInstruction = mentionedChar 
      ? `\n\n[INSTRUCTION FOCALE] : L'utilisateur s'adresse spécifiquement à **${mentionedChar.name}**. Assurez-vous que ce personnage réagisse en premier et soit au centre de la réponse.` 
      : (characters.length > 1 ? `\n\n[CONSEIL] : Puisqu'il s'agit d'un groupe, n'hésitez pas à faire participer plusieurs personnages si cela fait sens.` : '');

    if (mentionedUser) {
      focalInstruction += `\n\n[AVERTISSEMENT] : L'utilisateur @${mentionedUser.displayName} est un HUMAIN. Vous ne devez JAMAIS répondre à sa place. Laissez-le s'exprimer de lui-même. Vous ne pouvez que réagir à sa mention si l'un de vos personnages a une raison de le faire.`;
    }

    const universePrompt = universe ? { name: universe.name, rules: universe.rules } : undefined;
    const roomPrompt = currentRoom ? { name: currentRoom.name, description: currentRoom.description } : undefined;
    
    // Filter relevant lore based on user text (simple keyword matching)
    const relevantLore = loreEntries.filter(entry => 
       entry.keywords.some(k => userText.toLowerCase().includes(k.toLowerCase())) ||
       userText.toLowerCase().includes(entry.title.toLowerCase())
    );

    const sysPrompt = buildCharacterSystemPrompt(characters, personasForPrompt, universePrompt, roomPrompt, relevantLore) + activeLoreExtras + focalInstruction +
      ` [AFFINITÉ ACTUELLE: ${affinity}/100. Ton attitude doit refléter ce score : plus c'est bas, plus tu es distant/hostile. Plus c'est haut, plus tu es chaleureux/amical.]`;
      
      const apiMsgs = buildContextMessages(sysPrompt, historyForAI, 20, longTermMemory);

      await streamChatCompletion(
        apiMsgs as any, 
        currentModel,
        (chunk) => {
          setStreamingText(prev => prev + chunk);
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        },
        async (fullText) => {
          setIsGenerating(false);
          setAbortController(null);
          setStreamingText('');
          if (fullText) {
            await addMessage(conversationId, {
              role: 'assistant',
              content: fullText,
              model: currentModel,
            });
            
            // ANALYSE D'AFFINITÉ (asynchrone, simplifié)
            const analysisPrompt = `Analyze the user's last message impact on character's feelings.
Character: ${character.name}
User Message: "${userText}"
AI Response: "${fullText}"
Current Affinity: ${affinity}/100
Analyze if the user was: Respected (+2), Kind (+5), Flirty (+10), Rude (-5), Hostile (-15), Indifferent (0).
Output ONLY the number indicating the CHANGE in affinity (e.g. "+5" or "-10").`;
            
            let changeStr = '';
            streamChatCompletion(
              [{ role: 'system', content: analysisPrompt }],
              'nemotron-nano',
              (c) => { changeStr += c; },
              async () => {
                const change = parseInt(changeStr.replace(/[^\d-]/g, ''));
                if (!isNaN(change)) {
                  const newAff = Math.max(-100, Math.min(100, affinity + change));
                  setAffinity(newAff);
                  await updateAffinity(conversationId, newAff);
                }
              },
              () => {}
            );

            // GESTION DE LA MÉMOIRE LONG TERME (tous les 10 messages après 20)
            if (historyForAI.length > 20 && historyForAI.length % 10 === 0) {
              const messagesToSummarize = messages.slice(-15, -5); // Summarize some past context
              summarizeConversation(messagesToSummarize, longTermMemory).then(async (newMem) => {
                if (newMem && newMem !== longTermMemory) {
                  setLongTermMemory(newMem);
                  const { updateConversation } = await import('../services/firestore');
                  await updateConversation(conversationId, { longTermMemory: newMem });
                }
              }).catch(e => console.error("Memory error:", e));
            }
          } else {
            toast.error("L'IA n'a retourné aucune réponse. Modifiez votre message ou changez les préférences.");
          }
        },
        (error) => {
          setIsGenerating(false);
          setAbortController(null);
          setStreamingText('');
          toast.error("L'IA n'a pas pu répondre : " + error.message);
        },
        controller.signal,
        {
          temperature: user?.preferences?.temperature,
          top_p: user?.preferences?.topP
        }
      );
    } catch (err: any) {
      console.error("Erreur lors de la préparation de la requête:", err);
      setIsGenerating(false);
      setAbortController(null);
      setStreamingText('');
      toast.error("Erreur interne: " + (err.message || "Impossible de générer le prompt."));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputMessage(value);
    
    // Auto-resize
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;

    // Mention detection
    const cursorPosition = target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      // Ensure there's no space between @ and the cursor, or it's at the start/after space
      if (!textAfterAt.includes(' ') && (lastAtSymbol === 0 || textBeforeCursor[lastAtSymbol - 1] === ' ')) {
        setShowMentions(true);
        setMentionFilter(textAfterAt.toLowerCase());
        setMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    if (!textareaRef.current) return;
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = inputMessage.substring(0, cursorPosition);
    const textAfterCursor = inputMessage.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    const newText = textBeforeCursor.substring(0, lastAtSymbol) + '@' + name + ' ' + textAfterCursor;
    setInputMessage(newText);
    setShowMentions(false);
    
    // Re-focus and set cursor position after mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = lastAtSymbol + name.length + 2; // +1 for @, +1 for space
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const filteredParticipants = [
    ...characters.map(c => ({ id: c.id, name: c.name, type: 'character' as const, avatar: c.avatarUrl, color: c.avatarColor })),
    ...(participantUsers || []).map(u => ({ id: u.uid, name: u.displayName, type: 'user' as const, avatar: u.photoURL, color: 'text-text-muted' }))
  ].filter(p => p.name.toLowerCase().includes(mentionFilter));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredParticipants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredParticipants.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredParticipants.length) % filteredParticipants.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredParticipants[mentionIndex]) {
          insertMention(filteredParticipants[mentionIndex].name);
        }
        return;
      } else if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!conversationId) return;
    try {
      await updateMessage(conversationId, msgId, editContent);
      setEditingMessageId(null);
      setEditContent('');
      toast.success("Message mis à jour");
    } catch (e) {
      toast.error("Échec de la mise à jour");
    }
  };

  const toggleTTS = async (messageId: string, text: string, voiceId?: string) => {
    if (playingMessageId === messageId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingMessageId(null);
      }
      return;
    }

    // Stop current playback if it exists
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlayingMessageId(messageId);

    // Priority: 1. Specific passed ID. 2. Character's specific fixed voice. 3. User default. 4. Fallback.
    let finalVoiceId = voiceId || character?.voiceId || user?.preferences?.ttsVoice || '21m00Tcm4TlvDq8ikWAM';
    
    // Map legacy names to valid ElevenLabs IDs if necessary
    const legacyMap: Record<string, string> = {
      'Rachel': '21m00Tcm4TlvDq8ikWAM',
      'Drew': '29vD33N1CtxCmqQRPOHJ',
      'Clyde': '2EiwWnXFnvU5JabPnv8n',
      'Mimi': 'zrHiDhphv9ZnVBTuAHuD',
      'Fin': 'D38z5RcWu1voky8WS1ja'
    };
    if (legacyMap[finalVoiceId]) {
      finalVoiceId = legacyMap[finalVoiceId];
    }
    
    if (!finalVoiceId) {
        setPlayingMessageId(null);
        return;
    }

    try {
      const cleaned = cleanTextForTTS(text);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.preferences?.elevenlabsApiKey) {
        headers['x-custom-elevenlabs-key'] = user.preferences.elevenlabsApiKey;
      }
      
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: cleaned, voiceId: finalVoiceId })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'TTS failed');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => {
        setPlayingMessageId(null);
      };
      
      audioRef.current = audio;
      audio.play();
    } catch (e: any) {
      console.error(e);
      setPlayingMessageId(null);
      // Try to parse elevenlabs error message if it's JSON
      let errorMessage = "Erreur de synthèse vocale";
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.detail && parsed.detail.message) {
          errorMessage = parsed.detail.message;
        }
      } catch {
        if (e.message && e.message !== 'TTS failed') {
          errorMessage = e.message;
        }
      }
      toast.error(errorMessage);
    }
  };

  if (isLoading || !character) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-surface-950">
        <Sparkles className="w-8 h-8 text-primary-500 animate-pulse mb-4" />
        <p className="text-text-secondary">Connexion neuronale en cours...</p>
      </div>
    );
  }

  return (
    <div 
      className={`flex flex-col h-[calc(100vh-64px)] h-[calc(100dvh-64px)] bg-surface-950 bg-cover bg-center bg-no-repeat transition-all duration-700 ${universe ? 'bg-blend-overlay bg-indigo-900/10' : ''}`}
      style={{ 
        backgroundImage: `url(${currentRoom?.backgroundImageUrl || universe?.backgroundImageUrl || user?.preferences?.chatBackgroundImage || conversation?.backgroundImageUrl || character.backgroundImageUrl || character.avatarUrl})`
      }}
    >
      {/* Cinematic Overlays */}
      <div className={`fixed inset-0 z-0 ${universe ? 'bg-indigo-950/20 mix-blend-overlay' : 'bg-surface-950/20'} pointer-events-none`} />

      {/* Header */}
      <header className={`flex-shrink-0 h-16 border-b border-white/5 ${universe ? 'bg-indigo-950/40' : 'bg-surface-900/80'} backdrop-blur-md flex items-center justify-between px-4 z-10 w-full relative`}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/home')} className="md:hidden shrink-0 w-9 h-9 p-0 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          
          <div className="flex -space-x-4 overflow-hidden items-center group cursor-pointer" onClick={() => setShowParticipantsModal(true)}>
            {characters.slice(0, 3).map((c, i) => (
              <Avatar 
                key={c.id}
                src={c.avatarUrl} 
                alt={c.name} 
                fallbackColor={c.avatarColor}
                size="sm" 
                className={`border-2 border-surface-900 ring-2 ring-transparent z-[${i}] transition-transform group-hover:scale-110`}
              />
            ))}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 truncate">
              <h2 className="font-serif font-bold text-xs sm:text-sm truncate uppercase tracking-tighter">
                {universe ? (
                   <span className="text-indigo-300 flex items-center gap-2">
                     <Globe className="w-3 h-3" />
                     {universe.name}
                   </span>
                ) : (
                  characters.length > 1 
                    ? `${characters[0].name} & Co`
                    : characters[0]?.name || 'Nexus'
                )}
              </h2>
              {currentRoom && (
                <Badge variant="outline" className="text-[8px] py-0 border-indigo-500/30 text-indigo-100 bg-indigo-500/20 rounded-full sm:flex hidden">
                   {currentRoom.name}
                </Badge>
              )}
            </div>
            {universe && <span className="text-[9px] text-indigo-200/50 uppercase tracking-[0.2em] truncate hidden sm:block">{currentRoom?.name || 'ESPACE COMMUN'}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {universe && (
            <div className="flex items-center mr-2 border-r border-white/10 pr-2 gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-indigo-300 hover:text-white h-9 w-9" 
                title="Codex de l'Univers"
                onClick={() => setShowCodex(true)}
              >
                <Book className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-indigo-300 hover:text-white h-9 w-9" 
                title="Lieux de l'Univers"
                onClick={() => setShowRoomPicker(true)}
              >
                <MapIcon className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-9 w-9 ${longTermMemory ? 'text-primary-400' : 'text-text-muted hover:text-white'}`} 
              title="Mémoire de la conversation"
              onClick={() => setShowMemoryModal(true)}
            >
              <Brain className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-text-muted h-9 w-9" 
              title="Persona"
              onClick={() => setShowPersonaSelector(true)}
            >
              <UserIcon className="w-4 h-4" />
            </Button>

            <div className="hidden sm:flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-text-muted h-9 w-9" 
                title="Inviter"
                onClick={toggleInviteModal}
              >
                <Plus className="w-4 h-4" />
              </Button>
              
              <div className="shrink-0 ml-1">
                <ModelSwitch />
              </div>

              {user?.uid === character.creatorId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/edit/${character.id}`)}
                  title="Modifier ce personnage"
                  className="text-text-muted hover:text-text-primary h-9 w-9"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile-only sub-header for Model & Quick Actions */}
      <div className="sm:hidden flex-shrink-0 bg-surface-900/50 backdrop-blur-sm border-b border-white/5 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide">
        <ModelSwitch />
        <Button 
          variant="ghost" 
          size="sm" 
          className="shrink-0 h-8 text-[10px] px-2 py-0"
          onClick={toggleInviteModal}
        >
          <Plus className="w-3 h-3 mr-1" />
          Inviter
        </Button>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth ${universe ? 'universe-chat-bg' : ''}`}>
        <div className="max-w-3xl mx-auto w-full space-y-6 flex flex-col">
          {universe && (
            <div className="text-center my-4 space-y-2 translate-y-4">
              <h2 className="text-2xl font-serif font-bold text-indigo-300 uppercase tracking-[0.2em]">{universe.name}</h2>
              <p className="text-[10px] text-indigo-200/50 uppercase tracking-widest px-12 leading-relaxed">{universe.description}</p>
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent mx-auto mt-4"></div>
            </div>
          )}
          <div className={`text-center my-8 text-text-muted text-xs ${universe ? 'universe-special-text' : ''}`}>
            {universe ? 'Lobby d\'Univers - Immersion Actve' : `Discussion de groupe avec ${characters.map(c => c.name).join(', ')}`}
          </div>
          
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isSystem = msg.role === 'system';
              
              if (isSystem) {
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center my-4 text-text-muted text-xs italic">
                    {msg.content}
                  </motion.div>
                );
              }

              const isMulti = characters.length > 1;
              const senderName = isUser ? (msg.userName || 'Utilisateur') : (isMulti ? 'Nexus / Groupe' : character.name);
              const senderAvatar = isUser ? null : (isMulti ? null : character.avatarUrl); // Neutral avatar/icon for group
              const senderColor = isUser ? 'text-text-muted' : (isMulti ? 'text-primary-400' : character.avatarColor);
              
              const isUniverse = !!universe;
              const messageClass = isUser 
                ? (isUniverse ? 'universe-message-user' : 'message-user') 
                : (isUniverse ? 'universe-message-character' : 'message-character');

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    isMulti ? (
                      <div className={`w-9 h-9 rounded-sm flex items-center justify-center mt-1 shrink-0 ${isUniverse ? 'bg-indigo-900/50 border-indigo-500/30 shadow-lg shadow-indigo-500/20' : 'bg-surface-800 border-white/5'}`}>
                        <Users className={`w-5 h-5 ${isUniverse ? 'text-indigo-300' : 'text-primary-400'}`} />
                      </div>
                    ) : (
                      <Avatar src={senderAvatar} fallbackColor={senderColor} size="sm" alt={senderName} className="mt-1" />
                    )
                  )}
                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <span className="text-[10px] text-text-muted mb-0.5 px-1">{senderName}</span>
                    <div className={`text-sm leading-relaxed ${messageClass} flex items-start sm:items-center gap-2 w-full`}>
                      <div className="markdown-body flex-1 min-w-0 overflow-hidden break-words">
                        {editingMessageId === msg.id ? (
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-surface-800 p-2 rounded-sm text-white resize-y min-h-[80px]"
                          />
                        ) : (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        )}
                      </div>
                      <div className="flex sm:flex-col lg:flex-row gap-2 shrink-0 pt-1 sm:pt-0">
                        {isUser && !editingMessageId && msg.userId === user?.uid && (
                          <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }} className="text-text-muted hover:text-primary-500 p-1 bg-surface-800/50 rounded-sm">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isUser && (
                          <button onClick={() => toggleTTS(msg.id, msg.content, character.voiceId)} className="text-text-muted hover:text-primary-500 p-1 bg-surface-800/50 rounded-sm">
                            {playingMessageId === msg.id ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                      {editingMessageId === msg.id && (
                          <div className="flex gap-2 mt-2">
                             <Button size="sm" onClick={() => handleSaveEdit(msg.id)}>Enregistrer</Button>
                             <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)}>Annuler</Button>
                          </div>
                      )}
                    {!isUser && (
                      <span className="text-[10px] text-text-muted mt-1 ml-1 opacity-60">
                        {msg.model === 'nemotron-nano' ? '✨ Créatif' : '🧠 Standard'}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
            
            {isGenerating && streamingText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 w-full justify-start"
              >
                {characters.length > 1 ? (
                  <div className="w-9 h-9 rounded-sm bg-surface-800 border border-white/5 flex items-center justify-center mt-1 shrink-0">
                    <Users className="w-5 h-5 text-primary-400" />
                  </div>
                ) : (
                  <Avatar src={character.avatarUrl} fallbackColor={character.avatarColor} size="sm" alt={character.name} className="mt-1" />
                )}
                <div className="flex flex-col items-start max-w-[85%]">
                  <span className="text-[10px] text-text-muted mb-0.5 px-1">{characters.length > 1 ? 'Nexus / Groupe' : character.name}</span>
                  <div className="text-sm leading-relaxed message-character">
                    <div className="markdown-body">
                      <ReactMarkdown>{streamingText}</ReactMarkdown>
                    </div>
                    <span className="inline-block w-1.5 h-4 ml-1 bg-primary-400 animate-pulse align-middle"></span>
                  </div>
                </div>
              </motion.div>
            )}

            {isGenerating && !streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 w-full justify-start">
                {characters.length > 1 ? (
                  <div className="w-9 h-9 rounded-sm bg-surface-800 border border-white/5 flex items-center justify-center mt-1 shrink-0">
                    <Users className="w-5 h-5 text-primary-400" />
                  </div>
                ) : (
                  <Avatar src={character.avatarUrl} fallbackColor={character.avatarColor} size="sm" alt={character.name} className="mt-1" />
                )}
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-text-muted mb-0.5 px-1">{characters.length > 1 ? 'Nexus / Groupe' : character.name}</span>
                  <div className="message-character flex items-center h-10 px-4 mt-1">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-4 bg-surface-950/80 backdrop-blur border-t border-white/5 relative z-10 w-full">
          <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-surface-900 border border-white/5 rounded-sm p-2 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/20 transition-all shadow-inner">
          
          {/* Mention Dropdown */}
          {showMentions && filteredParticipants.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface-900 border border-white/10 rounded-sm shadow-2xl overflow-hidden z-50">
              <div className="p-2 border-b border-white/5 bg-surface-800 flex items-center justify-between">
                <span className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">Mentionner...</span>
                <span className="text-[9px] text-text-muted">↑↓ Naviguer • Entrée Choisir</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredParticipants.map((p, i) => (
                  <button
                    key={`${p.type}-${p.id}`}
                    className={`w-full flex items-center gap-2 p-2 hover:bg-primary-500/10 transition-colors text-left ${i === mentionIndex ? 'bg-primary-500/20' : ''}`}
                    onClick={() => insertMention(p.name)}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    <Avatar src={p.avatar} fallbackColor={p.color} size="sm" alt={p.name} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-text-muted uppercase italic">{p.type === 'character' ? 'Perso' : 'Humain'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={characters.length > 1 ? "Mentionnez quelqu'un avec @..." : `Écrire à ${character?.name || '...'}`}
            className="flex-1 max-h-32 min-h-[44px] bg-transparent text-sm font-sans resize-none outline-none py-3 px-3 text-white placeholder-text-muted scrollbar-hide"
            disabled={isGenerating}
            rows={1}
          />
          {isGenerating ? (
            <Button size="icon" variant="danger" className="h-[44px] w-[44px] shrink-0 rounded-sm flex items-center justify-center p-0" onClick={cancelGeneration}>
              <StopCircle className="w-5 h-5 m-0" />
            </Button>
          ) : (
            <Button 
              size="icon" 
              className="h-[44px] w-[44px] shrink-0 rounded-sm bg-primary-600 hover:bg-primary-500 text-surface-950 transition-colors flex items-center justify-center p-0"
              onClick={handleSendMessage}
            >
              <Send className="w-4 h-4 m-0 ml-0.5" />
            </Button>
          )}
        </div>
        <div className="text-center mt-2 text-[10px] text-text-muted font-serif italic">
          L'IA peut générer des informations inexactes.
        </div>
      </div>
      {showNsfwPrompt && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 border border-red-500/20 p-6 rounded-xl max-w-sm w-full">
            <h3 className="text-lg font-bold text-red-400 mb-2">Contenu mature détecté</h3>
            <p className="text-text-secondary text-sm mb-6">Ce message semble contenir du contenu suggestif. Pour une expérience optimale avec ce type de contenu, veuillez activer le tag 18+ sur ce personnage.</p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setShowNsfwPrompt(false); proceedSendMessage(pendingMessage); }}>Ignorer</Button>
              <Button onClick={() => navigate(`/edit/${character.id}`)}>Activer 18+</Button>
            </div>
          </div>
        </div>
      )}

      {showScenarioPicker && character && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-900 border border-white/10 p-6 rounded-xl max-w-lg w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-primary-400" />
              Choisir un Scénario
            </h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              <button 
                onClick={() => startNewConversation(character, character.persona.firstMessage)}
                className="w-full text-left p-4 bg-surface-800 hover:bg-surface-700 rounded-lg border border-white/5 transition-colors group"
              >
                <div className="font-bold text-primary-400 group-hover:text-primary-300">Introduction Classique</div>
                <div className="text-sm text-text-muted mt-1">{character.persona.firstMessage.substring(0, 100)}...</div>
              </button>
              
              {character.scenarios?.map(scen => (
                <button 
                  key={scen.id}
                  onClick={() => startNewConversation(character, scen.initialMessage, scen.id)}
                  className="w-full text-left p-4 bg-surface-800 hover:bg-surface-700 rounded-lg border border-white/5 transition-colors group"
                >
                  <div className="font-bold text-primary-400 group-hover:text-primary-300">{scen.title}</div>
                  <div className="text-sm text-text-secondary mt-1">{scen.description}</div>
                  <div className="text-[11px] text-text-muted mt-2 italic border-l-2 border-primary-500/30 pl-2">
                    "{scen.initialMessage.substring(0, 80)}..."
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => navigate('/home')}>Annuler</Button>
            </div>
          </div>
        </div>
      )}

      {/* Persona Selector Modal */}
      {showPersonaSelector && (
        <PersonaSelector 
            onSelect={handlePersonaSelect}
            onCancel={() => {
                if (!conversationId) navigate('/home');
                else setShowPersonaSelector(false);
            }}
        />
      )}

      {showParticipantsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 border border-white/10 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Participants</h3>
            <div className="space-y-4">
                <div>
                   <h4 className="text-xs font-bold text-text-muted mb-2">Personnages ({characters.length})</h4>
                   <div className="space-y-2">
                      {characters.map(c => (
                          <div key={c.id} className="flex items-center gap-3 p-2 bg-surface-800 rounded-lg">
                             <Avatar src={c.avatarUrl} fallbackColor={c.avatarColor} size="sm" />
                             <span>{c.name}</span>
                          </div>
                      ))}
                   </div>
                </div>
                <div>
                   <h4 className="text-xs font-bold text-text-muted mb-2">Utilisateurs</h4>
                   <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 bg-surface-800 rounded-lg">
                         <Avatar fallbackColor="bg-primary-500" size="sm" />
                         <span>{user?.displayName || 'Vous'}</span>
                      </div>
                      {participantUsers.map(u => (
                          <div key={u.uid} className="flex items-center gap-3 p-2 bg-surface-800 rounded-lg">
                             <Avatar fallbackColor="bg-primary-500" size="sm" />
                             <span>{u.displayName}</span>
                          </div>
                      ))}
                   </div>
                </div>
            </div>
            <Button className="w-full mt-6" onClick={() => setShowParticipantsModal(false)}>Fermer</Button>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-900 border border-white/10 p-6 rounded-xl max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-400" />
              Inviter dans la discussion
            </h3>
            {isInviting ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
            ) : (
              <div className="space-y-6">
                
                {/* Invite User */}
                <div>
                   <h4 className="text-sm font-bold text-text-muted mb-2">Utilisateurs</h4>
                   <div className="mt-2 space-y-2">
                     {allUsers.map(u => (
                        <button key={u.uid} onClick={() => inviteUser(u)} className="w-full flex items-center gap-3 p-2 bg-surface-800 rounded-lg hover:bg-surface-700">
                          <Avatar fallbackColor="bg-primary-500" size="sm" alt={u.displayName} />
                          <span>{u.displayName}</span>
                        </button>
                     ))}
                     {allUsers.length === 0 && <p className="text-center text-sm text-text-muted py-2">Aucun utilisateur disponible.</p>}
                   </div>
                </div>

                {/* Invite Character */}
                <div>
                  <h4 className="text-sm font-bold text-text-muted mb-2">Personnages</h4>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {myCharacters.filter(c => !characters.some(current => current.id === c.id)).map(char => (
                      <button 
                        key={char.id}
                        onClick={() => inviteCharacter(char)}
                        className="w-full flex items-center gap-3 p-3 bg-surface-800 hover:bg-surface-700 rounded-lg border border-white/5 transition-colors"
                      >
                        <Avatar src={char.avatarUrl} fallbackColor={char.avatarColor} size="sm" alt={char.name} />
                        <div className="text-left">
                          <div className="font-bold text-sm">{char.name}</div>
                        </div>
                      </button>
                    ))}
                    {myCharacters.length === 0 && <p className="text-center text-sm text-text-muted py-2">Aucun autre personnage disponible.</p>}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={() => setShowInviteModal(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
      {showCodex && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-surface-950 border border-indigo-500/30 p-8 rounded-sm max-w-2xl w-full shadow-2xl relative overflow-hidden">
            {/* Cinematic Gradient Background */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-serif font-bold text-indigo-100 flex items-center gap-4 tracking-tighter uppercase">
                <Book className="w-8 h-8 text-indigo-400" />
                Codex de l'Univers
              </h3>
              <button onClick={() => setShowCodex(false)} className="text-text-muted hover:text-white">Fermer</button>
            </div>
            
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
              {loreEntries.length === 0 && (
                <div className="text-center py-12 text-text-muted italic border border-white/5 bg-white/5 rounded-sm">
                  Le codex est actuellement scellé ou vide.
                </div>
              )}
              {loreEntries.map(entry => (
                <div key={entry.id} className="pb-6 border-b border-white/5 last:border-0 group">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="accent" className="rounded-sm text-[8px] bg-indigo-500/20 text-indigo-300 border-indigo-500/30 uppercase tracking-widest">{entry.category}</Badge>
                    <h4 className="text-xl font-serif font-bold text-white group-hover:text-indigo-300 transition-colors">{entry.title}</h4>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed font-light first-letter:text-2xl first-letter:font-serif first-letter:text-indigo-400 first-letter:mr-1 first-letter:float-left">
                    {entry.content}
                  </p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {entry.keywords.map(k => <span key={k} className="text-[10px] text-indigo-500/50 font-mono italic">#{k}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRoomPicker && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-surface-950 border border-white/10 p-8 rounded-sm max-w-4xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
              <h3 className="text-2xl font-serif font-bold text-white flex items-center gap-4 tracking-tighter uppercase">
                <MapIcon className="w-7 h-7 text-indigo-400" />
                Exploration : Choisir un Lieu
              </h3>
              <button onClick={() => setShowRoomPicker(false)} className="text-text-muted hover:text-white">Fermer</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
              {rooms.length === 0 && (
                <div className="col-span-2 text-center py-12 text-text-muted italic border border-white/5 bg-white/5 rounded-sm">
                  Aucun lieu spécifique n'est encore découvert dans cet univers.
                </div>
              )}
              {rooms.map(room => (
                <button 
                  key={room.id}
                  onClick={() => switchRoom(room)}
                  className={`relative group aspect-[16/8] rounded-sm overflow-hidden border-2 transition-all ${currentRoom?.id === room.id ? 'border-indigo-500' : 'border-white/10 hover:border-white/30'}`}
                >
                  <img src={room.backgroundImageUrl || undefined} alt="" className="absolute inset-0 w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-transform duration-1000 group-hover:scale-110" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-black/20" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end text-left">
                    <h4 className="text-xl font-serif font-bold text-white mb-2">{room.name}</h4>
                    <p className="text-xs text-text-secondary line-clamp-2 font-light">{room.description}</p>
                    {currentRoom?.id === room.id && (
                      <div className="absolute top-4 right-4 bg-indigo-600 text-white text-[9px] px-2 py-1 font-bold uppercase tracking-widest rounded-sm">
                        Lieu Actuel
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center mt-8 text-[10px] text-text-muted italic uppercase tracking-widest">
              Le changement de lieu sera notifié à tous les participants et adaptera l'ambiance visuelle.
            </p>
          </div>
        </div>
      )}

      {/* Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMemoryModal(false)} />
          <div className="bg-surface-950 border border-primary-500/30 rounded-lg p-6 max-w-lg w-full relative z-10 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold font-serif flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary-400" /> Mémoire de l'IA
              </h3>
              <button onClick={() => setShowMemoryModal(false)} className="text-text-muted hover:text-white p-1">
                 <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Ceci est le résumé cognitif de vos interactions passées. L'IA se base sur ce texte pour maintenir la cohérence au fur et à mesure que la conversation avance.
            </p>
            <div className="flex-1 overflow-y-auto mb-4 bg-surface-900 border border-white/5 rounded-sm p-4 font-mono text-sm text-text-muted whitespace-pre-wrap">
              {longTermMemory || "L'IA n'a pas encore synthétisé de souvenirs à long terme."}
            </div>
            <div className="flex justify-end pt-4 border-t border-white/10 shrink-0">
               <Button variant="outline" onClick={() => setShowMemoryModal(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
