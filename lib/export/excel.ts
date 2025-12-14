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

  // Товары
  order.items.forEach((item: any) => {
    const row = sheet.addRow([
      item.product.number,
      item.product.country,
      item.quantity,
      Number(item.pricePerItem).toFixed(2),
      Number(item.sum).toFixed(2),
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

  // Пустая строка
  sheet.addRow([]);

  // Итого
  const totalRow = sheet.addRow([
    '',
    '',
    '',
    'Итого:',
    Number(order.totalPrice).toFixed(2),
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
