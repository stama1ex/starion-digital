'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

export default function LoginForm() {
  const t = useTranslations('Login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });

    setLoading(false);

    if (res.ok) {
      toast.success(t('success'));
      window.location.replace('/');
      return;
    }

    toast.error(t('error'));
  };

  return (
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
            <Label>{t('password')}</Label>
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
            {loading ? t('loading') : t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
