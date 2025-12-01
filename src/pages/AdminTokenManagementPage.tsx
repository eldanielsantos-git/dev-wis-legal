import React, { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { tokenService, type UserTokenQuota } from '../services/TokenService';
import { Activity, Users, TrendingUp, Edit2, Save, X, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface UserQuotaWithProfile extends UserTokenQuota {
  email: string;
  first_name: string;
  last_name: string;
}

interface AdminTokenManagementPageProps {
  onNavigateToApp: () => void;
}

export function AdminTokenManagementPage({ onNavigateToApp }: AdminTokenManagementPageProps) {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserQuotaWithProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserQuotaWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      onNavigateToApp();
      return;
    }

    loadUsers();
    const interval = setInterval(loadUsers, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, onNavigateToApp]);

  useEffect(() => {
    filterUsers();
  }, [searchTerm, users]);

  const loadUsers = async () => {
    const data = await tokenService.getAllUsersTokenQuotas();
    setUsers(data);
    setLoading(false);
  };

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.first_name?.toLowerCase().includes(term) ||
        user.last_name?.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  };

  const handleEditQuota = (userId: string, currentQuota: number) => {
    setEditingUserId(userId);
    setEditValue(currentQuota);
  };

  const handleSaveQuota = async (userId: string) => {
    const success = await tokenService.updateUserQuota(userId, editValue);
    if (success) {
      setEditingUserId(null);
      loadUsers();
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditValue(0);
  };

  const totalUsersWithQuota = users.length;
  const totalTokensUsedAllUsers = users.reduce(
    (sum, user) => sum + user.tokens_used_this_month,
    0
  );
  const totalQuotaAllUsers = users.reduce((sum, user) => sum + user.monthly_quota, 0);
  const averageUsagePercent =
    totalQuotaAllUsers > 0 ? (totalTokensUsedAllUsers / totalQuotaAllUsers) * 100 : 0;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              Gerenciamento de Tokens
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gerencie cotas e monitore o uso de tokens por usuário
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Usuários com Cota
                  </h3>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {totalUsersWithQuota}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Usado Este Mês
                  </h3>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {tokenService.formatTokenCount(totalTokensUsedAllUsers)}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-[#255886] dark:text-sky-400" />
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Uso Médio
                  </h3>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {averageUsagePercent.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Usuários e Cotas
                  </h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar usuários..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Cota Mensal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Usado Este Mês
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Restante
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Uso %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          Carregando...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                          Nenhum usuário encontrado
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((userQuota) => {
                        const usagePercent = tokenService.getUsagePercentage(
                          userQuota.tokens_used_this_month,
                          userQuota.monthly_quota
                        );
                        const usageColor = tokenService.getUsageColor(usagePercent);
                        const remaining = userQuota.monthly_quota - userQuota.tokens_used_this_month;

                        return (
                          <tr key={userQuota.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {userQuota.first_name} {userQuota.last_name}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {userQuota.email}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingUserId === userQuota.user_id ? (
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                  className="w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                              ) : (
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {tokenService.formatTokenCount(userQuota.monthly_quota)}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900 dark:text-white">
                                {tokenService.formatTokenCount(userQuota.tokens_used_this_month)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-sm font-medium ${usageColor}`}>
                                {tokenService.formatTokenCount(remaining)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div
                                    className={`${tokenService.getUsageBarColor(
                                      usagePercent
                                    )} h-2 rounded-full`}
                                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-medium ${usageColor}`}>
                                  {usagePercent.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {editingUserId === userQuota.user_id ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleSaveQuota(userQuota.user_id)}
                                    className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleEditQuota(userQuota.user_id, userQuota.monthly_quota)
                                  }
                                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Editar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
