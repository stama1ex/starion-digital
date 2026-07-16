'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Loader2, Monitor, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CodeVerificationDialog } from '@/components/shared/code-verification-dialog';
import { ForgotPasswordDialog } from '@/components/shared/forgot-password-dialog';

interface AccountSession {
  id: number;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
  os: string;
  browser: string;
}

function formatSessionDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

type PendingAction =
  | 'contact'
  | 'credentials'
  | 'email-old'
  | 'email-new'
  | 'email-remove'
  | null;

export default function AccountSettings() {
  const t = useTranslations('AccountSettings');
  const locale = useLocale();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentLogin, setCurrentLogin] = useState('');

  const [login, setLogin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingCredentials, setUpdatingCredentials] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [address, setAddress] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [oldEmailToken, setOldEmailToken] = useState<string | null>(null);

  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/account');
        if (res.status === 401) {
          setUnauthorized(true);
          return;
        }
        const data = await res.json();
        setCurrentLogin(data.login ?? '');
        setPhone(data.phone ?? '');
        setEmail(data.email ?? '');
        setSavedEmail(data.email ?? '');
        setAddress(data.address ?? '');
      } catch (error) {
        console.error('Error loading account:', error);
        toast.error(t('load_error'));
      } finally {
        setLoadingProfile(false);
      }
    };

    const loadSessions = async () => {
      try {
        const res = await fetch('/api/account/sessions');
        if (!res.ok) return;
        const data = await res.json();
        setSessions(data.sessions);
      } catch (error) {
        console.error('Error loading sessions:', error);
        toast.error(t('sessions_load_error'));
      } finally {
        setLoadingSessions(false);
      }
    };

    loadProfile();
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevokeSession = async (sessionId: number) => {
    try {
      setRevokingSessionId(sessionId);
      const res = await fetch(`/api/account/sessions?id=${sessionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success(t('session_ended'));
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error(t('session_end_error'));
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Общие хелперы отправки/проверки кода — используются и для простых
  // случаев (один код), и для смены email (два кода подряд: старый, новый)
  const sendCode = async (targetEmail: string) => {
    const res = await fetch('/api/verify-email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('send_code_error'));
  };

  const confirmCode = async (
    targetEmail: string,
    code: string,
  ): Promise<string> => {
    const res = await fetch('/api/verify-email/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('confirm_code_error'));
    return data.token as string;
  };

  // Пред-проверка занятости логина/email ДО отправки кода подтверждения —
  // иначе человек проходит код(ы) с почты и только в конце узнаёт, что
  // логин или email уже заняты другим аккаунтом
  const checkAvailability = async (fields: {
    login?: string;
    email?: string;
  }): Promise<string | null> => {
    try {
      const res = await fetch('/api/account/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) return null;
      const data = await res.json();
      return data.error || t('availability_check_error');
    } catch (error) {
      console.error('Error checking availability:', error);
      return t('availability_check_error');
    }
  };

  const openVerification = async (
    action: PendingAction,
    targetEmail: string,
  ) => {
    try {
      await sendCode(targetEmail);
      setPendingAction(action);
      setCodeDialogOpen(true);
      toast.success(t('code_sent'));
    } catch (error) {
      console.error('Error requesting verification:', error);
      toast.error(
        error instanceof Error ? error.message : t('send_code_error'),
      );
    }
  };

  const doSaveContact = async (emailToken?: string, newEmailToken?: string) => {
    try {
      setSavingContact(true);
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          email,
          address,
          emailToken,
          newEmailToken,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success(t('contact_saved'));
      setSavedEmail(email.trim());
    } catch (error) {
      console.error('Error saving contact info:', error);
      toast.error(t('contact_save_error'));
    } finally {
      setSavingContact(false);
    }
  };

  // Смена email на другой — самое чувствительное изменение: без этого любой,
  // кто получил доступ к сессии (не к паролю), мог бы просто вписать свой
  // email, подтвердить его кодом на самого себя и перехватить аккаунт.
  // Поэтому здесь два шага: сначала код на СТАРЫЙ email (доказывает, что
  // запрос от настоящего владельца), потом код на НОВЫЙ (доказывает, что он
  // реально ему принадлежит).
  const handleSaveContact = async () => {
    const trimmedEmail = email.trim();

    // Отправка кода — это тоже сетевой запрос (rate-limit + письмо), а не
    // мгновенное действие, поэтому кнопка должна показывать загрузку уже на
    // этом этапе, а не только во время финального сохранения после диалога
    setSavingContact(true);
    try {
      const emailIsChanging = trimmedEmail && trimmedEmail !== savedEmail;

      if (emailIsChanging) {
        const error = await checkAvailability({ email: trimmedEmail });
        if (error) {
          toast.error(error);
          return;
        }
      }

      if (savedEmail && trimmedEmail && trimmedEmail !== savedEmail) {
        await openVerification('email-old', savedEmail);
      } else if (savedEmail && !trimmedEmail) {
        await openVerification('email-remove', savedEmail);
      } else if (trimmedEmail) {
        await openVerification('contact', trimmedEmail);
      } else {
        await doSaveContact();
      }
    } finally {
      setSavingContact(false);
    }
  };

  const doUpdateCredentials = async (emailToken: string) => {
    try {
      setUpdatingCredentials(true);
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newLogin: login || undefined,
          newPassword: newPassword || undefined,
          emailToken,
        }),
      });

      if (res.ok) {
        toast.success(t('credentials_updated'));
        if (login) setCurrentLogin(login);
        setLogin('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await res.text();
        let errorMessage = t('credentials_update_error');
        try {
          const errorJson = JSON.parse(error);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = error || errorMessage;
        }
        toast.error(t('error_prefix', { message: errorMessage }));
      }
    } catch (error) {
      console.error('Error updating credentials:', error);
      toast.error(t('credentials_update_network_error'));
    } finally {
      setUpdatingCredentials(false);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!currentPassword) {
      toast.error(t('enter_current_password'));
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error(t('passwords_mismatch'));
      return;
    }

    if (!login && !newPassword) {
      toast.error(t('enter_new_login_or_password'));
      return;
    }

    if (!savedEmail) {
      toast.error(t('need_email_for_credentials'));
      return;
    }

    if (email.trim() !== savedEmail) {
      toast.error(t('unsaved_email_changes'));
      return;
    }

    setUpdatingCredentials(true);
    try {
      if (login) {
        const error = await checkAvailability({ login });
        if (error) {
          toast.error(error);
          return;
        }
      }

      await openVerification('credentials', savedEmail);
    } finally {
      setUpdatingCredentials(false);
    }
  };

  // Подтверждение кода само по себе может провалиться (неверный/просроченный
  // код) — тогда бросаем ошибку, чтобы попап показал её и остался открыт для
  // повторной попытки. А вот ошибку самого сохранения (после успешного кода)
  // просто показываем тостом и закрываем попап — код-то был верный.
  const handleSubmitCode = async (code: string) => {
    if (pendingAction === 'email-old') {
      // Шаг 1 пройден (старый email подтверждён) — сразу шлём код на новый
      // и переключаем попап на шаг 2, не закрывая его
      const token = await confirmCode(savedEmail, code);
      setOldEmailToken(token);
      try {
        await sendCode(email.trim());
        setPendingAction('email-new');
        toast.success(t('new_email_code_sent'));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('send_code_error'),
        );
        setCodeDialogOpen(false);
        setPendingAction(null);
        setOldEmailToken(null);
      }
      return;
    }

    if (pendingAction === 'email-new') {
      const token = await confirmCode(email.trim(), code);
      setCodeDialogOpen(false);
      await doSaveContact(oldEmailToken ?? undefined, token);
      setOldEmailToken(null);
      setPendingAction(null);
      return;
    }

    if (pendingAction === 'email-remove') {
      const token = await confirmCode(savedEmail, code);
      setCodeDialogOpen(false);
      await doSaveContact(token);
      setPendingAction(null);
      return;
    }

    const targetEmail = email.trim();
    const token = await confirmCode(targetEmail, code);
    setCodeDialogOpen(false);
    if (pendingAction === 'contact') {
      await doSaveContact(token);
    } else if (pendingAction === 'credentials') {
      await doUpdateCredentials(token);
    }
    setPendingAction(null);
  };

  const handleResendCode = async () => {
    const targetEmail =
      pendingAction === 'email-old' || pendingAction === 'email-remove'
        ? savedEmail
        : email.trim();
    try {
      await sendCode(targetEmail);
      toast.success(t('code_resent'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('send_code_error'),
      );
    }
  };

  const dialogDescription =
    pendingAction === 'email-old'
      ? t('dialog_description_step1', { email: savedEmail })
      : pendingAction === 'email-new'
        ? t('dialog_description_step2', { email: email.trim() })
        : pendingAction === 'email-remove'
          ? t('dialog_description_remove', { email: savedEmail })
          : t('dialog_description_default', { email: email.trim() });

  if (unauthorized) {
    return (
      <p className="text-sm text-muted-foreground">{t('unauthorized')}</p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('title')}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t('contact_card_title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col space-y-4">
            {!loadingProfile && (
              <p className="text-sm text-muted-foreground">
                {t('login_label')}{' '}
                <span className="font-mono">{currentLogin}</span>
              </p>
            )}
            <div>
              <Label htmlFor="account-email" className="mb-2">
                {t('email_label')}
              </Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('email_placeholder')}
              />
              {!email && !loadingProfile && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                  <TriangleAlert size={13} className="shrink-0" />
                  {t('email_hint')}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="account-phone" className="mb-2">
                {t('phone_label')}
              </Label>
              <Input
                id="account-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('phone_placeholder')}
              />
            </div>

            <div>
              <Label htmlFor="account-address" className="mb-2">
                {t('address_label')}
              </Label>
              <Input
                id="account-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('address_placeholder')}
              />
            </div>
            <Button
              onClick={handleSaveContact}
              disabled={savingContact || loadingProfile}
              className="mt-auto w-full sm:w-fit self-start"
            >
              {savingContact ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save_contacts')
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t('credentials_card_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="current-password">
                  {t('current_password_label')}
                </Label>
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-xs font-medium text-primary hover:underline underline-offset-4 cursor-pointer"
                >
                  {t('forgot_password')}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('current_password_placeholder')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">{t('new_data_heading')}</h3>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="new-login" className="mb-2">
                    {t('new_login_label')}
                  </Label>
                  <Input
                    id="new-login"
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder={t('optional_placeholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="new-password" className="mb-2">
                    {t('new_password_label')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('optional_placeholder')}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="mb-2">
                    {t('confirm_password_label')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('confirm_password_placeholder')}
                      disabled={!newPassword}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      disabled={!newPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {!savedEmail ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <TriangleAlert size={13} className="shrink-0" />
                {t('need_email_hint')}
              </p>
            ) : (
              email.trim() !== savedEmail && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                  <TriangleAlert size={13} className="shrink-0" />
                  {t('unsaved_email_hint')}
                </p>
              )
            )}

            <Button
              onClick={handleUpdateCredentials}
              disabled={
                updatingCredentials ||
                !currentPassword ||
                !savedEmail ||
                email.trim() !== savedEmail
              }
              className="w-full sm:w-auto"
            >
              {updatingCredentials ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save_changes')
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('sessions_card_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSessions ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('no_sessions')}
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex items-start gap-3">
                  <Monitor
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    size={18}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {session.os} · {session.browser}
                      </span>
                      {session.isCurrent && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          {t('this_device')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('login_at', {
                        date: formatSessionDate(session.createdAt, locale),
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('last_active', {
                        date: formatSessionDate(session.lastUsedAt, locale),
                      })}
                    </p>
                  </div>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revokingSessionId === session.id}
                  >
                    {revokingSessionId === session.id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('ending_session')}
                      </>
                    ) : (
                      t('end_session')
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <CodeVerificationDialog
        key={pendingAction ?? 'none'}
        open={codeDialogOpen}
        onOpenChange={(open) => {
          setCodeDialogOpen(open);
          if (!open) {
            setPendingAction(null);
            setOldEmailToken(null);
          }
        }}
        title={
          pendingAction === 'email-old'
            ? t('confirm_current_email_title')
            : pendingAction === 'email-new'
              ? t('confirm_new_email_title')
              : undefined
        }
        description={dialogDescription}
        onSubmitCode={handleSubmitCode}
        onResend={handleResendCode}
      />

      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
        initialIdentifier={currentLogin}
        onSuccess={() => {
          // Сброс пароля отзывает все сессии, включая текущую — уводим на
          // страницу входа, чтобы войти уже с новым паролем
          window.location.replace('/login');
        }}
      />
    </div>
  );
}
