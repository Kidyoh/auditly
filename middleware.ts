import { auth } from '@/auth';

/**
 * Export `auth` directly — do not wrap with `auth(() => NextResponse.next())`.
 * If `callbacks.authorized` returns false for a page, Auth.js only redirects to
 * `/signin` when there is no custom wrapper; an empty wrapper runs first and
 * calls `NextResponse.next()`, so the dashboard loads while `/api/*` still gets 401.
 */
export default auth;

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
