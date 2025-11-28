import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Loader, Calendar } from 'lucide-react';
import { ProcessosService } from '../services/ProcessosService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import type { Processo } from '../lib/supabase';

interface IntelligentSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProcess: (processoId: string) => void;
}

export function IntelligentSearch({ isOpen, onClose, onSelectProcess }: IntelligentSearchProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const searchProcessos = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const allProcessos = await ProcessosService.getProcessos();
        const query = searchQuery.toLowerCase();

        const filtered = allProcessos.filter(processo => {
          const fileNameMatch = processo.file_name.toLowerCase().includes(query);

          const contentMatch = processo.paginas?.some(pagina =>
            pagina.text?.toLowerCase().includes(query)
          ) || false;

          const forensicMatch = false;

          return fileNameMatch || contentMatch || forensicMatch;
        });

        const sortedResults = filtered.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setSearchResults(sortedResults);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Erro na busca:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchProcessos, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      handleSelectProcess(searchResults[selectedIndex].id);
    }
  };

  const handleSelectProcess = (processoId: string) => {
    onSelectProcess(processoId);
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{
              backgroundColor: theme === 'dark' ? '#fbbf24' : '#fef3c7',
              color: theme === 'dark' ? '#111827' : '#92400e'
            }}>{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const overlayBg = theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)';
  const hoverBg = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const selectedBg = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 backdrop-blur-sm"
      style={{ backgroundColor: overlayBg }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden"
        style={{ backgroundColor: colors.bgSecondary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-6 py-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <Search className="w-5 h-5 mr-3" style={{ color: colors.textSecondary }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar por nome do arquivo ou conteúdo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none"
            style={{ color: colors.textPrimary, caretColor: colors.textPrimary }}
          />
          {loading && <Loader className="w-5 h-5 animate-spin mr-3" style={{ color: colors.textSecondary }} />}
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: colors.textSecondary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {searchQuery.trim().length < 2 ? (
            <div className="px-6 py-8 text-center" style={{ color: colors.textSecondary }}>
              <Search className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textTertiary }} />
              <p className="text-sm">Digite pelo menos 2 caracteres para buscar</p>
              <p className="text-xs mt-2">Busque por nome do arquivo, conteúdo do PDF ou análise forense</p>
            </div>
          ) : searchResults.length === 0 && !loading ? (
            <div className="px-6 py-8 text-center" style={{ color: colors.textSecondary }}>
              <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textTertiary }} />
              <p className="text-sm">Nenhum resultado encontrado para "{searchQuery}"</p>
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((processo, index) => (
                <button
                  key={processo.id}
                  onClick={() => handleSelectProcess(processo.id)}
                  className="w-full px-6 py-3 flex items-start space-x-4 transition-colors"
                  style={{
                    backgroundColor: index === selectedIndex ? selectedBg : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (index !== selectedIndex) {
                      e.currentTarget.style.backgroundColor = hoverBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (index !== selectedIndex) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <FileText className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: colors.textSecondary }} />
                  <div className="flex-1 text-left min-w-0">
                    <h3 className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                      {highlightMatch(processo.file_name, searchQuery)}
                    </h3>
                    <div className="flex items-center space-x-3 mt-1 text-xs" style={{ color: colors.textSecondary }}>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(processo.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span>{formatFileSize(processo.file_size)}</span>
                      <span>{processo.transcricao?.totalPages || 0} páginas</span>
                    </div>
                    {processo.status === 'completed' && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{
                          backgroundColor: theme === 'dark' ? '#064e3b' : '#d1fae5',
                          color: theme === 'dark' ? '#a7f3d0' : '#065f46'
                        }}>
                          Completo
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 flex items-center justify-between text-xs" style={{
          borderTop: `1px solid ${colors.border}`,
          color: colors.textSecondary
        }}>
          <div className="flex space-x-4">
            <span>↑↓ Navegar</span>
            <span>↵ Selecionar</span>
            <span>ESC Fechar</span>
          </div>
          {searchResults.length > 0 && (
            <span>{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
