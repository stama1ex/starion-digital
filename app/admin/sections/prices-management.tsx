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
import { ProductType, Material } from '@prisma/client';

const PRODUCT_TYPES: ProductType[] = [
  'MAGNET',
  'PLATE',
  'POSTCARD',
  'STATUE',
  'BALL',
];
const MATERIALS: Material[] = ['MARBLE', 'WOOD', 'ACRYLIC'];

interface Price {
  id: number;
  type: ProductType;
  material: Material;
  price: number;
}

export default function PricesManagement() {
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPrices, setEditingPrices] = useState<
    Record<string, number | string>
  >({});

  useEffect(() => {
    fetchPartners();
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
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (
    type: ProductType,
    material: Material,
    value: string
  ) => {
    const key = `${type}-${material}`;
    setEditingPrices({ ...editingPrices, [key]: value });
  };

  const handleSavePrice = async (
    type: ProductType,
    material: Material,
    value: string
  ) => {
    try {
      await fetch('/api/admin/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: parseInt(selectedPartnerId),
          type,
          material,
          price: parseFloat(value),
        }),
      });
      await fetchPrices();
    } catch (error) {
      console.error('Error saving price:', error);
    }
  };

  const getPrice = (type: ProductType, material: Material) => {
    const key = `${type}-${material}`;
    const editingValue = editingPrices[key];
    if (editingValue !== undefined) return editingValue;

    const price = prices.find(
      (p) => p.type === type && p.material === material
    );
    return price?.price ?? '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Управление ценами партнеров</h2>
        <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
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
                  {MATERIALS.map((material) => (
                    <div key={`${type}-${material}`} className="space-y-2">
                      <label className="text-sm font-medium">
                        {material === 'MARBLE'
                          ? 'Мрамор'
                          : material === 'WOOD'
                          ? 'Дерево'
                          : material}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={getPrice(type, material)}
                          onChange={(e) =>
                            handlePriceChange(type, material, e.target.value)
                          }
                          placeholder="0.00"
                        />
                        <Button
                          onClick={() =>
                            handleSavePrice(
                              type,
                              material,
                              getPrice(type, material).toString()
                            )
                          }
                          size="sm"
                        >
                          Сохранить
                        </Button>
                      </div>
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
