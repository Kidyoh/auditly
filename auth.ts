import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { NextResponse } from 'next/server';

/**
 * Microsoft Entra ID (Azure AD) — use your app registration values.
 *
 * Required (Auth.js):
 * - AUTH_SECRET: signing key for sessions/JWTs (or legacy NEXTAUTH_SECRET). Generate: openssl rand -base64 32
 *
 * Required for sign-in:
 * - AZURE_AD_TENANT_ID (or AZURE_TENANT_ID): Directory (tenant) ID
 * - AZURE_AD_CLIENT_ID (or AZURE_CLIENT_ID): Application (client) ID
 * - AZURE_AD_CLIENT_SECRET (or AZURE_CLIENT_SECRET): Client secret **value** (not the portal “Secret ID”)
 *
 * Optional:
 * - AZURE_AD_CLIENT_SECRET_ID / SECRET_ID: Rotation/audit metadata only — not sent to OAuth
 * - AZURE_AD_ISSUER: Override issuer URL (defaults to tenant v2.0 endpoint)
 *
 * Legacy (still supported): AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET, AUTH_MICROSOFT_ENTRA_ID_ISSUER
 */
const tenantId =
  process.env.AZURE_AD_TENANT_ID?.trim() ?? process.env.AZURE_TENANT_ID?.trim();

const clientId =
  process.env.AZURE_AD_CLIENT_ID?.trim() ??
  process.env.AZURE_CLIENT_ID?.trim() ??
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() ??
  '';

const clientSecret =
  process.env.AZURE_AD_CLIENT_SECRET?.trim() ??
  process.env.AZURE_CLIENT_SECRET?.trim() ??
  process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() ??
  '';

const issuerFromEnv =
  process.env.AZURE_AD_ISSUER?.trim() ?? process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();

const issuer =
  issuerFromEnv ??
  (tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : undefined);

const authSecretFromEnv =
  process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

/** In dev/test only — production must set AUTH_SECRET (see errors.authjs.dev#missingsecret). */
const DEV_AUTH_SECRET_FALLBACK =
  '__repo_audit_dev_only__set_AUTH_SECRET_in_env__do_not_use_in_production__';

const secret =
  authSecretFromEnv ||
  (process.env.NODE_ENV === 'production' ? undefined : DEV_AUTH_SECRET_FALLBACK);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  providers: [
    MicrosoftEntraID({
      clientId,
      clientSecret,
      ...(issuer ? { issuer } : {}),
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  trustHost: true,
  callbacks: {
    authorized({ request, auth: session }) {
      const pathname = request.nextUrl.pathname;
      // Always allow Auth.js endpoints (sign-in, sign-out, callback, csrf, etc.)
      // Without this, the OAuth callback at /api/auth/callback/<provider> is
      // bounced back to /signin and the authorization code is dropped.
      if (pathname.startsWith('/api/auth')) return true;
      if (pathname.startsWith('/signin')) return true;
      if (session?.user) return true;
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return false;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
