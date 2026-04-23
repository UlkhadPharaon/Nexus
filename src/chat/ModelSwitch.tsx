import React from 'react';
import { motion } from 'framer-motion';
import { ModelKey, NVIDIA_CONFIG } from '../../config/nvidia';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { updateUserPreferredModel } from '../../services/firestore';
import { Sparkles, Brain } from 'lucide-react';
import toast from 'react-hot-toast';

export function ModelSwitch() {
  const { currentModel, setCurrentModel } = useChatStore();
  const { user } = useAuthStore();

  const handleToggle = async (model: ModelKey) => {
    if (model === currentModel) return;
    
    setCurrentModel(model);
    toast.success(`Modèle changé pour ${NVIDIA_CONFIG.models[model].displayName}`);
    
    if (user) {
      try {
        await updateUserPreferredModel(user.uid, model);
      } catch (err) {
        console.error("Failed to update user preference", err);
      }
    }
  };

  const isNano = currentModel === 'nemotron-nano';

  return (
    <div className="relative inline-flex items-center p-1 bg-surface-800 rounded-full border border-white/5 shadow-inner group">
      {/* Background slider */}
      <motion.div
        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full z-0"
        style={{ backgroundColor: isNano ? 'rgba(204,55,171,0.2)' : 'rgba(98,81,238,0.2)' }}
        animate={{ 
          left: isNano ? 'calc(50% + 2px)' : '4px',
          boxShadow: isNano ? '0 0 10px rgba(204,55,171,0.4)' : '0 0 10px rgba(98,81,238,0.4)' 
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      
      <button
        onClick={() => handleToggle('mistral-small')}
        className={`relative z-10 flex items-center justify-center w-8 sm:w-auto sm:px-4 h-8 text-xs font-semibold transition-colors duration-200 rounded-full ${!isNano ? 'text-primary-300' : 'text-text-muted hover:text-text-secondary'}`}
        title={NVIDIA_CONFIG.models['mistral-small'].description}
      >
        <Brain className="w-3.5 h-3.5 sm:mr-1.5 shrink-0" />
        <span className="hidden sm:inline">Standard</span>
      </button>

      <button
        onClick={() => handleToggle('nemotron-nano')}
        className={`relative z-10 flex items-center justify-center w-8 sm:w-auto sm:px-4 h-8 text-xs font-semibold transition-colors duration-200 rounded-full ${isNano ? 'text-accent-300' : 'text-text-muted hover:text-text-secondary'}`}
        title={NVIDIA_CONFIG.models['nemotron-nano'].description}
      >
        <Sparkles className="w-3.5 h-3.5 sm:mr-1.5 shrink-0" />
        <span className="hidden sm:inline">Créatif</span>
      </button>
    </div>
  );
}
