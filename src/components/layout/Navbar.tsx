import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { auth } from '../../config/firebase';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Sparkles, Compass, LogOut, Shield, MessageSquare, Globe } from 'lucide-react';

export function Navbar() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-surface-950/80 backdrop-blur-xl z-50">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logoNexus.jpg" alt="Nexus Logo" className="w-6 h-6 rounded-full" />
            <span className="font-serif italic font-bold text-xl tracking-wide text-primary-100">Nexus</span>
          </Link>
          
          {user && (
            <div className="flex items-center gap-1">
              <Link to="/home">
                <Button variant="ghost" title="Mes Chats" className="h-9 px-2 sm:px-3 flex items-center justify-center bg-surface-800/50 hover:bg-surface-700 border border-white/5 text-text-secondary hover:text-white transition-all">
                  <MessageSquare className="w-4 h-4 sm:mr-2" />
                  <span className="hidden md:inline">Mes Chats</span>
                </Button>
              </Link>
              <Link to="/explore">
                <Button variant="ghost" title="Explorer" className="h-9 px-2 sm:px-3 flex items-center justify-center bg-surface-800/50 hover:bg-surface-700 border border-white/5 text-text-secondary hover:text-white transition-all">
                  <Compass className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Explorer</span>
                </Button>
              </Link>
              <Link to="/universe">
                <Button variant="ghost" title="Mon Univers" className="h-9 px-2 sm:px-3 flex items-center justify-center bg-surface-800/50 hover:bg-surface-700 border border-white/5 text-text-secondary hover:text-white transition-all">
                   <Globe className="w-4 h-4 sm:mr-2 text-primary-400" />
                   <span className="hidden sm:inline">Univers</span>
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/create">
                <Button variant="primary" size="sm" className="hidden sm:inline-flex">
                  + Créer
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                {user.email === 'ulrichtapsoba2009@gmail.com' && (
                  <Link to="/admin">
                    <Button variant="ghost" size="icon" className="h-9 w-9 bg-surface-800 hover:bg-surface-700 text-red-400 border border-white/5 transition-colors">
                      <Shield className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
                <Link to="/profile" className="ring-2 ring-transparent hover:ring-primary-500/50 rounded-full transition-all">
                  <Avatar src={user.photoURL} alt={user.displayName} size="sm" />
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9 bg-surface-800 hover:bg-surface-700 text-text-secondary hover:text-white border border-white/5 transition-colors">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="primary" size="sm">Connexion</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
