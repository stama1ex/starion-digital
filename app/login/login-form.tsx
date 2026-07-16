'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CodeVerificationDialog } from '@/components/shared/code-verification-dialog';
import { ForgotPasswordDialog } from '@/components/shared/forgot-password-dialog';

export default function LoginForm() {
  const t = useTranslations('Login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const goToDestination = (role: string) => {
    window.location.replace(role === 'ADMIN' ? '/admin' : '/');
  };

  const submitLogin = async (code?: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        code ? { login, password, code } : { login, password },
      ),
    });
    return res;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await submitLogin();
    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      if (data.requiresEmailVerification) {
        setCodeDialogOpen(true);
        toast.success(t('code_sent'));
        return;
      }
      toast.success(t('success'));
      goToDestination(data.role);
      return;
    }

    if (res.status === 429) {
      toast.error(t('too_many_attempts'));
      return;
    }

    toast.error(t('invalid'));
  };

  const handleSubmitCode = async (code: string) => {
    const res = await submitLogin(code);
    if (res.ok) {
      const data = await res.json();
      toast.success(t('success'));
      setCodeDialogOpen(false);
      goToDestination(data.role);
      return;
    }

    const data = await res.json().catch(() => null);
    throw new Error(data?.error || t('invalid_code'));
  };

  const handleResendCode = async () => {
    const res = await submitLogin();
    if (res.ok) {
      toast.success(t('code_sent'));
    } else {
      toast.error(t('invalid'));
    }
  };

  return (
    <>
      <Card className="w-full max-w-sm shadow-xl border-border/40 bg-card/80 backdrop-blur-md animate-fade-in mb-24">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-black tracking-tight">
            {t('title')}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>{t('login')}</Label>
              <Input
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={t('login_placeholder')}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('password')}</Label>
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-xs font-medium text-primary hover:underline underline-offset-4 cursor-pointer"
                >
                  {t('forgot_password')}
                </button>
              </div>
              <Input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('password_placeholder')}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('no_account')}{' '}
              <Link
                href="/partnership"
                className="font-semibold text-primary hover:underline underline-offset-4"
              >
                {t('apply_partnership')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      <CodeVerificationDialog
        open={codeDialogOpen}
        onOpenChange={setCodeDialogOpen}
        description={t('code_description')}
        onSubmitCode={handleSubmitCode}
        onResend={handleResendCode}
      />

      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      />
    </>
  );
}
