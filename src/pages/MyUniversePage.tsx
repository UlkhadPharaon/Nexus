import React, { useEffect, useState } from 'react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { useAuthStore } from '../stores/authStore';
import { getUserCharacters, deleteCharacter } from '../services/firestore';
import { Character } from '../types';
import { CharacterCard } from '../components/character/CharacterCard';
import { Sparkles, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export default function MyUniversePage() {
  const { user } = useAuthStore();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCharacters = async () => {
    if (user) {
      try {
        const data = await getUserCharacters(user.uid);
        setCharacters(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, [user]);

  const handleDeleteCharacter = async (characterId: string) => {
    try {
      await deleteCharacter(characterId);
      toast.success('Personnage supprimé');
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      setDeletingId(null);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <PageWrapper className="pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-serif font-bold mb-8">Mon Univers</h1>
        
        {characters.length === 0 ? (
          <div className="glass-card p-12 text-center border-white/5 bg-surface-900/40">
             <h2 className="text-xl font-serif font-bold mb-2">Aucun personnage</h2>
             <p className="text-text-secondary font-light">Vous n'avez pas encore créé de personnage.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {characters.map((char, i) => (
              <CharacterCard 
                key={char.id} 
                character={char} 
                index={i} 
                onDelete={(id) => setDeletingId(id)}
              />
            ))}
          </div>
        )}

        {/* Modal de confirmation de suppression */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-surface-900 border border-white/10 p-6 rounded-xl max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-2">Supprimer le personnage ?</h3>
              <p className="text-text-secondary text-sm mb-6">Cette action est irréversible. Toutes les statistiques et l'existence du personnage dans votre univers seront supprimées.</p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setDeletingId(null)}>Annuler</Button>
                <Button variant="danger" className="flex-1" onClick={() => deletingId && handleDeleteCharacter(deletingId)}>Supprimer</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
