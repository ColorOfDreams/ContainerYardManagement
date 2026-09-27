import { NotFoundException } from '@nestjs/common';

type PrismaDelegate = {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  count(args?: unknown): Promise<number>;
};

export interface PageRequest<TWhere = object, TOrderBy = object> {
  page?: number;
  pageSize?: number;
  where?: TWhere;
  orderBy?: TOrderBy;
}

// Shared read-only CRUD primitives. Stateful writes stay in domain services.
export abstract class BaseService<T extends PrismaDelegate> {
  protected constructor(protected readonly delegate: T) {}

  protected async page(request: PageRequest = {}) {
    const page = Math.max(1, request.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, request.pageSize ?? 20));
    const [data, total] = await Promise.all([
      this.delegate.findMany({ where: request.where, orderBy: request.orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.delegate.count({ where: request.where }),
    ]);
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  protected async requireOne(where: object, label: string) {
    const record = await this.delegate.findUnique({ where });
    if (!record) throw new NotFoundException(`${label} không tồn tại`);
    return record;
  }
}
