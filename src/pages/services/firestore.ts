import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  addDoc,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Character, Conversation, Message, User, UserPreferences, Folder, UserPersona, Persona, Universe, LoreEntry, UniverseRoom } from '../types';

export async function createUniverse(universeData: Omit<Universe, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'universes'), {
    ...universeData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getUniverse(universeId: string): Promise<Universe | null> {
  const docRef = doc(db, 'universes', universeId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Universe) : null;
}

export async function getUniverses(userId: string): Promise<Universe[]> {
  const q1 = query(collection(db, 'universes'), where('creatorId', '==', userId));
  const q2 = query(collection(db, 'universes'), where('participantIds', 'array-contains', userId));
  
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  
  const all = [
    ...snap1.docs.map(doc => ({ id: doc.id, ...doc.data() } as Universe)),
    ...snap2.docs.map(doc => ({ id: doc.id, ...doc.data() } as Universe))
  ];
  
  // Unique by ID
  return Array.from(new Map(all.map(u => [u.id, u])).values())
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function updateUniverse(universeId: string, data: Partial<Universe>): Promise<void> {
  await updateDoc(doc(db, 'universes', universeId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function createLoreEntry(universeId: string, entry: Omit<LoreEntry, 'id' | 'universeId' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'lore'), {
    ...entry,
    universeId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getLoreEntries(universeId: string): Promise<LoreEntry[]> {
  const q = query(collection(db, 'lore'), where('universeId', '==', universeId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoreEntry));
}

export async function createUniverseRoom(universeId: string, room: Omit<UniverseRoom, 'id' | 'universeId' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'rooms'), {
    ...room,
    universeId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getUniverseRooms(universeId: string): Promise<UniverseRoom[]> {
  const q = query(collection(db, 'rooms'), where('universeId', '==', universeId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UniverseRoom));
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as User) : null;
}

export async function getPersonas(userId: string): Promise<Persona[]> {
  const q = query(
    collection(db, 'personas'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Persona));
}

export async function createPersona(userId: string, persona: Omit<Persona, 'id' | 'userId' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'personas'), {
    ...persona,
    userId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deletePersona(personaId: string): Promise<void> {
  await deleteDoc(doc(db, 'personas', personaId));
}

export async function updatePersona(personaId: string, data: Partial<Persona>): Promise<void> {
  await updateDoc(doc(db, 'personas', personaId), data);
}

export async function createUserProfile(user: User): Promise<void> {
  await setDoc(doc(db, 'users', user.uid), {
    ...user,
    createdAt: serverTimestamp(),
  });
}

export async function updateUserPreferredModel(userId: string, model: 'mistral-small' | 'nemotron-nano'): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    preferredModel: model
  });
}

export async function updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    await updateDoc(docRef, {
      preferences: {
        ...(data.preferences || {}),
        ...preferences
      }
    });
  }
}

export async function updateUserBio(userId: string, bio: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    bio
  });
}

export async function updateUserPersona(userId: string, persona: UserPersona): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    persona
  });
}

/** New Persona Management **/
export async function getPersona(personaId: string): Promise<Persona | null> {
  const docRef = doc(db, 'personas', personaId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Persona) : null;
}

export async function updateConversation(conversationId: string, data: Partial<Conversation>): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), data);
}

export async function updateUserPhoto(userId: string, photoURL: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    photoURL
  });
}

export async function getPublicCharacters(): Promise<Character[]> {
  const q = query(
    collection(db, 'characters'),
    where('isPublic', '==', true),
    orderBy('stats.likes', 'desc'),
    limit(40) // Fetch slightly more to account for deleted items
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Character))
    .filter(c => c.isDeleted !== true)
    .slice(0, 20);
}

export async function getCharacter(characterId: string): Promise<Character | null> {
  const docRef = doc(db, 'characters', characterId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Character) : null;
}

export async function createCharacter(characterData: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const cleanData = Object.fromEntries(
    Object.entries(characterData).filter(([_, v]) => v !== undefined)
  );
  
  const docRef = await addDoc(collection(db, 'characters'), {
    ...cleanData,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCharacter(characterId: string, characterData: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const docRef = doc(db, 'characters', characterId);
  const cleanData = Object.fromEntries(
    Object.entries(characterData).filter(([_, v]) => v !== undefined)
  );

  await updateDoc(docRef, {
    ...cleanData,
    updatedAt: serverTimestamp(),
  });
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const q1 = query(collection(db, 'conversations'), where('userId', '==', userId));
  const q2 = query(collection(db, 'conversations'), where('participantIds', 'array-contains', userId));
  
  const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  // Combine and remove duplicates
  const allConvos: Conversation[] = [
    ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation)),
    ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation))
  ];

  // Remove duplicates by ID and filter deleted
  const uniqueConvos = Array.from(new Map(allConvos.map(c => [c.id, c])).values())
    .filter(c => c.isDeleted !== true);

  return uniqueConvos.sort((a, b) => {
    const timeA = a.lastMessageAt ? a.lastMessageAt.toMillis() : 0;
    const timeB = b.lastMessageAt ? b.lastMessageAt.toMillis() : 0;
    return timeB - timeA;
  });
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const docRef = doc(db, 'conversations', conversationId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Conversation) : null;
}

export async function createConversation(conversation: Omit<Conversation, 'id' | 'createdAt' | 'lastMessageAt'>): Promise<string> {
  // Remove undefined fields
  const cleanConversation = Object.fromEntries(
    Object.entries(conversation).filter(([_, v]) => v !== undefined)
  );

  const docRef = await addDoc(collection(db, 'conversations'), {
    ...cleanConversation,
    isDeleted: false,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function addMessage(conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
  const messageData: any = {
    ...message,
    isDeleted: false,
    timestamp: serverTimestamp(),
  };

  // Ensure optional fields are handled correctly
  if (message.userId) messageData.userId = message.userId;
  if (message.userName) messageData.userName = message.userName;

  await addDoc(collection(db, `conversations/${conversationId}/messages`), messageData);
  
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
    lastMessageAt: serverTimestamp(),
    modelUsed: message.model
  });
}

export async function updateMessage(conversationId: string, messageId: string, content: string): Promise<void> {
  await updateDoc(doc(db, `conversations/${conversationId}/messages`, messageId), {
    content: content,
  });
}

export function subscribeToMessages(conversationId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(db, `conversations/${conversationId}/messages`),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Message))
      .filter(m => m.isDeleted !== true);
    callback(messages);
  });
}

export async function updateAffinity(conversationId: string, affinity: number): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), {
    affinity: Math.max(-100, Math.min(100, affinity))
  });
}

export async function deleteCharacter(characterId: string): Promise<void> {
  await updateDoc(doc(db, 'characters', characterId), { isDeleted: true });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), { isDeleted: true });
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  await updateDoc(doc(db, `conversations/${conversationId}/messages`, messageId), { isDeleted: true });
}

export async function getUserCharacters(userId: string): Promise<Character[]> {
  const q = query(
    collection(db, 'characters'),
    where('creatorId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Character))
    .filter(c => c.isDeleted !== true);
}

export async function getFolders(userId: string): Promise<Folder[]> {
  const q = query(collection(db, 'folders'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder));
}

export async function getAllUsers(): Promise<User[]> {
  const querySnapshot = await getDocs(collection(db, 'users'));
  return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
}

export async function createFolder(userId: string, name: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'folders'), {
    userId,
    name,
    characterIds: [],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function addParticipantToConversation(conversationId: string, userId: string): Promise<void> {
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (convSnap.exists()) {
    const data = convSnap.data() as Conversation;
    const participants = data.participantIds || [data.userId];
    if (!participants.includes(userId)) {
      await updateDoc(convRef, {
        participantIds: [...participants, userId]
      });
    }
  }
}

export async function searchUsers(queryStr: string): Promise<User[]> {
  const q = query(
    collection(db, 'users'), 
    where('displayName', '>=', queryStr),
    where('displayName', '<=', queryStr + '\uf8ff'),
    limit(5)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
}
