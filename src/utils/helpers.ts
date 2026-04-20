import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.split(' ');
  let initials = '';
  for (let i = 0; i < Math.min(parts.length, 2); i++) {
    if (parts[i].length > 0) {
      initials += parts[i][0].toUpperCase();
    }
  }
  return initials || name[0].toUpperCase() || '?';
}

export const CATEGORIES = [
  "Fantasy", "Sci-Fi", "Romance", "Anime", 
  "Historique", "Contemporain", "Mystery", "Horreur",
  "Comedy", "Action", "Drama", "Other"
];

export const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
];
