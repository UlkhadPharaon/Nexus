import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import {Shield, RefreshCw, Search, ChevronRight, User as UserIcon, Bot, ArrowLeft, MessageSquare, Clock, PlusCircle, Sparkles, Wand2, Loader2, Save} from 'lucide-react';
import { collection, getDocs, query, where, Timestamp, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { User, Character, Conversation, Message, LoreEntry, Scenario } from '../types';
import toast from 'react-hot-toast';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CATEGORIES, COLORS } from '../utils/helpers';
import { streamChatCompletion } from '../services/aiService';
import { uploadCharacterPreview } from '../services/storage';
import { createCharacter } from '../services/firestore';

const ADMIN_EMAIL = 'ulrichtapsoba2009@gmail.com';

export default function AdminPage() {
  const { user, isLoading } = useAuthStore();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<'users' | 'populate'>('users');

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      toast.error('Accès refusé');
      navigate('/');
      return;
    }

    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const usersData = snap.docs.map(doc => ({ ...doc.data() } as User));
        // Sort by most recently active or alphabetically
        usersData.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setUsers(usersData);
      } catch (err) {
        console.error(err);
        toast.error("Erreur de chargement des utilisateurs.");
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [user, isLoading, navigate]);

  if (isLoading || !user || user.email !== ADMIN_EMAIL) return null;

  const filteredUsers = users.filter(u => 
    (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto text-white flex flex-col h-[calc(100vh-64px)]">
      <div className="flex items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-500" />
            <h1 className="text-2xl md:text-3xl font-bold font-serif">Tableau de Bord Admin</h1>
          </div>
          
          <div className="hidden md:flex bg-surface-900 p-1 rounded-lg border border-white/5">
            <button 
              onClick={() => setActiveView('users')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'users' ? 'bg-primary-500 text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
            >
              Utilisateurs
            </button>
            <button 
              onClick={() => setActiveView('populate')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'populate' ? 'bg-primary-500 text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
            >
              Peuplement Explorer
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-primary-400 bg-primary-500/10 border-primary-500/20">
            {users.length} Utilisateurs
          </Badge>
        </div>
      </div>

      {activeView === 'users' ? (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6">
          {/* Left Sidebar - Users List */}
          <div className={`w-full md:w-80 flex-shrink-0 flex-col bg-surface-900 border border-white/5 rounded-sm overflow-hidden ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-white/5 bg-surface-950/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input 
                  placeholder="Rechercher..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 text-sm bg-surface-800"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
              {loadingUsers ? (
                 <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-primary-400" /></div>
              ) : filteredUsers.length === 0 ? (
                 <div className="text-center text-text-muted text-sm py-8">Aucun utilisateur</div>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-800 transition-colors border-l-2 ${selectedUser?.uid === u.uid ? 'border-primary-500 bg-surface-800' : 'border-transparent'}`}
                  >
                    <Avatar src={u.photoURL} alt={u.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{u.displayName || 'Sans nom'}</div>
                      <div className="text-xs text-text-muted truncate">{u.email}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - User Details */}
          <div className={`flex-1 flex-col bg-surface-900 border border-white/5 rounded-sm overflow-hidden ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
            {selectedUser ? (
              <AdminUserDetail userProfile={selectedUser} onBack={() => setSelectedUser(null)} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
                <UserIcon className="w-12 h-12 mb-4 opacity-20" />
                <p>Sélectionnez un utilisateur pour voir les détails</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <CharacterPopulator />
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------- //
// Subcomponent for User Details (Characters, Convos, Messages)
// -------------------------------------------------------------------------------- //

// -------------------------------------------------------------------------------- //
// Character Populator Component
// -------------------------------------------------------------------------------- //

function CharacterPopulator() {
  const { user } = useAuthStore();
  const [theme, setTheme] = useState('');
  const [batchSize, setBatchSize] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState<number | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState<number | null>(null);
  
  const [generatedCharacters, setGeneratedCharacters] = useState<any[]>([]);

  const handleGenerateAI = async () => {
    if (!theme.trim()) {
      toast.error("Veuillez entrer un thème pour la génération.");
      return;
    }
    setIsGenerating(true);
    setGeneratedCharacters([]);
    
    // We request an array of characters
    const prompt = `You are a professional character designer. Based on the theme: "${theme}", create ${batchSize} different detailed characters for a chat app. They should be variations or distinct concepts fitting the theme.
    Return ONLY a JSON array of objects with this structure:
    [
      {
        "name": "string",
        "tagline": "short catchy description",
        "category": "one of ${CATEGORIES.join(', ')}",
        "tags": "tag1, tag2",
        "personality": "detailed character traits",
        "backstory": "history",
        "universe": "context of their world",
        "speakingStyle": "how they talk",
        "firstMessage": "initial greeting",
        "avatarColor": "one of ${COLORS.slice(0, 10).join(', ')}"
      }
    ]
    The characters must be unique and interesting. Use French for all text fields. IMPORTANT: Only return the raw JSON array, without any markdown formatting like \`\`\`json or \`\`\`.`;

    try {
      let fullText = '';
      await streamChatCompletion(
        [{ role: 'system', content: prompt }],
        'mistral-small', // Use a faster, non-reasoning model for batch JSON generation
        (chunk) => { 
            fullText += chunk;
        },
        () => {
          try {
            // Robust parsing: try to extract JSON array if markdown is present anyway
            let cleanText = fullText.trim();
            if (cleanText.startsWith('```json')) {
              cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
            }

            // Find the array part in the response
            const match = cleanText.match(/\[[\s\S]*\]/);
            if (match) {
              const data = JSON.parse(match[0]);
              if (Array.isArray(data)) {
                 // Initialize properties for UI state
                 const charactersWithState = data.map((char: any, index: number) => ({
                    ...char,
                    id: `temp_${index}_${Date.now()}`,
                    avatarUrl: '',
                    isNSFW: false,
                    // apply default if missing
                    avatarColor: char.avatarColor || COLORS[index % COLORS.length],
                    category: CATEGORIES.includes(char.category) ? char.category : CATEGORIES[0]
                 }));
                 setGeneratedCharacters(charactersWithState);
                 toast.success(`${charactersWithState.length} personnages générés !`);
              } else {
                 throw new Error("L'IA n'a pas renvoyé un tableau.");
              }
            } else {
               throw new Error("Format JSON invalide.");
            }
          } catch (e: any) {
            console.error("JSON Parse Error:", e, fullText);
            toast.error("Erreur lors de l'analyse de la réponse IA. Veuillez réessayer.");
          } finally {
            setIsGenerating(false);
          }
        },
        (err) => {
          toast.error("Erreur IA: " + err.message);
          setIsGenerating(false);
        }
      );
    } catch (err: any) {
      toast.error(err.message);
      setIsGenerating(false);
    }
  };

  const generateAvatarIA = async (index: number) => {
    const char = generatedCharacters[index];
    if (!char.name) return;
    
    setIsGeneratingAvatar(index);
    try {
      const prompt = `Artistic portrait of ${char.name}, ${char.tagline}, ${char.universe}. Highly detailed, 4k, digital art, cinematic lighting.`;
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, width: 1024, height: 1024, steps: 4 })
      });
      
      if (!res.ok) throw new Error("Erreur génération image");
      const data = await res.json();
      
      const b64 = data.data?.[0]?.b64_json || data.data?.[0]?.base64 || data.image;
      
      if (b64) {
        const byteCharacters = atob(b64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, {type: 'image/png'});
        const file = new File([blob], `admin_char_batch_${Date.now()}.png`, { type: 'image/png' });
        
        const url = await uploadCharacterPreview(`admin_populate_batch_${Date.now()}`, file);
        
        // Update specific character
        setGeneratedCharacters(prev => {
          const newArr = [...prev];
          newArr[index] = { ...newArr[index], avatarUrl: url };
          return newArr;
        });
        toast.success(`Avatar généré pour ${char.name} !`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGeneratingAvatar(null);
    }
  };

  const handleSave = async (index: number) => {
    if (!user) return;
    const char = generatedCharacters[index];
    if (!char.name || !char.personality) {
      toast.error("Le nom et la personnalité sont obligatoires.");
      return;
    }
    
    setIsSaving(index);
    try {
      const tagsArray = typeof char.tags === 'string' 
        ? char.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
        : Array.isArray(char.tags) ? char.tags : [];

      await createCharacter({
        creatorId: user.uid,
        name: char.name,
        tagline: char.tagline,
        description: char.personality,
        avatarUrl: char.avatarUrl,
        avatarColor: char.avatarColor,
        category: char.category,
        tags: tagsArray,
        isPublic: true,
        isNSFW: char.isNSFW,
        stats: { conversationCount: 0, messageCount: 0, likes: 0 },
        persona: {
          personality: char.personality,
          backstory: char.backstory,
          universe: char.universe,
          speakingStyle: char.speakingStyle,
          firstMessage: char.firstMessage || `Bonjour, je suis ${char.name}.`,
          exampleDialogues: [],
          systemPromptAddons: ''
        }
      });
      toast.success(`${char.name} publié avec succès !`);
      
      // Remove published character from the list
      setGeneratedCharacters(prev => prev.filter((_, i) => i !== index));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(null);
    }
  };

  const updateCharacterField = (index: number, field: string, value: any) => {
    setGeneratedCharacters(prev => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  return (
    <div className="p-6 animate-fade-in bg-surface-950/20 rounded-xl mt-4">
      {/* Configuration & AI Assistant */}
      <div className="bg-surface-900 p-6 rounded-sm border border-white/5 space-y-4 shadow-xl mb-8">
        <div className="flex items-center gap-2 mb-2 text-primary-400">
          <Wand2 className="w-5 h-5" />
          <h2 className="font-bold font-serif text-xl">Création par Lot (Batch)</h2>
        </div>
        <p className="text-sm text-text-muted">Décrivez un thème et générez plusieurs variantes de personnages en une seule fois.</p>
        
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <label className="text-xs text-text-muted uppercase font-bold tracking-wider">Thème Global</label>
            <Input 
              placeholder="Ex: Cyberpunk, Chevaliers de la table ronde, Super-héros déchus..."
              value={theme}
              onChange={e => setTheme(e.target.value)}
              className="bg-surface-950 border-white/10"
            />
          </div>
          <div className="w-full md:w-32 space-y-2">
             <label className="text-xs text-text-muted uppercase font-bold tracking-wider">Quantité</label>
             <select 
                className="w-full h-10 bg-surface-950 border border-white/10 px-3 rounded-sm text-sm outline-none"
                value={batchSize}
                onChange={e => setBatchSize(Number(e.target.value))}
             >
                {[1, 3, 5, 10, 15].map(v => <option key={v} value={v}>{v} Personnages</option>)}
             </select>
          </div>
          <Button onClick={handleGenerateAI} isLoading={isGenerating} className="w-full md:w-auto shrink-0 md:px-8 h-10 shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
            <Sparkles className="w-4 h-4 mr-2" />
            Générer
          </Button>
        </div>
      </div>

      {generatedCharacters.length > 0 && (
         <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-bold flex items-center gap-2 text-white">
                  <Bot className="w-5 h-5 text-primary-400" /> 
                  Résultats ({generatedCharacters.length})
                </h3>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {generatedCharacters.map((char, index) => (
                <div key={char.id} className="bg-surface-900 border border-white/5 rounded-sm p-5 shadow-lg flex flex-col transition-all hover:border-white/10">
                   <div className="flex gap-4 items-start mb-4">
                      <div className="relative group shrink-0">
                        <Avatar src={char.avatarUrl} fallbackColor={char.avatarColor} alt={char.name} size="xl" className="border-2 border-primary-500/20" />
                        <button 
                          onClick={() => generateAvatarIA(index)}
                          disabled={isGeneratingAvatar === index}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-sm disabled:opacity-50"
                          title="Générer l'avatar"
                        >
                          {isGeneratingAvatar === index ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Sparkles className="w-6 h-6 text-white" />}
                        </button>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                         <Input 
                           value={char.name} 
                           onChange={e => updateCharacterField(index, 'name', e.target.value)} 
                           className="bg-surface-950 font-bold h-9"
                         />
                         <Input 
                           value={char.tagline} 
                           onChange={e => updateCharacterField(index, 'tagline', e.target.value)} 
                           className="bg-surface-950 text-sm h-8"
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 mb-4">
                      <select 
                        className="w-full bg-surface-950 border border-white/10 p-2 rounded-sm text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                        value={char.category}
                        onChange={e => updateCharacterField(index, 'category', e.target.value)}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Input 
                        placeholder="Tags" value={char.tags}
                        onChange={e => updateCharacterField(index, 'tags', e.target.value)}
                        className="bg-surface-950 h-8 text-xs"
                      />
                   </div>

                   <div className="space-y-3 flex-1">
                      <Textarea 
                        label="Personnalité & Traits" value={char.personality} rows={2}
                        onChange={e => updateCharacterField(index, 'personality', e.target.value)}
                        className="bg-surface-950 text-xs"
                      />
                      <Textarea 
                        label="Univers & Contexte" value={char.universe} rows={2}
                        onChange={e => updateCharacterField(index, 'universe', e.target.value)}
                        className="bg-surface-950 text-xs"
                      />
                      <Textarea 
                        label="Premier Message" value={char.firstMessage} rows={2}
                        onChange={e => updateCharacterField(index, 'firstMessage', e.target.value)}
                        className="bg-surface-950 text-xs border-primary-500/20"
                      />
                   </div>

                   <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" checked={char.isNSFW}
                          onChange={e => updateCharacterField(index, 'isNSFW', e.target.checked)}
                          className="w-4 h-4 accent-red-500 rounded bg-surface-950 border-white/10"
                        />
                        <span className="text-xs font-bold text-red-500">NSFW (18+)</span>
                      </label>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setGeneratedCharacters(prev => prev.filter((_, i) => i !== index))} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                           Retirer
                        </Button>
                        <Button size="sm" onClick={() => handleSave(index)} isLoading={isSaving === index}>
                           <Save className="w-4 h-4 mr-2" /> Publier
                        </Button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
         </div>
      )}
    </div>
  );
}

function AdminUserDetail({ userProfile, onBack }: { userProfile: User, onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<'chars' | 'convos'>('chars');

  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const charsSnap = await getDocs(query(collection(db, 'characters'), where('creatorId', '==', userProfile.uid)));
        setCharacters(charsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Character)));

        const convosSnap = await getDocs(query(collection(db, 'conversations'), where('userId', '==', userProfile.uid)));
        setConversations(convosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation)));
      } catch (err) {
        toast.error("Erreur de chargement des données");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userProfile.uid]);

  const handleViewMessages = async (convo: Conversation) => {
    setSelectedConvo(convo);
    setLoadingMsgs(true);
    try {
      const msgsSnap = await getDocs(collection(db, `conversations/${convo.id}/messages`));
      const msgsData = msgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      msgsData.sort((a,b) => {
        const timeA = a.timestamp instanceof Timestamp ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp instanceof Timestamp ? b.timestamp.toMillis() : 0;
        return timeA - timeB;
      });
      setMessages(msgsData);
    } catch(err) {
      toast.error("Erreur lors de la lecture des messages");
    } finally {
      setLoadingMsgs(false);
    }
  };

  if (selectedConvo) {
    return (
      <div className="flex flex-col h-full bg-surface-950">
        <div className="p-4 border-b border-white/5 bg-surface-900 flex items-center gap-3 shrink-0">
          <Button variant="ghost" onClick={() => setSelectedConvo(null)} className="w-9 h-9 p-0 flex items-center justify-center shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="font-bold text-sm">Conversation avec {selectedConvo.characterName}</div>
            <div className="text-xs text-text-muted">ID: {selectedConvo.id}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingMsgs ? (
            <div className="flex justify-center p-8"><RefreshCw className="w-5 h-5 animate-spin text-primary-400" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8">Aucun message</div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-sm px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary-600/20 text-primary-100 border border-primary-500/30' : 'bg-surface-800 border border-white/5 text-text-primary'} ${msg.isDeleted ? 'opacity-40 grayscale border-dashed border-red-500/50' : ''}`}>
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div className="text-[10px] text-text-muted opacity-50 uppercase">{msg.role === 'user' ? userProfile.displayName : selectedConvo.characterName}</div>
                    {msg.isDeleted && <span className="text-[8px] font-bold text-red-500 tracking-tighter">MESSAGE SUPPRIMÉ</span>}
                  </div>
                  <div>{msg.content}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Profile Header */}
      <div className="p-6 border-b border-white/5 shrink-0 bg-surface-900/50">
        <div className="flex items-start gap-4">
          <Button variant="ghost" onClick={onBack} className="md:hidden shrink-0 w-9 h-9 p-0 flex items-center justify-center mt-1 sm:mt-2">
             <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <Avatar src={userProfile.photoURL} alt={userProfile.displayName} size="lg" className="border-2 border-primary-500/50" />
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold truncate">{userProfile.displayName}</h2>
            <div className="text-sm text-text-muted">{userProfile.email} • UID: {userProfile.uid}</div>
            {userProfile.bio && <p className="text-sm mt-2 text-text-secondary bg-surface-950 p-2 rounded-sm border border-white/5 line-clamp-2">{userProfile.bio}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 shrink-0">
        <button 
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chars' ? 'border-primary-500 text-primary-400 bg-surface-800' : 'border-transparent text-text-muted hover:bg-surface-800'}`}
          onClick={() => setActiveTab('chars')}
        >
          <Bot className="w-4 h-4 inline-block mr-2" />
          Personnages ({characters.length})
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'convos' ? 'border-primary-500 text-primary-400 bg-surface-800' : 'border-transparent text-text-muted hover:bg-surface-800'}`}
          onClick={() => setActiveTab('convos')}
        >
          <MessageSquare className="w-4 h-4 inline-block mr-2" />
          Discussions ({conversations.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-surface-950/20">
        {loading ? (
          <div className="flex justify-center p-8"><RefreshCw className="w-5 h-5 animate-spin text-primary-400" /></div>
        ) : activeTab === 'chars' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.length === 0 ? <p className="col-span-full text-center text-text-muted py-8 text-sm">Aucun personnage créé.</p> : characters.map(char => (
              <div key={char.id} className="bg-surface-900 border border-white/5 p-4 rounded-sm flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Avatar src={char.avatarUrl} fallbackColor={char.avatarColor} alt={char.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-sm truncate">{char.name}</div>
                      {char.isDeleted && <Badge variant="outline" className="text-[9px] py-0 border-red-500/30 text-red-500 bg-red-500/5">SUPPRIMÉ</Badge>}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">{char.category}</div>
                  </div>
                  {char.isPublic ? <Badge variant="outline" className="text-[10px] py-0 border-green-500/30 text-green-400">Public</Badge> : <Badge variant="outline" className="text-[10px] py-0">Privé</Badge>}
                </div>
                <p className="text-xs text-text-secondary line-clamp-2 mt-1 flex-1">{char.tagline}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.length === 0 ? <p className="text-center text-text-muted py-8 text-sm">Aucune discussion ouverte.</p> : conversations.map(convo => (
              <div key={convo.id} className="bg-surface-900 border border-white/5 p-4 rounded-sm flex items-center justify-between group">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center shrink-0 border border-white/5">
                    <Bot className="w-5 h-5 text-primary-500/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="font-bold text-sm truncate text-white">{convo.characterName}</div>
                        {convo.isDeleted && <Badge variant="outline" className="text-[9px] py-0 border-red-500/30 text-red-500">SUPPRIMÉ</Badge>}
                    </div>
                    <div className="text-xs text-text-secondary truncate mt-0.5">{convo.lastMessage || 'Nouvelle conversation'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 shrink-0 pl-2 sm:pl-4">
                  {convo.lastMessageAt && (
                    <div className="text-[10px] text-text-muted hidden sm:flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(convo.lastMessageAt.toDate(), { addSuffix: true, locale: fr })}
                    </div>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleViewMessages(convo)} className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity px-2 sm:px-3">
                    <span className="hidden sm:inline">Inspecter</span> <ChevronRight className="w-4 h-4 sm:ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
