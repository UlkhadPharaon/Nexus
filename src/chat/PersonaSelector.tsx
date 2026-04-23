import React, { useState, useEffect } from 'react';
import { Persona } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { User, Plus, Check, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface PersonaSelectorProps {
  onSelect: (persona: Persona) => void;
  onCancel?: () => void;
  currentPersonaId?: string;
}

export function PersonaSelector({ onSelect, onCancel, currentPersonaId }: PersonaSelectorProps) {
  const { user } = useAuthStore();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newPersona, setNewPersona] = useState({
    name: '',
    age: '',
    appearance: '',
    mentality: '',
    background: ''
  });

  useEffect(() => {
    if (!user) return;
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    try {
      const { getPersonas } = await import('../../services/firestore');
      const data = await getPersonas(user.uid);
      setPersonas(data);
    } catch (error) {
      console.error('Error loading personas:', error);
      toast.error('Erreur lors du chargement des personas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newPersona.name) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      const { createPersona, getPersona } = await import('../../services/firestore');
      const id = await createPersona(user.uid, newPersona);
      const persona = await getPersona(id);
      
      toast.success('Persona créé !');
      await loadPersonas();
      setShowCreateForm(false);
      setNewPersona({ name: '', age: '', appearance: '', mentality: '', background: '' });
      if (persona) {
        onSelect(persona);
      }
    } catch (error) {
      console.error('Error creating persona:', error);
      toast.error('Erreur lors de la création du persona');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-950/90 fixed inset-0 z-50">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm shadow-2xl">
      <div className="bg-surface-900 border border-white/10 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <User className="w-6 h-6 text-primary-400" />
            Profil du Voyageur
          </h3>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <p className="text-sm text-text-muted mb-6">
          Choisissez votre identité pour cette discussion. Cela influencera comment {personas.length > 0 ? "le personnage" : "les personnages"} vous perçoivent.
        </p>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 gap-3">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={`flex flex-col items-start p-4 rounded-xl border transition-all text-left group
                  ${currentPersonaId === p.id 
                    ? 'bg-primary-500/10 border-primary-500 shadow-lg' 
                    : 'bg-surface-800 border-white/5 hover:border-white/20'}`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`font-bold text-base ${currentPersonaId === p.id ? 'text-primary-400' : 'text-text-primary'}`}>
                    {p.name}
                  </span>
                  {currentPersonaId === p.id && <Check className="w-5 h-5 text-primary-500" />}
                </div>
                <p className="text-xs text-text-muted line-clamp-2 italic mb-3">"{p.background}"</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] px-2 py-1 bg-surface-950 rounded-lg border border-white/5 text-primary-300">Âge: {p.age}</span>
                  <span className="text-[10px] px-2 py-1 bg-surface-950 rounded-lg border border-white/5 text-primary-300">{p.mentality}</span>
                </div>
              </button>
            ))}

            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-white/5 bg-white/5 hover:bg-white/10 hover:border-primary-500/50 transition-all gap-2 group"
            >
              <Plus className="w-5 h-5 text-primary-500 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold text-text-muted group-hover:text-text-primary">Créer un nouveau Profil</span>
            </button>
          </div>

          <AnimatePresence>
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mt-4 p-4 bg-surface-800 rounded-xl border border-primary-500/30"
              >
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Nom</label>
                      <Input 
                        value={newPersona.name} 
                        onChange={(e) => setNewPersona({...newPersona, name: e.target.value})} 
                        placeholder="Votre nom"
                        className="h-10 text-sm bg-surface-950 border-white/5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Âge</label>
                      <Input 
                        value={newPersona.age} 
                        onChange={(e) => setNewPersona({...newPersona, age: e.target.value})} 
                        placeholder="Ex: 24"
                        className="h-10 text-sm bg-surface-950 border-white/5"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Apparence</label>
                    <Input 
                      value={newPersona.appearance} 
                      onChange={(e) => setNewPersona({...newPersona, appearance: e.target.value})} 
                      placeholder="Sombre, athlétique, yeux rouges..."
                      className="h-10 text-sm bg-surface-950 border-white/5"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Tempérament</label>
                    <Input 
                      value={newPersona.mentality} 
                      onChange={(e) => setNewPersona({...newPersona, mentality: e.target.value})} 
                      placeholder="Froid, sarcastique, héroïque..."
                      className="h-10 text-sm bg-surface-950 border-white/5"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Explications / Histoire</label>
                    <Textarea 
                      value={newPersona.background} 
                      onChange={(e) => setNewPersona({...newPersona, background: e.target.value})} 
                      placeholder="Comment êtes-vous arrivé ici ?"
                      className="text-sm min-h-[80px] bg-surface-950 border-white/5"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="submit" 
                      className="flex-1 shadow-lg shadow-primary-500/20" 
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
