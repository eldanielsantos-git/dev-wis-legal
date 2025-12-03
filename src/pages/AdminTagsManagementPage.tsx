import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { Tag, Plus, Edit3, Trash2, ChevronLeft, Search, Check, X } from 'lucide-react';
import type { ProcessoTag, CreateTagInput } from '../lib/supabase';
import { ProcessoTagsService } from '../services/ProcessoTagsService';
import { ProcessoTagComponent } from '../components/tags/ProcessoTag';
import { TagColorPicker } from '../components/tags/TagColorPicker';
import { generateTagSlug, isValidHexColor } from '../utils/tagColors';

interface AdminTagsManagementPageProps {
  onNavigateToAdmin: () => void;
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminTagsManagementPage({
  onNavigateToAdmin,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminTagsManagementPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [tags, setTags] = useState<ProcessoTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ProcessoTag | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    description: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const allTags = await ProcessoTagsService.getAllTags(true);
      const sortedTags = allTags.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setTags(sortedTags);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreateModal = () => {
    setEditingTag(null);
    setFormData({
      name: '',
      color: '#3B82F6',
      description: '',
      is_active: true
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (tag: ProcessoTag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
      is_active: tag.is_active
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Nome deve ter pelo menos 2 caracteres';
    } else if (formData.name.trim().length > 30) {
      errors.name = 'Nome deve ter no máximo 30 caracteres';
    }

    if (!isValidHexColor(formData.color)) {
      errors.color = 'Cor inválida';
    }

    if (formData.description && formData.description.length > 200) {
      errors.description = 'Descrição deve ter no máximo 200 caracteres';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingTag) {
        await ProcessoTagsService.updateTag(editingTag.id, {
          name: formData.name.trim(),
          color: formData.color,
          description: formData.description.trim() || null,
          is_active: formData.is_active
        });
      } else {
        const input: CreateTagInput = {
          name: formData.name.trim(),
          color: formData.color,
          description: formData.description.trim() || undefined,
          is_active: formData.is_active
        };
        await ProcessoTagsService.createTag(input);
      }

      setIsFormModalOpen(false);
      await loadTags();
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar tag');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tag: ProcessoTag) => {
    const confirmMessage = tag.usage_count > 0
      ? `Esta tag está sendo usada em ${tag.usage_count} processo(s). Tem certeza que deseja desativá-la?`
      : `Tem certeza que deseja excluir a tag "${tag.name}"?`;

    if (!confirm(confirmMessage)) return;

    try {
      await ProcessoTagsService.deleteTag(tag.id, tag.usage_count === 0);
      await loadTags();
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir tag');
    }
  };

  const handleToggleActive = async (tag: ProcessoTag) => {
    try {
      await ProcessoTagsService.updateTag(tag.id, {
        is_active: !tag.is_active
      });
      await loadTags();
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar tag');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToProfile={onNavigateToProfile}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-6">
            <button
              onClick={onNavigateToAdmin}
              className="flex items-center gap-2 text-sm mb-4 hover:opacity-70 transition-opacity"
              style={{ color: colors.textSecondary }}
            >
              <ChevronLeft size={16} />
              Voltar para Administração
            </button>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
                  <Tag className="w-6 h-6" style={{ color: '#8B5CF6' }} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                    Gestão de Tags
                  </h1>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Crie e gerencie tags para classificar processos
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
              >
                <Plus size={18} />
                Nova Tag
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: colors.textSecondary }} />
              <input
                type="text"
                placeholder="Buscar tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.border,
                  color: colors.textPrimary
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12" style={{ color: colors.textSecondary }}>
              Carregando tags...
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <Tag className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
              <p style={{ color: colors.textSecondary }}>
                {searchQuery ? 'Nenhuma tag encontrada' : 'Nenhuma tag cadastrada'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: colors.bgTertiary }}>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Preview</th>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Descrição</th>
                    <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: colors.textSecondary }}>Processos</th>
                    <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: colors.textSecondary }}>Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: colors.textSecondary }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.map((tag, index) => (
                    <tr
                      key={tag.id}
                      className="border-t transition-colors hover:bg-opacity-50"
                      style={{ borderColor: colors.border, backgroundColor: index % 2 === 0 ? 'transparent' : colors.bgTertiary }}
                    >
                      <td className="px-4 py-3">
                        <ProcessoTagComponent tag={tag} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium" style={{ color: colors.textPrimary }}>{tag.name}</span>
                        <div className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>{tag.slug}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="text-sm line-clamp-2" style={{ color: colors.textSecondary }}>
                          {tag.description || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: colors.bgTertiary, color: colors.textPrimary }}>
                          {tag.usage_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(tag)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: tag.is_active ? '#10B981' : '#6B7280',
                            color: '#FFFFFF'
                          }}
                        >
                          {tag.is_active ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(tag)}
                            className="p-2 rounded-lg transition-opacity hover:opacity-70"
                            style={{ backgroundColor: colors.bgTertiary }}
                            title="Editar"
                          >
                            <Edit3 size={16} style={{ color: colors.textPrimary }} />
                          </button>
                          <button
                            onClick={() => handleDelete(tag)}
                            className="p-2 rounded-lg transition-opacity hover:opacity-70"
                            style={{ backgroundColor: colors.bgTertiary }}
                            title="Excluir"
                          >
                            <Trash2 size={16} style={{ color: '#EF4444' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </div>

      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => !isSaving && setIsFormModalOpen(false)}
        >
          <div
            className="rounded-lg shadow-2xl w-full max-w-md"
            style={{ backgroundColor: colors.bgPrimary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border }}>
              <h2 className="text-lg font-bold" style={{ color: colors.textPrimary }}>
                {editingTag ? 'Editar Tag' : 'Nova Tag'}
              </h2>
              <button
                onClick={() => !isSaving && setIsFormModalOpen(false)}
                className="p-1 rounded hover:opacity-70 transition-opacity"
                style={{ color: colors.textSecondary }}
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                  Nome da Tag *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: formErrors.name ? '#EF4444' : colors.border,
                    color: colors.textPrimary
                  }}
                  placeholder="Digite o nome da tag"
                  maxLength={30}
                  disabled={isSaving}
                />
                {formErrors.name && (
                  <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{formErrors.name}</p>
                )}
                <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  {formData.name.length}/30 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                  Cor da Tag *
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-lg border-2"
                    style={{ backgroundColor: formData.color, borderColor: colors.border }}
                  />
                  <button
                    onClick={() => setIsColorPickerOpen(true)}
                    className="px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
                    style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
                    disabled={isSaving}
                  >
                    Escolher Cor
                  </button>
                  <span className="text-sm font-mono" style={{ color: colors.textSecondary }}>
                    {formData.color}
                  </span>
                </div>
                {formErrors.color && (
                  <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{formErrors.color}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 resize-none"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: formErrors.description ? '#EF4444' : colors.border,
                    color: colors.textPrimary
                  }}
                  placeholder="Digite uma descrição para a tag"
                  rows={3}
                  maxLength={200}
                  disabled={isSaving}
                />
                {formErrors.description && (
                  <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{formErrors.description}</p>
                )}
                <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  {formData.description.length}/200 caracteres
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                  disabled={isSaving}
                />
                <label htmlFor="is_active" className="text-sm" style={{ color: colors.textPrimary }}>
                  Tag ativa (tags inativas não aparecem para seleção)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: colors.border }}>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80 flex items-center gap-2"
                style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Check size={16} />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <TagColorPicker
        selectedColor={formData.color}
        onChange={(color) => setFormData({ ...formData, color })}
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
      />
    </div>
  );
}
