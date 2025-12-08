/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Material {
  id: number;
  name: string;
  label: string;
  createdAt: string;
}

export default function MaterialsManagement() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/materials');
      const data = await res.json();
      setMaterials(data);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.label.trim()) {
      alert('Пожалуйста, заполните все поля');
      return;
    }

    try {
      const url = '/api/admin/materials';
      const method = editingId ? 'PUT' : 'POST';

      const body = editingId
        ? { id: editingId, name: formData.name, label: formData.label }
        : { name: formData.name, label: formData.label };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        setIsDialogOpen(false);
        await fetchMaterials();
        alert(editingId ? 'Материал обновлён' : 'Материал добавлен');
      } else {
        const error = await res.json();
        alert(error.error || 'Ошибка при сохранении материала');
      }
    } catch (error) {
      console.error('Error saving material:', error);
      alert('Ошибка при сохранении материала');
    }
  };

  const handleEdit = (material: Material) => {
    setFormData({
      name: material.name,
      label: material.label,
    });
    setEditingId(material.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Вы уверены? Это удалит материал из системы.')) {
      try {
        const res = await fetch(`/api/admin/materials`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        const result = await res.json();

        if (res.ok) {
          await fetchMaterials();
          alert('Материал удалён');
        } else {
          alert(
            result.error ||
              'Не удалось удалить материал. Возможно, он используется в товарах.'
          );
        }
      } catch (error) {
        console.error('Error deleting material:', error);
        alert('Ошибка при удалении материала');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
    });
    setEditingId(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading) return <div className="p-4">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Материалы</h2>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus size={16} />
          Добавить материал
        </Button>
      </div>

      <div className="grid gap-2">
        {materials.map((material) => (
          <Card key={material.id}>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center py-4">
                <div>
                  <p className="text-sm text-muted-foreground">Код (name)</p>
                  <p className="font-mono font-bold">{material.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Название (label)
                  </p>
                  <p className="text-sm">{material.label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Дата создания</p>
                  <p className="text-sm">
                    {new Date(material.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(material)}
                    className="gap-2"
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(material.id)}
                    className="gap-2"
                  >
                    <Trash2 size={16} />
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
              {editingId ? 'Редактировать материал' : 'Добавить материал'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Код (name) *</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value.toUpperCase(),
                  })
                }
                placeholder="MARBLE"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Используется в системе. Только латиница, в ВЕРХНЕМ РЕГИСТРЕ
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Название (label) *</label>
              <Input
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Мрамор"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Отображается пользователям (может быть на любом языке)
              </p>
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
