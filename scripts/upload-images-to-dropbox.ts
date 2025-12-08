import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { uploadImage } from '@/lib/dropbox';

async function uploadImagesToDropbox() {
  try {
    console.log('🚀 Starting image upload to Dropbox...');

    // Получаем все продукты
    const products = await prisma.product.findMany();
    console.log(`📦 Found ${products.length} products to process`);

    let uploadedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      const imagePath = product.image;

      // Если это уже URL (содержит http или /)
      if (imagePath.startsWith('http')) {
        console.log(`⏭️  Skipping ${product.number} - already a URL`);
        skippedCount++;
        continue;
      }

      // Строим полный путь к файлу
      const fullPath = path.join(process.cwd(), 'public', imagePath);

      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️  File not found: ${fullPath}`);
        skippedCount++;
        continue;
      }

      try {
        // Читаем файл
        const fileBuffer = fs.readFileSync(fullPath);
        const arrayBuffer = fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        );

        // Генерируем имя файла
        const filename = `${product.type.toLowerCase()}_${
          product.number
        }_${Date.now()}.avif`;

        // Загружаем в Dropbox и получаем временный URL
        console.log(`📤 Uploading ${product.number}...`);
        const { url } = await uploadImage(arrayBuffer, filename);

        // Обновляем базу данных
        await prisma.product.update({
          where: { id: product.id },
          data: { image: url },
        });

        console.log(`✅ ${product.number} uploaded: ${url}`);
        uploadedCount++;

        // Задержка для избежания rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error uploading ${product.number}:`, error);
        skippedCount++;
      }
    }

    console.log(`\n✨ Upload complete!`);
    console.log(`  ✅ Uploaded: ${uploadedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

uploadImagesToDropbox();
