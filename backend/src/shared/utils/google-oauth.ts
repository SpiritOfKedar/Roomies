import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { env } from './env';
import { UnauthorizedError } from './app-error';

let client: OAuth2Client | null = null;

function getGoogleClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) {
    throw UnauthorizedError('Google sign-in is not configured');
  }

  if (!client) {
    client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET || undefined,
      env.GOOGLE_REDIRECT_URI || undefined,
    );
  }

  return client;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

export function assertGoogleConfigured(): void {
  if (!env.GOOGLE_CLIENT_ID) {
    throw UnauthorizedError('Google sign-in is not configured');
  }
}

function payloadToProfile(payload?: TokenPayload | null): GoogleProfile {
  if (!payload?.sub || !payload.email) {
    throw UnauthorizedError('Invalid Google account');
  }

  if (payload.email_verified === false) {
    throw UnauthorizedError('Google email is not verified');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? payload.email.split('@')[0],
    avatarUrl: payload.picture,
    emailVerified: payload.email_verified ?? true,
  };
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  assertGoogleConfigured();

  const ticket = await getGoogleClient().verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  return payloadToProfile(ticket.getPayload());
}

export function getGoogleAuthUrl(): string {
  assertGoogleConfigured();

  if (!env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw UnauthorizedError('Google redirect sign-in is not configured');
  }

  return getGoogleClient().generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
}

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  assertGoogleConfigured();

  const { tokens } = await getGoogleClient().getToken(code);
  if (!tokens.id_token) {
    throw UnauthorizedError('Google did not return an ID token');
  }

  const ticket = await getGoogleClient().verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  return payloadToProfile(ticket.getPayload());
}
