import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface SearchResult {
  resultId: string;
  title: string;
  matchText: string;
  matchIndex: number;
}

interface ProcessContentSearchProps {
  analysisResults: Array<{
    id: string;
    prompt_title: string;
    result_content: string | null;
  }>;
  onResultClick?: (resultId: string, matchIndex: number) => void;
}

export function ProcessContentSearch({ analysisResults, onResultClick }: ProcessContentSearchProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const availableCards = [
    'Visão Geral do Processo',
    'Resumo Estratégico',
    'Comunicações e Prazos',
    'Admissibilidade Recursal',
    'Estratégias Jurídicas',
    'Riscos e Alertas',
    'Balanço Financeiro',
    'Mapa de Preclusões',
    'Conclusões e Perspectivas'
  ];

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedFilters, analysisResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsContainerRef.current &&
        !resultsContainerRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = (query: string) => {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    let filteredResults = analysisResults;
    if (selectedFilters.length > 0) {
      filteredResults = analysisResults.filter(result =>
        selectedFilters.includes(result.prompt_title)
      );
    }

    filteredResults.forEach((result) => {
      if (!result.result_content) return;

      const lowerContent = result.result_content.toLowerCase();
      let startIndex = 0;
      let matchCount = 0;

      while (true) {
        const index = lowerContent.indexOf(lowerQuery, startIndex);
        if (index === -1) break;

        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(result.result_content.length, index + query.length + 50);
        let matchText = result.result_content.substring(contextStart, contextEnd);

        if (contextStart > 0) matchText = '...' + matchText;
        if (contextEnd < result.result_content.length) matchText = matchText + '...';

        results.push({
          resultId: result.id,
          title: result.prompt_title,
          matchText,
          matchIndex: matchCount
        });

        matchCount++;
        startIndex = index + query.length;
      }
    });

    setSearchResults(results);
    setShowResults(results.length > 0);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setSelectedFilters([]);
    searchInputRef.current?.focus();
  };

  const handleResultClick = (result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result.resultId, result.matchIndex);
    }
    setShowResults(false);
  };

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              className="rounded px-0.5"
              style={{
                backgroundColor: theme === 'dark' ? '#FCD34D' : '#FEF3C7',
                color: theme === 'dark' ? '#78350F' : '#92400E'
              }}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <div
            className="flex items-center rounded-xl border shadow-sm transition-all"
            style={{
              backgroundColor: colors.bgSecondary,
              borderColor: showResults ? '#3B82F6' : theme === 'dark' ? '#374151' : '#E5E7EB'
            }}
          >
            <div className="pl-4 pr-2">
              <Search
                className="w-5 h-5"
                style={{ color: isSearching ? '#3B82F6' : colors.textSecondary }}
              />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Buscar no conteúdo da análise..."
              className="flex-1 py-3 px-2 bg-transparent outline-none text-sm"
              style={{ color: colors.textPrimary }}
            />
            {(searchQuery || selectedFilters.length > 0) && (
              <button
                onClick={handleClearSearch}
                className="px-3 py-1 rounded-lg hover:bg-opacity-10 transition-colors"
                style={{ color: colors.textSecondary }}
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showResults && searchResults.length > 0 && (
            <div
              ref={resultsContainerRef}
              className="absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-lg z-50 max-h-96 overflow-y-auto"
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: theme === 'dark' ? '#374151' : '#E5E7EB'
              }}
            >
              <div className="p-2">
                <div
                  className="px-3 py-2 text-xs font-semibold sticky top-0 z-10"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    color: colors.textSecondary
                  }}
                >
                  {searchResults.length} {searchResults.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                </div>
                <div className="space-y-1">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.resultId}-${index}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-opacity-80"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.5)' : 'rgba(243, 244, 246, 0.5)'
                      }}
                    >
                      <div className="flex items-start space-x-2">
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-xs font-semibold mb-1"
                            style={{ color: '#3B82F6' }}
                          >
                            {result.title}
                          </div>
                          <div
                            className="text-xs leading-relaxed"
                            style={{ color: colors.textSecondary }}
                          >
                            {highlightMatch(result.matchText, searchQuery)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 px-4 py-3 rounded-xl border transition-all hover:shadow-sm"
          style={{
            backgroundColor: selectedFilters.length > 0 ? '#3B82F6' : colors.bgSecondary,
            borderColor: selectedFilters.length > 0 ? '#3B82F6' : theme === 'dark' ? '#374151' : '#E5E7EB',
            color: selectedFilters.length > 0 ? '#FFFFFF' : colors.textPrimary
          }}
          title="Filtrar por card"
        >
          <Filter className="w-4 h-4" />
          {selectedFilters.length > 0 && (
            <span className="text-xs font-semibold">{selectedFilters.length}</span>
          )}
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {showFilters && (
        <div
          className="mt-2 p-3 rounded-xl border"
          style={{
            backgroundColor: colors.bgSecondary,
            borderColor: theme === 'dark' ? '#374151' : '#E5E7EB'
          }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
            Filtrar por análise:
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCards.map((card) => (
              <button
                key={card}
                onClick={() => toggleFilter(card)}
                className="px-3 py-1.5 text-xs rounded-lg border transition-all"
                style={{
                  backgroundColor: selectedFilters.includes(card)
                    ? '#3B82F6'
                    : colors.bgPrimary,
                  borderColor: selectedFilters.includes(card)
                    ? '#3B82F6'
                    : theme === 'dark' ? '#374151' : '#E5E7EB',
                  color: selectedFilters.includes(card)
                    ? '#FFFFFF'
                    : colors.textPrimary
                }}
              >
                {card}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
