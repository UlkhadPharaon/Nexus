import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, createUserProfile } from '../services/firestore';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { Sparkles, Mail } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      let userProfile = await getUserProfile(result.user.uid);
      if (!userProfile) {
        await createUserProfile({
          uid: result.user.uid,
          displayName: result.user.displayName || 'Utilisateur',
          email: result.user.email!,
          photoURL: result.user.photoURL,
          bio: '',
          preferredModel: 'mistral-small',
          createdAt: new Date() as any,
          stats: { charactersCreated: 0, totalMessages: 0, totalConversations: 0 }
        });
      }
      toast.success('Connexion réussie !');
      setLoading(true);
      navigate('/home');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la connexion');
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Bon retour !');
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfile({
          uid: result.user.uid,
          displayName: displayName || email.split('@')[0],
          email: result.user.email!,
          photoURL: null,
          bio: '',
          preferredModel: 'mistral-small',
          createdAt: new Date() as any,
          stats: { charactersCreated: 0, totalMessages: 0, totalConversations: 0 }
        });
        toast.success('Compte créé avec succès !');
      }
      setLoading(true);
      navigate('/home');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'authentification');
      setIsLoading(false);
    }
  };

  return (
    <PageWrapper className="flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-500/10 rounded-xl mb-4">
            <Sparkles className="w-6 h-6 text-primary-400" />
          </div>
          <h2 className="font-display text-2xl font-bold">
            {isLogin ? 'Bon retour' : 'Créez votre compte'}
          </h2>
          <p className="text-text-secondary mt-2">
            Rejoignez Nexus pour créer des IA uniques.
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          {!isLogin && (
            <Input
              label="Nom d'utilisateur"
              placeholder="Ex: Architecte IA"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <Button className="w-full" type="submit" isLoading={isLoading}>
            <Mail className="w-4 h-4 mr-2" />
            {isLogin ? 'Se connecter' : "S'inscrire"}
          </Button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-surface-800 text-text-muted">Ou continuer avec</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full bg-white text-black hover:bg-gray-100"
          onClick={handleGoogleAuth}
          disabled={isLoading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-3" alt="Google" />
          Google
        </Button>

        <div className="mt-8 text-center text-sm text-text-secondary">
          {isLogin ? "Pas encore de compte ? " : "Déjà un compte ? "}
          <button
            type="button"
            className="text-primary-400 hover:text-primary-300 font-medium"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}
