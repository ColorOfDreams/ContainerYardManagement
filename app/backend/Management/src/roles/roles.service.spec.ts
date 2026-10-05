import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { DatabaseService } from '../database/database.service';

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: DatabaseService, useValue: { query: async () => ({ rows: [] }), transaction: async () => undefined } },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
