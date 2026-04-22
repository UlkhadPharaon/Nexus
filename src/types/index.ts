import { Timestamp } from 'firebase/firestore';

export interface UserPreferences {
  temperature?: number;
  topP?: number;
  ttsVoice?: string;
  chatBackgroundImage?: string;
  elevenlabsApiKey?: string;
}

export interface Persona {
  id: string;
  userId: string;
  name: string;
  age: string;
  appearance: string;
  mentality: string;
  background: string;
  isDefault?: boolean;
  createdAt: Timestamp;
}

export interface UserPersona {
  name: string;
  age: string;
  appearance: string;
  mentality: string;
  background: string;
}

export interface UserStats {
  charactersCreated: number;
  totalMessages: number;
  totalConversations: number;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  bio: string;
  createdAt: Timestamp;
  preferredModel: 'mistral-small' | 'nemotron-nano';
  stats: UserStats;
  preferences?: UserPreferences;
  persona?: UserPersona;
}

export interface CharacterPersona {
  personality: string;
  backstory: string;
  universe: string;
  speakingStyle: string;
  exampleDialogues: Array<{ user: string; character: string }>;
  firstMessage: string;
  systemPromptAddons: string;
}

export interface CharacterStats {
  conversationCount: number;
  messageCount: number;
  likes: number;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  characterIds: string[];
  createdAt: Timestamp;
}

export interface Character {
  id: string;
  creatorId: string;
  name: string;
  tagline: string;
  description: string;
  avatarUrl: string;
  avatarColor: string;
  persona: CharacterPersona;
  tags: string[];
  category: string;
  isPublic: boolean;
  isNSFW: boolean;
  stats: CharacterStats;
  voiceId?: string; // TTS voice identifier
  personaId?: string; // Reference to a template Persona if used
  collectionId?: string; // Folder mapping
  backgroundImageUrl?: string; // Character default background
  lore?: LoreEntry[]; // Quick lore entries
  scenarios?: Scenario[]; // Starter scenarios
  isDeleted?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Universe {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  rules: string;
  backgroundImageUrl?: string;
  participantIds: string[]; // Users invited
  characterIds: string[];   // Characters in the universe
  isPublic: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Conversation {
  id: string;
  userId: string;
  participantIds: string[]; // All users participating
  characterId: string; // Keep for legacy, but add IDs
  characterIds?: string[]; // Multiple characters support
  characterName: string; // Main character name or group name
  characterAvatarUrl: string;
  lastMessage: string;
  lastMessageAt: Timestamp;
  messageCount: number;
  modelUsed: 'mistral-small' | 'nemotron-nano';
  backgroundImageUrl?: string; // Conversation specific background override
  affinity?: number; // -100 to 100
  longTermMemory?: string; // Memory of past interactions
  scenarioId?: string; // Active scenario if any
  personaId?: string; // User persona used in this convo
  universeId?: string; // Linked universe if any
  currentRoomId?: string; // Active location context
  isUniverseChat?: boolean; // Visual style flag
  isDeleted?: boolean;
  createdAt: Timestamp;
}

export interface LoreEntry {
  id: string;
  universeId?: string;
  characterId?: string;
  title: string;
  content: string;
  category?: 'general' | 'place' | 'person' | 'object' | 'history' | 'magic';
  keywords: string[]; // Triggers for the AI
  imageUrl?: string;
  createdAt?: Timestamp;
}

export interface UniverseRoom {
  id: string;
  universeId: string;
  name: string;
  description: string;
  backgroundImageUrl: string;
  createdAt: Timestamp;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  initialMessage: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  userId?: string; 
  userName?: string; 
  content: string;
  model: 'mistral-small' | 'nemotron-nano';
  timestamp: Timestamp;
  tokens?: number;
  isDeleted?: boolean;
}
