import { supabase } from '../lib/supabase';

export type AchievementType =
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
  icon: string;
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
    type: 'first_process',
    title: 'Primeira Análise',
    description: 'Complete sua primeira análise forense',
    icon: '🎯',
    color: '#10B981',
    requiredCount: 1,
    badgeGradient: 'linear-gradient(135deg, #10B981, #059669)'
  },
  {
    type: 'three_processes',
    title: 'Iniciante',
    description: 'Complete 3 análises forenses',
    icon: '⭐',
    color: '#3B82F6',
    requiredCount: 3,
    badgeGradient: 'linear-gradient(135deg, #3B82F6, #2563EB)'
  },
  {
    type: 'ten_processes',
    title: 'Experiente',
    description: 'Complete 10 análises forenses',
    icon: '💎',
    color: '#8B5CF6',
    requiredCount: 10,
    badgeGradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
  },
  {
    type: 'fifty_processes',
    title: 'Expert',
    description: 'Complete 50 análises forenses',
    icon: '🏆',
    color: '#F59E0B',
    requiredCount: 50,
    badgeGradient: 'linear-gradient(135deg, #F59E0B, #D97706)'
  },
  {
    type: 'hundred_processes',
    title: 'Mestre Forense',
    description: 'Complete 100 análises forenses',
    icon: '👑',
    color: '#EF4444',
    requiredCount: 100,
    badgeGradient: 'linear-gradient(135deg, #EF4444, #DC2626)'
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

  static async getAchievementProgress(): Promise<AchievementProgress[]> {
    const [achievements, completedCount] = await Promise.all([
      this.getUserAchievements(),
      this.getCompletedProcessesCount()
    ]);

    const achievementMap = new Map(
      achievements.map(a => [a.achievement_type, a])
    );

    return ACHIEVEMENTS.map(config => {
      const userAchievement = achievementMap.get(config.type);
      const unlocked = !!userAchievement;
      const progress = Math.min((completedCount / config.requiredCount) * 100, 100);

      return {
        config,
        unlocked,
        unlockedAt: userAchievement?.unlocked_at,
        progress: Math.round(progress),
        currentCount: completedCount
      };
    });
  }

  static getAchievementConfig(type: AchievementType): AchievementConfig | undefined {
    return ACHIEVEMENTS.find(a => a.type === type);
  }

  static async checkAndUnlockAchievements(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const completedCount = await this.getCompletedProcessesCount();

    const { error } = await supabase.rpc('unlock_achievement_if_eligible', {
      p_user_id: user.id,
      p_completed_count: completedCount
    });

    if (error) {
      console.error('Erro ao desbloquear conquistas:', error);
      throw new Error(`Erro ao desbloquear conquistas: ${error.message}`);
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
