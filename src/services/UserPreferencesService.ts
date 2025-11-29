import { supabase } from '../lib/supabase';

export interface UserPreferences {
  id: string;
  user_id: string;
  notify_process_completed: boolean;
  notify_invites: boolean;
  sound_enabled: boolean;
  theme_preference: 'dark' | 'light';
  email_launches: boolean;
  email_offers: boolean;
  created_at: string;
  updated_at: string;
}

export class UserPreferencesService {
  static async getUserPreferences(): Promise<UserPreferences | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar preferências:', error);
      throw new Error(`Erro ao buscar preferências: ${error.message}`);
    }

    if (!data) {
      const defaultPrefs = await this.createDefaultPreferences();
      return defaultPrefs;
    }

    return data;
  }

  static async createDefaultPreferences(): Promise<UserPreferences> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: user.id,
        notify_process_completed: true,
        notify_invites: true,
        sound_enabled: true,
        theme_preference: 'dark',
        email_launches: false,
        email_offers: false
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar preferências padrão:', error);
      throw new Error(`Erro ao criar preferências: ${error.message}`);
    }

    return data;
  }

  static async updatePreferences(
    preferences: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<UserPreferences> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('user_preferences')
      .update(preferences)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar preferências:', error);
      throw new Error(`Erro ao atualizar preferências: ${error.message}`);
    }

    return data;
  }

  static async toggleNotification(
    field: 'notify_process_completed' | 'notify_invites' | 'sound_enabled' | 'email_launches' | 'email_offers',
    value: boolean
  ): Promise<UserPreferences> {
    return this.updatePreferences({ [field]: value });
  }

  static async updateTheme(theme: 'dark' | 'light'): Promise<UserPreferences> {
    return this.updatePreferences({ theme_preference: theme });
  }

  static subscribeToPreferences(callback: (preferences: UserPreferences | null) => void) {
    const subscription = supabase
      .channel('user-preferences-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_preferences' },
        async () => {
          try {
            const preferences = await this.getUserPreferences();
            callback(preferences);
          } catch (error) {
            console.error('Erro ao atualizar preferências via subscription:', error);
            callback(null);
          }
        }
      )
      .subscribe();

    return subscription;
  }
}
