'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const WRONG_CODE = "That code didn't work.";
const GENERIC_ERROR = 'Something went wrong. Try again.';
const NO_CONNECTION = 'SiteLens could not connect. Try again.';

/** A small lens mark: an outer ring and an offset inner ring. */
function LensMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-foreground">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="10" r="4" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        router.replace('/');
        router.refresh();
        return;
      }
      if (res.status === 401) {
        setError(WRONG_CODE);
      } else {
        const data: { error?: unknown } = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : GENERIC_ERROR);
      }
    } catch {
      setError(NO_CONNECTION);
    }
    setPending(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <LensMark />
          <span className="text-xl font-semibold tracking-tight">SiteLens</span>
        </div>
        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter the shared access code.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <Label htmlFor="access-code">Access code</Label>
                <Input
                  id="access-code"
                  name="code"
                  type="password"
                  autoComplete="off"
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'access-code-error' : undefined}
                  className="h-10"
                />
                {error && (
                  <p id="access-code-error" role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" className="h-10 w-full" disabled={pending || code.length === 0}>
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
