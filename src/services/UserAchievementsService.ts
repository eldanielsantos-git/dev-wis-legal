import { supabase } from '../lib/supabase';
import { Target, Star, Diamond, Trophy, Crown, User } from 'lucide-react';

export type AchievementType =
  | 'profile_complete'
  | 'first_process'
  | 'three_processes'
  | 'ten_processes'
  | 'fifty_processes'
  | 'hundred_processes';

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_type: AchievementType;
  unlocked_at: string;
  created_at: string;
}

export interface AchievementConfig {
  type: AchievementType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  requiredCount: number;
  badgeGradient: string;
}

export interface AchievementProgress {
  config: AchievementConfig;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  currentCount: number;
}

export const ACHIEVEMENTS: AchievementConfig[] = [
  {
    type: 'profile_complete',
    title: 'Perfil Wis',
    description: 'Complete 100% dos dados do seu perfil',
    icon: User,
    color: '#10B981',
    requiredCount: 9,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'first_process',
    title: 'Primeira Análise',
    description: 'Complete sua primeira análise',
    icon: Target,
    color: '#10B981',
    requiredCount: 1,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'three_processes',
    title: 'Iniciante',
    description: 'Complete 3 análises',
    icon: Star,
    color: '#10B981',
    requiredCount: 3,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'ten_processes',
    title: 'Experiente',
    description: 'Complete 10 análises',
    icon: Diamond,
    color: '#10B981',
    requiredCount: 10,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'fifty_processes',
    title: 'Expert',
    description: 'Complete 50 análises',
    icon: Trophy,
    color: '#10B981',
    requiredCount: 50,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'hundred_processes',
    title: 'Mestre Jurídico',
    description: 'Complete 100 análises',
    icon: Crown,
    color: '#10B981',
    requiredCount: 100,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  }
];

export class UserAchievementsService {
  static async getUserAchievements(): Promise<UserAchievement[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar conquistas:', error);
      throw new Error(`Erro ao buscar conquistas: ${error.message}`);
    }

    return data || [];
  }

  static async getCompletedProcessesCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { count, error } = await supabase
      .from('processos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    if (error) {
      console.error('Erro ao contar processos completados:', error);
      throw new Error(`Erro ao contar processos: ${error.message}`);
    }

    return count || 0;
  }

  static async getProfileCompletionCount(): Promise<{ completedCount: number; totalCount: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('type, email, first_name, last_name, company_name, phone, cpf, cnpj, oab, state, city, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return { completedCount: 0, totalCount: 9 }; // Default para PF
    }

    const userType = profile.type || 'PF';

    // Campos comuns para ambos os tipos
    const commonFields = [
      profile.email,
      profile.first_name,
      profile.last_name,
      profile.phone,
      profile.state,
      profile.city,
      profile.avatar_url
    ];

    // Campos específicos baseados no tipo
    const specificFields = userType === 'PJ'
      ? [profile.company_name, profile.cnpj, profile.oab] // PJ: Nome da empresa, CNPJ e OAB do responsável
      : [profile.cpf, profile.oab]; // PF: CPF e OAB

    const allFields = [...commonFields, ...specificFields];

    const completedFields = allFields.filter(field => {
      if (typeof field === 'string') {
        return field.trim().length > 0;
      }
      return false;
    }).length;

    return { completedCount: completedFields, totalCount: allFields.length };
  }

  static async getProfileCompletionPercentage(): Promise<number> {
    const { completedCount, totalCount } = await this.getProfileCompletionCount();
    return Math.round((completedCount / totalCount) * 100);
  }

  static async getAchievementProgress(): Promise<AchievementProgress[]> {
    const [achievements, completedCount, profileCompletionData, profilePercentage] = await Promise.all([
      this.getUserAchievements(),
      this.getCompletedProcessesCount(),
      this.getProfileCompletionCount(),
      this.getProfileCompletionPercentage()
    ]);

    const achievementMap = new Map(
      achievements.map(a => [a.achievement_type, a])
    );

    return ACHIEVEMENTS.map(config => {
      const userAchievement = achievementMap.get(config.type);
      const unlocked = !!userAchievement;

      let progress: number;
      let currentCount: number;

      if (config.type === 'profile_complete') {
        progress = profilePercentage;
        currentCount = profileCompletionData.completedCount;
      } else {
        progress = Math.min((completedCount / config.requiredCount) * 100, 100);
        currentCount = completedCount;
      }

      return {
        config,
        unlocked,
        unlockedAt: userAchievement?.unlocked_at,
        progress: Math.round(progress),
        currentCount
      };
    });
  }

  static getAchievementConfig(type: AchievementType): AchievementConfig | undefined {
    return ACHIEVEMENTS.find(a => a.type === type);
  }

  static async checkAndUnlockAchievements(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const [completedCount, profileCompletion] = await Promise.all([
      this.getCompletedProcessesCount(),
      this.getProfileCompletionPercentage()
    ]);

    const { error } = await supabase.rpc('unlock_achievement_if_eligible', {
      p_user_id: user.id,
      p_completed_count: completedCount
    });

    if (error) {
      console.error('Erro ao desbloquear conquistas:', error);
      throw new Error(`Erro ao desbloquear conquistas: ${error.message}`);
    }

    if (profileCompletion === 100) {
      const { data: existingAchievement } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', user.id)
        .eq('achievement_type', 'profile_complete')
        .maybeSingle();

      if (!existingAchievement) {
        await supabase
          .from('user_achievements')
          .insert({
            user_id: user.id,
            achievement_type: 'profile_complete',
            unlocked_at: new Date().toISOString()
          });
      }
    }
  }

  static getNextAchievement(currentCount: number): AchievementConfig | null {
    for (const achievement of ACHIEVEMENTS) {
      if (currentCount < achievement.requiredCount) {
        return achievement;
      }
    }
    return null;
  }

  static getUnlockedCount(achievements: UserAchievement[]): number {
    return achievements.length;
  }

  static getTotalCount(): number {
    return ACHIEVEMENTS.length;
  }

  static subscribeToAchievements(callback: (achievements: UserAchievement[]) => void) {
    const subscription = supabase
      .channel('user-achievements-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_achievements' },
        async () => {
          try {
            const achievements = await this.getUserAchievements();
            callback(achievements);
          } catch (error) {
            console.error('Erro ao atualizar conquistas via subscription:', error);
          }
        }
      )
      .subscribe();

    return subscription;
  }
}
