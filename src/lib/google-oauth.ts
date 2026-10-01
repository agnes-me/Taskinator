import type { SupabaseServerClient } from '@/lib/supabase/server';

// Écriture ET lecture (contrairement aux abonnements iCal, en lecture seule) : nécessaire pour
// créer/modifier/supprimer des événements et pour lister les agendas de l'utilisateur.
export const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID manquant');
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_OAUTH_SCOPE);
  url.searchParams.set('access_type', 'offline');
  // Sans prompt=consent, Google ne renvoie un refresh_token qu'à la toute première autorisation —
  // une reconnexion après révocation resterait alors sans refresh_token indéfiniment.
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

async function requestTokens(body: Record<string, string>): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET manquants');

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Échange de jeton Google refusé (${res.status}) : ${text}`);
  }
  return res.json();
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  return requestTokens({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
}

async function refreshTokens(refreshToken: string): Promise<GoogleTokenResponse> {
  return requestTokens({ refresh_token: refreshToken, grant_type: 'refresh_token' });
}

/**
 * Jeton d'accès valide pour ce compte (rafraîchi si expiré), ou null si le compte n'est pas
 * connecté ou si Google a révoqué l'autorisation (l'appelant doit alors proposer de reconnecter).
 */
export async function getValidAccessToken(supabase: SupabaseServerClient, userId: string): Promise<string | null> {
  const { data: account } = await supabase
    .from('google_oauth_accounts')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!account) return null;

  // Marge de 2 minutes avant l'expiration réelle pour ne jamais partir avec un jeton qui expire
  // en cours de requête.
  const expiresAt = new Date(account.expires_at).getTime();
  if (expiresAt - Date.now() > 2 * 60 * 1000) return account.access_token;

  try {
    const refreshed = await refreshTokens(account.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from('google_oauth_accounts')
      .update({ access_token: refreshed.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export async function disconnectGoogleAccount(supabase: SupabaseServerClient, userId: string) {
  const { data: account } = await supabase.from('google_oauth_accounts').select('access_token').eq('user_id', userId).maybeSingle();
  if (account) {
    // Best-effort : la révocation Google échoue silencieusement (jeton déjà expiré/révoqué), on
    // supprime la ligne locale dans tous les cas pour que l'appli reflète l'état "déconnecté".
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(account.access_token)}`, { method: 'POST' }).catch(() => {});
  }
  await supabase.from('google_oauth_accounts').delete().eq('user_id', userId);
  await supabase.from('google_calendars').delete().eq('user_id', userId);
}
