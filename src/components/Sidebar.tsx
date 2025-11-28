import React from 'react';
import { Search, Plus, FileText, Sun, Bell, Coins, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  onNavigateToHome: () => void;
  onNavigateToAdmin?: () => void;
}

export function Sidebar({ onNavigateToHome, onNavigateToAdmin }: SidebarProps) {
  const { profile, isAdmin } = useAuth();

  return (
    <aside className="w-64 bg-wis-light h-screen fixed left-0 top-0 flex flex-col font-body border-r border-gray-200">
      <div className="p-6">
        <button
          onClick={onNavigateToHome}
          className="hover:opacity-80 transition-opacity"
          title="Ir para página inicial"
        >
          <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-black.svg" alt="Wis Legal" className="h-8" />
        </button>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Buscar"><Search className="w-5 h-5" /><span className="text-sm font-medium">Busca</span></button>
        <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Novo processo"><Plus className="w-5 h-5" /><span className="text-sm font-medium">Novo processo</span></button>
        <button onClick={onNavigateToHome} className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Meus processos"><FileText className="w-5 h-5" /><span className="text-sm font-medium">Meus processos</span></button>
        <div className="pt-4 border-t border-gray-300 mt-4">
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Modo claro"><Sun className="w-5 h-5" /><span className="text-sm font-medium">Modo claro</span></button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Notificações"><Bell className="w-5 h-5" /><span className="text-sm font-medium">Notificações</span></button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Tokens"><Coins className="w-5 h-5" /><span className="text-sm font-medium">Tokens</span></button>
        </div>
        {isAdmin && onNavigateToAdmin && (
          <div className="pt-4 border-t border-gray-300 mt-4">
            <button onClick={onNavigateToAdmin} className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Administração"><Settings className="w-5 h-5" /><span className="text-sm font-medium">Admin</span></button>
          </div>
        )}
      </nav>
      <div className="p-3 border-t border-gray-300">
        <div className="flex items-center space-x-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-wis-card flex items-center justify-center text-white font-semibold">{profile?.first_name?.[0]}{profile?.last_name?.[0]}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{profile?.first_name} {profile?.last_name}</p><p className="text-xs text-gray-500 truncate">Meu perfil</p></div>
        </div>
      </div>
    </aside>
  );
}
