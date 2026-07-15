/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown, Search } from 'lucide-react';
import { ProductType } from '@prisma/client';

const PRODUCT_TYPES: ProductType[] = [
  'MAGNET',
  'PLATE',
  'POSTCARD',
  'KEYCHAIN',
  // 'STATUE',
  // 'BALL',
];

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  MAGNET: 'Магниты',
  PLATE: 'Тарелки',
  POSTCARD: 'Открытки',
  KEYCHAIN: 'Брелоки',
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
  const [partnerQuery, setPartnerQuery] = useState('');
  const [isPartnerComboboxOpen, setIsPartnerComboboxOpen] = useState(false);
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
  const [isDefaultPricesModalOpen, setIsDefaultPricesModalOpen] =
    useState(false);
  const [defaultPrices, setDefaultPrices] = useState<
    Record<string, number | string>
  >({});
  const [loadingDefaultPrices, setLoadingDefaultPrices] = useState(false);
  const [savingDefaultPrices, setSavingDefaultPrices] = useState(false);
  const partnerComboboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchPartners();
    fetchGroups();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        partnerComboboxRef.current &&
        !partnerComboboxRef.current.contains(event.target as Node)
      ) {
        setIsPartnerComboboxOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/admin/partners');
      const data = await res.json();
      // Фильтруем партнеров - исключаем ADMIN
      const filtered = data.filter((p: any) => p.role !== 'ADMIN');
      setPartners(filtered);
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

  useEffect(() => {
    const selectedPartner = partners.find(
      (partner) => partner.id.toString() === selectedPartnerId,
    );

    if (selectedPartner) {
      setPartnerQuery(selectedPartner.name);
    }
  }, [partners, selectedPartnerId]);

  const filteredPartners = useMemo(() => {
    const query = partnerQuery.trim().toLowerCase();

    if (!query) {
      return partners;
    }

    return partners.filter((partner) =>
      partner.name.toLowerCase().includes(query),
    );
  }, [partners, partnerQuery]);

  const selectedPartnerName =
    partners.find((partner) => partner.id.toString() === selectedPartnerId)
      ?.name || 'Выберите партнера';

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
    if (!selectedPartnerId) {
      toast.error('Выберите партнера');
      return;
    }
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

  const fetchDefaultPrices = async () => {
    try {
      setLoadingDefaultPrices(true);
      const res = await fetch('/api/admin/default-prices');
      const data: Price[] = await res.json();
      const mapped: Record<string, number | string> = {};
      data.forEach((dp) => {
        mapped[`${dp.type}-${dp.groupId}`] = dp.price;
      });
      setDefaultPrices(mapped);
    } catch (error) {
      console.error('Error fetching default prices:', error);
      toast.error('Не удалось загрузить цены по умолчанию');
    } finally {
      setLoadingDefaultPrices(false);
    }
  };

  const handleOpenDefaultPricesModal = () => {
    setIsDefaultPricesModalOpen(true);
    fetchDefaultPrices();
  };

  const handleDefaultPriceChange = (
    type: ProductType,
    groupId: number | null,
    value: string,
  ) => {
    const key = `${type}-${groupId}`;
    setDefaultPrices({ ...defaultPrices, [key]: value });
  };

  const getDefaultPrice = (type: ProductType, groupId: number | null) => {
    const key = `${type}-${groupId}`;
    return defaultPrices[key] ?? '';
  };

  const handleSaveDefaultPrices = async () => {
    try {
      setSavingDefaultPrices(true);
      const promises = Object.entries(defaultPrices)
        .filter(([, value]) => value !== '' && value !== undefined)
        .map(([key, value]) => {
          const [type, groupIdStr] = key.split('-');
          const groupId = groupIdStr === 'null' ? null : parseInt(groupIdStr);
          return fetch('/api/admin/default-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: type as ProductType,
              groupId,
              price: parseFloat(value.toString()),
            }),
          });
        });

      await Promise.all(promises);
      toast.success('Цены по умолчанию сохранены');
      setIsDefaultPricesModalOpen(false);
    } catch (error) {
      console.error('Error saving default prices:', error);
      toast.error('Ошибка при сохранении цен по умолчанию');
    } finally {
      setSavingDefaultPrices(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-4">
            Управление ценами партнеров
          </h2>
          <div ref={partnerComboboxRef} className="relative w-full sm:w-80">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between gap-2"
              onClick={() => {
                setIsPartnerComboboxOpen((open) => !open);
                setPartnerQuery(selectedPartnerId ? selectedPartnerName : '');
              }}
            >
              <span className="truncate text-left">{selectedPartnerName}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>

            {isPartnerComboboxOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-md border bg-popover p-2 shadow-md">
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    value={partnerQuery}
                    onChange={(e) => setPartnerQuery(e.target.value)}
                    placeholder="Поиск партнера..."
                    className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
                    autoFocus
                  />
                </div>

                <div className="mt-2 max-h-72 overflow-y-auto">
                  {filteredPartners.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      Партнер не найден
                    </div>
                  ) : (
                    filteredPartners.map((partner) => {
                      const isSelected =
                        partner.id.toString() === selectedPartnerId;

                      return (
                        <button
                          key={partner.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setSelectedPartnerId(partner.id.toString());
                            setPartnerQuery(partner.name);
                            setIsPartnerComboboxOpen(false);
                          }}
                        >
                          <span className="truncate">{partner.name}</span>
                          {isSelected && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleOpenDefaultPricesModal}
            className="w-full sm:w-auto"
          >
            ⚙️ Цены по умолчанию для новых партнёров
          </Button>
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
                            disabled={!selectedPartnerId}
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
                      disabled={!selectedPartnerId}
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

      {/* Модальное окно цен по умолчанию для новых партнёров */}
      {isDefaultPricesModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[85vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Цены по умолчанию для новых партнёров</CardTitle>
              <p className="text-sm text-muted-foreground">
                Эти цены будут автоматически проставлены новому партнёру при
                его создании (в том числе при одобрении заявки на
                партнёрство), чтобы он сразу мог оформлять заказы.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingDefaultPrices ? (
                <div>Загрузка...</div>
              ) : (
                <div className="space-y-4">
                  {PRODUCT_TYPES.map((type) => (
                    <Card key={type}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {PRODUCT_TYPE_LABELS[type] || type}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Array.isArray(groups) &&
                            groups
                              .filter((g) => g.type === type)
                              .map((group) => (
                                <div
                                  key={`default-${type}-${group.id}`}
                                  className="space-y-2"
                                >
                                  <label className="text-sm font-medium truncate block">
                                    {(group.translations as any)?.ru ||
                                      group.slug}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={getDefaultPrice(type, group.id)}
                                    onChange={(e) =>
                                      handleDefaultPriceChange(
                                        type,
                                        group.id,
                                        e.target.value,
                                      )
                                    }
                                    placeholder="0.00"
                                  />
                                </div>
                              ))}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Без группы
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              value={getDefaultPrice(type, null)}
                              onChange={(e) =>
                                handleDefaultPriceChange(
                                  type,
                                  null,
                                  e.target.value,
                                )
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

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsDefaultPricesModalOpen(false)}
                  disabled={savingDefaultPrices}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleSaveDefaultPrices}
                  disabled={savingDefaultPrices || loadingDefaultPrices}
                >
                  {savingDefaultPrices ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
