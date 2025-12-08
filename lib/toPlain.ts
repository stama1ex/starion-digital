import { Decimal } from '@prisma/client/runtime/library';

export function toPlain<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      value instanceof Decimal ? Number(value) : value
    )
  );
}
