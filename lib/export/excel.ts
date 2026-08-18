/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from 'exceljs';
import { naturalCompare } from '@/lib/naturalSort';

export async function createOrderExcel(order: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Заказ');

  const typeLabels: Record<string, string> = {
    MAGNET: 'Магниты',
    PLATE: 'Тарелки',
    POSTCARD: 'Открытки',
    KEYCHAIN: 'Брелоки',
  };

  // Заголовок
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Заказ №${order.id} - ${order.partner.name}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Дата
  sheet.mergeCells('A2:D2');
  const dateCell = sheet.getCell('A2');
  const date = new Date(order.createdAt);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  dateCell.value = order.hasVat
    ? `Дата: ${day}.${month}.${year} (с НДС 20%)`
    : `Дата: ${day}.${month}.${year}`;
  dateCell.alignment = { horizontal: 'center' };
  sheet.getRow(2).height = 20;

  // Контакты партнёра (если указаны)
  const contactPhone = order.partner.phone;
  const contactAddress = order.address || order.partner.address;

  if (contactPhone) {
    const phoneRow = sheet.addRow([`Телефон: ${contactPhone}`]);
    sheet.mergeCells(`A${phoneRow.number}:D${phoneRow.number}`);
    phoneRow.getCell(1).alignment = { horizontal: 'center' };
  }

  if (contactAddress) {
    const addressRow = sheet.addRow([`Адрес: ${contactAddress}`]);
    sheet.mergeCells(`A${addressRow.number}:D${addressRow.number}`);
    addressRow.getCell(1).alignment = { horizontal: 'center' };
  }

  // Пустая строка
  sheet.addRow([]);

  // Заголовки таблицы
  const headerRow = sheet.addRow([
    'Наименование',
    'Кол-во',
    'Цена/шт (MDL)',
    'Сумма (MDL)',
  ]);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Ширина колонок
  sheet.columns = [{ width: 15 }, { width: 12 }, { width: 18 }, { width: 18 }];

  const moneyFormat = '#,##0.00';

  // Группируем товары по типу
  const itemsByType: Record<string, any[]> = {};
  order.items.forEach((item: any) => {
    const type = typeLabels[item.product.type] || item.product.type;
    if (!itemsByType[type]) {
      itemsByType[type] = [];
    }
    itemsByType[type].push(item);
  });

  // Название группы/материала товара (как в развёртке заказа в админке)
  const getGroupName = (item: any): string | null => {
    if (!item.product.groupId) return null;
    const translations = item.product.group?.translations as
      | { ru?: string }
      | null
      | undefined;
    return translations?.ru || item.product.group?.slug || null;
  };

  Object.entries(itemsByType).forEach(([type, items]) => {
    // Заголовок типа
    const typeHeaderRow = sheet.addRow([type]);
    sheet.mergeCells(`A${typeHeaderRow.number}:D${typeHeaderRow.number}`);
    typeHeaderRow.font = { bold: true, size: 12 };
    typeHeaderRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8E8E8' },
    };
    typeHeaderRow.getCell(1).alignment = { horizontal: 'left' };

    // Группируем товары этого типа по группе/материалу
    const byGroup = new Map<string, { name: string | null; items: any[] }>();
    items.forEach((item: any) => {
      const key = String(item.product.groupId ?? 'none');
      if (!byGroup.has(key)) {
        byGroup.set(key, { name: getGroupName(item), items: [] });
      }
      byGroup.get(key)!.items.push(item);
    });

    const sortedGroups = Array.from(byGroup.values()).sort((a, b) => {
      if (a.name === null) return 1;
      if (b.name === null) return -1;
      return a.name.localeCompare(b.name, 'ru');
    });

    // Разбивку по группам показываем только если групп больше одной —
    // иначе она дублирует итог по типу
    const showGroupBreakdown = sortedGroups.length > 1;

    let typeQty = 0;
    let typeSum = 0;

    sortedGroups.forEach((group) => {
      group.items.sort((a, b) =>
        naturalCompare(a.product.number, b.product.number),
      );

      if (showGroupBreakdown) {
        const groupHeaderRow = sheet.addRow([
          group.name ? `  ${group.name}` : '  Без группы',
        ]);
        sheet.mergeCells(`A${groupHeaderRow.number}:D${groupHeaderRow.number}`);
        groupHeaderRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
        groupHeaderRow.getCell(1).alignment = { horizontal: 'left', indent: 1 };
      }

      let groupQty = 0;
      let groupSum = 0;

      // Товары этой группы (сумма и цена - с учётом НДС, если он включён у
      // заказа, чтобы итоги по группам/типам и общий итог совпадали с
      // order.totalPrice)
      group.items.forEach((item: any) => {
        const qty = item.quantity;
        const sum = Number(item.sum) + Number(item.vatAmount ?? 0);
        const price = qty > 0 ? sum / qty : Number(item.pricePerItem);

        typeQty += qty;
        typeSum += sum;
        groupQty += qty;
        groupSum += sum;

        const row = sheet.addRow([item.product.number, qty, price, sum]);

        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });

        row.getCell(1).alignment = { horizontal: 'left' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'right' };
        row.getCell(4).alignment = { horizontal: 'right' };
        row.getCell(3).numFmt = moneyFormat;
        row.getCell(4).numFmt = moneyFormat;
      });

      if (showGroupBreakdown) {
        const groupLabel = group.name
          ? `Итого (${group.name}):`
          : 'Итого (без группы):';
        const groupSubtotalRow = sheet.addRow([
          groupLabel,
          groupQty,
          '',
          groupSum,
        ]);
        groupSubtotalRow.font = { italic: true, size: 10 };
        groupSubtotalRow.getCell(1).alignment = { horizontal: 'left' };
        groupSubtotalRow.getCell(2).alignment = { horizontal: 'center' };
        groupSubtotalRow.getCell(4).alignment = { horizontal: 'right' };
        groupSubtotalRow.getCell(4).numFmt = moneyFormat;
        groupSubtotalRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' },
          };
        });
      }
    });

    // Промежуточный итог по типу
    const subtotalRow = sheet.addRow(['', typeQty, 'Итого:', typeSum]);
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(2).alignment = { horizontal: 'center' };
    subtotalRow.getCell(3).alignment = { horizontal: 'right' };
    subtotalRow.getCell(4).alignment = { horizontal: 'right' };
    subtotalRow.getCell(4).numFmt = moneyFormat;
    subtotalRow.getCell(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };

    // Пустая строка после каждого типа
    sheet.addRow([]);
  });

  // Общий итог
  const totalRow = sheet.addRow(['', '', 'ВСЕГО:', Number(order.totalPrice)]);
  totalRow.font = { bold: true, size: 14 };
  totalRow.getCell(3).alignment = { horizontal: 'right' };
  totalRow.getCell(4).alignment = { horizontal: 'right' };
  totalRow.getCell(4).numFmt = moneyFormat;
  totalRow.getCell(4).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB3B' },
  };

  if (order.hasVat) {
    const vatRow = sheet.addRow([
      '',
      '',
      'в т.ч. НДС 20%:',
      Number(order.vatAmount),
    ]);
    vatRow.font = { italic: true };
    vatRow.getCell(3).alignment = { horizontal: 'right' };
    vatRow.getCell(4).alignment = { horizontal: 'right' };
    vatRow.getCell(4).numFmt = moneyFormat;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
