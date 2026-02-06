import { z } from 'zod';

// Server-side environment variables schema
const serverSchema = z.object({
  // Supabase (required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // Google OAuth (required for auth)
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // MSG91 OTP (required for phone auth)
  MSG91_AUTH_KEY: z.string().min(1),
  MSG91_TEMPLATE_ID: z.string().min(1),
  MSG91_SENDER_ID: z.string().default('NAUM'),
  MSG91_OTP_LENGTH: z.coerce.number().default(6),
  MSG91_OTP_EXPIRY_SECONDS: z.coerce.number().default(300),

  // Email (required for notifications)
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_REPLY_TO_EMAIL: z.string().email().optional(),

  // Zoom (optional — only needed if Zoom integration is active)
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_WEBHOOK_SECRET: z.string().optional(),

  // Twilio (optional — fallback SMS provider)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Interakt WhatsApp (optional)
  INTERAKT_API_KEY: z.string().optional(),

  // Cron jobs (required for scheduled notification processing)
  CRON_SECRET: z.string().min(1),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Client-side environment variables (NEXT_PUBLIC_* only)
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let _serverEnv: ServerEnv | undefined;
let _clientEnv: ClientEnv | undefined;

/**
 * Validates and returns server-side environment variables.
 * Call in server-only contexts (API routes, server components, middleware).
 * Throws with a clear error listing all missing/invalid variables.
 */
export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;

  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment variables:\n${errors}\n\nCheck your .env.local file.`
    );
  }

  _serverEnv = result.data;
  return _serverEnv;
}

/**
 * Validates and returns client-side environment variables (NEXT_PUBLIC_* only).
 * Safe to call in both server and client contexts.
 */
export function getClientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv;

  const result = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid client environment variables:\n${errors}\n\nCheck your .env.local file.`
    );
  }

  _clientEnv = result.data;
  return _clientEnv;
}
