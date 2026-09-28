import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * One code path for every environment; only the variables change.
 * - Local (develop): DDB_ENDPOINT points at DynamoDB Local, ADMIN_KEY comes from .env.
 * - AWS (prod): no DDB_ENDPOINT, ADMIN_KEY_PARAMETER names an SSM SecureString read at cold start.
 */
export function configuration(adminKey = process.env.ADMIN_KEY) {
  const endpoint = process.env.DDB_ENDPOINT;
  if (!adminKey || adminKey.length < 16) throw new Error('ADMIN_KEY must contain at least 16 characters');
  return {
    endpoint, adminKey, tableName: process.env.TABLE_NAME ?? 'DynamoLive-local',
    region: process.env.AWS_REGION ?? 'eu-central-1',
    origins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(o => o.trim()).filter(Boolean),
  };
}
export type Configuration = ReturnType<typeof configuration>;

/** Resolves ADMIN_KEY directly or from SSM Parameter Store (decrypted, 3 s timeout). */
export async function loadConfiguration(): Promise<Configuration> {
  const parameter = process.env.ADMIN_KEY_PARAMETER;
  if (process.env.ADMIN_KEY || !parameter) return configuration();
  const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'eu-central-1', maxAttempts: 2 });
  try {
    const output = await ssm.send(new GetParameterCommand({ Name: parameter, WithDecryption: true }), { abortSignal: AbortSignal.timeout(3000) });
    return configuration(output.Parameter?.Value);
  } finally { ssm.destroy(); }
}
