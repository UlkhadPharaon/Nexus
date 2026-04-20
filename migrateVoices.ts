import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const legacyMap: Record<string, string> = {
  'Rachel': '21m00Tcm4TlvDq8ikWAM',
  'Drew': '29vD33N1CtxCmqQRPOHJ',
  'Clyde': '2EiwWnXFnvU5JabPnv8n',
  'Mimi': 'zrHiDhphv9ZnVBTuAHuD',
  'Fin': 'D38z5RcWu1voky8WS1ja'
};

async function migrateVoices() {
  console.log("Starting migration...");
  try {
    const charactersSnap = await getDocs(collection(db, 'characters'));
    let count = 0;
    
    for (const characterDoc of charactersSnap.docs) {
      const data = characterDoc.data();
      const currentVoiceId = data.voiceId;
      
      if (currentVoiceId && legacyMap[currentVoiceId]) {
        console.log(`Migrating character ${characterDoc.id} from ${currentVoiceId} to ${legacyMap[currentVoiceId]}`);
        await updateDoc(doc(db, 'characters', characterDoc.id), {
          voiceId: legacyMap[currentVoiceId]
        });
        count++;
      }
    }
    console.log(`Migration complete. Updated ${count} characters.`);
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

migrateVoices();
