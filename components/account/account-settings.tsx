'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Monitor } from 'lucide-react';

interface AccountSession {
  id: number;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
  os: string;
  browser: string;
}

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AccountSettings() {
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
  const [address, setAddress] = useState('');
  const [savingContact, setSavingContact] = useState(false);

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
        setAddress(data.address ?? '');
      } catch (error) {
        console.error('Error loading account:', error);
        toast.error('Не удалось загрузить данные аккаунта');
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
        toast.error('Не удалось загрузить активные сессии');
      } finally {
        setLoadingSessions(false);
      }
    };

    loadProfile();
    loadSessions();
  }, []);

  const handleRevokeSession = async (sessionId: number) => {
    try {
      setRevokingSessionId(sessionId);
      const res = await fetch(`/api/account/sessions?id=${sessionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success('Сессия завершена');
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Не удалось завершить сессию');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleSaveContact = async () => {
    try {
      setSavingContact(true);
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, address }),
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success('Контактные данные обновлены');
    } catch (error) {
      console.error('Error saving contact info:', error);
      toast.error('Не удалось сохранить контактные данные');
    } finally {
      setSavingContact(false);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!currentPassword) {
      toast.error('Введите текущий пароль');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('Новые пароли не совпадают');
      return;
    }

    if (!login && !newPassword) {
      toast.error('Введите новый логин или новый пароль');
      return;
    }

    try {
      setUpdatingCredentials(true);
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newLogin: login || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Данные успешно обновлены');
        if (login) setCurrentLogin(login);
        setLogin('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await res.text();
        let errorMessage = 'Не удалось обновить данные';
        try {
          const errorJson = JSON.parse(error);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = error || errorMessage;
        }
        toast.error(`Ошибка: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error updating credentials:', error);
      toast.error('Ошибка при обновлении данных');
    } finally {
      setUpdatingCredentials(false);
    }
  };

  if (unauthorized) {
    return (
      <p className="text-sm text-muted-foreground">
        Войдите в аккаунт, чтобы просмотреть настройки.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Мой аккаунт</h2>

      <Card>
        <CardHeader>
          <CardTitle>Контактные данные</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loadingProfile && (
            <p className="text-sm text-muted-foreground">
              Логин: <span className="font-mono">{currentLogin}</span>
            </p>
          )}
          <div>
            <Label htmlFor="account-phone" className="mb-2">
              Телефон
            </Label>
            <Input
              id="account-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+373 XX XXX XXX"
            />
          </div>
          <div>
            <Label htmlFor="account-address" className="mb-2">
              Адрес
            </Label>
            <Input
              id="account-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Город, улица, дом"
            />
          </div>
          <Button
            onClick={handleSaveContact}
            disabled={savingContact || loadingProfile}
            className="w-full sm:w-auto"
          >
            {savingContact ? 'Сохранение...' : 'Сохранить контакты'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Изменить логин и пароль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-password" className="mb-2">
              Текущий пароль *
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Введите текущий пароль"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">
              Новые данные (заполните нужное)
            </h3>

            <div className="space-y-3">
              <div>
                <Label htmlFor="new-login" className="mb-2">
                  Новый логин
                </Label>
                <Input
                  id="new-login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Оставьте пустым, если не хотите менять"
                />
              </div>

              <div>
                <Label htmlFor="new-password" className="mb-2">
                  Новый пароль
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Оставьте пустым, если не хотите менять"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-password" className="mb-2">
                  Подтвердите новый пароль
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите новый пароль"
                    disabled={!newPassword}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

          <Button
            onClick={handleUpdateCredentials}
            disabled={updatingCredentials || !currentPassword}
            className="w-full sm:w-auto"
          >
            {updatingCredentials ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Активные сессии</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSessions ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Нет активных сессий
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
                          Это устройство
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Вход: {formatSessionDate(session.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Последняя активность:{' '}
                      {formatSessionDate(session.lastUsedAt)}
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
                    {revokingSessionId === session.id
                      ? 'Завершение...'
                      : 'Завершить'}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
