import { auth, signIn } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock, Layers, GitBranch } from 'lucide-react';

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  async function signInWithMicrosoft() {
    'use server';
    await signIn('microsoft-entra-id', { redirectTo: '/' });
  }

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12 md:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/4 right-0 h-[360px] w-[360px] rounded-full bg-indigo-400/10 blur-3xl" />
      </div>

      <div className="grid w-full max-w-5xl gap-8 md:grid-cols-[1.05fr_1fr] md:items-center">
        <div className="hidden flex-col gap-6 md:flex">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary">
            <ShieldCheck className="h-3 w-3" />
            <span className="uppercase tracking-[0.14em]">Repo Audit</span>
          </div>
          <div className="space-y-3">
            <h1 className="font-heading text-balance text-3xl font-semibold tracking-tight text-foreground md:text-[2.25rem] md:leading-[1.1]">
              Continuous dependency security for your Azure DevOps fleet.
            </h1>
            <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
              Inventory every Git repository across every project, scan manifests for known CVEs and
              persistence indicators, and triage findings — without leaving the browser.
            </p>
          </div>

          <ul className="grid gap-3 pt-2 text-sm text-foreground/85">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                <GitBranch className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-sm font-medium">Live inventory from Azure DevOps</p>
                <p className="text-xs text-muted-foreground">
                  Reads through every project, no manual list required.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                <Layers className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-sm font-medium">Manifests + watchlist + OSV.dev</p>
                <p className="text-xs text-muted-foreground">
                  Cross-referenced critical and high CVEs in one view.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-sm font-medium">Credentials stay on the server</p>
                <p className="text-xs text-muted-foreground">
                  PAT and org URL are loaded from environment variables only.
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div className="surface-card relative w-full p-8 shadow-pop">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-primary/0 via-primary/60 to-primary/0"
          />

          <div className="flex flex-col items-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-primary to-indigo-500 text-primary-foreground shadow-[0_8px_22px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)] ring-1 ring-primary/30">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <h2 className="font-heading mt-5 text-xl font-semibold tracking-tight text-foreground">
              Sign in to Repo Audit
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Use your Microsoft work or school account to access the dashboard.
            </p>
          </div>

          <form action={signInWithMicrosoft} className="mt-7">
            <Button
              type="submit"
              size="lg"
              className="w-full justify-center font-semibold shadow-[0_8px_18px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)] ring-1 ring-primary/40"
            >
              <MicrosoftMark className="mr-2 h-4 w-4" />
              Continue with Microsoft
            </Button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            Authentication is handled by Microsoft Entra ID.
          </p>
        </div>
      </div>
    </div>
  );
}

function MicrosoftMark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 21 21"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
