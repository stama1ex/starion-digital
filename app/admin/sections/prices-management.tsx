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
import { ProductType } from '@prisma/client';

const PRODUCT_TYPES: ProductType[] = [
  'MAGNET',
  'PLATE',
  'POSTCARD',
  'STATUE',
  'BALL',
];

interface Material {
  id: number;
  name: string;
  label: string;
}

interface Price {
  id: number;
  type: ProductType;
  materialId: number;
  price: number;
}

export default function PricesManagement() {
  const [partners, setPartners] = useState<any[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState<
    Record<string, number | string>
  >({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPartners();
    fetchMaterials();
  }, []);

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/admin/partners');
      const data = await res.json();
      // Фильтруем партнеров - исключаем ADMIN
      const filtered = data.filter((p: any) => p.name !== 'ADMIN');
      setPartners(filtered);
      if (filtered.length > 0) {
        setSelectedPartnerId(filtered[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await fetch('/api/admin/materials');
      const data = await res.json();
      setMaterials(data);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  useEffect(() => {
    if (selectedPartnerId) {
      fetchPrices();
    }
  }, [selectedPartnerId]);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/prices?partnerId=${selectedPartnerId}`
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
  };

  const handlePriceChange = (
    type: ProductType,
    materialId: number,
    value: string
  ) => {
    const key = `${type}-${materialId}`;
    setEditingPrices({ ...editingPrices, [key]: value });
    setHasChanges(true);
  };

  const handleSaveAllPrices = async () => {
    try {
      setLoading(true);
      const promises = Object.entries(editingPrices).map(([key, value]) => {
        const [type, materialId] = key.split('-');
        return fetch('/api/admin/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId: parseInt(selectedPartnerId),
            type: type as ProductType,
            materialId: parseInt(materialId),
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

  const getPrice = (type: ProductType, materialId: number) => {
    const key = `${type}-${materialId}`;
    const editingValue = editingPrices[key];
    if (editingValue !== undefined) return editingValue;

    const price = prices.find(
      (p) => p.type === type && p.materialId === materialId
    );
    return price?.price ?? '';
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
              <CardHeader>
                <CardTitle className="text-lg">
                  {type === 'MAGNET'
                    ? 'Магниты'
                    : type === 'PLATE'
                    ? 'Тарелки'
                    : type}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {materials.map((material) => (
                    <div key={`${type}-${material.id}`} className="space-y-2">
                      <label className="text-sm font-medium">
                        {material.label}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={getPrice(type, material.id)}
                        onChange={(e) =>
                          handlePriceChange(type, material.id, e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
