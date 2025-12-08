/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from 'exceljs';

export async function createOrderExcel(order: any) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Order');

  sheet.columns = [
    { header: '№', key: 'number', width: 10 },
    { header: 'Страна', key: 'country', width: 15 },
    { header: 'Кол-во', key: 'qty', width: 10 },
    { header: 'Цена/шт', key: 'price', width: 12 },
    { header: 'Сумма', key: 'sum', width: 12 },
  ];

  order.items.forEach((it: any) =>
    sheet.addRow({
      number: it.product.number,
      country: it.product.country,
      qty: it.quantity,
      price: it.pricePerItem,
      sum: it.sum,
    })
  );

  sheet.addRow({});
  sheet.addRow({ sum: `Итого: ${order.totalPrice} MDL` });

  // Возвращаем буфер (НЕ файл)
  return await workbook.xlsx.writeBuffer();
}
