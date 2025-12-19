/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from 'exceljs';

export async function createOrderExcel(order: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Заказ');

  // Заголовок
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Заказ №${order.id} - ${order.partner.name}`;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Дата
  sheet.mergeCells('A2:E2');
  const dateCell = sheet.getCell('A2');
  const date = new Date(order.createdAt);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  dateCell.value = `Дата: ${day}.${month}.${year}`;
  dateCell.alignment = { horizontal: 'center' };
  sheet.getRow(2).height = 20;

  // Пустая строка
  sheet.addRow([]);

  // Заголовки таблицы
  const headerRow = sheet.addRow([
    '№',
    'Страна',
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
  sheet.columns = [
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
  ];

  // Группируем товары по типу
  const itemsByType: Record<string, any[]> = {};
  order.items.forEach((item: any) => {
    const type = item.product.type === 'MAGNET' ? 'Магниты' : 'Тарелки';
    if (!itemsByType[type]) {
      itemsByType[type] = [];
    }
    itemsByType[type].push(item);
  });

  // Функция для замены точки на запятую в числах
  const formatNumber = (num: number): string => {
    return num.toFixed(2).replace('.', ',');
  };

  // Выводим товары по типам
  const typeSummaries: { type: string; totalQty: number; totalSum: number }[] =
    [];

  Object.entries(itemsByType).forEach(([type, items]) => {
    // Заголовок типа
    const typeHeaderRow = sheet.addRow([type]);
    sheet.mergeCells(`A${typeHeaderRow.number}:E${typeHeaderRow.number}`);
    typeHeaderRow.font = { bold: true, size: 12 };
    typeHeaderRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8E8E8' },
    };
    typeHeaderRow.getCell(1).alignment = { horizontal: 'left' };

    let typeQty = 0;
    let typeSum = 0;

    // Товары этого типа
    items.forEach((item: any) => {
      const qty = item.quantity;
      const price = Number(item.pricePerItem);
      const sum = Number(item.sum);

      typeQty += qty;
      typeSum += sum;

      const row = sheet.addRow([
        item.product.number,
        item.product.country,
        qty,
        formatNumber(price),
        formatNumber(sum),
      ]);

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
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'right' };
      row.getCell(5).alignment = { horizontal: 'right' };
    });

    // Промежуточный итог по типу
    const subtotalRow = sheet.addRow([
      '',
      '',
      typeQty,
      'Итого:',
      formatNumber(typeSum),
    ]);
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(3).alignment = { horizontal: 'center' };
    subtotalRow.getCell(4).alignment = { horizontal: 'right' };
    subtotalRow.getCell(5).alignment = { horizontal: 'right' };
    subtotalRow.getCell(5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };

    typeSummaries.push({ type, totalQty: typeQty, totalSum: typeSum });

    // Пустая строка после каждого типа
    sheet.addRow([]);
  });

  // Общий итог
  const totalRow = sheet.addRow([
    '',
    '',
    '',
    'ВСЕГО:',
    formatNumber(Number(order.totalPrice)),
  ]);
  totalRow.font = { bold: true, size: 14 };
  totalRow.getCell(4).alignment = { horizontal: 'right' };
  totalRow.getCell(5).alignment = { horizontal: 'right' };
  totalRow.getCell(5).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB3B' },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
