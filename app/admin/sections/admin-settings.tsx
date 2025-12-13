'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export default function AdminSettings() {
  const [login, setLogin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUpdateCredentials = async () => {
    if (!currentPassword) {
      alert('Введите текущий пароль');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      alert('Новые пароли не совпадают');
      return;
    }

    if (!login && !newPassword) {
      alert('Введите новый логин или новый пароль');
      return;
    }

    try {
      setUpdating(true);
      const res = await fetch('/api/admin/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newLogin: login || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      if (res.ok) {
        alert('Данные успешно обновлены');
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
        alert(`Ошибка: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error updating credentials:', error);
      alert('Ошибка при обновлении данных');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Настройки администратора</h2>

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
            disabled={updating || !currentPassword}
            className="w-full sm:w-auto"
          >
            {updating ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
