/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ProductType } from '@prisma/client';

const PRODUCT_TYPES: ProductType[] = [
  'MAGNET',
  'PLATE',
  'POSTCARD',
  // 'STATUE',
  // 'BALL',
];

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  MAGNET: 'Магниты',
  PLATE: 'Тарелки',
  POSTCARD: 'Открытки',
  STATUE: 'Статуэтки',
  BALL: 'Шары',
};

interface ProductGroup {
  id: number;
  slug: string;
  translations: any;
  type: ProductType;
}

interface Price {
  id: number;
  type: ProductType;
  groupId: number | null;
  price: number;
}

export default function PricesManagement() {
  const [partners, setPartners] = useState<any[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState<
    Record<string, number | string>
  >({});
  const [hasChanges, setHasChanges] = useState(false);
  const [presetPrices, setPresetPrices] = useState<
    Record<string, number | string>
  >({});
  const [showPresetModal, setShowPresetModal] = useState<ProductType | null>(
    null,
  );
  const [showGroupPresetModal, setShowGroupPresetModal] = useState<{
    type: ProductType;
    groupId: number | null;
    groupName: string;
  } | null>(null);
  const [applyingPreset, setApplyingPreset] = useState(false);

  useEffect(() => {
    fetchPartners();
    fetchGroups();
  }, []);

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/admin/partners');
      const data = await res.json();
      // Фильтруем партнеров - исключаем ADMIN
      const filtered = data.filter((p: any) => p.role !== 'ADMIN');
      setPartners(filtered);
      if (filtered.length > 0) {
        setSelectedPartnerId(filtered[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/admin/groups');
      const data = await res.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  useEffect(() => {
    if (selectedPartnerId) {
      fetchPrices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartnerId]);

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/prices?partnerId=${selectedPartnerId}`,
      );
      const data = await res.json();
      setPrices(data);
      setEditingPrices({});
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPartnerId]);

  const handlePriceChange = (
    type: ProductType,
    groupId: number | null,
    value: string,
  ) => {
    const key = `${type}-${groupId}`;
    setEditingPrices({ ...editingPrices, [key]: value });
    setHasChanges(true);
  };

  const handleSaveAllPrices = async () => {
    try {
      setLoading(true);
      const promises = Object.entries(editingPrices).map(([key, value]) => {
        const [type, groupIdStr] = key.split('-');
        const groupId = groupIdStr === 'null' ? null : parseInt(groupIdStr);
        return fetch('/api/admin/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId: parseInt(selectedPartnerId),
            type: type as ProductType,
            groupId: groupId,
            price: parseFloat(value.toString()),
          }),
        });
      });

      await Promise.all(promises);
      await fetchPrices();
    } catch (error) {
      console.error('Error saving prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (type: ProductType, groupId: number | null) => {
    const key = `${type}-${groupId}`;
    const editingValue = editingPrices[key];
    if (editingValue !== undefined) return editingValue;

    const price = prices.find((p) => p.type === type && p.groupId === groupId);
    return price?.price ?? '';
  };

  const handleApplyPresetToAll = async (type: ProductType) => {
    if (
      !confirm(
        `Вы уверены, что хотите применить этот пресет цен для типа "${
          PRODUCT_TYPE_LABELS[type] || type
        }" ко всем партнерам? Это перезапишет все существующие цены для этого типа товара у всех партнеров.`,
      )
    ) {
      return;
    }

    try {
      setApplyingPreset(true);

      // Получаем все группы для данного типа товара
      const typeGroups = groups.filter((g) => g.type === type);
      const groupIds = [...typeGroups.map((g) => g.id), null]; // включаем null для "Без группы"

      // Для каждого партнера применяем цены
      const promises = partners.map((partner) =>
        groupIds.map((groupId) => {
          const key = `${type}-${groupId}`;
          const presetValue = presetPrices[key];

          // Если для этой группы задан пресет, применяем его
          if (presetValue !== undefined && presetValue !== '') {
            return fetch('/api/admin/prices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partnerId: partner.id,
                type: type,
                groupId: groupId,
                price: parseFloat(presetValue.toString()),
              }),
            });
          }
          return null;
        }),
      );

      await Promise.all(promises.flat().filter((p) => p !== null));
      toast.success('Пресет успешно применён ко всем партнерам!');
      setShowPresetModal(null);
      setPresetPrices({});
      await fetchPrices(); // Обновляем данные для текущего партнера
    } catch (error) {
      console.error('Error applying preset:', error);
      toast.error('Ошибка при применении пресета');
    } finally {
      setApplyingPreset(false);
    }
  };

  const handlePresetPriceChange = (
    type: ProductType,
    groupId: number | null,
    value: string,
  ) => {
    const key = `${type}-${groupId}`;
    setPresetPrices({ ...presetPrices, [key]: value });
  };

  const getPresetPrice = (type: ProductType, groupId: number | null) => {
    const key = `${type}-${groupId}`;
    return presetPrices[key] ?? '';
  };

  const handleApplyGroupPresetToAll = async (
    type: ProductType,
    groupId: number | null,
    price: number,
  ) => {
    if (
      !confirm(
        `Вы уверены, что хотите применить цену ${price} лей для этой группы ко всем партнерам?`,
      )
    ) {
      return;
    }

    try {
      setApplyingPreset(true);

      const promises = partners.map((partner) =>
        fetch('/api/admin/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId: partner.id,
            type: type,
            groupId: groupId,
            price: price,
          }),
        }),
      );

      await Promise.all(promises);
      toast.success('Цена успешно применена ко всем партнерам!');
      setShowGroupPresetModal(null);
      await fetchPrices();
    } catch (error) {
      console.error('Error applying group preset:', error);
      toast.error('Ошибка при применении цены');
    } finally {
      setApplyingPreset(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-4">
            Управление ценами партнеров
          </h2>
          <Select
            value={selectedPartnerId}
            onValueChange={setSelectedPartnerId}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Выберите партнера" />
            </SelectTrigger>
            <SelectContent>
              {partners.map((partner) => (
                <SelectItem key={partner.id} value={partner.id.toString()}>
                  {partner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasChanges && (
          <Button
            onClick={handleSaveAllPrices}
            disabled={loading}
            size="lg"
            className="w-full sm:w-auto"
          >
            {loading ? 'Сохранение...' : 'Сохранить все изменения'}
          </Button>
        )}
      </div>

      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <div className="space-y-4">
          {PRODUCT_TYPES.map((type) => (
            <Card key={type}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">
                  {PRODUCT_TYPE_LABELS[type] || type}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPresetModal(type)}
                  className="ml-auto"
                >
                  📋 Пресет для всех партнеров
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {Array.isArray(groups) &&
                    groups
                      .filter((g) => g.type === type)
                      .map((group) => (
                        <div key={`${type}-${group.id}`} className="space-y-2">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-sm font-medium truncate">
                              {(group.translations as any)?.ru || group.slug}
                            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setShowGroupPresetModal({
                                  type,
                                  groupId: group.id,
                                  groupName:
                                    (group.translations as any)?.ru ||
                                    group.slug,
                                })
                              }
                              className="h-6 px-2 text-xs shrink-0"
                              title="Применить цену ко всем партнерам"
                            >
                              📋
                            </Button>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={getPrice(type, group.id)}
                            onChange={(e) =>
                              handlePriceChange(type, group.id, e.target.value)
                            }
                            placeholder="0.00"
                          />
                        </div>
                      ))}
                  {/* Цена для товаров без группы */}
                  <div key={`${type}-null`} className="space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <label className="text-sm font-medium">Без группы</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowGroupPresetModal({
                            type,
                            groupId: null,
                            groupName: 'Без группы',
                          })
                        }
                        className="h-6 px-2 text-xs shrink-0"
                        title="Применить цену ко всем партнерам"
                      >
                        📋
                      </Button>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={getPrice(type, null)}
                      onChange={(e) =>
                        handlePriceChange(type, null, e.target.value)
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Модальное окно для настройки пресета */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                Настройка пресета для типа:{' '}
                {PRODUCT_TYPE_LABELS[showPresetModal]}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Задайте цены, которые будут применены ко всем партнерам для
                этого типа товара
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.isArray(groups) &&
                  groups
                    .filter((g) => g.type === showPresetModal)
                    .map((group) => (
                      <div
                        key={`preset-${showPresetModal}-${group.id}`}
                        className="space-y-2"
                      >
                        <label className="text-sm font-medium">
                          {(group.translations as any)?.ru || group.slug}
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={getPresetPrice(showPresetModal, group.id)}
                          onChange={(e) =>
                            handlePresetPriceChange(
                              showPresetModal,
                              group.id,
                              e.target.value,
                            )
                          }
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                {/* Цена для товаров без группы */}
                <div
                  key={`preset-${showPresetModal}-null`}
                  className="space-y-2"
                >
                  <label className="text-sm font-medium">Без группы</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={getPresetPrice(showPresetModal, null)}
                    onChange={(e) =>
                      handlePresetPriceChange(
                        showPresetModal,
                        null,
                        e.target.value,
                      )
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPresetModal(null);
                    setPresetPrices({});
                  }}
                  disabled={applyingPreset}
                >
                  Отмена
                </Button>
                <Button
                  onClick={() => handleApplyPresetToAll(showPresetModal)}
                  disabled={applyingPreset}
                >
                  {applyingPreset
                    ? 'Применение...'
                    : 'Применить ко всем партнерам'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Модальное окно для применения цены конкретной группы ко всем */}
      {showGroupPresetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Применить цену для всех партнеров</CardTitle>
              <p className="text-sm text-muted-foreground">
                Группа: {showGroupPresetModal.groupName} ({' '}
                {PRODUCT_TYPE_LABELS[showGroupPresetModal.type] ||
                  showGroupPresetModal.type}
                )
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Цена (лей)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={
                    getPrice(
                      showGroupPresetModal.type,
                      showGroupPresetModal.groupId,
                    ) || ''
                  }
                  onChange={(e) =>
                    handlePriceChange(
                      showGroupPresetModal.type,
                      showGroupPresetModal.groupId,
                      e.target.value,
                    )
                  }
                  placeholder="Введите цену"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Эта цена будет применена ко всем {partners.length - 1}{' '}
                  партнерам
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowGroupPresetModal(null)}
                  disabled={applyingPreset}
                >
                  Отмена
                </Button>
                <Button
                  onClick={() => {
                    const priceValue = getPrice(
                      showGroupPresetModal.type,
                      showGroupPresetModal.groupId,
                    );
                    if (priceValue && priceValue !== '') {
                      handleApplyGroupPresetToAll(
                        showGroupPresetModal.type,
                        showGroupPresetModal.groupId,
                        parseFloat(priceValue.toString()),
                      );
                    } else {
                      toast.error('Пожалуйста, введите цену');
                    }
                  }}
                  disabled={applyingPreset}
                >
                  {applyingPreset ? 'Применение...' : 'Применить ко всем'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
