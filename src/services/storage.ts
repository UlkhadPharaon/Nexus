import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const filePath = `avatars/${userId}/${Date.now()}.${fileExt}`;
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadCharacterPreview(characterId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const filePath = `characters/${characterId}/${Date.now()}.${fileExt}`;
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
