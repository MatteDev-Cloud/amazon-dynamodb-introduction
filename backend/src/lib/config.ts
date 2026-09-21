export function configuration() {
  const endpoint = process.env.DDB_ENDPOINT;
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || adminKey.length < 16) throw new Error('ADMIN_KEY must contain at least 16 characters');
  return {
    endpoint, adminKey, tableName: process.env.TABLE_NAME ?? 'DynamoLive-local',
    region: process.env.AWS_REGION ?? 'eu-central-1',
    origins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  };
}
export type Configuration = ReturnType<typeof configuration>;
