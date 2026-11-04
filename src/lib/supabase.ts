// Cliente de Supabase (navegador) del proyecto compartido `apps` (dmracybffqdvcltkarag), app `dreamhouse`.
// La URL y la clave "publishable" son públicas por diseño: la seguridad real son las políticas RLS y las funciones de la base.
// NUNCA pongas aquí la service_role ni la clave de OpenAI.
import { createClient } from '@supabase/supabase-js';

export const APP_ID = 'dreamhouse';
export const SUPABASE_URL = 'https://dmracybffqdvcltkarag.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EP0yPI9NexntnxQ4_dG5jg_dH5z_zWU';

// Google por PKCE: la app solo acepta el código que ella misma pidió; el SDK rechaza una sesión «implícita» en la dirección.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
