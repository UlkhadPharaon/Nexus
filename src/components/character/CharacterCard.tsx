import React from 'react';
import { Link } from 'react-router-dom';
import { Character } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { MessageSquare, Heart, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';

interface CharacterCardProps {
  character: Character;
  index?: number;
  onDelete?: (id: string) => void;
}

export function CharacterCard({ character, index = 0, onDelete }: CharacterCardProps) {
  const { user } = useAuthStore();
  const isOwner = user?.uid === character.creatorId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <div className="glass-card overflow-hidden group hover:shadow-[0_0_20px_rgba(197,155,39,0.15)] hover:border-primary-500/50 transition-all duration-300">
        <div className="p-5">
          <div className="flex gap-4 mb-4">
            <Avatar 
              src={character.avatarUrl} 
              alt={character.name} 
              fallbackColor={character.avatarColor}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-bold text-lg truncate group-hover:text-primary-400 transition-colors">
                {character.name}
              </h3>
              <p className="text-sm text-text-secondary font-light line-clamp-2 mt-1">
                {character.tagline}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <Badge variant="primary">{character.category}</Badge>
            {character.isNSFW && <Badge variant="danger">18+</Badge>}
            {character.tags.slice(0, 2).map(tag => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
            {character.tags.length > 2 && (
              <Badge variant="outline">+{character.tags.length - 2}</Badge>
            )}
          </div>

          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-3">
              <Link to={`/chat/${character.id}`}>
                <button className="text-sm font-serif font-semibold text-primary-500 hover:text-primary-400 transition-colors">
                  Discuter →
                </button>
              </Link>
              
              {isOwner && (
                <div className="flex items-center gap-1 border-l border-white/10 pl-3 ml-1">
                  <Link 
                    to={`/edit/${character.id}`} 
                    className="p-2 text-text-muted hover:text-white transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  {onDelete && (
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(character.id); }}
                      className="p-2 text-text-muted hover:text-red-500 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3 text-xs font-medium text-text-muted">
              <span className="flex items-center gap-1.5" title="Conversations">
                <MessageSquare className="w-3.5 h-3.5" />
                {character.stats.conversationCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5" title="Likes">
                <Heart className="w-3.5 h-3.5" />
                {character.stats.likes.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
