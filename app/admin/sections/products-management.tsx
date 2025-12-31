/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
import { Trash2, Edit2, Plus, Upload, X } from 'lucide-react';
import { ProductType } from '@prisma/client';
import {
  useProducts,
  useGroups,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  AdminAPI,
  handleApiError,
} from '@/lib/admin';
import { NoImageIcon } from '@/components/shared/no-image-icon';
import { useDropboxImage } from '@/lib/hooks/useDropboxImage';

function ProductImagePreview({ imagePath }: { imagePath: string }) {
  const { imgSrc, loading } = useDropboxImage(imagePath);

  if (loading) {
    return (
      <div
        className="w-full max-w-xs mx-auto rounded-lg bg-muted animate-pulse"
        style={{ height: '200px' }}
      />
    );
  }

  if (!imgSrc) {
    return (
      <NoImageIcon className="w-32 h-32 mx-auto text-muted-foreground/30" />
    );
  }

  // Используем обычный img для Dropbox URL
  if (imgSrc.includes('dropboxusercontent.com')) {
    return (
      <img
        src={imgSrc}
        alt="Preview"
        className="w-full max-w-xs mx-auto rounded-lg object-contain"
        style={{ maxHeight: '200px' }}
      />
    );
  }

  return (
    <img
      src={imgSrc}
      alt="Preview"
      className="w-full max-w-xs mx-auto rounded-lg object-contain"
      style={{ maxHeight: '200px' }}
    />
  );
}

export default function ProductsManagement() {
  const { products, loading, refetch: refetchProducts } = useProducts();
  const { groups } = useGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    number: '',
    type: 'MAGNET' as ProductType,
    country: 'MD',
    groupId: '',
    costPrice: '',
    image: '',
  });

  const uploadFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите файл изображения');
      return;
    }

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
        toast.error(result.error || 'Ошибка загрузки изображения');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Ошибка при загрузке изображения');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSave = async () => {
    try {
      const groupId =
        formData.groupId && formData.groupId !== 'NONE'
          ? parseInt(formData.groupId)
          : null;

      const body = {
        ...(editingId && { id: editingId }),
        number: formData.number,
        type: formData.type,
        country: formData.country,
        groupId,
        costPrice: parseFloat(formData.costPrice),
        imageUrl: formData.image,
      };

      if (editingId) {
        await AdminAPI.updateProduct(body);
      } else {
        await AdminAPI.createProduct(body);
      }

      resetForm();
      setIsDialogOpen(false);
      await refetchProducts();
      toast.success('Товар сохранён');
    } catch (error) {
      const message = await handleApiError(error);
      toast.error('Ошибка при сохранении товара: ' + message);
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      number: product.number,
      type: product.type,
      country: product.country,
      groupId: product.groupId ? product.groupId.toString() : 'NONE',
      costPrice: product.costPrice.toString(),
      image: product.image,
    });
    setEditingId(product.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены? Это удалит товар из системы.')) return;

    try {
      await AdminAPI.deleteProduct(id);
      await refetchProducts();
      toast.success('Товар удалён');
    } catch (error) {
      const message = await handleApiError(error);
      toast.error('Ошибка при удалении товара: ' + message);
    }
  };

  const resetForm = () => {
    setFormData({
      number: '',
      type: 'MAGNET',
      country: 'MD',
      groupId: '',
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

  // Фильтрация товаров по поисковому запросу
  const filteredProducts = products.filter((product) => {
    // Поиск по тексту
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        product.number.toLowerCase().includes(query) ||
        product.country.toLowerCase().includes(query) ||
        product.type.toLowerCase().includes(query) ||
        product.group?.name?.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    // Фильтр по типу
    if (filterType !== 'ALL' && product.type !== filterType) {
      return false;
    }

    // Фильтр по группе
    if (filterGroup !== 'ALL') {
      if (filterGroup === 'NONE' && product.groupId !== null) {
        return false;
      }
      if (filterGroup !== 'NONE' && product.groupId !== parseInt(filterGroup)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Товары</h2>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus size={16} />
          Добавить товар
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Поиск по артикулу, стране, типу..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:flex-1"
        />

        <Select
          value={filterType}
          onValueChange={(value) => {
            setFilterType(value);
            setFilterGroup('ALL'); // Сбрасываем фильтр группы при смене типа
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Все типы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все типы</SelectItem>
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

        <Select
          value={filterGroup}
          onValueChange={setFilterGroup}
          disabled={filterType === 'ALL'}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Все группы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все группы</SelectItem>
            <SelectItem value="NONE">Без группы</SelectItem>
            {groups
              .filter(
                (group) => filterType === 'ALL' || group.type === filterType
              )
              .map((group) => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {(group.translations as any)?.ru || group.slug}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="p-0">
            <CardContent className="px-3 py-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                {/* Информация в одну строку */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">№</span>
                    <span className="font-mono font-bold">
                      {product.number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Тип:</span>
                    <span>
                      {PRODUCT_TYPE_LABELS[product.type] || product.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Группа:
                    </span>
                    <span>
                      {product.group
                        ? (product.group.translations as any)?.ru ||
                          product.group.slug
                        : 'Без группы'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Цена:</span>
                    <span className="font-semibold">
                      {product.costPrice} MDL
                    </span>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                    className="gap-1 h-8"
                  >
                    <Edit2 size={14} />
                    <span className="hidden sm:inline">Редактировать</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                    className="gap-1 h-8"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Удалить</span>
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
                value={formData.number || ''}
                onChange={(e) =>
                  setFormData({ ...formData, number: e.target.value })
                }
                placeholder="М01"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Тип</label>
              <Select
                value={formData.type || ''}
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
                      {PRODUCT_TYPE_LABELS[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">
                Группа (необязательно)
              </label>
              <Select
                value={formData.groupId || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, groupId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите группу или оставьте пустым" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Без группы</SelectItem>
                  {groups
                    .filter((g) => g.type === formData.type)
                    .map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {(group.translations as any)?.ru || group.slug}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Страна</label>
              <Input
                value={formData.country || ''}
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
                value={formData.costPrice || ''}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Изображение</label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {formData.image ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <ProductImagePreview imagePath={formData.image} />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setFormData({ ...formData, image: '' })}
                        className="absolute top-2 right-2 h-8 w-8 p-0"
                      >
                        <X size={16} />
                      </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Изображение загружено
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <NoImageIcon className="w-32 h-32 mx-auto text-muted-foreground/30" />
                    <label className="cursor-pointer block">
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Нет изображения. Нажмите для загрузки
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
                  </div>
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
