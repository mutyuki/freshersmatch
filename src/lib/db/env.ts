const REQUIRED_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type RequiredEnvName = (typeof REQUIRED_ENV_NAMES)[number];

export function getRequiredEnv(name: RequiredEnvName): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function assertRequiredEnvs(): void {
  for (const envName of REQUIRED_ENV_NAMES) {
    getRequiredEnv(envName);
  }
}
