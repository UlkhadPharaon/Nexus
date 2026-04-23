import { compressImage } from '../utils/imageUtils';

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  // Return compressed base64 data URI instead of uploading to Firebase Storage
  // This bypasses Firebase Storage CORS/rules issues and keeps the data size small.
  return await compressImage(file, 256, 256);
}

export async function uploadCharacterPreview(characterId: string, file: File): Promise<string> {
  return await compressImage(file, 400, 400);
}

export async function uploadGeneralImage(path: string, file: File): Promise<string> {
  return await compressImage(file, 800, 800);
}
