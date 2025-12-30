/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductType } from '@prisma/client';

interface OrderCustomPricesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  groups: any[];
  onSuccess: (updatedOrder?: any) => void;
}

const PRODUCT_TYPES: ProductType[] = ['MAGNET', 'PLATE'];

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  MAGNET: 'Магниты',
  PLATE: 'Тарелки',
  POSTCARD: 'Открытки',
  STATUE: 'Статуэтки',
  BALL: 'Шары',
};

export function OrderCustomPricesDialog({
  open,
  onOpenChange,
  order,
  groups,
  onSuccess,
}: OrderCustomPricesDialogProps) {
  const [editingPrices, setEditingPrices] = useState<
    Record<string, number | string>
  >({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open && order) {
      // Инициализируем цены из customPrices заказа или стандартных цен партнера
      const initialPrices: Record<string, number | string> = {};
      
      // Получаем все уникальные комбинации type-groupId из товаров заказа
      const uniqueCombinations = new Set<string>();
      order.items.forEach((item: any) => {
        const groupId = item.product.groupId ?? null;
        const key = `${item.product.type}-${groupId}`;
        uniqueCombinations.add(key);
      });

      // Для каждой комбинации устанавливаем цену
      uniqueCombinations.forEach((key) => {
        if (order.customPrices && order.customPrices[key] !== undefined) {
          // Если есть кастомная цена, используем её
          initialPrices[key] = order.customPrices[key];
        } else {
          // Иначе берем текущую цену из первого товара с этой комбинацией
          const item = order.items.find((i: any) => {
            const groupId = i.product.groupId ?? null;
            return `${i.product.type}-${groupId}` === key;
          });
          if (item) {
            initialPrices[key] = Number(item.pricePerItem);
          }
        }
      });

      setEditingPrices(initialPrices);
      setHasChanges(false);
    }
  }, [open, order, groups]);

  const handlePriceChange = (
    type: ProductType,
    groupId: number | null,
    value: string
  ) => {
    const key = `${type}-${groupId}`;
    setEditingPrices({ ...editingPrices, [key]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch('/api/admin/orders/custom-prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          customPrices: editingPrices,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const data = await response.json();

      alert('Цены успешно обновлены');
      setHasChanges(false);
      onSuccess(data?.order);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving custom prices:', error);
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при сохранении цен: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const getPrice = (type: ProductType, groupId: number | null) => {
    const key = `${type}-${groupId}`;
    return editingPrices[key] ?? '';
  };

  // Проверяем, есть ли в заказе товары данного типа и группы
  const hasProductsOfTypeAndGroup = (type: ProductType, groupId: number | null) => {
    return order?.items?.some(
      (item: any) => {
        const itemGroupId = item.product.groupId ?? null;
        return item.product.type === type && itemGroupId === groupId;
      }
    );
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать цены для заказа #{order.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded">
            <p className="text-sm">
              <strong>Партнёр:</strong> {order.partner.name}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Измените цены для конкретных групп товаров. Эти цены будут применены
              ТОЛЬКО к этому заказу и не повлияют на стандартные цены партнёра.
            </p>
          </div>

          {PRODUCT_TYPES.map((type) => {
            // Получаем группы для данного типа товара, которые есть в заказе
            const typeGroups = groups.filter((g) => g.type === type);
            const relevantGroups = typeGroups.filter((g) =>
              hasProductsOfTypeAndGroup(type, g.id)
            );
            const hasNoGroupProducts = hasProductsOfTypeAndGroup(type, null);

            // Если нет товаров этого типа в заказе, пропускаем
            if (relevantGroups.length === 0 && !hasNoGroupProducts) {
              return null;
            }

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {PRODUCT_TYPE_LABELS[type]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Группы */}
                    {relevantGroups.map((group) => (
                      <div key={group.id} className="space-y-2">
                        <label className="text-sm font-medium">
                          {(group.translations as any)?.ru || group.slug}
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={getPrice(type, group.id)}
                            onChange={(e) =>
                              handlePriceChange(type, group.id, e.target.value)
                            }
                            placeholder="0.00"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            MDL
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Без группы */}
                    {hasNoGroupProducts && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Без группы</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={getPrice(type, null)}
                            onChange={(e) =>
                              handlePriceChange(type, null, e.target.value)
                            }
                            placeholder="0.00"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            MDL
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? 'Сохранение...' : 'Сохранить цены'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
