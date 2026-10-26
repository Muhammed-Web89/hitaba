import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { LocaleMenu } from './LocaleMenu';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <LocaleMenu />
      </header>
      <main className="flex flex-1 flex-col justify-center pb-16">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-ink-2">{footer}</div>}
      </main>
    </div>
  );
}
