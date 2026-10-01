import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/google-oauth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const error = searchParams.get('error');

  const redirectWithError = (message: string) => NextResponse.redirect(`${origin}/settings?googleError=${encodeURIComponent(message)}`);

  if (error) return redirectWithError(`Google a refusé la connexion (${error}).`);
  if (!code) return redirectWithError('Code Google manquant.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const cookieStore = request.headers.get('cookie') ?? '';
  const expectedState = cookieStore.match(new RegExp(`${GOOGLE_OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];
  if (!expectedState || expectedState !== returnedState) return redirectWithError('État OAuth invalide — réessaie la connexion.');

  try {
    const redirectUri = `${origin}/api/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      return redirectWithError(
        "Google n'a pas renvoyé de jeton de rafraîchissement — déconnecte l'accès Taskinator dans myaccount.google.com/permissions puis réessaie.",
      );
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const { error: upsertError } = await supabase.from('google_oauth_accounts').upsert({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    });
    if (upsertError) return redirectWithError(`Impossible d'enregistrer la connexion — ${upsertError.message}`);
  } catch (e) {
    return redirectWithError(e instanceof Error ? e.message : 'Erreur inconnue lors de la connexion Google.');
  }

  const response = NextResponse.redirect(`${origin}/settings?googleConnected=1`);
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return response;
}
