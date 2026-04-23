import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { Button } from '../components/ui/Button';
import { Sparkles, MessageSquare, Wand2, Zap } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function LandingPage() {
  const { user, isLoading } = useAuthStore();

  if (!isLoading && user) {
    return <Navigate to="/home" />;
  }

  return (
    <PageWrapper>
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-primary-900/10 to-transparent pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-white/5 border border-primary-500/30 mb-8 animate-fade-in backdrop-blur-md">
            <img src="/logoNexus.jpg" alt="Nexus Logo" className="w-4 h-4 rounded-full" />
            <span className="text-sm font-medium text-primary-100 font-serif italic">L'avenir du Character AI est là</span>
          </div>
          
          <h1 className="font-serif text-5xl md:text-7xl lg:text-[84px] font-bold tracking-tight mb-8">
            Des conversations qui <br className="hidden md:block" />
            <span className="gradient-text">prennent vie.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed font-sans font-light">
            Nexus vous permet de concevoir, d'interagir et d'explorer des personnages IA sans limites. 
            Une immersion totale propulsée par l'intelligence de NVIDIA NIM.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto">
                Commencer l'aventure
              </Button>
            </Link>
            <Link to="/explore">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                Explorer les personnages
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-20 border-t border-white/5">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="glass-card p-8 group hover:-translate-y-2 transition-transform duration-300">
            <div className="w-14 h-14 bg-surface-800 rounded-sm flex items-center justify-center mb-6 border border-primary-500/30 shadow-[0_0_15px_rgba(197,155,39,0.1)] group-hover:shadow-[0_0_25px_rgba(197,155,39,0.3)] transition-all">
              <MessageSquare className="w-7 h-7 text-primary-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 font-serif">Hyper-Réalisme</h3>
            <p className="text-text-secondary leading-relaxed font-light text-sm">
              Des interactions fluides avec des IA qui comprennent la nuance, gardent le contexte et respectent parfaitement leur comportement.
            </p>
          </div>
          <div className="glass-card p-8 group hover:-translate-y-2 transition-transform duration-300">
            <div className="w-14 h-14 bg-surface-800 rounded-sm flex items-center justify-center mb-6 border border-primary-500/30 shadow-[0_0_15px_rgba(197,155,39,0.1)] group-hover:shadow-[0_0_25px_rgba(197,155,39,0.3)] transition-all">
              <Wand2 className="w-7 h-7 text-primary-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 font-serif">Création Libre</h3>
            <p className="text-text-secondary leading-relaxed font-light text-sm">
              Façonnez l'histoire, le ton et les souvenirs de votre personnage avec des formulaires de paramètres avancés offrant un contrôle total.
            </p>
          </div>
          <div className="glass-card p-8 group hover:-translate-y-2 transition-transform duration-300">
            <div className="w-14 h-14 bg-surface-800 rounded-sm flex items-center justify-center mb-6 border border-primary-500/30 shadow-[0_0_15px_rgba(197,155,39,0.1)] group-hover:shadow-[0_0_25px_rgba(197,155,39,0.3)] transition-all">
              <Zap className="w-7 h-7 text-primary-400" />
            </div>
            <h3 className="text-xl font-bold mb-3 font-serif">Super-Rapide</h3>
            <p className="text-text-secondary leading-relaxed font-light text-sm">
              Propulsé par la technologie de NVIDIA NIM pour des temps de réponse instantanés via streaming en temps réel sous vos yeux.
            </p>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
