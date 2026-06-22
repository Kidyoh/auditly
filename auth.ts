import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import GitLab from 'next-auth/providers/gitlab';
import { NextResponse } from 'next/server';

const authSecretFromEnv =
  process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();

/** In dev/test only — production must set AUTH_SECRET. */
const DEV_AUTH_SECRET_FALLBACK =
  '__auditly_dev_only__set_AUTH_SECRET_in_env__do_not_use_in_production__';

const secret =
  authSecretFromEnv ||
  (process.env.NODE_ENV === 'production' ? undefined : DEV_AUTH_SECRET_FALLBACK);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      authorization: {
        params: { scope: 'read:user user:email repo' },
      },
    }),
    GitLab({
      clientId: process.env.GITLAB_CLIENT_ID ?? '',
      clientSecret: process.env.GITLAB_CLIENT_SECRET ?? '',
      authorization: {
        url: 'https://gitlab.com/oauth/authorize',
        params: { scope: 'read_user read_api' },
      },
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  trustHost: true,
  callbacks: {
    jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      if (token.provider) {
        session.provider = token.provider as string;
      }
      return session;
    },
    authorized({ request, auth: session }) {
      const pathname = request.nextUrl.pathname;
      if (pathname.startsWith('/api/auth')) return true;
      if (pathname.startsWith('/signin')) return true;
      if (session?.user) return true;
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return false;
    },
  },
});
