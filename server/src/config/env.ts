export const AppEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  LOKI: {
    ENABLED: process.env.LOKI_ENABLED === 'true',
    HOST: process.env.LOKI_HOST || '',
    BASIC_AUTH: process.env.LOKI_BASIC_AUTH || '',
  },
  PORT: Number(process.env.PORT ?? 5000),
  API_PREFIX: process.env.API_PREFIX ?? "/api/v1",
};
