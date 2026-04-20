import { create } from 'zustand';
import { ModelKey } from '../config/nvidia';

interface ChatState {
  currentModel: ModelKey;
  setCurrentModel: (model: ModelKey) => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  abortController: AbortController | null;
  setAbortController: (controller: AbortController | null) => void;
  cancelGeneration: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentModel: 'mistral-small',
  setCurrentModel: (model) => set({ currentModel: model }),
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  abortController: null,
  setAbortController: (abortController) => set({ abortController }),
  cancelGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isGenerating: false });
    }
  }
}));
