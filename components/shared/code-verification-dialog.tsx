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

const RESEND_COOLDOWN_SEC = 30;

interface CodeVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description: string;
  onSubmitCode: (code: string) => Promise<void>;
  onResend?: () => Promise<void>;
}

// Универсальное окошко "введите код из письма" — используется везде, где
// нужно подтверждение email кодом: вход, смена контактов/логина/пароля,
// заявка на партнёрство. Отправку выполняет вызывающий код через переданные
// колбэки; ошибку неверного/просроченного кода (onSubmitCode бросает Error)
// диалог показывает тостом сам, чтобы не дублировать это в каждом вызывающем месте.
export function CodeVerificationDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmitCode,
  onResend,
}: CodeVerificationDialogProps) {
  const t = useTranslations('CodeVerificationDialog');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (open) {
      setCode('');
      setCooldown(RESEND_COOLDOWN_SEC);
    }
  }, [open]);

  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [open, cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;

    try {
      setSubmitting(true);
      await onSubmitCode(code.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('invalid_code'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!onResend || cooldown > 0 || resending) return;
    try {
      setResending(true);
      await onResend();
      setCooldown(RESEND_COOLDOWN_SEC);
    } finally {
      setResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title ?? t('title')}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={submitting || !code.trim()}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('confirming')}
                </>
              ) : (
                t('confirm')
              )}
            </Button>
            {onResend && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="w-full"
              >
                {resending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('sending')}
                  </>
                ) : cooldown > 0 ? (
                  t('resend_countdown', { seconds: cooldown })
                ) : (
                  t('resend')
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
