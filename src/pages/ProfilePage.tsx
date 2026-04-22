import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/Button';
import { Settings, Palette, Edit2, Sliders, Image as ImageIcon, Mic, Sparkles, Loader2, User as UserIcon } from 'lucide-react';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { updateUserBio, updateUserPreferences, updateUserPhoto, updateUserPersona } from '../services/firestore';
import { uploadAvatar } from '../services/storage';
import { UserPreferences, UserPersona } from '../types';
import { getVoices, Voice } from '../utils/ttsUtils';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [theme, setTheme] = useState<'romance' | 'cyber'>('romance');
  
  const [bio, setBio] = useState('');
  const [persona, setPersona] = useState<UserPersona>({
    name: '',
    age: '',
    appearance: '',
    mentality: '',
    background: ''
  });
  
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.9);
  const [ttsVoice, setTtsVoice] = useState<string>('21m00Tcm4TlvDq8ikWAM'); // Rachel
  const [chatBackgroundImage, setChatBackgroundImage] = useState<string>('');
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    // Initial fetch with server default
    getVoices().then(setVoices);
  }, []);

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      if (user.persona) {
        setPersona(user.persona);
      }
      if (user.preferences) {
        setTemperature(user.preferences.temperature ?? 0.7);
        setTopP(user.preferences.topP ?? 0.9);
        
        let voicePref = user.preferences.ttsVoice ?? '21m00Tcm4TlvDq8ikWAM';
        const legacyMap: Record<string, string> = {
          'Rachel': '21m00Tcm4TlvDq8ikWAM',
          'Drew': '29vD33N1CtxCmqQRPOHJ',
          'Clyde': '2EiwWnXFnvU5JabPnv8n',
          'Mimi': 'zrHiDhphv9ZnVBTuAHuD',
          'Fin': 'D38z5RcWu1voky8WS1ja'
        };
        if (legacyMap[voicePref]) {
          voicePref = legacyMap[voicePref];
        }
        setTtsVoice(voicePref);
        
        setChatBackgroundImage(user.preferences.chatBackgroundImage ?? '');
        setElevenlabsApiKey(user.preferences.elevenlabsApiKey ?? '');

        // Fetch voices with custom key if exists
        const key = user.preferences.elevenlabsApiKey;
        getVoices(key).then(setVoices);
      }
    }
  }, [user]);

  if (!user) return <div className="p-8 text-center text-white">Veuillez vous connecter.</div>;

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    try {
      const newPrefs: UserPreferences = {
        temperature,
        topP,
        ttsVoice,
        chatBackgroundImage,
        elevenlabsApiKey
      };
      await updateUserBio(user.uid, bio);
      await updateUserPersona(user.uid, persona);
      await updateUserPreferences(user.uid, newPrefs);
      
      setUser({
        ...user,
        bio,
        persona,
        preferences: newPrefs
      });

      toast.success("Profil mis à jour avec succès !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const generateUserAvatar = async () => {
    if (!user) return;
    setIsGeneratingAvatar(true);
    try {
      const prompt = `A professional artistic portrait of a ${user.displayName || 'fantasy persona'}, close-up shot, cinematic lighting, high quality, digital art style.`;
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          width: 1024,
          height: 1024,
          seed: Math.floor(Math.random() * 1000000),
          steps: 4
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur de génération");
      }
      
      const data = await res.json();
      
      // Robust b64 extraction for different API versions
      const b64 = 
        data.data?.[0]?.b64_json || 
        data.data?.[0]?.base64 || 
        data.artifacts?.[0]?.base64 || 
        data.b64_json || 
        data.image;
      
      if (b64) {
         const byteCharacters = atob(b64);
         const byteArrays = [];
         for (let offset = 0; offset < byteCharacters.length; offset += 512) {
           const slice = byteCharacters.slice(offset, offset + 512);
           const byteNumbers = new Array(slice.length);
           for (let i = 0; i < slice.length; i++) {
             byteNumbers[i] = slice.charCodeAt(i);
           }
           const byteArray = new Uint8Array(byteNumbers);
           byteArrays.push(byteArray);
         }
         const blob = new Blob(byteArrays, {type: 'image/png'});
         const file = new File([blob], `user_avatar_${Date.now()}.png`, { type: 'image/png' });
         
         const imageUrl = await uploadAvatar(user.uid, file);
         await updateUserPhoto(user.uid, imageUrl);
         
         setUser({ ...user, photoURL: imageUrl });
         toast.success("Avatar utilisateur généré !");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Échec: " + err.message);
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  return (
    <div className={`p-8 max-w-4xl mx-auto text-white theme-${theme}`}>
      <h1 className="text-4xl font-bold mb-8 font-serif">Mon Espace</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Profile & Bio */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-900 p-6 md:p-8 rounded-sm border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
              <div className="relative group">
                <img src={user.photoURL || undefined} alt={user.displayName} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-primary-500 shrink-0 object-cover" />
                <button 
                  onClick={generateUserAvatar}
                  disabled={isGeneratingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Générer un nouvel avatar avec l'IA"
                >
                  {isGeneratingAvatar ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
                </button>
              </div>
              <div className="flex-1 w-full relative">
                <h2 className="text-xl md:text-2xl font-bold">{user.displayName}</h2>
                <p className="text-text-muted text-sm md:text-base mb-2 sm:mb-0">{user.email}</p>
                <div className="flex items-center gap-2 mt-4 text-primary-400">
                  <UserIcon className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-widest">Configuration du Persona</span>
                </div>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Ces informations définissent *qui* vous êtes vis-à-vis de l'IA. Les personnages en tiendront compte durant les discussions pour vous répondre de manière plus personnalisée.
                </p>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="Nom / Pseudonyme" 
                  placeholder="Ex: Alexander, L'Étranger..." 
                  value={persona.name} 
                  onChange={(e) => setPersona({ ...persona, name: e.target.value })} 
                  className="bg-surface-950"
                />
                <Input 
                  label="Âge" 
                  placeholder="Ex: 25 ans, Immortel..." 
                  value={persona.age} 
                  onChange={(e) => setPersona({ ...persona, age: e.target.value })} 
                  className="bg-surface-950"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Physique & Apparence</label>
                <textarea 
                  className="w-full bg-surface-950 p-3 rounded-sm border border-white/5 text-sm text-text-secondary min-h-[60px] focus:ring-1 focus:ring-primary-500/50 outline-none transition-all" 
                  value={persona.appearance}
                  onChange={(e) => setPersona({ ...persona, appearance: e.target.value })}
                  placeholder="Ex: Cheveux bruns en bataille, porte souvent un long manteau noir..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Mentalité & Caractère</label>
                <textarea 
                  className="w-full bg-surface-950 p-3 rounded-sm border border-white/5 text-sm text-text-secondary min-h-[60px] focus:ring-1 focus:ring-primary-500/50 outline-none transition-all" 
                  value={persona.mentality}
                  onChange={(e) => setPersona({ ...persona, mentality: e.target.value })}
                  placeholder="Ex: Cynique mais au grand cœur. Se méfie des inconnus..."
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Background (Histoire passée)</label>
                <textarea 
                  className="w-full bg-surface-950 p-3 rounded-sm border border-white/5 text-sm text-text-secondary min-h-[60px] focus:ring-1 focus:ring-primary-500/50 outline-none transition-all" 
                  value={persona.background}
                  onChange={(e) => setPersona({ ...persona, background: e.target.value })}
                  placeholder="Ex: Ancien chevalier ayant perdu sa faction..."
                />
              </div>
            </div>
            
            <div className="pt-4 border-t border-white/5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted mb-2">Biographie (Visible par les autres joueurs)</h3>
              <textarea 
                className="w-full bg-surface-950 p-4 rounded-sm border border-white/5 text-text-secondary min-h-[80px] focus:ring-1 focus:ring-primary-500/50 outline-none transition-all" 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Parlez un peu de vous à la communauté..."
              />
            </div>
          </div>

          {/* AI Settings Section */}
          <div className="bg-surface-900 p-6 md:p-8 rounded-sm border border-white/5 space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Sliders className="w-5 h-5 text-primary-400" />
              <h3 className="font-bold text-lg font-serif">Paramètres de l'IA</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-text-secondary">Température (Créativité)</label>
                  <span className="text-sm text-primary-400 font-mono">{temperature.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0" max="2" step="0.1" 
                  value={temperature} 
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-primary-500"
                />
                <p className="text-xs text-text-muted mt-1">Une valeur plus élevée rend les réponses plus créatives et imprévisibles.</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-text-secondary">Top P (Diversité des mots)</label>
                  <span className="text-sm text-primary-400 font-mono">{topP.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={topP} 
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-primary-500"
                />
                <p className="text-xs text-text-muted mt-1">Contrôle le vocabulaire. 1.0 utilise tous les mots probables.</p>
              </div>
            </div>
          </div>

          <Button onClick={handleUpdateProfile} isLoading={isSaving} className="w-full">
            Enregistrer les modifications
          </Button>
        </div>

        {/* Right Column: Appearance & Stats */}
        <div className="space-y-6">
          
          <div className="bg-surface-900 p-6 rounded-sm border border-white/5">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Palette className="w-4 h-4 text-primary-400" /> Interface</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Thème Global</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTheme('romance')} className={`p-2 text-xs rounded-sm transition-colors ${theme === 'romance' ? 'bg-primary-600 text-white' : 'bg-surface-800 text-text-secondary hover:bg-surface-700'}`}>Dark Romance</button>
                  <button onClick={() => setTheme('cyber')} className={`p-2 text-xs rounded-sm transition-colors ${theme === 'cyber' ? 'bg-primary-600 text-white' : 'bg-surface-800 text-text-secondary hover:bg-surface-700'}`}>Cyber-Neon</button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block flex items-center gap-2">
                  <ImageIcon className="w-3 h-3" /> Fond de Chat Global (URL)
                </label>
                <Input 
                  placeholder="https://..." 
                  value={chatBackgroundImage}
                  onChange={(e) => setChatBackgroundImage(e.target.value)}
                  className="text-sm h-10"
                />
                <p className="text-[10px] text-text-muted mt-1">Remplace le fond par défaut des conversations.</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-900 p-6 rounded-sm border border-white/5">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Mic className="w-4 h-4 text-primary-400" /> Gestion de la Voix</h3>

            <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block flex items-center gap-2 mt-4">
              Clé API ElevenLabs (Optionnel)
            </label>
            <Input 
              placeholder="sk_..." 
              value={elevenlabsApiKey}
              onChange={(e) => setElevenlabsApiKey(e.target.value)}
              className="text-sm h-10 mb-4"
              type="password"
            />

            <select 
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-sm p-3 text-sm text-text-primary outline-none focus:border-primary-500"
            >
              <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Standard Female)</option>
              {voices.filter(v => v.voice_id !== '21m00Tcm4TlvDq8ikWAM').map(voice => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {voice.name} {voice.labels?.accent ? `(${voice.labels.accent})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-surface-900 p-6 rounded-sm border border-white/5">
            <h3 className="font-bold mb-4 font-serif">Statistiques</h3>
            <div className="space-y-3 text-sm text-text-secondary">
              <div className="flex justify-between items-center bg-surface-800 p-3 rounded-sm">
                <span>Personnages créés</span>
                <span className="font-bold text-primary-400">{user.stats.charactersCreated}</span>
              </div>
              <div className="flex justify-between items-center bg-surface-800 p-3 rounded-sm">
                <span>Total messages</span>
                <span className="font-bold text-primary-400">{user.stats.totalMessages}</span>
              </div>
              <div className="flex justify-between items-center bg-surface-800 p-3 rounded-sm">
                <span>Conversations</span>
                <span className="font-bold text-primary-400">{user.stats.totalConversations}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
