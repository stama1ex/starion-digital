/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Edit2, Plus, Eye, EyeOff } from 'lucide-react';
import {
  usePartners,
  useCurrentUser,
  AdminAPI,
  handleApiError,
} from '@/lib/admin';
import { PartnershipRequests } from './partnership-requests';

interface PartnersManagementProps {
  onRequestsChange?: () => void;
  pendingRequestsCount?: number;
}

export default function PartnersManagement({
  onRequestsChange,
  pendingRequestsCount = 0,
}: PartnersManagementProps) {
  const { partners, loading, refetch } = usePartners(true);
  const { user } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    login: '',
    password: '',
  });

  const handleSave = async () => {
    if (!editingId) {
      if (!formData.name.trim() || !formData.login.trim()) {
        toast.error('Заполните имя и логин');
        return;
      }

      if (formData.password.length < 4) {
        toast.error('Пароль должен быть минимум 4 символа');
        return;
      }
    }

    try {
      const body = editingId ? { ...formData, id: editingId } : formData;

      if (editingId) {
        await AdminAPI.updatePartner(body);
      } else {
        await AdminAPI.createPartner(body);
      }

      setFormData({ name: '', login: '', password: '' });
      setEditingId(null);
      setIsDialogOpen(false);
      await refetch();
      toast.success(editingId ? 'Партнёр обновлён' : 'Партнёр создан');
    } catch (error) {
      const message = await handleApiError(error);
      toast.error(`Ошибка: ${message}`);
    }
  };

  const handleEdit = (partner: any) => {
    setFormData({
      name: partner.name,
      login: partner.login,
      password: '',
    });
    setEditingId(partner.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (id === user?.id) {
      toast.error('Вы не можете удалить самого себя');
      return;
    }

    if (!confirm('Вы уверены? Это удалит партнёра из системы.')) return;

    try {
      await AdminAPI.deletePartner(id);
      await refetch();
      toast.success('Партнёр удалён');
    } catch (error) {
      const message = await handleApiError(error);
      toast.error(`Ошибка: ${message}`);
    }
  };

  const handleOpenNew = () => {
    setFormData({ name: '', login: '', password: '' });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  if (loading) return <div className="p-4">Загрузка...</div>;

  // Фильтрация партнёров по поисковому запросу
  const filteredPartners = partners.filter((partner) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      partner.name.toLowerCase().includes(query) ||
      partner.login.toLowerCase().includes(query)
    );
  });

  return (
    <Tabs defaultValue="list" className="space-y-4">
      <TabsList className="grid w-full md:w-auto grid-cols-2">
        <TabsTrigger value="list">Список партнеров</TabsTrigger>
        <TabsTrigger value="requests" className="relative">
          Заявки
          {pendingRequestsCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-1 h-5 min-w-5 px-1 text-xs"
            >
              {pendingRequestsCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold">Партнеры</h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <Input
              placeholder="Поиск по имени или логину..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
            <Button onClick={handleOpenNew} className="gap-2">
              <Plus size={16} />
              Добавить партнера
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          {filteredPartners.map((partner) => (
            <Card key={partner.id} className="py-1">
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Имя</p>
                    <p className="font-medium">{partner.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Логин</p>
                    <p className="font-mono text-sm">{partner.login}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Пароль</p>
                    <p className="font-mono text-sm">•••••</p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(partner)}
                      className="gap-2"
                    >
                      <Edit2 size={16} />
                      Редактировать
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(partner.id)}
                      disabled={partner.id === user?.id}
                      title={
                        partner.id === user?.id
                          ? 'Вы не можете удалить себя'
                          : ''
                      }
                      className="gap-2"
                    >
                      <Trash2 size={16} />
                      Удалить
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="requests">
        <PartnershipRequests onRequestsChange={onRequestsChange} />
      </TabsContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Редактировать партнера' : 'Добавить партнера'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Имя</label>
              <Input
                value={formData.name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Название компании"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Логин</label>
              <Input
                value={formData.login || ''}
                onChange={(e) =>
                  setFormData({ ...formData, login: e.target.value })
                }
                placeholder="username"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Пароль</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
