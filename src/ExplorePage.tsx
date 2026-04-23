import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageWrapper } from '../components/layout/PageWrapper';
import { CharacterCard } from '../components/character/CharacterCard';
import { getPublicCharacters } from '../services/firestore';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Search, Filter, Loader2 } from 'lucide-react';
import { CATEGORIES } from '../utils/helpers';

export default function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: characters, isLoading, error } = useQuery({
    queryKey: ['publicCharacters'],
    queryFn: getPublicCharacters,
  });

  const filteredCharacters = characters?.filter(char => {
    const matchesSearch = char.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          char.tagline.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? char.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <PageWrapper className="pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex-1 max-w-2xl">
            <h1 className="text-4xl font-serif font-bold mb-4">Explorer</h1>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <Input 
                placeholder="Rechercher un personnage, un univers..." 
                className="pl-12 h-14 text-lg bg-surface-900 border-white/5 rounded-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-text-secondary overflow-x-auto pb-2 scrollbar-hide md:pb-0 scroll-smooth">
            <Filter className="w-5 h-5 shrink-0 mr-2 hidden sm:block" />
            <button 
              onClick={() => setSelectedCategory(null)}
              className={`px-3 sm:px-4 py-2 rounded-sm whitespace-nowrap text-sm font-medium transition-colors ${!selectedCategory ? 'bg-primary-600 text-surface-950' : 'bg-surface-800 hover:bg-surface-700 text-text-secondary'}`}
            >
              Tous
            </button>
            {CATEGORIES.slice(0, 5).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 sm:px-4 py-2 rounded-sm whitespace-nowrap text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-primary-600 text-surface-950' : 'bg-surface-800 hover:bg-surface-700 text-text-secondary'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">
            Une erreur est survenue lors du chargement des personnages.
          </div>
        ) : filteredCharacters && filteredCharacters.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCharacters.map((char, i) => (
              <CharacterCard key={char.id} character={char} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-surface-900/40 rounded-sm border border-white/5 mx-auto max-w-2xl">
            <div className="w-16 h-16 bg-surface-800 rounded-sm flex items-center justify-center mx-auto mb-4 border border-white/5">
              <Search className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="text-xl font-bold mb-2 font-serif">Aucun résultat</h3>
            <p className="text-text-secondary font-light">
              Nous n'avons trouvé aucun personnage correspondant à votre recherche.
            </p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
