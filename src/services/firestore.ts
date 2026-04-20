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
import { Character, Conversation, Message, User, UserPreferences, Folder, UserPersona } from '../types';

export async function getUserProfile(userId: string): Promise<User | null> {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as User) : null;
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
  const docRef = await addDoc(collection(db, 'characters'), {
    ...characterData,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCharacter(characterId: string, characterData: Partial<Omit<Character, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const docRef = doc(db, 'characters', characterId);
  await updateDoc(docRef, {
    ...characterData,
    updatedAt: serverTimestamp(),
  });
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const q = query(
    collection(db, 'conversations'),
    where('userId', '==', userId),
    orderBy('lastMessageAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Conversation))
    .filter(c => c.isDeleted !== true);
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
