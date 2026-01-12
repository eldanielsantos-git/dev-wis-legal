import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Scale, LogOut, User } from 'lucide-react';
import { PricingSection } from './components/PricingSection';
import { UserSubscription } from './components/UserSubscription';
import { AuthForm } from './components/AuthForm';
import { Success } from './pages/Success';
import { supabase } from './lib/supabase';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Scale className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Wis Legal</h1>
              </div>

              <div className="flex items-center gap-4">
                {user && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="w-4 h-4" />
                      {user.email}
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <Routes>
          <Route path="/success" element={<Success />} />
          <Route path="/" element={
            <main className="py-8">
              {!user ? (
                <div className="max-w-md mx-auto px-4">
                  <AuthForm 
                    mode={authMode} 
                    onToggle={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} 
                  />
                </div>
              ) : (
                <div className="max-w-7xl mx-auto px-4">
                  {/* User Subscription Status */}
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Meu Plano</h2>
                    <UserSubscription />
                  </div>

                  {/* Pricing Section */}
                  <PricingSection />
                </div>
              )}
            </main>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;