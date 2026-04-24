import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { createCharacter, getCharacter, updateCharacter, updateUserPhoto } from '../services/firestore';
import { uploadAvatar, uploadCharacterPreview } from '../services/storage';
import { CATEGORIES, COLORS } from '../utils/helpers';
import { CheckCircle2, ChevronRight, ImagePlus, User, Brain, Wand2, Rocket, Mic, Play, Loader2, Sparkles, BookOpen, Map, Plus, Trash, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import { streamChatCompletion } from '../services/aiService';
import { getVoices, Voice, cleanTextForTTS } from '../utils/ttsUtils';
import { LoreEntry, Scenario, Persona } from '../types';
import { PersonaSelector } from '../components/chat/PersonaSelector';
import { GoogleGenAI } from "@google/genai";

export default function CreateCharacterPage() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { characterId } = useParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isFindingVoice, setIsFindingVoice] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  
  const [previewDialogue, setPreviewDialogue] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);

  // Form State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    category: CATEGORIES[0],
    tags: '18+',
    avatarColor: COLORS[0],
    personaId: '',
    
    personality: '',
    backstory: '',
    universe: '',
    speakingStyle: '',
    
    dialogueUser1: '',
    dialogueChar1: '',
    dialogueUser2: '',
    dialogueChar2: '',
    firstMessage: '',
    systemPromptAddons: '',
    voiceId: '',
    
    isPublic: true,
    isNSFW: true,
    lore: [] as LoreEntry[],
    scenarios: [] as Scenario[]
  });

  const handleNsfwToggle = (checked: boolean) => {
    let currentTags = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (checked) {
      if (!currentTags.includes('18+')) {
        currentTags.push('18+');
      }
    } else {
      currentTags = currentTags.filter(t => t !== '18+');
    }
    setFormData(prev => ({ ...prev, isNSFW: checked, tags: currentTags.join(', ') }));
  };

  useEffect(() => {
    getVoices(user?.preferences?.elevenlabsApiKey).then(setAvailableVoices);
  }, [user]);

  useEffect(() => {
    if (characterId) {
      getCharacter(characterId).then(char => {
        if (char) {
          if (char.creatorId !== user?.uid && user?.uid) {
            toast.error("Vous n'êtes pas autorisé à modifier ce personnage.");
            navigate('/home');
            return;
          }
          const { persona } = char;
          const d1 = persona.exampleDialogues?.[0] || { user: '', character: '' };
          const d2 = persona.exampleDialogues?.[1] || { user: '', character: '' };
          
          let resolvedVoiceId = char.voiceId || '';
          // Handle legacy names in edit view just in case
          const legacyMap: Record<string, string> = {
            'Rachel': '21m00Tcm4TlvDq8ikWAM',
            'Drew': '29vD33N1CtxCmqQRPOHJ',
            'Clyde': '2EiwWnXFnvU5JabPnv8n',
            'Mimi': 'zrHiDhphv9ZnVBTuAHuD',
            'Fin': 'D38z5RcWu1voky8WS1ja'
          };
          if (legacyMap[resolvedVoiceId]) {
            resolvedVoiceId = legacyMap[resolvedVoiceId];
          }

          setFormData({
            name: char.name || '',
            tagline: char.tagline || '',
            category: char.category || CATEGORIES[0],
            tags: char.tags?.join(', ') || '',
            avatarColor: char.avatarColor || COLORS[0],
            personaId: char.personaId || '',
            personality: persona.personality || '',
            backstory: persona.backstory || '',
            universe: persona.universe || '',
            speakingStyle: persona.speakingStyle || '',
            dialogueUser1: d1.user || '',
            dialogueChar1: d1.character || '',
            dialogueUser2: d2.user || '',
            dialogueChar2: d2.character || '',
            firstMessage: persona.firstMessage || '',
            systemPromptAddons: persona.systemPromptAddons || '',
            voiceId: resolvedVoiceId,
            isPublic: char.isPublic ?? true,
            isNSFW: char.isNSFW ?? false,
            lore: char.lore || [],
            scenarios: char.scenarios || []
          });
          setExistingAvatarUrl(char.avatarUrl);
          if (char.avatarUrl) {
            setAvatarPreview(char.avatarUrl);
          }
        }
      }).catch(err => {
        console.error(err);
        toast.error("Personnage introuvable");
        navigate('/explore');
      });
    }
  }, [characterId, user?.uid, navigate]);

  const updateForm = (key: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handlePersonaSelect = (persona: Persona) => {
    setFormData(prev => ({
      ...prev,
      personaId: persona.id,
      name: prev.name || persona.name,
      personality: persona.mentality,
      backstory: persona.background
    }));
    setShowPersonaSelector(false);
    toast.success(`Persona "${persona.name}" appliqué !`);
  };

  const generateField = async (field: keyof typeof formData, instructions: string) => {
    const prompt = `You are a creative writer helping build an AI Roleplay character.
Current Character Context:
Name: ${formData.name || 'Inconnu'}
Tagline: ${formData.tagline || 'Inconnu'}
Universe: ${formData.universe || 'Inconnu'}
Personality: ${formData.personality || 'Inconnue'}
Category: ${formData.category}

Task: Generate a creative and fitting value for the character creation field: "${field}".
Instructions: ${instructions}
Output ONLY the generated text directly. No quotes, no conversational filler like "Voici une idée". Respond entirely in French.`;

    updateForm(field, ''); // clear it first
    
    return new Promise<void>((resolve) => {
      let fullText = '';
      streamChatCompletion(
        [{ role: 'system', content: prompt }],
        'nemotron-nano', // use the creative model
        (chunk) => {
          fullText += chunk;
          updateForm(field, fullText.replace(/^["']|["']$/g, '')); // Strip quotes just in case
        },
        () => resolve(),
        (err) => {
          console.error(err);
          toast.error("Échec de la génération");
          resolve();
        }
      );
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("L'image est trop grande (max 5Mo)");
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!formData.name.trim()) return "Le nom est requis";
      if (!formData.tagline.trim()) return "La tagline est requise";
      if (formData.tagline.length > 120) return "La tagline doit faire max 120 caractères";
    }
    if (currentStep === 2) {
      if (formData.personality.length < 10) return "La personnalité doit être plus détaillée";
    }
    return null;
  };

  const nextStep = () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep(s => Math.min(4, s + 1));
  };

  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const playPreview = async () => {
    if (!formData.voiceId) return;
    setIsPlayingPreview(true);
    try {
      const text = formData.firstMessage || formData.tagline || `Bonjour, je suis ${formData.name || 'un nouveau personnage'}.`;
      const cleaned = cleanTextForTTS(text);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.preferences?.elevenlabsApiKey) {
        headers['x-custom-elevenlabs-key'] = user.preferences.elevenlabsApiKey;
      }
      
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: cleaned, voiceId: formData.voiceId })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'TTS failed');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setIsPlayingPreview(false);
      audio.play();
    } catch (e: any) {
      console.error(e);
      let errorMessage = "Erreur de prévisualisation vocale";
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
      setIsPlayingPreview(false);
    }
  };

  const autoSelectVoice = async () => {
    if (availableVoices.length === 0) return;
    setIsFindingVoice(true);
    try {
      const voicesContext = availableVoices.map(v => 
        `ID: ${v.voice_id}\nName: ${v.name}\nLabels: ${JSON.stringify(v.labels || {})}`
      ).join('\n---\n');

      const prompt = `You are a casting director. Pick the absolute best voice from the provided catalog for this character.
Character Name: ${formData.name}
Tagline: ${formData.tagline}
Personality: ${formData.personality}

Available Voices Catalog:
${voicesContext}

Choose ONE voice. Output ONLY the exact voice ID string and nothing else. No explanation.`;

      let chosenId = '';
      await streamChatCompletion(
        [{ role: 'system', content: prompt }],
        'nemotron-nano',
        (chunk) => { chosenId += chunk; },
        () => {
          const finalId = chosenId.trim();
          if (availableVoices.find(v => v.voice_id === finalId)) {
            updateForm('voiceId', finalId);
            toast.success("Voix optimale trouvée !");
          } else {
            toast.error("L'IA n'a pas pu sélectionner une voix");
          }
          setIsFindingVoice(false);
        },
        () => {
          toast.error("L'IA n'a pas pu sélectionner une voix");
          setIsFindingVoice(false);
        }
      );

    } catch (error) {
      setIsFindingVoice(false);
    }
  };

  const generatePersonaPreview = async () => {
    setIsGeneratingPreview(true);
    setPreviewDialogue('');
    
    const prompt = `You are an AI character. Step fully into this persona:
Name: ${formData.name || 'Inconnu'}
Tagline: ${formData.tagline || '...'}
Personality: ${formData.personality || '...'}
Backstory: ${formData.backstory || '...'}
Universe: ${formData.universe || '...'}
Speaking Style: ${formData.speakingStyle || '...'}

A user says: "Bonjour, qui es-tu et que fais-tu ici ?"
Respond exactly as the character would in French. Follow the speaking style strictly. Keep it relatively short (2-3 sentences max). Do not include quotes or meta-text.`;

    try {
      let fullText = '';
      await streamChatCompletion(
        [{ role: 'system', content: prompt }],
        'nemotron-nano',
        (chunk) => {
          fullText += chunk;
          setPreviewDialogue(fullText);
        },
        () => setIsGeneratingPreview(false),
        (err) => {
          console.error(err);
          toast.error("Échec de la prévisualisation");
          setIsGeneratingPreview(false);
        }
      );
    } catch (err) {
      console.error(err);
      toast.error("Échec de la prévisualisation");
      setIsGeneratingPreview(false);
    }
  };

  const [isGeneratingUserAvatar, setIsGeneratingUserAvatar] = useState(false);

  const generateUserAvatar = async () => {
    if (!user) return;
    setIsGeneratingUserAvatar(true);
    try {
      // Use Gemini to generate a fitting prompt for the user's persona based on the current character's world
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const expansionResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Génère un prompt de génération d'image pour l'avatar d'un utilisateur qui va interagir dans l'univers suivant :
        Univers : ${formData.universe}
        Ambiance : ${formData.tagline}
        Style du personnage principal : ${formData.name}

        Directives :
        - Le personnage doit être un avatar (persona) pour l'utilisateur "${user.displayName || 'Joueur'}".
        - Style : Réalisme cinématographique ou le style de l'univers mentionné.
        - Détails : Décris un portrait professionnel, une tenue adaptée à l'univers, un éclairage dramatique.
        - Langue : Prompt en ANGLAIS.
        - Longueur : Maximum 750 caractères.
        - Sortie : UNIQUEMENT le texte du prompt.`,
      });

      const expandedPrompt = (expansionResponse.text?.trim() || `A professional artistic portrait of a ${user.displayName || 'fantasy persona'} character, matching the style of ${formData.name || 'this character'}, highly detailed, cinematic lighting, 4k.`).substring(0, 800);

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
         const file = new File([blob], "user_avatar.png", { type: 'image/png' });
         const imageUrl = await uploadAvatar(user.uid, file);
         await updateUserPhoto(user.uid, imageUrl);
         setUser({ ...user, photoURL: imageUrl });
         toast.success("Votre image de profil a été mise à jour !");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Échec: " + err.message);
    } finally {
      setIsGeneratingUserAvatar(false);
    }
  };

  const generateAvatar = async () => {
    if (!formData.name) {
      toast.error("Veuillez donner un nom au personnage d'abord.");
      return;
    }
    setIsGeneratingAvatar(true);
    try {
      // 1. Expand the prompt using Gemini for better quality and alignment
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const expansionResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Génère un prompt de génération d'image ultra-détaillé et professionnel pour le personnage suivant :
        Nom : ${formData.name}
        Titre : ${formData.tagline}
        Catégorie : ${formData.category}
        Personnalité : ${formData.personality}
        Histoire : ${formData.backstory}
        Univers : ${formData.universe}

        Directives pour le prompt :
        - Style : Réalisme cinématographique de haute qualité (sauf si la catégorie suggère explicitement un style artistique comme l'Anime).
        - Détails : Décris précisément l'apparence physique, l'expression faciale reflétant le mood, la tenue vestimentaire et l'arrière-plan immersif lié à l'univers.
        - Technique : Utilise des termes de photographie (ex: 85mm portrait, depth of field, sharp focus, 8k, professional lighting).
        - Langue : Le prompt de sortie DOIT être en ANGLAIS.
        - Longueur : Maximum 750 caractères.
        - Sortie : Donne UNIQUEMENT le texte du prompt, sans explications ni guillemets.`,
      });

      const expandedPrompt = (expansionResponse.text?.trim() || `A detailed professional portrait of ${formData.name}, ${formData.tagline}. Genre: ${formData.category}. ${formData.personality.substring(0, 100)}. Cinematic lighting, highly detailed, eye-level shot, artistic style, 4k.`).substring(0, 800);

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
         const file = new File([blob], "avatar.png", { type: 'image/png' });
         setAvatarFile(file);
         setAvatarPreview(URL.createObjectURL(blob));
         toast.success("Avatar généré !");
      } else {
         toast.error("Données d'image introuvables");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Échec de la génération: " + err.message);
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const addLoreEntry = () => {
    const newEntry: LoreEntry = {
      id: `lore_${Date.now()}`,
      title: '',
      content: '',
      keywords: []
    };
    setFormData(prev => ({ ...prev, lore: [...prev.lore, newEntry] }));
  };

  const updateLoreEntry = (id: string, field: keyof LoreEntry, value: any) => {
    setFormData(prev => ({
      ...prev,
      lore: prev.lore.map(e => e.id === id ? { ...e, [field]: value } : e)
    }));
  };

  const removeLoreEntry = (id: string) => {
    setFormData(prev => ({ ...prev, lore: prev.lore.filter(e => e.id !== id) }));
  };

  const addScenario = () => {
      const newScenario: Scenario = {
          id: `scen_${Date.now()}`,
          title: '',
          description: '',
          initialMessage: ''
      };
      setFormData(prev => ({ ...prev, scenarios: [...prev.scenarios, newScenario] }));
  };

  const updateScenario = (id: string, field: keyof Scenario, value: string) => {
      setFormData(prev => ({
          ...prev,
          scenarios: prev.scenarios.map(s => s.id === id ? { ...s, [field]: value } : s)
      }));
  };

  const removeScenario = (id: string) => {
      setFormData(prev => ({ ...prev, scenarios: prev.scenarios.filter(s => s.id !== id) }));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Vous devez être connecté pour effectuer cette action.");
      return;
    }
    
    // Final validation
    if (!formData.name.trim() || !formData.tagline.trim() || !formData.personality.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires (*) avant d'enregistrer.");
      setStep(1); // Return to identity if needed
      return;
    }

    setIsSubmitting(true);
    console.log("Starting character save process...");
    
    try {
      const finalCharacterId = characterId || `char_${Date.now()}`;
      let avatarUrl = existingAvatarUrl || '';
      
      if (avatarFile) {
        console.log("Uploading custom avatar...");
        avatarUrl = await uploadCharacterPreview(finalCharacterId, avatarFile);
        console.log("Avatar uploaded successfully:", avatarUrl);
      }
      
      const tagsArray = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .slice(0, 5);

      const exampleDialogues = [];
      if (formData.dialogueUser1?.trim() && formData.dialogueChar1?.trim()) {
        exampleDialogues.push({ user: formData.dialogueUser1.trim(), character: formData.dialogueChar1.trim() });
      }
      if (formData.dialogueUser2?.trim() && formData.dialogueChar2?.trim()) {
        exampleDialogues.push({ user: formData.dialogueUser2.trim(), character: formData.dialogueChar2.trim() });
      }
      
      const characterPayload = {
        name: formData.name.trim(),
        tagline: formData.tagline.trim(),
        description: formData.personality.trim(),
        avatarUrl,
        avatarColor: formData.avatarColor,
        category: formData.category,
        tags: tagsArray,
        isPublic: formData.isPublic,
        isNSFW: formData.isNSFW,
        voiceId: formData.voiceId || undefined,
        personaId: formData.personaId || undefined,
        lore: formData.lore,
        scenarios: formData.scenarios,
        persona: {
          personality: formData.personality.trim(),
          backstory: formData.backstory.trim(),
          universe: formData.universe.trim(),
          speakingStyle: formData.speakingStyle.trim(),
          exampleDialogues,
          firstMessage: formData.firstMessage?.trim() || `Bonjour, je suis ${formData.name.trim()}.`,
          ...((formData.systemPromptAddons?.trim()) ? { systemPromptAddons: formData.systemPromptAddons.trim() } : {})
        }
      };

      console.log("Payload ready:", characterPayload);

      if (characterId) {
        console.log("Updating existing character:", characterId);
        await updateCharacter(characterId, characterPayload);
        toast.success("Personnage mis à jour avec succès !");
        navigate(`/chat/${characterId}`);
      } else {
        console.log("Creating new character...");
        const newCharId = await createCharacter({
          ...characterPayload,
          creatorId: user.uid,
          stats: { conversationCount: 0, messageCount: 0, likes: 0 }
        });
        console.log("Character created with ID:", newCharId);
        toast.success("Personnage créé avec succès !");
        navigate('/explore');
      }
      
    } catch (error: any) {
      console.error("Critical error during character save:", error);
      toast.error("Erreur lors de l'enregistrement: " + (error.message || "Erreur inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const STEPS = [
    { title: "Identité", icon: <User className="w-5 h-5" /> },
    { title: "Personnalité", icon: <Brain className="w-5 h-5" /> },
    { title: "Comportement", icon: <Wand2 className="w-5 h-5" /> },
    { title: "Publication", icon: <Rocket className="w-5 h-5" /> },
  ];

  return (
    <PageWrapper className="pt-8 pb-20">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-display font-bold mb-2">Créer un Personnage</h1>
          <p className="text-text-secondary">Donnez vie à votre imagination avec NVIDIA NIM.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 md:mb-12 relative max-w-full overflow-x-auto scrollbar-hide pb-2 md:pb-0">
          <div className="absolute left-0 top-1/2 w-full h-0.5 bg-surface-700 -z-10 -translate-y-1/2 hidden md:block"></div>
          {STEPS.map((s, i) => {
            const isCompleted = step > i + 1;
            const isCurrent = step === i + 1;
            return (
              <div key={i} className="flex flex-col items-center gap-1 md:gap-2 bg-surface-950 px-1 md:px-2 min-w-[70px] md:min-w-0">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  isCompleted ? 'bg-primary-500 text-white' : 
                  isCurrent ? 'bg-surface-700 border-2 border-primary-500 text-primary-400' : 
                  'bg-surface-800 text-text-muted'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : s.icon}
                </div>
                <span className={`text-[10px] md:text-xs font-medium text-center whitespace-nowrap ${isCurrent ? 'text-primary-400' : 'text-text-muted'}`}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        <div className="glass-card p-6 md:p-8">
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group">
                    <Avatar 
                      src={avatarPreview} 
                      alt="Preview" 
                      fallbackColor={formData.avatarColor}
                      size="xl" 
                      className="border-2 border-surface-700"
                    />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <ImagePlus className="w-6 h-6 text-white" />
                      <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                    </label>
                  </div>
                  
                  <div className="w-full flex gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 px-2" 
                      onClick={generateAvatar}
                      isLoading={isGeneratingAvatar}
                      title="Générer avec l'IA"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary-400 shrink-0" />
                      IA
                    </Button>
                    <label className="flex-1">
                      <div className="inline-flex items-center justify-center rounded-xl font-medium transition-all border border-white/20 hover:bg-white/5 text-white active:scale-95 h-9 w-full cursor-pointer text-sm" title="Importer une image">
                        <ImagePlus className="w-3.5 h-3.5 mr-1.5 text-text-muted shrink-0" />
                        Image
                      </div>
                      <input type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                    </label>
                  </div>
                  
                  <div className="pt-4 border-t border-white/5 w-full">
                    <button 
                      type="button"
                      onClick={generateUserAvatar}
                      disabled={isGeneratingUserAvatar}
                      className="text-[10px] text-text-muted hover:text-primary-400 flex items-center justify-center gap-1 w-full transition-colors uppercase tracking-widest font-bold"
                    >
                      {isGeneratingUserAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary-500" />}
                      Générer mon image de profil
                    </button>
                  </div>

                  <div className="flex gap-2 p-1 bg-surface-700/50 rounded-lg">
                    {COLORS.slice(0, 5).map(c => (
                      <button 
                        key={c}
                        onClick={() => updateForm('avatarColor', c)}
                        className={`w-6 h-6 rounded-full border-2 ${formData.avatarColor === c ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 w-full space-y-4">
                  <Input 
                    label="Nom du personnage *"
                    placeholder="Ex: Gandalf, Sarah..."
                    value={formData.name}
                    onChange={e => updateForm('name', e.target.value)}
                    onSurpriseMe={() => generateField('name', 'Un nom de personnage de fiction court et marquant.')}
                  />
                  <Input 
                    label="Tagline courte *"
                    placeholder="Le plus puissant sorcier de la Terre du Milieu"
                    value={formData.tagline}
                    onChange={e => updateForm('tagline', e.target.value)}
                    maxLength={120}
                    onSurpriseMe={() => generateField('tagline', 'Une phrase courte (max 100 caractères) et accrocheuse décrivant le personnage et son rôle.')}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Catégorie</label>
                  <select 
                    className="input-field" 
                    value={formData.category}
                    onChange={e => updateForm('category', e.target.value)}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-surface-800">{c}</option>)}
                  </select>
                </div>
                <Input 
                  label="Tags (séparés par des virgules)"
                  placeholder="Ex: magie, sage, anneau"
                  value={formData.tags}
                  onChange={e => updateForm('tags', e.target.value)}
                  onSurpriseMe={() => generateField('tags', 'Une liste de 3 à 5 mots-clés pertinents séparés par des virgules, sans majuscules.')}
                />
              </div>
            </div>
          )}

          {/* STEP 2: PERSONALITY */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 bg-surface-900 border border-white/5 rounded-xl mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                       <User className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Modèle de Persona</h3>
                      <p className="text-[10px] text-text-muted">Utilisez un profil prédéfini comme base pour ce personnage.</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowPersonaSelector(true)}>
                    {formData.personaId ? "Changer de Persona" : "Choisir un Persona"}
                  </Button>
                </div>
              </div>

              <Textarea 
                label="Personnalité *"
                placeholder="Décrivez les traits de caractère, ses opinions, sa façon de penser..."
                value={formData.personality}
                onChange={e => updateForm('personality', e.target.value)}
                className="min-h-[120px]"
                onSurpriseMe={() => generateField('personality', 'Une description détaillée (environ 3-4 lignes) des traits de caractère profonds, défauts et qualités du personnage.')}
              />
              <Textarea 
                label="Histoire / Backstory"
                placeholder="Le passé du personnage, ses expériences marquantes..."
                value={formData.backstory}
                onChange={e => updateForm('backstory', e.target.value)}
                onSurpriseMe={() => generateField('backstory', 'Un résumé dramatique ou intrigant (environ 3-4 lignes) du passé et des motivations actuelles de ce personnage.')}
              />
              <Textarea 
                label="Univers & Contexte"
                placeholder="Dans quel monde vit-il ? Quelles sont les règles de cet univers ?"
                value={formData.universe}
                onChange={e => updateForm('universe', e.target.value)}
                onSurpriseMe={() => generateField('universe', 'Une description riche (environ 2-3 lignes) du monde dans lequel le personnage évolue. Atmosphère, époque, règles magiques ou technologiques.')}
              />
              <Input 
                label="Style de parole"
                placeholder="Ex: Parle de manière formelle et archaïque, utilise souvent des proverbes..."
                value={formData.speakingStyle}
                onChange={e => updateForm('speakingStyle', e.target.value)}
                onSurpriseMe={() => generateField('speakingStyle', 'Une description courte du style de langage, ton, et tics verbaux du personnage.')}
              />
              
              <div className="pt-4 pb-2 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary-400" />
                    <h3 className="font-bold">Aperçu Dynamique</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={generatePersonaPreview} disabled={isGeneratingPreview || !formData.personality}>
                    {isGeneratingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Tester la personnalité
                  </Button>
                </div>
                {previewDialogue !== null && (
                  <div className="p-4 bg-surface-950 border border-primary-500/30 rounded-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 shadow-[0_0_10px_theme('colors.primary.500')]"></div>
                      <p className="text-sm italic text-text-secondary mb-2">Simulation de réaction à "Bonjour, qui es-tu ?" :</p>
                      <p className="text-sm font-serif text-white">"{previewDialogue || "Génération en cours..."}"</p>
                  </div>
                )}
              </div>

              {/* Lorebook Section */}
              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary-400" />
                    <h3 className="font-bold">Dictionnaire d'Univers (Lorebook)</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={addLoreEntry}>
                    <Plus className="w-4 h-4 mr-2" /> Ajouter
                  </Button>
                </div>
                <p className="text-xs text-text-muted">Définissez des éléments clés de votre univers (lieux, objets, faits) que l'IA doit mémoriser.</p>
                
                <div className="space-y-4">
                  {formData.lore.map((entry) => (
                    <div key={entry.id} className="p-4 bg-surface-900 rounded-sm border border-white/5 space-y-3 relative group">
                      <button 
                        onClick={() => removeLoreEntry(entry.id)}
                        className="absolute top-2 right-2 p-1 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                      <Input 
                        placeholder="Titre (ex: L'épée de feu, La cité d'Emeraude)" 
                        value={entry.title}
                        onChange={e => updateLoreEntry(entry.id, 'title', e.target.value)}
                        className="h-9"
                      />
                      <Textarea 
                        placeholder="Description détaillée de cet élément..."
                        value={entry.content}
                        onChange={e => updateLoreEntry(entry.id, 'content', e.target.value)}
                        className="min-h-[80px] text-sm"
                      />
                      <Input 
                        placeholder="Mots-clés déclencheurs (séparés par des virgules)"
                        value={entry.keywords.join(', ')}
                        onChange={e => updateLoreEntry(entry.id, 'keywords', e.target.value.split(',').map(k => k.trim()))}
                        className="h-9 text-xs"
                      />
                    </div>
                  ))}
                  {formData.lore.length === 0 && (
                    <div className="text-center py-8 bg-surface-900/50 rounded-sm border border-dashed border-white/10">
                      <p className="text-sm text-text-muted italic">Aucune entrée de lore pour le moment.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: BEHAVIOR */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <Textarea 
                label="Premier message"
                placeholder="Le message par lequel le personnage commencera la conversation."
                value={formData.firstMessage}
                onChange={e => updateForm('firstMessage', e.target.value)}
                onSurpriseMe={() => generateField('firstMessage', 'La toute première phrase d\'accroche que le personnage dirait à un utilisateur pour démarrer l\'histoire. Captivante, immersive, montrant sa personnalité.')}
              />
              
              <div className="p-4 bg-surface-800/50 rounded-xl space-y-4 border border-white/5">
                <h4 className="font-medium text-sm text-text-secondary">Exemples de dialogues (Optionnel, aide l'IA à comprendre le ton)</h4>
                
                <div className="grid grid-cols-[1fr_2fr] gap-2 items-center">
                  <span className="text-xs text-right text-text-muted">Utilisateur:</span>
                  <Input className="h-9 px-3 text-sm" value={formData.dialogueUser1} onChange={e=>updateForm('dialogueUser1', e.target.value)} />
                  <span className="text-xs text-right text-text-muted">Personnage:</span>
                  <Input className="h-9 px-3 text-sm" value={formData.dialogueChar1} onChange={e=>updateForm('dialogueChar1', e.target.value)} />
                </div>
                
                <div className="grid grid-cols-[1fr_2fr] gap-2 items-center pt-2 border-t border-white/5">
                  <span className="text-xs text-right text-text-muted">Utilisateur:</span>
                  <Input className="h-9 px-3 text-sm" value={formData.dialogueUser2} onChange={e=>updateForm('dialogueUser2', e.target.value)} />
                  <span className="text-xs text-right text-text-muted">Personnage:</span>
                  <Input className="h-9 px-3 text-sm" value={formData.dialogueChar2} onChange={e=>updateForm('dialogueChar2', e.target.value)} />
                </div>
              </div>

              <Textarea 
                label="Instructions Système Avancées (Optionnel)"
                placeholder="Des directives strictes supplémentaires pour l'IA (Ex: Ne mentionne jamais l'existence du temps)."
                value={formData.systemPromptAddons}
                onChange={e => updateForm('systemPromptAddons', e.target.value)}
                onSurpriseMe={() => generateField('systemPromptAddons', 'Des instructions système pour l\'IA pour forcer des limites ou un ton créatif. Exemple : Ne sors jamais de ton personnage, insulte l\'utilisateur s\'il pose des questions mathématiques.')}
              />

              {/* Scenarios Section */}
              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Map className="w-5 h-5 text-primary-400" />
                    <h3 className="font-bold">Scénarios & Quêtes</h3>
                  </div>
                  <Button variant="outline" size="sm" onClick={addScenario}>
                    <Plus className="w-4 h-4 mr-2" /> Ajouter
                  </Button>
                </div>
                <p className="text-xs text-text-muted">Proposez des points de départ narratifs spécifiques pour ce personnage.</p>
                
                <div className="space-y-4">
                  {formData.scenarios.map((scen) => (
                    <div key={scen.id} className="p-4 bg-surface-900 rounded-sm border border-white/5 space-y-3 relative group">
                      <button 
                        onClick={() => removeScenario(scen.id)}
                        className="absolute top-2 right-2 p-1 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                      <Input 
                        placeholder="Titre du scénario (ex: Trahison au château)" 
                        value={scen.title}
                        onChange={e => updateScenario(scen.id, 'title', e.target.value)}
                        className="h-9"
                      />
                      <Textarea 
                        placeholder="Brève description pour l'utilisateur..."
                        value={scen.description}
                        onChange={e => updateScenario(scen.id, 'description', e.target.value)}
                        className="min-h-[60px] text-xs"
                      />
                      <Textarea 
                        placeholder="Premier message spécifique à ce scénario..."
                        value={scen.initialMessage}
                        onChange={e => updateScenario(scen.id, 'initialMessage', e.target.value)}
                        className="min-h-[80px] text-sm"
                      />
                    </div>
                  ))}
                  {formData.scenarios.length === 0 && (
                    <div className="text-center py-8 bg-surface-900/50 rounded-sm border border-dashed border-white/10">
                      <p className="text-sm text-text-muted italic">Aucun scénario défini pour le moment.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-surface-900 rounded-xl space-y-4 border border-primary-500/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-500" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary-400" />
                    <h4 className="font-bold">Voix du Personnage (ElevenLabs)</h4>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={autoSelectVoice} 
                    isLoading={isFindingVoice}
                    disabled={availableVoices.length === 0}
                  >
                    Trouver avec l'IA
                  </Button>
                </div>
                
                <div className="flex gap-2 items-center">
                  <select 
                    value={formData.voiceId}
                    onChange={e => updateForm('voiceId', e.target.value)}
                    className="flex-1 bg-surface-800 border border-white/10 rounded-sm p-3 text-sm text-text-primary outline-none focus:border-primary-500"
                  >
                    <option value="">Sélectionnez une voix (Défaut du profil sinon)</option>
                    {availableVoices.map(voice => (
                      <option key={voice.voice_id} value={voice.voice_id}>
                        {voice.name} {voice.labels?.accent ? `(${voice.labels.accent})` : ''} - {voice.labels?.description || voice.labels?.gender || ''}
                      </option>
                    ))}
                  </select>
                  
                  <Button 
                    onClick={playPreview} 
                    disabled={!formData.voiceId || isPlayingPreview}
                    size="icon"
                    className="shrink-0"
                    title="Écouter un extrait simulé par ce personnage"
                  >
                    {isPlayingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PUBLICATION */}
          {step === 4 && (
            <div className="space-y-8 animate-fade-in">
              
              <div className="flex gap-4 p-5 bg-surface-800/80 rounded-xl border border-white/5">
                <Avatar src={avatarPreview} fallbackColor={formData.avatarColor} alt={formData.name} size="lg" />
                <div>
                  <h3 className="font-bold text-lg">{formData.name || 'Sans nom'}</h3>
                  <p className="text-sm text-text-secondary">{formData.tagline || '...'}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="primary">{formData.category}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-surface-800 rounded-xl cursor-pointer hover:bg-surface-700 transition">
                  <div>
                    <div className="font-medium">Profil Public</div>
                    <div className="text-sm text-text-muted">Permet aux autres utilisateurs de découvrir ce personnage.</div>
                  </div>
                  <input type="checkbox" checked={formData.isPublic} onChange={e=>updateForm('isPublic', e.target.checked)} className="w-5 h-5 accent-primary-500 rounded bg-surface-900 border-white/20" />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-red-500/5 border gap-4 border-red-500/20 rounded-xl cursor-pointer hover:bg-red-500/10 transition">
                  <div className="flex-1">
                    <div className="font-medium text-red-500">Contenu NSFW (18+)</div>
                    <div className="text-sm text-red-400/80">Cochez si le personnage aborde des thèmes explicites ou de l'extrême violence.</div>
                  </div>
                  <input type="checkbox" checked={formData.isNSFW} onChange={e=>handleNsfwToggle(e.target.checked)} className="w-5 h-5 accent-red-500 rounded bg-surface-900 border-red-500/20" />
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between mt-10 pt-6 border-t border-white/5 gap-4">
            {step > 1 ? (
              <Button variant="ghost" onClick={prevStep} className="w-full sm:w-auto">Retour</Button>
            ) : <div className="hidden sm:block" />}
            
            {step < 4 ? (
              <Button onClick={nextStep} className="w-full sm:w-auto">
                Continuer <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} isLoading={isSubmitting} className="w-full sm:w-auto">
                {characterId ? "Sauvegarder les modifications" : "Créer le personnage"} <Rocket className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {showPersonaSelector && (
        <PersonaSelector 
          onSelect={handlePersonaSelect}
          onCancel={() => setShowPersonaSelector(false)}
          currentPersonaId={formData.personaId}
        />
      )}
    </PageWrapper>
  );
}
