import { auth, signIn } from '@/auth';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { GlobeClient } from '@/components/ui/globe-client';

async function signInWithGitHub() {
  'use server';
  await signIn('github', { redirectTo: '/' });
}

async function signInWithGitLab() {
  'use server';
  await signIn('gitlab', { redirectTo: '/' });
}

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return (
    <div className="flex flex-1 flex-col md:flex-row">

      {/* Left — Globe */}
      <div className="relative hidden md:block md:w-1/2">
        <div className="absolute inset-0">
          <GlobeClient />
        </div>
      </div>

      {/* Right — sign-in */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-16 md:w-1/2">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="Auditly"
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl object-contain"
            priority
          />
          <span className="text-base font-semibold tracking-tight text-foreground">Auditly</span>
        </div>

        <div className="w-full max-w-sm rounded-xl border border-hairline bg-card p-8 shadow-[0_2px_16px_rgba(0,0,0,0.4)]">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Connect your GitHub or GitLab account to audit your repositories.
            </p>
          </div>

          <div className="space-y-3">
            <form action={signInWithGitHub}>
              <Button type="submit" size="lg" className="w-full justify-center gap-2.5 font-medium">
                <GitHubMark className="h-4 w-4 shrink-0" />
                Continue with GitHub
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form action={signInWithGitLab}>
              <Button
                type="submit"
                size="lg"
                variant="outline"
                className="w-full justify-center gap-2.5 font-medium"
              >
                <GitLabMark className="h-4 w-4 shrink-0" />
                Continue with GitLab
              </Button>
            </form>
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" />
            Requests <code className="font-mono">repo</code> / <code className="font-mono">read_api</code> scope for private access.
          </p>
        </div>
      </div>

    </div>
  );
}

function GitHubMark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden fill="currentColor" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GitLabMark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 380 380" xmlns="http://www.w3.org/2000/svg" aria-hidden fill="currentColor" className={className}>
      <path d="M189.9 357.6L264.8 124H115L189.9 357.6z" opacity=".9" />
      <path d="M189.9 357.6L115 124H28.6L189.9 357.6z" opacity=".7" />
      <path d="M28.6 124L6.1 193.7a15.6 15.6 0 005.7 17.4l178.1 129.5L28.6 124z" opacity=".5" />
      <path d="M28.6 124H115L78.3 11.2C76 4.2 66.3 4.2 64 11.2L28.6 124z" />
      <path d="M189.9 357.6L264.8 124H351.3L189.9 357.6z" opacity=".7" />
      <path d="M351.3 124l22.6 69.7a15.6 15.6 0 01-5.7 17.4L189.9 357.6 351.3 124z" opacity=".5" />
      <path d="M351.3 124H264.8l36.8-112.8c2.3-7 12-7 14.3 0L351.3 124z" />
    </svg>
  );
}
