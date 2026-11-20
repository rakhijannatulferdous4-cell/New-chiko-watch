/**
 * New Chiko Watch — Environment & API Key Configuration
 *
 * Public keys (NEXT_PUBLIC_*) are available in the browser for Supabase & Cloudinary.
 * Secret keys (GEMINI_API_KEY, ADMIN_USERNAME, ADMIN_PASSWORD) are strictly read server-side.
 */

const metaEnv: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' &&
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ? ((import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {})
    : {};

const nodeEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

export const PUBLIC_CONFIG = {
  NEXT_PUBLIC_SUPABASE_URL:
    metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
    metaEnv.VITE_SUPABASE_URL ||
    nodeEnv.NEXT_PUBLIC_SUPABASE_URL ||
    nodeEnv.SUPABASE_URL ||
    '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    nodeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    nodeEnv.SUPABASE_ANON_KEY ||
    '',
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
    metaEnv.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    nodeEnv.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    'zxamensn',
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET:
    metaEnv.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    nodeEnv.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    '',
} as const;

export const isSupabaseConfigured = Boolean(
  PUBLIC_CONFIG.NEXT_PUBLIC_SUPABASE_URL &&
    PUBLIC_CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    PUBLIC_CONFIG.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
);

export const isCloudinaryPresetConfigured = Boolean(
  PUBLIC_CONFIG.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    PUBLIC_CONFIG.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
);

export function getServerConfig() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerConfig must only be called on the server.');
  }
  const supabaseUrl =
    nodeEnv.NEXT_PUBLIC_SUPABASE_URL ||
    nodeEnv.SUPABASE_URL ||
    nodeEnv.VITE_SUPABASE_URL ||
    '';
  const supabaseKey =
    nodeEnv.SUPABASE_SERVICE_ROLE_KEY ||
    nodeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    nodeEnv.SUPABASE_ANON_KEY ||
    nodeEnv.VITE_SUPABASE_ANON_KEY ||
    '';

  let cloudName =
    nodeEnv.CLOUDINARY_CLOUD_NAME ||
    nodeEnv.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    nodeEnv.VITE_CLOUDINARY_CLOUD_NAME ||
    'zxamensn';
  let cloudApiKey = nodeEnv.CLOUDINARY_API_KEY || '';
  let cloudApiSecret = nodeEnv.CLOUDINARY_API_SECRET || '';
  const cloudUploadPreset =
    nodeEnv.CLOUDINARY_UPLOAD_PRESET ||
    nodeEnv.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    nodeEnv.VITE_CLOUDINARY_UPLOAD_PRESET ||
    '';

  const rawCloudUrl = (nodeEnv.CLOUDINARY_URL || '').trim();
  if (rawCloudUrl.startsWith('cloudinary://')) {
    try {
      const parsed = new URL(rawCloudUrl);
      if (parsed.hostname) cloudName = parsed.hostname;
      if (parsed.username) cloudApiKey = decodeURIComponent(parsed.username);
      if (parsed.password) cloudApiSecret = decodeURIComponent(parsed.password);
    } catch {
      // ignore malformed CLOUDINARY_URL
    }
  }

  return {
    GEMINI_API_KEY: nodeEnv.GEMINI_API_KEY || '',
    ADMIN_USERNAME: nodeEnv.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD: nodeEnv.ADMIN_PASSWORD || 'chiko123',
    SUPABASE_URL: supabaseUrl,
    SUPABASE_KEY: supabaseKey,
    CLOUDINARY_CLOUD_NAME: cloudName.trim(),
    CLOUDINARY_API_KEY: cloudApiKey.trim(),
    CLOUDINARY_API_SECRET: cloudApiSecret.trim(),
    CLOUDINARY_UPLOAD_PRESET: cloudUploadPreset.trim(),
  };
}
