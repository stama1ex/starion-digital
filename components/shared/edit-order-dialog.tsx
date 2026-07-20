'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';

interface AvailableProduct {
  id: number;
  number: string;
  price: number;
}

interface EditLine {
  productId: number;
  number: string;
  quantity: number;
  pricePerItem: number;
}

interface EditOrderDialogProps {
  orderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrderDialog({
  orderId,
  open,
  onOpenChange,
  onSuccess,
}: EditOrderDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [availableProducts, setAvailableProducts] = useState<
    AvailableProduct[]
  >([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setSearchQuery('');

    fetch(`/api/order/${orderId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((data) => {
        setEditable(data.editable);
        setReason(data.reason);
        setAvailableProducts(data.availableProducts || []);
        setLines(
          (data.order?.items || []).map(
            (item: {
              productId: number;
              quantity: number;
              pricePerItem: number;
              product: { number: string };
            }) => ({
              productId: item.productId,
              number: item.product.number,
              quantity: item.quantity,
              pricePerItem: Number(item.pricePerItem),
            }),
          ),
        );
      })
      .catch((error) => {
        console.error('Error loading order for edit:', error);
        toast.error('Не удалось загрузить заказ для редактирования');
      })
      .finally(() => setLoading(false));
  }, [open, orderId]);

  const handleQuantityChange = (productId: number, value: string) => {
    const qty = Math.max(1, parseInt(value) || 1);
    setLines((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, quantity: qty } : line,
      ),
    );
  };

  const handleRemove = (productId: number) => {
    setLines((prev) => prev.filter((line) => line.productId !== productId));
  };

  const handleAddProduct = (product: AvailableProduct) => {
    if (lines.some((line) => line.productId === product.id)) return;
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        number: product.number,
        quantity: 1,
        pricePerItem: product.price,
      },
    ]);
  };

  const handleSave = async () => {
    if (lines.length === 0) {
      toast.error('В заказе должна остаться хотя бы одна позиция');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/order/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message);
      }

      toast.success('Заказ обновлён');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка';
      toast.error(`Не удалось сохранить изменения: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const usedProductIds = new Set(lines.map((l) => l.productId));
  const filteredAvailable = availableProducts
    .filter((p) => !usedProductIds.has(p.id))
    .filter((p) =>
      p.number.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const total = lines.reduce(
    (sum, line) => sum + line.pricePerItem * line.quantity,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Редактировать заказ №{orderId}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !editable ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Товары в заказе</h4>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Все позиции удалены
                </p>
              ) : (
                lines.map((line) => (
                  <div
                    key={line.productId}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <span className="flex-1 min-w-0 truncate text-sm">
                      {line.number}
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        handleQuantityChange(line.productId, e.target.value)
                      }
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-8 w-16 text-center"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(line.productId)}
                      title="Убрать из заказа"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 border-t pt-3">
              <h4 className="text-sm font-medium">Добавить товар</h4>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск товара по номеру..."
                  className="pl-8"
                />
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    Товары не найдены
                  </p>
                ) : (
                  filteredAvailable.slice(0, 30).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span className="truncate">{product.number}</span>
                      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                        {product.price.toFixed(2)} MDL
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Итого</span>
              <span className="font-semibold">{total.toFixed(2)} MDL</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {editable ? 'Отмена' : 'Закрыть'}
          </Button>
          {editable && (
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                'Сохранить изменения'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
