import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { useAuthStore } from '../stores/authStore';
import { getUserCharacters, deleteCharacter, getUniverses, createUniverse, searchUsers, getPublicCharacters, getConversations, createConversation, getLoreEntries, createLoreEntry, getUniverseRooms, createUniverseRoom } from '../services/firestore';
import { uploadGeneralImage } from '../services/storage';
import { Character, Universe, User, Conversation, LoreEntry, UniverseRoom } from '../types';
import { CharacterCard } from '../components/character/CharacterCard';
import { Sparkles, Loader2, Plus, Globe, Users, ScrollText, Image as ImageIcon, Search, Info, MessageSquare, Book, Map as MapIcon, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";

export default function MyUniversePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'characters' | 'worlds'>('worlds');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorld, setNewWorld] = useState({
    name: '',
    description: '',
    rules: '',
    backgroundImageUrl: '',
    isPublic: true
  });
  const [isCreating, setIsCreating] = useState(false);
  
  // Invite state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);

  // Edit universe state
  const [editingWorld, setEditingWorld] = useState<Universe | null>(null);
  const [editingTab, setEditingTab] = useState<'general' | 'lore' | 'rooms'>('general');
  const [worldLore, setWorldLore] = useState<LoreEntry[]>([]);
  const [worldRooms, setWorldRooms] = useState<UniverseRoom[]>([]);
  const [isLoreLoading, setIsLoreLoading] = useState(false);
  const [newLore, setNewLore] = useState({ title: '', content: '', category: 'general' as LoreEntry['category'], keywords: '' });
  const [newRoom, setNewRoom] = useState({ name: '', description: '', backgroundImageUrl: '' });

  const [isGeneratingImg, setIsGeneratingImg] = useState(false);

  const generateUniverseImage = async (isRoom: boolean = false) => {
    const target = isRoom ? newRoom : newWorld;
    if (!target.name || !target.description) {
      toast.error("Veuillez remplir le nom et la description d'abord.");
      return;
    }
    
    setIsGeneratingImg(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const expansionResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Génère un prompt de génération d'image épique et immersif pour l'arrière-plan d'un ${isRoom ? 'lieu spécifique' : 'univers'} appelé "${target.name}".
        Description : ${target.description}
        ${!isRoom ? `Univers Global : ${newWorld.name}` : ''}

        Directives :
        - Style : Illustration concept art professionnelle, haute résolution, cinématique.
        - Composition : Angle large, atmosphère riche, détails immersifs.
        - Langue : Prompt en ANGLAIS.
        - Sortie : UNIQUEMENT le texte du prompt.`,
      });

      const expandedPrompt = expansionResponse.text?.trim() || `Atmospheric background for ${target.name}, ${target.description}, high quality concept art.`;

      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: expandedPrompt,
          width: 1024,
          height: 1024,
          seed: Math.floor(Math.random() * 1000000),
          steps: 4
        })
      });

      if (!res.ok) throw new Error("Erreur de génération d'image");
      const data = await res.json();
      
      const b64 = data.data?.[0]?.b64_json || data.data?.[0]?.base64 || data.artifacts?.[0]?.base64 || data.b64_json || data.image;
      
      if (b64) {
          // Convert b64 to file and upload
          const byteCharacters = atob(b64);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
            byteArrays.push(new Uint8Array(byteNumbers));
          }
          const blob = new Blob(byteArrays, {type: 'image/png'});
          const file = new File([blob], "bg.png", { type: 'image/png' });
          
          const path = `universes/${user?.uid}/${Date.now()}.png`;
          const imageUrl = await uploadGeneralImage(path, file);
          
          if (isRoom) {
            setNewRoom({ ...newRoom, backgroundImageUrl: imageUrl });
          } else {
            setNewWorld({ ...newWorld, backgroundImageUrl: imageUrl });
          }
          toast.success("Image générée et sauvegardée !");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Échec: " + err.message);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const fetchCharacters = async () => {
    if (user) {
      try {
        const data = await getUserCharacters(user.uid);
        setCharacters(data);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const fetchUniverses = async () => {
    if (user) {
      try {
        const data = await getUniverses(user.uid);
        setUniverses(data);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const fetchPublicCharacters = async () => {
    try {
      const data = await getPublicCharacters();
      setAvailableCharacters(data);
    } catch (e) {}
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCharacters(), fetchUniverses(), fetchPublicCharacters()]);
      setLoading(false);
    };
    init();
  }, [user]);

  const handleSearchUsers = async (val: string) => {
    setSearchQuery(val);
    if (val.length > 2) {
      const results = await searchUsers(val);
      setSearchResults(results.filter(u => u.uid !== user?.uid && !selectedParticipants.find(p => p.uid === u.uid)));
    } else {
      setSearchResults([]);
    }
  };

  const addParticipant = (u: User) => {
    setSelectedParticipants(prev => [...prev, u]);
    setSearchResults([]);
    setSearchQuery('');
  };

  const removeParticipant = (uid: string) => {
    setSelectedParticipants(prev => prev.filter(p => p.uid !== uid));
  };

  const toggleCharacter = (c: Character) => {
    if (selectedCharacters.find(sc => sc.id === c.id)) {
      setSelectedCharacters(prev => prev.filter(sc => sc.id !== c.id));
    } else {
      setSelectedCharacters(prev => [...prev, c]);
    }
  };

  const handleCreateWorld = async () => {
    if (!user || !newWorld.name || !newWorld.description) {
      toast.error('Veuillez remplir les informations de base');
      return;
    }

    setIsCreating(true);
    try {
      const universeData: Omit<Universe, 'id' | 'createdAt' | 'updatedAt'> = {
        creatorId: user.uid,
        name: newWorld.name,
        description: newWorld.description,
        rules: newWorld.rules,
        backgroundImageUrl: newWorld.backgroundImageUrl,
        participantIds: selectedParticipants.map(p => p.uid),
        characterIds: selectedCharacters.map(c => c.id),
        isPublic: newWorld.isPublic
      };

      await createUniverse(universeData);
      toast.success('Univers créé avec succès');
      setShowCreateModal(false);
      fetchUniverses();
      
      // Reset form
      setNewWorld({ name: '', description: '', rules: '', backgroundImageUrl: '', isPublic: true });
      setSelectedParticipants([]);
      setSelectedCharacters([]);
    } catch (err) {
      toast.error('Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEnterUniverse = async (uni: Universe) => {
    if (!user) return;
    setIsCreating(true);
    try {
      // Find if there's already a conversation for this universe
      const convos = await getConversations(user.uid);
      const existing = convos.find(c => c.universeId === uni.id);
      
      if (existing) {
        navigate(`/chat/${existing.characterIds?.[0] || existing.characterId}?convoId=${existing.id}`);
        return;
      }

      // Create new shared conversation for this universe
      const convoData: Omit<Conversation, 'id' | 'createdAt' | 'lastMessageAt'> = {
        userId: user.uid,
        participantIds: Array.from(new Set([user.uid, ...uni.participantIds])),
        characterId: uni.characterIds[0] || 'none',
        characterIds: uni.characterIds,
        characterName: uni.name,
        characterAvatarUrl: uni.backgroundImageUrl || '',
        lastMessage: `Bienvenue dans l'univers ${uni.name}`,
        messageCount: 0,
        modelUsed: 'mistral-small',
        universeId: uni.id,
        isUniverseChat: true
      };

      const convoId = await createConversation(convoData);
      navigate(`/chat/${convoData.characterId}?convoId=${convoId}`);
    } catch (e) {
      toast.error("Erreur lors de l'accès à l'univers");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditor = async (uni: Universe) => {
    setEditingWorld(uni);
    setEditingTab('general');
    setIsLoreLoading(true);
    try {
      const [lore, rooms] = await Promise.all([
        getLoreEntries(uni.id),
        getUniverseRooms(uni.id)
      ]);
      setWorldLore(lore);
      setWorldRooms(rooms);
    } catch (e) {
      toast.error("Erreur de chargement des données");
    } finally {
      setIsLoreLoading(false);
    }
  };

  const handleAddLore = async () => {
    if (!editingWorld || !newLore.title || !newLore.content) return;
    try {
      await createLoreEntry(editingWorld.id, {
        title: newLore.title,
        content: newLore.content,
        category: newLore.category,
        keywords: newLore.keywords.split(',').map(k => k.trim()),
      });
      toast.success("Codex mis à jour");
      setNewLore({ title: '', content: '', category: 'general', keywords: '' });
      const lore = await getLoreEntries(editingWorld.id);
      setWorldLore(lore);
    } catch (e) {
      toast.error("Erreur d'ajout");
    }
  };

  const handleAddRoom = async () => {
    if (!editingWorld || !newRoom.name || !newRoom.backgroundImageUrl) return;
    try {
      await createUniverseRoom(editingWorld.id, {
        name: newRoom.name,
        description: newRoom.description,
        backgroundImageUrl: newRoom.backgroundImageUrl
      });
      toast.success("Lieu ajouté");
      setNewRoom({ name: '', description: '', backgroundImageUrl: '' });
      const rooms = await getUniverseRooms(editingWorld.id);
      setWorldRooms(rooms);
    } catch (e) {
      toast.error("Erreur d'ajout");
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    try {
      await deleteCharacter(characterId);
      toast.success('Personnage supprimé');
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      setDeletingId(null);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <PageWrapper className="pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-1">Mon Univers</h1>
            <p className="text-text-muted text-sm italic font-serif">Gérez vos créations et vos mondes partagés.</p>
          </div>
          <div className="flex bg-surface-900 p-1 rounded-sm border border-white/5 self-start sm:self-center">
            <button 
              onClick={() => setActiveTab('worlds')}
              className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'worlds' ? 'bg-primary-600 text-surface-950' : 'text-text-secondary hover:text-white'}`}
            >
              <Globe className="w-4 h-4" />
              Mes Mondes
            </button>
            <button 
              onClick={() => setActiveTab('characters')}
              className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'characters' ? 'bg-primary-600 text-surface-950' : 'text-text-secondary hover:text-white'}`}
            >
              <Sparkles className="w-4 h-4" />
              Mes Personnages
            </button>
          </div>
        </div>
        
        {activeTab === 'characters' ? (
          <>
            {characters.length === 0 ? (
              <div className="glass-card p-12 text-center border-white/5 bg-surface-900/40">
                <h2 className="text-xl font-serif font-bold mb-2">Aucun personnage</h2>
                <p className="text-text-secondary font-light mb-6">Vous n'avez pas encore créé de personnage.</p>
                <Button onClick={() => navigate('/create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un personnage
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {characters.map((char, i) => (
                  <CharacterCard 
                    key={char.id} 
                    character={char} 
                    index={i} 
                    onDelete={(id) => setDeletingId(id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-serif font-bold text-primary-400">Vos Mondes Partagés</h2>
              <Button onClick={() => setShowCreateModal(true)} className="rounded-sm">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Monde
              </Button>
            </div>

            {universes.length === 0 ? (
              <div className="glass-card p-12 text-center border-white/5 bg-surface-900/40">
                <div className="w-16 h-16 bg-surface-800 rounded-sm flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <Globe className="w-8 h-8 text-primary-500 opacity-50" />
                </div>
                <h3 className="text-xl font-serif font-bold mb-2">Aucun monde créé</h3>
                <p className="text-text-secondary font-light max-w-md mx-auto mb-8">
                  Les mondes vous permettent de définir des règles globales et d'inviter d'autres joueurs pour des jeux de rôle immersifs.
                </p>
                <Button variant="ghost" onClick={() => setShowCreateModal(true)}>
                  Lancer mon premier univers
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {universes.map(world => (
                  <div key={world.id} className="glass-card p-6 border-white/5 bg-surface-900/60 hover:bg-surface-800/80 transition-all group flex flex-col h-full relative overflow-hidden">
                    {world.backgroundImageUrl && (
                      <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                         <img src={world.backgroundImageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-primary-500/10 rounded-sm border border-primary-500/20">
                          <Globe className="w-6 h-6 text-primary-400" />
                        </div>
                        <Badge variant={world.isPublic ? 'accent' : 'outline'} className="rounded-sm">
                          {world.isPublic ? 'Public' : 'Privé'}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold font-serif mb-2 group-hover:text-primary-400 transition-colors uppercase tracking-tight">{world.name}</h3>
                      <p className="text-text-secondary text-sm mb-6 line-clamp-3 font-light leading-relaxed">{world.description}</p>
                      
                      <div className="mt-auto space-y-4">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                             <Users className="w-4 h-4 text-text-muted" />
                             <span className="text-xs text-text-secondary font-medium">{world.participantIds.length + 1} Participants</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <Sparkles className="w-4 h-4 text-text-muted" />
                             <span className="text-xs text-text-secondary font-medium">{world.characterIds.length} Personnages AI</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 flex gap-2">
                          <Button variant="outline" className="flex-1 text-xs h-9 rounded-sm uppercase tracking-wider" onClick={() => handleEnterUniverse(world)}>
                             <MessageSquare className="w-3.5 h-3.5 mr-2" />
                             Entrer
                          </Button>
                          <Button variant="ghost" className="text-xs h-9 rounded-sm uppercase tracking-wider" onClick={() => handleOpenEditor(world)}>
                             Editer
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Création de Monde */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
            <div className="bg-surface-950 border border-white/10 p-8 rounded-sm max-w-3xl w-full shadow-2xl my-8">
              <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                <h3 className="text-2xl font-serif font-bold flex items-center gap-3 uppercase tracking-tighter">
                  <Globe className="w-6 h-6 text-primary-400" />
                  Générer un Nouvel Univers
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-text-muted hover:text-white transition-colors">
                  Fermer
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block">Nom du Monde</label>
                    <Input 
                      placeholder="Ex: Néo-Paris 2099" 
                      className="bg-surface-900 border-white/10 h-10 rounded-sm"
                      value={newWorld.name}
                      onChange={e => setNewWorld({...newWorld, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block">Synopsis & Description</label>
                    <textarea 
                      placeholder="Décrivez l'univers, son atmosphère..." 
                      className="w-full bg-surface-900 border border-white/10 rounded-sm p-3 text-sm min-h-[120px] focus:outline-none focus:border-primary-500 transition-colors"
                      value={newWorld.description}
                      onChange={e => setNewWorld({...newWorld, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block flex items-center gap-2">
                       <ScrollText className="w-4 h-4" />
                       Règles Fondamentales
                    </label>
                    <textarea 
                      placeholder="Les lois physiques, sociales ou tabous de cet univers..." 
                      className="w-full bg-surface-900 border border-white/10 rounded-sm p-3 text-xs min-h-[100px] focus:outline-none focus:border-primary-500 transition-colors font-mono"
                      value={newWorld.rules}
                      onChange={e => setNewWorld({...newWorld, rules: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block flex items-center justify-between">
                       <span className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Arrière-plan
                       </span>
                       <button 
                        onClick={() => generateUniverseImage(false)}
                        disabled={isGeneratingImg}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                       >
                        {isGeneratingImg ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                        Générer avec l'IA
                       </button>
                    </label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="URL de l'image" 
                        className="bg-surface-900 border-white/10 h-10 rounded-sm flex-1"
                        value={newWorld.backgroundImageUrl}
                        onChange={e => setNewWorld({...newWorld, backgroundImageUrl: e.target.value})}
                      />
                      {newWorld.backgroundImageUrl && (
                        <div className="w-10 h-10 rounded-sm overflow-hidden border border-white/10 shrink-0">
                          <img src={newWorld.backgroundImageUrl} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block flex items-center gap-2">
                       <Users className="w-4 h-4" />
                       Inviter des Humains
                    </label>
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <Input 
                        placeholder="Rechercher par nom..." 
                        className="pl-10 bg-surface-900 border-white/10 h-10 rounded-sm"
                        value={searchQuery}
                        onChange={e => handleSearchUsers(e.target.value)}
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-800 border border-white/10 rounded-sm z-50 overflow-hidden shadow-2xl">
                          {searchResults.map(u => (
                            <button 
                              key={u.uid}
                              onClick={() => addParticipant(u)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-primary-500/10 transition-colors border-b border-white/5 last:border-0"
                            >
                              <Avatar src={u.photoURL} alt={u.displayName} size="xs" />
                              <span className="text-sm font-medium">{u.displayName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedParticipants.map(participant => (
                        <Badge key={participant.uid} className="bg-surface-800 border-white/10 px-2 py-1 flex items-center gap-2 rounded-sm text-[10px]">
                          {participant.displayName}
                          <button onClick={() => removeParticipant(participant.uid)} className="hover:text-red-400">×</button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block flex items-center gap-2">
                       <Sparkles className="w-4 h-4" />
                       Peupler l'Univers (Personnages)
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2 p-3 bg-surface-900/50 border border-white/5 rounded-sm max-h-[160px] overflow-y-auto scrollbar-hide">
                      {availableCharacters.map(char => (
                        <button
                          key={char.id}
                          onClick={() => toggleCharacter(char)}
                          className={`relative aspect-square rounded-sm overflow-hidden border-2 transition-all ${selectedCharacters.find(sc => sc.id === char.id) ? 'border-primary-500 scale-95 shadow-lg shadow-primary-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-1">
                             <span className="text-[8px] font-bold text-white truncate w-full">{char.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-text-muted italic"><Info className="w-3 h-3 inline mr-1" /> Cliquez sur les personnages pour les ajouter ou les retirer de l'univers.</p>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <Button 
                      className="w-full rounded-sm h-12 uppercase tracking-widest text-sm shadow-xl shadow-primary-500/10" 
                      onClick={handleCreateWorld}
                      disabled={isCreating}
                    >
                      {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Matérialiser l\'Univers'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Edition de Monde */}
        {editingWorld && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 backdrop-blur-xl overflow-y-auto">
            <div className="bg-surface-950 border border-white/10 p-4 sm:p-8 rounded-sm max-w-5xl w-full shadow-2xl my-8 min-h-[80vh]">
              <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-2xl font-serif font-bold uppercase tracking-tighter flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-primary-400" />
                    Configuration de l'Univers : {editingWorld.name}
                  </h3>
                </div>
                <button onClick={() => setEditingWorld(null)} className="text-text-muted hover:text-white transition-colors">
                   Fermer
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                {/* Tabs Sidebar */}
                <div className="w-full md:w-48 space-y-2 shrink-0">
                  <button 
                    onClick={() => setEditingTab('general')}
                    className={`w-full text-left px-4 py-2 rounded-sm text-sm font-medium transition-all flex items-center gap-2 ${editingTab === 'general' ? 'bg-primary-600 text-surface-950 shadow-lg shadow-primary-500/20' : 'text-text-secondary hover:bg-white/5'}`}
                  >
                    <Globe className="w-4 h-4" />
                    Général
                  </button>
                  <button 
                    onClick={() => setEditingTab('lore')}
                    className={`w-full text-left px-4 py-2 rounded-sm text-sm font-medium transition-all flex items-center gap-2 ${editingTab === 'lore' ? 'bg-primary-600 text-surface-950 shadow-lg shadow-primary-500/20' : 'text-text-secondary hover:bg-white/5'}`}
                  >
                    <Book className="w-4 h-4" />
                    Codex (Lore)
                  </button>
                  <button 
                    onClick={() => setEditingTab('rooms')}
                    className={`w-full text-left px-4 py-2 rounded-sm text-sm font-medium transition-all flex items-center gap-2 ${editingTab === 'rooms' ? 'bg-primary-600 text-surface-950 shadow-lg shadow-primary-500/20' : 'text-text-secondary hover:bg-white/5'}`}
                  >
                    <MapIcon className="w-4 h-4" />
                    Lieux (Rooms)
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 min-h-[500px]">
                  {editingTab === 'general' && (
                    <div className="space-y-6 animate-fade-in">
                       <p className="text-text-secondary text-sm italic">Modifiez les paramètres de base de votre monde.</p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                           <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block">Description Globale</label>
                           <textarea 
                             className="w-full bg-surface-900 border border-white/10 rounded-sm p-4 text-sm min-h-[150px] font-light"
                             defaultValue={editingWorld.description}
                           />
                         </div>
                         <div>
                           <label className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-2 block">Règles Systèmes</label>
                           <textarea 
                             className="w-full bg-surface-900 border border-white/10 rounded-sm p-4 text-xs min-h-[150px] font-mono"
                             defaultValue={editingWorld.rules}
                           />
                         </div>
                       </div>
                       <Button onClick={() => toast.success("Enregistré (Démo)")}>Sauvegarder les modifications</Button>
                    </div>
                  )}

                  {editingTab === 'lore' && (
                    <div className="space-y-6 animate-fade-in">
                       <div className="bg-surface-900/50 p-6 rounded-sm border border-white/5 mb-8">
                         <h4 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                           <Plus className="w-5 h-5 text-primary-400" />
                           Nouvelle Entrée du Codex
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                           <Input 
                             placeholder="Titre (ex: L'Ancienne Magie)" 
                             className="bg-surface-800 border-white/5"
                             value={newLore.title}
                             onChange={e => setNewLore({...newLore, title: e.target.value})}
                           />
                           <select 
                            className="bg-surface-800 border border-white/5 rounded-sm px-3 text-sm outline-none"
                            value={newLore.category}
                            onChange={e => setNewLore({...newLore, category: e.target.value as any})}
                           >
                             <option value="general">Général</option>
                             <option value="history">Histoire</option>
                             <option value="place">Lieu important</option>
                             <option value="magic">Magie/Techno</option>
                             <option value="object">Objet</option>
                           </select>
                         </div>
                         <textarea 
                            placeholder="Contenu détaillé de la connaissance..." 
                            className="w-full bg-surface-800 border border-white/5 rounded-sm p-3 text-sm min-h-[100px] mb-4"
                            value={newLore.content}
                            onChange={e => setNewLore({...newLore, content: e.target.value})}
                         />
                         <Input 
                            placeholder="Mots-clés (séparés par des virgules) - Triggers AI" 
                            className="bg-surface-800 border-white/5 mb-4 text-xs font-mono"
                            value={newLore.keywords}
                            onChange={e => setNewLore({...newLore, keywords: e.target.value})}
                         />
                         <Button onClick={handleAddLore} disabled={!newLore.title || !newLore.content}>
                           Inscrire dans le Codex
                         </Button>
                       </div>

                       <div className="space-y-4">
                         <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-text-muted">Entrées Existantes</h4>
                         {isLoreLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" /> : (
                           <div className="grid grid-cols-1 gap-4">
                             {worldLore.length === 0 && <p className="text-text-muted text-sm italic text-center p-8 bg-white/5 rounded-sm">Le codex est vide. Commencez à écrire l'histoire de votre monde.</p>}
                             {worldLore.map(entry => (
                               <div key={entry.id} className="p-4 bg-surface-900 border border-white/10 rounded-sm hover:border-primary-500/30 transition-all">
                                 <div className="flex items-center justify-between mb-2">
                                   <div className="flex items-center gap-3">
                                      <Badge variant="accent" className="rounded-sm uppercase text-[8px]">{entry.category}</Badge>
                                      <h5 className="font-serif font-bold text-primary-100">{entry.title}</h5>
                                   </div>
                                 </div>
                                 <p className="text-xs text-text-secondary line-clamp-2 font-light leading-relaxed mb-3">{entry.content}</p>
                                 <div className="flex gap-1">
                                    {entry.keywords.map(k => <span key={k} className="text-[9px] text-primary-500/50 font-mono">#{k}</span>)}
                                 </div>
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                    </div>
                  )}

                  {editingTab === 'rooms' && (
                    <div className="space-y-6 animate-fade-in">
                       <div className="bg-surface-900/50 p-6 rounded-sm border border-white/5 mb-8">
                         <h4 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                           <Plus className="w-5 h-5 text-indigo-400" />
                           Nouveau Lieu Dynamique
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                           <Input 
                             placeholder="Nom du lieu (ex: Salle du Trône)" 
                             className="bg-surface-800 border-white/5"
                             value={newRoom.name}
                             onChange={e => setNewRoom({...newRoom, name: e.target.value})}
                           />
                           <div className="flex gap-2">
                             <Input 
                               placeholder="URL de l'image d'ambiance" 
                               className="bg-surface-800 border-white/5 flex-1"
                               value={newRoom.backgroundImageUrl}
                               onChange={e => setNewRoom({...newRoom, backgroundImageUrl: e.target.value})}
                             />
                             <Button 
                               size="icon" 
                               variant="outline" 
                               className="h-10 w-10 shrink-0 border-white/10"
                               title="Générer avec l'IA"
                               onClick={(e) => { e.preventDefault(); generateUniverseImage(true); }}
                               disabled={isGeneratingImg}
                             >
                               {isGeneratingImg ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <Sparkles className="w-4 h-4 text-indigo-400" />}
                             </Button>
                           </div>
                         </div>
                         <textarea 
                            placeholder="Brève description de l'ambiance du lieu..." 
                            className="w-full bg-surface-800 border border-white/5 rounded-sm p-3 text-sm min-h-[80px] mb-4"
                            value={newRoom.description}
                            onChange={e => setNewRoom({...newRoom, description: e.target.value})}
                         />
                         <Button onClick={handleAddRoom} className="bg-indigo-600 hover:bg-indigo-500 border-indigo-500">
                           Matérialiser ce lieu
                         </Button>
                       </div>

                       <div className="space-y-4">
                         <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-text-muted">Lieux Découverts</h4>
                         {isLoreLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500" /> : (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {worldRooms.length === 0 && <p className="text-text-muted text-sm italic text-center p-8 bg-white/5 rounded-sm col-span-2">Aucun lieu spécifique créé pour cet univers.</p>}
                             {worldRooms.map(room => (
                               <div key={room.id} className="relative group aspect-[16/7] rounded-sm overflow-hidden border border-white/10">
                                 <img src={room.backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover grayscale-[50%] group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                                 <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                                 <div className="absolute bottom-0 left-0 p-4">
                                   <h5 className="font-serif font-bold text-white group-hover:text-indigo-300 transition-colors">{room.name}</h5>
                                   <p className="text-[10px] text-text-secondary line-clamp-1">{room.description}</p>
                                 </div>
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmation de suppression */}
        {deletingId && ( activeTab === 'characters' && (
          <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-surface-900 border border-white/10 p-6 rounded-sm max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-2">Supprimer le personnage ?</h3>
              <p className="text-text-secondary text-sm mb-6">Cette action est irréversible. Toutes les statistiques et l'existence du personnage dans votre univers seront supprimées.</p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setDeletingId(null)}>Annuler</Button>
                <Button variant="danger" className="flex-1" onClick={() => deletingId && handleDeleteCharacter(deletingId)}>Supprimer</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
