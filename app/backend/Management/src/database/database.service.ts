// Service là lớp kết nối giữa database service và management service

// Injectable để NestJS biết class này tiêm (inject) được vào chỗ khác
//  OnModuleDestroy là 1 "interface vòng đời" — khai báo để NestJS gọi đúng lúc app tắt.
import { Injectable,  OnModuleDestroy } from '@nestjs/common'; 


import { Pool, QueryResult, PoolClient } from 'pg';


@Injectable()
export class DatabaseService implements OnModuleDestroy {
    // tạo connection tới database = pool với việc kêt nối = .env trong docker compose
    private readonly pool: Pool;

    constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  // Khi app tắt thì tất nhiên phải đóng connection
    async onModuleDestroy() {
    await this.pool.end();
  }

  // query<T> là hàm query SQL chung, nhận vào text (câu lệnh SQL) và params (tham số)
    query<T extends import('pg').QueryResultRow = any>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  // mượng 1 connection
    async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
        // Bắt đầu thực hiện
      await client.query('BEGIN');
      // chạy hàm nghiệp vụ trong client nhiều lần
      const result = await fn(client);
      // Không có lỗi thì commit
      await client.query('COMMIT');
      return result;
    }
    // Có lỗi thì roolback 
    catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
