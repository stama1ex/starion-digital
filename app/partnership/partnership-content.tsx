'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Container } from '@/components/shared/container';
import { Mail, Phone, Lock, User, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function PartnershipContent() {
  const router = useRouter();
  const t = useTranslations('Partnership');
  const [formData, setFormData] = useState({
    phone: '',
    login: '',
    password: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const res = await fetch('/api/partnership-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (res.ok) {
        setSent(true);
      } else {
        alert(result.error || t('error_submit'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert(t('error_network'));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Container className="py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="mb-4">
              <Mail className="w-16 h-16 mx-auto text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('success_title')}</h2>
            <p className="text-muted-foreground mb-6">{t('success_message')}</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('back')}
              </Button>
              <Button onClick={() => router.push('/')}>
                {t('back_to_home')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4 gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('back')}
      </Button>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{t('title')}</CardTitle>
          <p className="text-center text-muted-foreground">
            {t('description')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4" />
                {t('phone_label')} *
              </Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder={t('phone_placeholder')}
              />
            </div>

            <div>
              <Label htmlFor="login" className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                {t('login_label')} *
              </Label>
              <Input
                id="login"
                type="text"
                required
                value={formData.login}
                onChange={(e) =>
                  setFormData({ ...formData, login: e.target.value })
                }
                placeholder={t('login_placeholder')}
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="flex items-center gap-2 mb-2"
              >
                <Lock className="w-4 h-4" />
                {t('password_label')} *
              </Label>
              <Input
                id="password"
                type="text"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder={t('password_placeholder')}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('password_hint')}
              </p>
            </div>

            <div>
              <Label htmlFor="message" className="mb-2">
                {t('message_label')}
              </Label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder={t('message_placeholder')}
                className="w-full min-h-25 p-3 border rounded-md resize-y"
              />
            </div>

            <Button type="submit" disabled={sending} className="w-full">
              {sending ? t('sending') : t('submit_button')}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {t('required_fields')}
            </p>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
