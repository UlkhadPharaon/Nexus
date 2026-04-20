import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Button } from '../components/ui/Button';
import { PlusCircle, Compass, MessageSquare, ChevronRight, Trash2 } from 'lucide-react';
import { getConversations, deleteConversation } from '../services/firestore';
import { Conversation } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const fetchConversations = async () => {
    if (user?.uid) {
      try {
        const data = await getConversations(user.uid);
        // Grouper par personnage pour n'afficher qu'une seule conversation (la plus récente) par personnage
        const seenCharacters = new Set<string>();
        const grouped = data.filter(conv => {
          if (seenCharacters.has(conv.characterId)) return false;
          seenCharacters.add(conv.characterId);
          return true;
        });
        setConversations(grouped);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingInitial(false);
      }
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId);
      toast.success('Conversation supprimée');
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setDeletingId(null);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (!authLoading && !user) {
    return <Navigate to="/auth" />;
  }

  if (authLoading || loadingInitial) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  return (
    <PageWrapper className="pt-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-serif font-bold mb-2">Bienvenue, {user?.displayName}</h1>
            <p className="text-text-secondary font-light">Reprenez vos conversations où vous les avez laissées.</p>
          </div>
          <div className="flex gap-3">
            <Link to="/explore" className="sm:hidden">
              <Button variant="ghost" className="border border-white/5 flex items-center justify-center h-10 w-10 p-0">
                <Compass className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/explore" className="hidden sm:block">
              <Button variant="ghost" className="border border-white/5 flex items-center justify-center">
                <Compass className="w-4 h-4 mr-2" />
                Explorer
              </Button>
            </Link>
            <Link to="/create">
              <Button className="flex items-center justify-center">
                <PlusCircle className="w-4 h-4 mr-2 hidden sm:block" />
                <PlusCircle className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">Nouveau</span>
              </Button>
            </Link>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="glass-card p-12 text-center border-white/5 bg-surface-900/40">
            <div className="w-16 h-16 bg-surface-800 rounded-sm flex items-center justify-center mx-auto mb-4 border border-white/5">
              <MessageSquare className="w-8 h-8 text-primary-500" />
            </div>
            <h2 className="text-xl font-serif font-bold mb-2">Aucune conversation</h2>
            <p className="text-text-secondary mb-6 max-w-md mx-auto font-light">
              Vous n'avez pas encore commencé de discussion. Explorez les personnages publics ou créez le vôtre !
            </p>
            <Link to="/explore">
              <Button>Découvrir des personnages</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {conversations.map((conv) => (
              <div key={conv.id} className="glass-card overflow-hidden group hover:border-primary-500/30 transition-colors flex items-center relative border border-white/5">
                <Link to={`/chat/${conv.characterId}`} className="flex-1 flex items-center gap-4 p-4 hover:bg-surface-800 transition-colors min-w-0">
                  <Avatar src={conv.characterAvatarUrl} alt={conv.characterName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-serif font-bold text-sm truncate pr-2 group-hover:text-primary-400 transition-colors">{conv.characterName}</h3>
                      {conv.lastMessageAt && (
                        <span className="text-[10px] text-text-secondary whitespace-nowrap italic">
                          {formatDistanceToNow(conv.lastMessageAt.toDate(), { addSuffix: true, locale: fr })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate font-light">
                      {conv.lastMessage || "Nouvelle conversation..."}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <div className="flex items-center gap-2 pr-4 py-4">
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingId(conv.id); }}
                    className="h-9 w-9 text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-opacity"
                    title="Supprimer la conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de confirmation de suppression */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-surface-900 border border-white/10 p-6 rounded-xl max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-2">Supprimer la conversation ?</h3>
              <p className="text-text-secondary text-sm mb-6">Cette action est irréversible. Tous les messages de cette conversation seront perdus.</p>
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setDeletingId(null)}>Annuler</Button>
                <Button variant="danger" className="flex-1" onClick={() => deletingId && handleDeleteConversation(deletingId)}>Supprimer</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
