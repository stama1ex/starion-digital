'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  Loader2,
  Phone,
  User,
  Lock,
  MessageSquare,
  Trash2,
} from 'lucide-react';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface PartnershipRequest {
  id: number;
  phone: string;
  login: string;
  password: string;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export function PartnershipRequests() {
  const [requests, setRequests] = useState<PartnershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/admin/partnership-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    const confirmMessage =
      action === 'approve'
        ? 'Вы уверены? Это создаст нового партнера.'
        : 'Вы уверены? Заявка будет отклонена.';

    if (!confirm(confirmMessage)) return;

    setProcessing(id);
    try {
      const res = await fetch('/api/admin/partnership-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      if (res.ok) {
        await fetchRequests();
        alert(
          action === 'approve' ? 'Партнер успешно создан!' : 'Заявка отклонена'
        );
      } else {
        const result = await res.json();
        alert(result.error || 'Ошибка при обработке заявки');
      }
    } catch (error) {
      console.error('Error processing request:', error);
      alert('Ошибка при обработке заявки');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены? Заявка будет удалена безвозвратно.')) return;

    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/partnership-requests?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchRequests();
        alert('Заявка удалена');
      } else {
        const result = await res.json();
        alert(result.error || 'Ошибка при удалении заявки');
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Ошибка при удалении заявки');
    } finally {
      setProcessing(null);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
          >
            Ожидает
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge
            variant="secondary"
            className="bg-green-500/20 text-green-700 dark:text-green-400"
          >
            Одобрена
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge
            variant="secondary"
            className="bg-red-500/20 text-red-700 dark:text-red-400"
          >
            Отклонена
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Заявок пока нет</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Заявки на партнерство</h3>
      {requests.map((req) => (
        <Card key={req.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(req.status)}
                    <span className="text-sm text-muted-foreground">
                      {formatDate(req.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Логин:
                      </span>
                      <p className="font-medium">{req.login}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Телефон:
                      </span>
                      <p className="font-medium">{req.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Пароль:
                      </span>
                      <p className="font-mono text-sm">{req.password}</p>
                    </div>
                  </div>
                </div>

                {req.message && (
                  <div className="flex gap-2 pt-2 border-t">
                    <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground">
                        Сообщение:
                      </span>
                      <p className="text-sm mt-1">{req.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {req.status === 'PENDING' && (
                <div className="flex flex-col gap-2 min-w-35">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAction(req.id, 'approve')}
                    disabled={processing === req.id}
                    className="w-full"
                  >
                    {processing === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Одобрить
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(req.id, 'reject')}
                    disabled={processing === req.id}
                    className="w-full"
                  >
                    {processing === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <X className="w-4 h-4 mr-1" />
                        Отклонить
                      </>
                    )}
                  </Button>
                </div>
              )}

              {req.status !== 'PENDING' && (
                <div className="flex items-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(req.id)}
                    disabled={processing === req.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {processing === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
