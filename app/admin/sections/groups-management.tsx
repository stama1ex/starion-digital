/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGroups,
  AdminAPI,
  handleApiError,
  PRODUCT_TYPES_OPTIONS,
  groupBy,
} from '@/lib/admin';

interface ProductGroup {
  id: number;
  name: string;
  slug?: string | null;
  translations?: any;
  type: string;
  _count?: {
    products: number;
  };
}

export function GroupsManagement() {
  const { groups, refetch } = useGroups();
  const [newGroupTranslations, setNewGroupTranslations] = useState({
    en: '',
    ro: '',
    ru: '',
  });
  const [newGroupType, setNewGroupType] = useState<string>('MAGNET');
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  const [editTranslations, setEditTranslations] = useState({
    en: '',
    ro: '',
    ru: '',
  });

  const handleCreate = async () => {
    const generatedSlug = newGroupTranslations.en.trim().toUpperCase();
    if (!generatedSlug) {
      toast.error('Введите название на английском (для генерации slug)');
      return;
    }
    if (!newGroupTranslations.ru.trim()) {
      toast.error('Введите название на русском');
      return;
    }

    try {
      await AdminAPI.createGroup({
        type: newGroupType,
        slug: generatedSlug,
        translations: {
          en: newGroupTranslations.en.trim() || newGroupTranslations.ru.trim(),
          ro: newGroupTranslations.ro.trim() || newGroupTranslations.ru.trim(),
          ru: newGroupTranslations.ru.trim(),
        },
      });

      setNewGroupTranslations({ en: '', ro: '', ru: '' });
      refetch();
    } catch (error: any) {
      const message = await handleApiError(error);
      toast.error('Ошибка: ' + message);
    }
  };

  const handleUpdate = async () => {
    const generatedSlug = editTranslations.en.trim().toUpperCase();
    if (!editingGroup || !generatedSlug || !editTranslations.ru.trim()) {
      if (!generatedSlug)
        toast.error('Введите название на английском (для генерации slug)');
      return;
    }

    try {
      await AdminAPI.updateGroup({
        id: editingGroup.id,
        slug: generatedSlug,
        translations: {
          en: editTranslations.en.trim() || editTranslations.ru.trim(),
          ro: editTranslations.ro.trim() || editTranslations.ru.trim(),
          ru: editTranslations.ru.trim(),
        },
      });

      setEditingGroup(null);
      setEditTranslations({ en: '', ro: '', ru: '' });
      refetch();
    } catch (error: any) {
      const message = await handleApiError(error);
      toast.error('Ошибка: ' + message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить эту группу? Товары останутся без группы.')) return;

    try {
      await AdminAPI.deleteGroup(id);
      refetch();
    } catch (error) {
      const message = await handleApiError(error);
      toast.error('Ошибка при удалении группы: ' + message);
    }
  };

  const groupedByType = groupBy(groups, (group) => group.type);

  return (
    <div className="space-y-6">
      {/* Создание новой группы */}
      <Card>
        <CardHeader>
          <CardTitle>Создать новую группу</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2">Русский</Label>
                <Input
                  value={newGroupTranslations.ru}
                  onChange={(e) =>
                    setNewGroupTranslations({
                      ...newGroupTranslations,
                      ru: e.target.value,
                    })
                  }
                  placeholder="Дерево, Мрамор..."
                />
              </div>
              <div>
                <Label className="mb-2">English</Label>
                <Input
                  value={newGroupTranslations.en}
                  onChange={(e) =>
                    setNewGroupTranslations({
                      ...newGroupTranslations,
                      en: e.target.value,
                    })
                  }
                  placeholder="Wood, Marble..."
                />
              </div>
              <div>
                <Label className="mb-2">Română</Label>
                <Input
                  value={newGroupTranslations.ro}
                  onChange={(e) =>
                    setNewGroupTranslations({
                      ...newGroupTranslations,
                      ro: e.target.value,
                    })
                  }
                  placeholder="Lemn, Marmură..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="mb-2">Тип товара</Label>
                <Select value={newGroupType} onValueChange={setNewGroupType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES_OPTIONS.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex mt-auto">
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Список групп по типам */}
      {PRODUCT_TYPES_OPTIONS.map((type) => {
        const typeGroups = groupedByType[type.value] || [];
        if (typeGroups.length === 0) return null;

        return (
          <Card key={type.value}>
            <CardHeader>
              <CardTitle>{type.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {typeGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex flex-col gap-3 p-3 border rounded-lg"
                  >
                    {editingGroup?.id === group.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label>English</Label>
                            <Input
                              value={editTranslations.en}
                              onChange={(e) =>
                                setEditTranslations({
                                  ...editTranslations,
                                  en: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Română</Label>
                            <Input
                              value={editTranslations.ro}
                              onChange={(e) =>
                                setEditTranslations({
                                  ...editTranslations,
                                  ro: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Русский</Label>
                            <Input
                              value={editTranslations.ru}
                              onChange={(e) =>
                                setEditTranslations({
                                  ...editTranslations,
                                  ru: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdate}>
                            Сохранить
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingGroup(null);
                              setEditTranslations({ en: '', ro: '', ru: '' });
                            }}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {(group.translations as any)?.ru || group.slug}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Slug: {group.slug || 'не указан'} | Товаров:{' '}
                            {group._count?.products || 0}
                          </p>
                          {group.translations && (
                            <p className="text-xs text-muted-foreground mt-1">
                              EN: {(group.translations as any).en || '-'} | RO:{' '}
                              {(group.translations as any).ro || '-'}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingGroup(group);
                              const trans = group.translations as any;
                              setEditTranslations({
                                en: trans?.en || '',
                                ro: trans?.ro || '',
                                ru: trans?.ru || group.slug,
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(group.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
