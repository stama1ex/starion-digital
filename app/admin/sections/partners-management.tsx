/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Edit2, Plus } from 'lucide-react';

export default function PartnersManagement() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    login: '',
    password: '',
  });

  useEffect(() => {
    fetchCurrentUser();
    fetchPartners();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.id) {
        setCurrentUserId(data.id);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/partners');
      const data = await res.json();
      // Фильтруем партнеров - исключаем ADMIN
      const filtered = data.filter((p: any) => p.name !== 'ADMIN');
      setPartners(filtered);
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = '/api/admin/partners';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...formData, id: editingId } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setFormData({ name: '', login: '', password: '' });
        setEditingId(null);
        setIsDialogOpen(false);
        await fetchPartners();
      }
    } catch (error) {
      console.error('Error saving partner:', error);
    }
  };

  const handleEdit = (partner: any) => {
    setFormData({
      name: partner.name,
      login: partner.login,
      password: partner.password,
    });
    setEditingId(partner.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (id === currentUserId) {
      alert('Вы не можете удалить самого себя!');
      return;
    }

    if (confirm('Вы уверены?')) {
      try {
        const res = await fetch('/api/admin/partners', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        if (res.ok) {
          await fetchPartners();
          alert('Партнер удалён');
        } else {
          const error = await res.json();
          alert(error.error || 'Ошибка при удалении');
        }
      } catch (error) {
        console.error('Error deleting partner:', error);
        alert('Ошибка при удалении партнера');
      }
    }
  };

  const handleOpenNew = () => {
    setFormData({ name: '', login: '', password: '' });
    setEditingId(null);
    setIsDialogOpen(true);
  };

  if (loading) return <div className="p-4">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Партнеры</h2>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus size={16} />
          Добавить партнера
        </Button>
      </div>

      <div className="grid gap-4">
        {partners.map((partner) => (
          <Card key={partner.id}>
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
                    disabled={partner.id === currentUserId}
                    title={
                      partner.id === currentUserId
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
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Название компании"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Логин</label>
              <Input
                value={formData.login}
                onChange={(e) =>
                  setFormData({ ...formData, login: e.target.value })
                }
                placeholder="username"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Пароль</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="password"
              />
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
    </div>
  );
}
