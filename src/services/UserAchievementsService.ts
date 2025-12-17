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
    requiredCount: 100,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'first_process',
    title: 'Primeira Análise',
    description: 'Complete sua primeira análise forense',
    icon: Target,
    color: '#10B981',
    requiredCount: 1,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'three_processes',
    title: 'Iniciante',
    description: 'Complete 3 análises forenses',
    icon: Star,
    color: '#10B981',
    requiredCount: 3,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'ten_processes',
    title: 'Experiente',
    description: 'Complete 10 análises forenses',
    icon: Diamond,
    color: '#10B981',
    requiredCount: 10,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'fifty_processes',
    title: 'Expert',
    description: 'Complete 50 análises forenses',
    icon: Trophy,
    color: '#10B981',
    requiredCount: 50,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'hundred_processes',
    title: 'Mestre Jurídico',
    description: 'Complete 100 análises forenses',
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

  static async getProfileCompletionPercentage(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const metadata = user.user_metadata || {};
    const profileFields = [
      metadata.first_name,
      metadata.last_name,
      metadata.phone,
      metadata.cpf,
      metadata.oab,
      metadata.state,
      metadata.city,
      metadata.avatar_url
    ];

    const completedFields = profileFields.filter(field => {
      if (typeof field === 'string') {
        return field.trim().length > 0;
      }
      return false;
    }).length;

    return Math.round((completedFields / profileFields.length) * 100);
  }

  static async getAchievementProgress(): Promise<AchievementProgress[]> {
    const [achievements, completedCount, profileCompletion] = await Promise.all([
      this.getUserAchievements(),
      this.getCompletedProcessesCount(),
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
        progress = profileCompletion;
        currentCount = profileCompletion;
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
