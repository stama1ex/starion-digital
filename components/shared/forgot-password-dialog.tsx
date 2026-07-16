'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RESEND_COOLDOWN_SEC = 30;

type Step = 'identifier' | 'code' | 'password' | 'done';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Если известен логин пользователя (например, открыто со страницы
  // аккаунта уже авторизованным пользователем) — пропускаем шаг ввода
  // логина/email и сразу отправляем код
  initialIdentifier?: string;
  // Вызывается сразу после успешного сброса пароля. Полезно, если диалог
  // открыт из авторизованного контекста: сброс отзывает все сессии,
  // включая текущую, поэтому есть смысл сразу увести на страницу входа
  onSuccess?: () => void;
}

// Флоу сброса пароля в одном окне: логин/email -> код с почты -> новый
// пароль. Пароль восстановить нельзя (хранится как bcrypt-хеш), поэтому
// вместо "напоминания" всегда выпускается новый пароль после подтверждения
// владения привязанной почтой.
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  initialIdentifier,
  onSuccess,
}: ForgotPasswordDialogProps) {
  const t = useTranslations('ForgotPassword');
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const sendCode = async (id: string) => {
    const res = await fetch('/api/forgot-password/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error);
    }
  };

  useEffect(() => {
    if (!open) return;
    setCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setCooldown(0);

    if (initialIdentifier) {
      setIdentifier(initialIdentifier);
      setStep('code');
      setLoading(true);
      sendCode(initialIdentifier.trim())
        .then(() => {
          toast.success(t('code_sent'));
          setCooldown(RESEND_COOLDOWN_SEC);
        })
        .catch((error) => {
          toast.error(error instanceof Error && error.message ? error.message : t('send_error'));
        })
        .finally(() => setLoading(false));
    } else {
      setIdentifier('');
      setStep('identifier');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIdentifier]);

  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [open, cooldown]);

  const handleSubmitIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || loading) return;

    try {
      setLoading(true);
      await sendCode(identifier.trim());
      toast.success(t('code_sent'));
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t('send_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    try {
      setLoading(true);
      await sendCode(identifier.trim());
      toast.success(t('code_sent'));
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : t('send_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    try {
      setLoading(true);
      const res = await fetch('/api/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error || t('invalid_code'));
        return;
      }

      setResetToken(data.token);
      setStep('password');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (newPassword.length < 6) {
      toast.error(t('password_too_short'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('password_mismatch'));
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error || t('reset_error'));
        return;
      }

      setStep('done');
      toast.success(t('reset_success'));
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {step === 'identifier' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('identifier_description')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitIdentifier} className="space-y-4">
              <Input
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t('identifier_placeholder')}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={loading || !identifier.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('sending')}
                    </>
                  ) : (
                    t('send_code')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('code_description')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitCode} className="space-y-4">
              <Input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('code_placeholder')}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="text-center text-lg tracking-widest"
              />
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('confirming')}
                    </>
                  ) : (
                    t('confirm')
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="w-full"
                >
                  {cooldown > 0
                    ? t('resend_countdown', { seconds: cooldown })
                    : t('resend')}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('password_description')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('new_password')}</Label>
                <Input
                  autoFocus
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('new_password_placeholder')}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('confirm_password')}</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirm_password_placeholder')}
                  autoComplete="new-password"
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('saving')}
                    </>
                  ) : (
                    t('save_password')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('done_title')}</DialogTitle>
              <DialogDescription>{t('done_description')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                {t('close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
