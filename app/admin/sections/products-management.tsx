/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Edit2, Plus, Upload } from 'lucide-react';
import { ProductType, Material } from '@prisma/client';

const PRODUCT_TYPES: ProductType[] = [
  'MAGNET',
  'PLATE',
  'POSTCARD',
  'STATUE',
  'BALL',
];
const MATERIALS: Material[] = ['MARBLE', 'WOOD', 'ACRYLIC'];

export default function ProductsManagement() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    number: '',
    type: 'MAGNET' as ProductType,
    country: 'MD',
    material: 'MARBLE' as Material,
    costPrice: '',
    image: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formDataToSend,
      });

      const result = await res.json();
      if (res.ok) {
        setFormData({ ...formData, image: result.path });
      } else {
        alert(result.error || 'Ошибка загрузки изображения');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Ошибка при загрузке изображения');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = '/api/admin/products';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId
        ? {
            ...formData,
            id: editingId,
            costPrice: parseFloat(formData.costPrice),
          }
        : { ...formData, costPrice: parseFloat(formData.costPrice) };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        setIsDialogOpen(false);
        await fetchProducts();
        alert('Товар сохранён');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Ошибка при сохранении товара');
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      number: product.number,
      type: product.type,
      country: product.country,
      material: product.material,
      costPrice: product.costPrice.toString(),
      image: product.image,
    });
    setEditingId(product.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Вы уверены? Это удалит товар из системы.')) {
      try {
        const res = await fetch('/api/admin/products', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });

        const result = await res.json();

        if (res.ok) {
          await fetchProducts();
          alert('Товар удалён');
        } else {
          alert(
            result.error ||
              'Не удалось удалить товар. Возможно, он используется в заказах.'
          );
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Ошибка при удалении товара');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      number: '',
      type: 'MAGNET',
      country: 'MD',
      material: 'MARBLE',
      costPrice: '',
      image: '',
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
        <h2 className="text-2xl font-bold">Товары</h2>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus size={16} />
          Добавить товар
        </Button>
      </div>

      <div className="grid gap-2">
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Артикул</p>
                  <p className="font-mono font-bold">{product.number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Тип</p>
                  <p className="text-sm">
                    {product.type === 'MAGNET'
                      ? 'Магнит'
                      : product.type === 'PLATE'
                      ? 'Тарелка'
                      : product.type}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Материал</p>
                  <p className="text-sm">
                    {product.material === 'MARBLE'
                      ? 'Мрамор'
                      : product.material === 'WOOD'
                      ? 'Дерево'
                      : product.material}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Себестоимость</p>
                  <p className="font-semibold">{product.costPrice} MDL</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                    className="gap-2"
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
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
              {editingId ? 'Редактировать товар' : 'Добавить товар'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Артикул (М01, T01)</label>
              <Input
                value={formData.number}
                onChange={(e) =>
                  setFormData({ ...formData, number: e.target.value })
                }
                placeholder="М01"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Тип</label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as ProductType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === 'MAGNET'
                        ? 'Магнит'
                        : type === 'PLATE'
                        ? 'Тарелка'
                        : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Материал</label>
              <Select
                value={formData.material}
                onValueChange={(value) =>
                  setFormData({ ...formData, material: value as Material })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((material) => (
                    <SelectItem key={material} value={material}>
                      {material === 'MARBLE'
                        ? 'Мрамор'
                        : material === 'WOOD'
                        ? 'Дерево'
                        : material}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Страна</label>
              <Input
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                placeholder="MD"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Себестоимость (MDL)</label>
              <Input
                type="number"
                step="0.1"
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Изображение</label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {formData.image ? (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600">
                      ✓ Изображение загружено
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formData.image}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={24} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Выберите файл или перетащите сюда
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {uploadingImage && (
                <p className="text-sm text-blue-500 mt-2">Загрузка...</p>
              )}
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
