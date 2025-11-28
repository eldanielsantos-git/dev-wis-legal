const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (component: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[${component}]`, ...args);
    }
  },

  warn: (component: string, ...args: any[]) => {
    if (isDevelopment) {
      console.warn(`[${component}]`, ...args);
    }
  },

  error: (component: string, ...args: any[]) => {
    console.error(`[${component}]`, ...args);
  },

  info: (component: string, ...args: any[]) => {
    if (isDevelopment) {
      console.info(`[${component}]`, ...args);
    }
  }
};
