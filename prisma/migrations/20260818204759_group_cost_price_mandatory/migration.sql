-- Себестоимость переезжает с товара на группу товаров (все товары одной
-- группы стоят в производстве одинаково), группа становится обязательной
-- для цен. Хэндроллед-миграция (не автосгенерирована), т.к. требует
-- переноса реальных данных перед удалением/ужесточением колонок.

-- 1) Добавляем costPrice на ProductGroup (пока 0 у всех - заполним ниже)
ALTER TABLE "ProductGroup" ADD COLUMN "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 2) Переносим себестоимость с товаров на их группы. Значения сверены
-- вручную по факту на 2026-08-18: внутри каждой группы у всех товаров
-- была одна и та же costPrice, кроме группы id=2 (Магниты/Деревянные),
-- где 22 из 24 товаров стоили 6 и 2 - явно ошибочно 1 (D23, D25) -
-- берём преобладающее значение 6.
UPDATE "ProductGroup" SET "costPrice" = 8    WHERE id = 1;  -- Магниты/Мраморные
UPDATE "ProductGroup" SET "costPrice" = 6    WHERE id = 2;  -- Магниты/Деревянные
UPDATE "ProductGroup" SET "costPrice" = 40   WHERE id = 3;  -- Тарелки/Мраморные
UPDATE "ProductGroup" SET "costPrice" = 46   WHERE id = 4;  -- Тарелки/Деревянные
UPDATE "ProductGroup" SET "costPrice" = 18.5 WHERE id = 5;  -- Магниты/Металлические
UPDATE "ProductGroup" SET "costPrice" = 2    WHERE id = 10; -- Открытки/Кишинёв AR
UPDATE "ProductGroup" SET "costPrice" = 8.5  WHERE id = 13; -- Брелоки/Дерево
-- Любые другие/будущие группы (на свежей БД их ещё нет) остаются с costPrice=0
-- по умолчанию и требуют ручного заполнения через админку.

-- 3) Убираем costPrice с товара - источник истины теперь группа
ALTER TABLE "Product" DROP COLUMN "costPrice";

-- 4) Цены "без группы" на реальных данных - не более чем неиспользуемый
-- пережиток (все товары этих типов уже принадлежат группам, кроме одного
-- незагруппированного, который теперь скрыт из каталога и не заказывается)
DELETE FROM "Price" WHERE "groupId" IS NULL;
ALTER TABLE "Price" ALTER COLUMN "groupId" SET NOT NULL;

DELETE FROM "DefaultPrice" WHERE "groupId" IS NULL;
ALTER TABLE "DefaultPrice" ALTER COLUMN "groupId" SET NOT NULL;
