-- Белая метка: во вьюере не остаётся упоминаний Starion (подпись, ссылка на
-- каталог, заголовок вкладки, иконка). Для сувениров под чужим брендом.
ALTER TABLE "ARExperience" ADD COLUMN     "whiteLabel" BOOLEAN NOT NULL DEFAULT false;

-- Короткая ссылка /a/{code} убрана из приложения: она прятала slug, а домен в
-- QR светился всё равно. Колонка больше нигде не читается — снимаем расхождение
-- между схемой и базой. Значения были случайными кодами, ни один не напечатан.
DROP INDEX IF EXISTS "ARExperience_shortCode_key";
ALTER TABLE "ARExperience" DROP COLUMN IF EXISTS "shortCode";
