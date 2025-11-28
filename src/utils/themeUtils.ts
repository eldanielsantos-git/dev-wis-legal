export const getThemeColors = (theme: 'dark' | 'light') => {
  if (theme === 'light') {
    return {
      bgPrimary: '#FAFAFA',
      bgSecondary: '#F5F5F5',
      bgTertiary: '#FFFFFF',
      textPrimary: '#2C2C2C',
      textSecondary: '#666666',
      textTertiary: '#555555',
      border: 'rgba(0, 0, 0, 0.1)',
      card: '#FFFFFF',
      logo: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-black.svg',
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
    textPrimary: '#C8C8C8',
    textSecondary: '#808080',
    textTertiary: '#8B8B8B',
    border: 'rgba(200, 200, 200, 0.1)',
    card: '#1F2229',
    logo: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg',
    successBg: '#1A3A2E',
    successText: '#10B981',
    successBorder: '#10B981',
    successIcon: '#10B981',
    successAccent: '#10B98120',
  };
};
