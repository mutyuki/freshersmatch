const REQUIRED_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_SESSION_SECRET",
] as const;

export type RequiredEnvName = (typeof REQUIRED_ENV_NAMES)[number];

export function isRequiredEnvName(value: string): value is RequiredEnvName {
  return REQUIRED_ENV_NAMES.includes(value as RequiredEnvName);
}

export function getRequiredEnv(name: string): string {
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
