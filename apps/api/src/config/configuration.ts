export default () => ({
  port: parseInt(process.env.API_PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? './uploads',
    googleDrive: {
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? '',
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? '',
    },
  },
});
