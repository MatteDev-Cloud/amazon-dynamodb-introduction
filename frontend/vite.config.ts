import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * A build for dev/live that is missing its stack URLs still succeeds and produces a bundle pointing at
 * http://localhost:3001 — which would only be discovered from the projector. Fail here instead.
 * scripts/deploy-aws.ps1 writes frontend/.env.<mode> from the CloudFormation outputs before building.
 */
export default defineConfig(({ mode }) => {
  if (mode === 'dev' || mode === 'live') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    for (const name of ['VITE_API_BASE', 'VITE_PUBLIC_ORIGIN'] as const) {
      const value = env[name];
      if (!value) throw new Error(`${name} assente: manca frontend/.env.${mode}. Esegui ./scripts/deploy-aws.ps1 -Environment ${mode}`);
      if (/REPLACE-CON|REPLACE_WITH|example\.com/i.test(value)) throw new Error(`${name} contiene ancora un segnaposto ("${value}"): frontend/.env.${mode} va generato da deploy-aws.ps1, non copiato dall'esempio.`);
      if (!value.startsWith('https://')) throw new Error(`${name} deve essere HTTPS per i telefoni, non "${value}".`);
    }
  }
  return { plugins: [svelte()] };
});
