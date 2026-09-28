import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

function required(name) {
  const value = process.env[name] ?? getAmplifyEnvironmentSecret(name);
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local and restart the server.`);
  return value;
}

function getAmplifyEnvironmentSecret(name) {
  // Amplify Gen 1 exposes Parameter Store environment secrets as a JSON value.
  // Local development and other hosts continue to use ordinary environment variables.
  try {
    return JSON.parse(process.env.secrets ?? "{}")[name];
  } catch {
    return undefined;
  }
}

export function getSupabaseAdmin() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL').replace(/\/rest\/v1\/?$/, '');
  return createClient(url, required('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function getOpenAI() {
  return new OpenAI({ apiKey: required('OPENAI_API_KEY') });
}
