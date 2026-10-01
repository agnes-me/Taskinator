import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildGoogleAuthUrl, GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/google-oauth';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const state = randomUUID();
  const redirectUri = `${origin}/api/google/callback`;

  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(state, redirectUri);
  } catch {
    return NextResponse.redirect(`${origin}/settings?googleError=${encodeURIComponent('Connexion Google Calendar non configurée côté serveur.')}`);
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
