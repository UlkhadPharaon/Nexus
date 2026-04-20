import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { getCharacter, getConversation, subscribeToMessages, addMessage, updateMessage, createConversation, getConversations } from '../services/firestore';
import { streamChatCompletion } from '../services/aiService';
import { buildCharacterSystemPrompt, buildContextMessages } from '../utils/promptBuilder';
import { Character, Message, Conversation } from '../types';
import { ModelSwitch } from '../components/chat/ModelSwitch';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft, Send, Sparkles, StopCircle, User, Volume2, Edit2, Heart, Users, FileText, Plus, Map as MapIcon, Loader2 } from 'lucide-react';
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
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
        const char = await getCharacter(customId);
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
          
          if (conv) {
             // Load participants
             if (conv.participantIds) {
                const { getUserProfile } = await import('../services/firestore');
                const profiles = await Promise.all(conv.participantIds.map(uid => getUserProfile(uid)));
                setParticipantUsers(profiles.filter(u => u !== null) as User[]);
             }
          }
          
          // Load all characters in group
          const ids = conv?.characterIds || [customId];
          const loadedChars = await Promise.all(ids.map(id => getCharacter(id)));
          setCharacters(loadedChars.filter(c => c !== null) as Character[]);
        } else {
          setCharacters([char]);
          // If the character has scenarios, show picker first
          if (char.scenarios && char.scenarios.length > 0) {
            setShowScenarioPicker(true);
          } else {
            await startNewConversation(char, char.persona.firstMessage);
          }
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

  async function startNewConversation(char: Character, firstMsg: string, scenarioId?: string) {
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
      affinity: 0
    });
    setConversationId(newConvId);
    
    await addMessage(newConvId, {
      role: 'assistant',
      content: firstMsg,
      model: currentModel
    });
    setAffinity(0);
    setShowScenarioPicker(false);
  }

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [participantUsers, setParticipantUsers] = useState<User[]>([]);

  const toggleInviteModal = async () => {
    if (!user) return;
    setShowInviteModal(!showInviteModal);
    if (!showInviteModal) {
      setIsInviting(true);
      try {
        const { getUserCharacters, getAllUsers } = await import('../services/firestore');
        const mine = await getUserCharacters(user.uid);
        const users = await getAllUsers();
        setMyCharacters(mine.filter(m => !characters.find(c => c.id === m.id)));
        setAllUsers(users.filter(u => u.uid !== user?.uid && !conversation?.participantIds?.includes(u.uid)));
      } finally { setIsInviting(false); }
    }
  };

  // Update inviteUser
  const inviteUser = async (userToInvite: User) => {
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
    if (!inputMessage.trim() || isGenerating || !character || !conversationId) return;

    const userText = inputMessage.trim();
    
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
      const historyForAI = messages.map(m => ({ role: m.role, content: m.content }));
      historyForAI.push({ role: 'user', content: userText });
      
      // Include current user if they are not already in participantUsers
      const participantsWithUser = [...participantUsers];
      if (user && !participantsWithUser.some(p => p.uid === user.uid)) {
         participantsWithUser.push(user as User);
      }

      const sysPrompt = buildCharacterSystemPrompt(character, participantsWithUser.map(p => p.persona || { name: p.displayName, age: 'Inconnu', appearance: 'Inconnue', mentality: 'Standard', background: 'Inconnu' })) + activeLoreExtras + 
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
    } catch (err) {
      setIsGenerating(false);
      setAbortController(null);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      className="flex flex-col h-[calc(100vh-64px)] bg-surface-950 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: user?.preferences?.chatBackgroundImage ? `url(${user.preferences.chatBackgroundImage})` : (conversation?.backgroundImageUrl ? `url(${conversation.backgroundImageUrl})` : 'none') }}
    >
      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-white/5 bg-surface-900/80 backdrop-blur flex items-center justify-between px-4 z-10 w-full relative">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/home')} className="md:hidden shrink-0 w-9 h-9 p-0 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <Avatar 
            src={character.avatarUrl} 
            alt={character.name} 
            fallbackColor={character.avatarColor}
            size="sm" 
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm">{character.name}</h2>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 rounded-full border border-red-500/20">
                <Heart className={`w-2.5 h-2.5 ${affinity > 0 ? 'fill-red-500 text-red-500' : 'text-text-muted'}`} />
                <span className="text-[9px] font-bold text-red-500">{affinity}%</span>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] py-0">{character.category}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-text-muted" 
            title="Inviter des personnages"
            onClick={toggleInviteModal}
          >
            <Users className="w-4 h-4" />
          </Button>
          <ModelSwitch />
          {user?.uid === character.creatorId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/edit/${character.id}`)}
              title="Modifier ce personnage"
              className="hidden sm:flex text-text-muted hover:text-text-primary"
            >
              Éditer
            </Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        <div className="max-w-3xl mx-auto w-full space-y-6 flex flex-col">
          <div className="text-center my-8 text-text-muted text-xs">
            Début de la conversation avec {character.name}
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

              const senderName = isUser ? (msg.userName || 'Utilisateur') : character.name;
              const senderAvatar = isUser ? null : character.avatarUrl; // Use character avatar for AI
              const senderColor = isUser ? 'text-text-muted' : character.avatarColor;
              
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 w-full ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <Avatar src={senderAvatar} fallbackColor={senderColor} size="sm" alt={senderName} className="mt-1" />
                  )}
                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <span className="text-[10px] text-text-muted mb-0.5 px-1">{senderName}</span>
                    <div className={`text-sm leading-relaxed ${isUser ? 'message-user' : 'message-character'} flex items-start sm:items-center gap-2 w-full`}>
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
                <Avatar src={character.avatarUrl} fallbackColor={character.avatarColor} size="sm" alt={character.name} className="mt-1" />
                <div className="flex flex-col items-start max-w-[85%]">
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
                <Avatar src={character.avatarUrl} fallbackColor={character.avatarColor} size="sm" alt={character.name} />
                <div className="message-character flex items-center h-10 px-4">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce"></div>
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
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Écrire à ${character.name}...`}
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
              disabled={!inputMessage.trim()}
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
                    {myCharacters.map(char => (
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
    </div>
  );
}
