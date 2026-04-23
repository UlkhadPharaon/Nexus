import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { auth, db } from './config/firebase';
import { useAuthStore } from './stores/authStore';
import { Navbar } from './components/layout/Navbar';
import { User } from './types';

// Lazy loading pages could be added here, but for simplicity we'll import directly for now
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ChatPage from './pages/ChatPage';
import CreateCharacterPage from './pages/CreateCharacterPage';
import ProfilePage from './pages/ProfilePage';
import MyUniversePage from './pages/MyUniversePage';
import AdminPage from './pages/AdminPage';

const queryClient = new QueryClient();

function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pt-16">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { setFirebaseUser, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (firebaseUser) {
        setLoading(true);
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as User);
          } else {
            setUser(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          setUser(null);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [setFirebaseUser, setUser, setLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster 
          position="top-center"
          toastOptions={{
            style: {
              background: '#0A0A0A',
              color: '#F5F5F5',
              border: '1px solid rgba(197, 155, 39, 0.3)',
              borderRadius: '2px', // sharp corners
            }
          }}
        />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/chat/:customId" element={<ChatPage />} />
            <Route path="/create" element={<CreateCharacterPage />} />
            <Route path="/edit/:characterId" element={<CreateCharacterPage />} />
            <Route path="/universe" element={<MyUniversePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
