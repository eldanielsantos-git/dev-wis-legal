export const getThemeColors = (theme: 'dark' | 'light') => {
  if (theme === 'light') {
    return {
      bgPrimary: '#FAFAFA',
      bgSecondary: '#F5F5F5',
      bgTertiary: '#FFFFFF',
      background: '#FAFAFA',
      textPrimary: '#2C2C2C',
      textSecondary: '#666666',
      textTertiary: '#8B8B8B',
      text: '#2C2C2C',
      mutedText: '#666666',
      border: 'rgba(0, 0, 0, 0.1)',
      card: '#FFFFFF',
      cardBackground: '#FFFFFF',
      logo: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-black.svg',
      primary: '#3B82F6',
      success: '#10B981',
      successBg: '#10B981',
      successText: '#1A3A2E',
      successBorder: '#059669',
      successIcon: '#10B981',
      successAccent: '#10B98120',
    };
  }

  return {
    bgPrimary: '#0F0E0D',
    bgSecondary: '#141312',
    bgTertiary: '#14181B',
    background: '#0F0E0D',
    textPrimary: '#C8C8C8',
    textSecondary: '#808080',
    textTertiary: '#8B8B8B',
    text: '#C8C8C8',
    mutedText: '#808080',
    border: 'rgba(200, 200, 200, 0.1)',
    card: '#1F2229',
    cardBackground: '#1A1A1A',
    logo: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg',
    primary: '#3B82F6',
    success: '#10B981',
    successBg: '#1A3A2E',
    successText: '#10B981',
    successBorder: '#10B981',
    successIcon: '#10B981',
    successAccent: '#10B98120',
  };
};
