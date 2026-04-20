import React, { useState } from 'react';
import { Folder as FolderIcon, Plus, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Folder } from '../../types';

interface FolderManagerProps {
  folders: Folder[];
  onCreateFolder: (name: string) => Promise<void>;
  onSelectFolder: (folderId: string) => void;
}

export const FolderManager: React.FC<FolderManagerProps> = ({ folders, onCreateFolder, onSelectFolder }) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName);
    setNewFolderName('');
    setIsCreating(false);
  };

  return (
    <div className="bg-surface-900 border border-white/5 rounded-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FolderIcon className="w-4 h-4 text-primary-500" />
          Collections
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {isCreating && (
        <div className="flex gap-2">
          <input
            className="flex-1 bg-surface-950 text-sm p-2 rounded-sm border border-white/5 text-white"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nom de la collection"
            autoFocus
          />
          <Button size="sm" onClick={handleCreate}>OK</Button>
        </div>
      )}

      <div className="space-y-1">
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => onSelectFolder(folder.id)}
            className="w-full flex items-center justify-between p-2 text-sm text-text-secondary hover:bg-surface-800 rounded-sm transition-colors"
          >
            <span>{folder.name}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
};
