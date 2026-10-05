// db/seed-fake.js — sinh dữ liệu giả trải đủ mọi bảng trong schema
// "management" để có sẵn dữ liệu test/demo, không cần tạo tay qua từng API.
//
// Chạy: docker compose exec management-service node db/seed-fake.js
// An toàn chạy lại nhiều lần: mỗi lần chạy dùng UUID/mã mới, không xóa dữ
// liệu cũ — muốn làm sạch trước thì tự truncate bảng rồi chạy lại.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---- helpers ----
const uuid = () => crypto.randomUUID();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, digits = 2) => Number((Math.random() * (max - min) + min).toFixed(digits));
const daysFromNow = (days) => new Date(Date.now() + days * 86400000);
function pickWeighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

// INSERT nhiều dòng 1 lần — pg không có "createMany" sẵn như Prisma, phải tự
// dựng câu VALUES (r1c1,r1c2),(r2c1,r2c2),... rồi truyền params tương ứng.
async function bulkInsert(client, table, columns, rows) {
  if (rows.length === 0) return;
  const colList = columns.join(', ');
  const valueGroups = [];
  const params = [];
  rows.forEach((row, i) => {
    const placeholders = columns.map((_, j) => `$${i * columns.length + j + 1}`);
    valueGroups.push(`(${placeholders.join(', ')})`);
    columns.forEach((col) => params.push(row[col] ?? null));
  });
  await client.query(`INSERT INTO management.${table} (${colList}) VALUES ${valueGroups.join(', ')}`, params);
}

// ---- counts (đủ ~1000-2000 dòng cộng dồn các bảng) ----
const N_WAREHOUSES = 5;
const N_VEHICLES = 10;
const N_CONTRACTS = 30;
const N_CONTAINERS = 150;
const N_SHIPMENTS = 60;
const N_SHIPMENT_CONTAINERS = 150;

// ---- sample pools ----
const SHIPPERS = ['Song Hong Logistics', 'Viet Thinh Trading', 'Dai Duong Export', 'Phu Thai JSC', 'An Binh Corp', 'Minh Long Co.', 'Hoang Gia Import', 'Tan Cang Co.'];
const CARRIERS = ['Maersk Line', 'MSC', 'CMA CGM', 'ONE', 'Evergreen', 'COSCO Shipping', 'Hapag-Lloyd', 'Yang Ming'];
const PORTS = ['Cat Lai', 'Cai Mep', 'Hai Phong', 'Da Nang', 'Singapore', 'Shanghai', 'Busan', 'Hong Kong'];
const SIZE_TYPES = ['20GP', '40GP', '40HC', '20RF', '40RF'];
const CONTAINER_TYPES = ['Dry Van', 'Reefer', 'Open Top', 'Flat Rack', 'Tank'];
const CARGO_TYPES = ['General Cargo', 'Electronics', 'Textiles', 'Machinery', 'Frozen Food', 'Chemicals', 'Furniture', 'Agricultural Products'];
const NAMES = ['Nguyen Van A', 'Tran Thi B', 'Le Van C', 'Pham Thi D', 'Hoang Van E', 'Vu Thi F', 'Dang Van G', 'Bui Thi H'];
const WAREHOUSE_NAMES = ['Kho Cat Lai', 'Kho Cai Mep', 'Kho Hai Phong', 'Kho Da Nang', 'Kho Long Binh'];

// DTO/code cũ dùng tên enum kiểu Prisma (liền, không dấu) — DB lưu đúng theo
// SRS (có khoảng trắng/gạch ngang), map tay ở đây vì không còn Prisma @map.
const INSPECTION_TYPE_DB = { GateIn: 'Gate-in', GateOut: 'Gate-out', AdHoc: 'Ad-hoc' };
const MOVEMENT_TYPE_DB = { GateIn: 'Gate-in', Relocation: 'Relocation', Rehandle: 'Rehandle', GateOut: 'Gate-out' };
const EVENT_TYPE_DB = {
  CustomsHold: 'Customs Hold',
  Rejected: 'Rejected',
  Dispute: 'Dispute',
  DamageDuringMovement: 'Damage During Movement',
  OwnerRequest: 'Owner Request',
};
const INVOICE_TYPE_DB = { Deposit: 'Deposit', StorageFee: 'Storage Fee', FinalSettlement: 'Final Settlement', Other: 'Other' };
const PAYMENT_METHOD_DB = { BankTransfer: 'Bank Transfer', Cash: 'Cash', Card: 'Card' };
const SHIPMENT_STATUS_DB = { Planned: 'Planned', InTransit: 'In Transit', Arrived: 'Arrived', Completed: 'Completed' };

async function main() {
  const client = await pool.connect();
  try {
    console.log('== 1. Roles & Permissions ==');
    const permissionDefs = [
      'contract:create', 'contract:read', 'contract:update', 'contract:activate', 'contract:terminate',
      'user:create', 'user:read', 'user:update', 'user:delete',
      'role:create', 'role:read', 'role:update', 'role:delete',
      'permission:create', 'permission:read', 'permission:update', 'permission:delete',
    ];
    const permissionIds = {};
    for (const code of permissionDefs) {
      const result = await client.query(
        `INSERT INTO management.permission (code, name) VALUES ($1, $1)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING permission_id`,
        [code],
      );
      permissionIds[code] = result.rows[0].permission_id;
    }

    const roleDefs = {
      ADMIN: permissionDefs,
      DISPATCHER: ['contract:read', 'contract:create'],
      OPERATOR: ['contract:read'],
      INSPECTOR: ['contract:read'],
      ACCOUNTANT: ['contract:read'],
      VIEWER: ['contract:read'],
    };
    const roleIds = {};
    for (const [code, permCodes] of Object.entries(roleDefs)) {
      const result = await client.query(
        `INSERT INTO management.role (code, name, is_system) VALUES ($1, $1, $2)
         ON CONFLICT (code) DO NOTHING RETURNING role_id`,
        [code, code === 'ADMIN'],
      );
      const roleId = result.rows[0]
        ? result.rows[0].role_id
        : (await client.query(`SELECT role_id FROM management.role WHERE code = $1`, [code])).rows[0].role_id;
      roleIds[code] = roleId;
      for (const permCode of permCodes) {
        await client.query(
          `INSERT INTO management.role_permission (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleId, permissionIds[permCode]],
        );
      }
    }

    console.log('== 2. Users (6 tài khoản demo, mật khẩu chung: Passw0rd1) ==');
    const userDefs = [
      ['admin2@example.local', 'Demo Admin', 'ADMIN'],
      ['dispatcher@example.local', 'Demo Dispatcher', 'DISPATCHER'],
      ['operator@example.local', 'Demo Operator', 'OPERATOR'],
      ['inspector@example.local', 'Demo Inspector', 'INSPECTOR'],
      ['accountant@example.local', 'Demo Accountant', 'ACCOUNTANT'],
      ['viewer@example.local', 'Demo Viewer', 'VIEWER'],
    ];
    const passwordHash = await bcrypt.hash('Passw0rd1', 12);
    const users = [];
    for (const [email, displayName, roleCode] of userDefs) {
      const result = await client.query(
        `INSERT INTO management.user (email, password_hash, display_name) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING RETURNING user_id`,
        [email, passwordHash, displayName],
      );
      const userId = result.rows[0]
        ? result.rows[0].user_id
        : (await client.query(`SELECT user_id FROM management.user WHERE email = $1`, [email])).rows[0].user_id;
      await client.query(
        `INSERT INTO management.user_role (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleIds[roleCode]],
      );
      users.push({ user_id: userId });
    }

    console.log(`== 3. Warehouses x${N_WAREHOUSES} ==`);
    const warehouseRows = WAREHOUSE_NAMES.slice(0, N_WAREHOUSES).map((name) => ({
      warehouse_id: uuid(),
      name,
      address: `${pick(PORTS)}, Vietnam`,
      capacity: randInt(50, 300),
    }));
    await bulkInsert(client, 'warehouse', ['warehouse_id', 'name', 'address', 'capacity'], warehouseRows);

    console.log(`== 4. Vehicles x${N_VEHICLES} ==`);
    const vehicleRows = Array.from({ length: N_VEHICLES }, () => ({
      vehicle_id: uuid(),
      plate_number: `${randInt(10, 99)}C-${randInt(10000, 99999)}`,
      vehicle_type: pick(['Xe đầu kéo', 'Xe tải', 'Xe container']),
      capacity: randFloat(5000, 30000, 0),
      status: pickWeighted([['AVAILABLE', 6], ['IN_USE', 3], ['MAINTENANCE', 1]]),
    }));
    await bulkInsert(client, 'vehicle', ['vehicle_id', 'plate_number', 'vehicle_type', 'capacity', 'status'], vehicleRows);

    console.log(`== 5. Contracts x${N_CONTRACTS} ==`);
    const contractRows = Array.from({ length: N_CONTRACTS }, () => {
      const effectiveDate = daysFromNow(-randInt(30, 400));
      return {
        contract_id: uuid(),
        warehouse_id: pick(warehouseRows).warehouse_id,
        customer_id: uuid(),
        effective_date: effectiveDate,
        expiry_date: daysFromNow(randInt(30, 700)),
        unit_price: randFloat(20, 200),
        free_time_days: randInt(3, 14),
        surcharge_rate: randFloat(0.01, 0.1, 4),
        payment_terms: pick(['Net 15', 'Net 30', 'Net 45', 'COD']),
        status: pickWeighted([['Draft', 2], ['Active', 6], ['Expired', 1], ['Terminated', 1]]),
      };
    });
    await bulkInsert(
      client,
      'contract',
      ['contract_id', 'warehouse_id', 'customer_id', 'effective_date', 'expiry_date', 'unit_price', 'free_time_days', 'surcharge_rate', 'payment_terms', 'status'],
      contractRows,
    );

    console.log(`== 6. Containers x${N_CONTAINERS} ==`);
    const usedCodes = new Set();
    const containerRows = Array.from({ length: N_CONTAINERS }, () => {
      let code;
      do {
        code = `${pick(['MSCU', 'MAEU', 'CMAU', 'ONEU', 'COSU', 'HLXU'])}${randInt(1000000, 9999999)}`;
      } while (usedCodes.has(code));
      usedCodes.add(code);
      const tare = randFloat(1900, 4200, 0);
      return {
        container_id: uuid(),
        container_code: code,
        container_type: pick(CONTAINER_TYPES),
        size_type_code: pick(SIZE_TYPES),
        tare_weight: tare,
        max_gross_weight: tare + randFloat(20000, 28000, 0),
        max_payload: randFloat(18000, 26000, 0),
        capacity: randFloat(25, 76, 1),
        status: pickWeighted([['AVAILABLE', 7], ['MAINTENANCE', 2], ['DAMAGED', 1]]),
      };
    });
    await bulkInsert(
      client,
      'container',
      ['container_id', 'container_code', 'container_type', 'size_type_code', 'tare_weight', 'max_gross_weight', 'max_payload', 'capacity', 'status'],
      containerRows,
    );

    console.log(`== 7. Shipments x${N_SHIPMENTS} ==`);
    const shipmentRows = Array.from({ length: N_SHIPMENTS }, () => ({
      shipment_id: uuid(),
      contract_id: pick(contractRows).contract_id,
      shipper: pick(SHIPPERS),
      consignee: pick(SHIPPERS),
      carrier: pick(CARRIERS),
      origin: pick(PORTS),
      loading_port: pick(PORTS),
      discharge_port: pick(PORTS),
      vessel: `${pick(CARRIERS).split(' ')[0]} ${randInt(1, 999)}`,
      voyage: `V${randInt(100, 999)}${pick(['N', 'S', 'E', 'W'])}`,
      status: SHIPMENT_STATUS_DB[pickWeighted([['Planned', 3], ['InTransit', 3], ['Arrived', 2], ['Completed', 2]])],
    }));
    await bulkInsert(
      client,
      'shipment',
      ['shipment_id', 'contract_id', 'shipper', 'consignee', 'carrier', 'origin', 'loading_port', 'discharge_port', 'vessel', 'voyage', 'status'],
      shipmentRows,
    );

    console.log(`== 8. ShipmentContainer + Cargo + YardVisit x${N_SHIPMENT_CONTAINERS} ==`);
    const scRows = [];
    const cargoRows = [];
    const yardVisitRows = [];
    for (let i = 0; i < N_SHIPMENT_CONTAINERS; i++) {
      const shipment = pick(shipmentRows);
      const container = pick(containerRows);
      const contract = contractRows.find((c) => c.contract_id === shipment.contract_id);
      const scId = uuid();
      scRows.push({
        shipment_container_id: scId,
        shipment_id: shipment.shipment_id,
        container_id: container.container_id,
        seal_number: `SL${randInt(100000, 999999)}`,
        seal_type: pick(['Bolt Seal', 'Cable Seal']),
        gross_weight_actual: randFloat(5000, 25000, 0),
      });

      const cargoType = pick(CARGO_TYPES);
      const isFrozenOrChem = cargoType === 'Frozen Food' || cargoType === 'Chemicals';
      cargoRows.push({
        cargo_id: uuid(),
        shipment_container_id: scId,
        cargo_type: cargoType,
        weight: randFloat(3000, 22000, 0),
        volume: randFloat(10, 70, 1),
        is_hazardous: cargoType === 'Chemicals' && Math.random() < 0.3,
        temperature_min: isFrozenOrChem ? randFloat(-20, 2, 1) : null,
        temperature_max: isFrozenOrChem ? randFloat(3, 10, 1) : null,
        humidity_min: isFrozenOrChem ? randFloat(40, 60, 1) : null,
        humidity_max: isFrozenOrChem ? randFloat(61, 90, 1) : null,
        special_handling: isFrozenOrChem ? 'Giữ lạnh liên tục, tránh sốc nhiệt' : null,
      });

      const eta = daysFromNow(randInt(-60, 30));
      yardVisitRows.push({
        yard_visit_id: uuid(),
        shipment_container_id: scId,
        current_warehouse_id: null,
        eta,
        etd: new Date(eta.getTime() + randInt(2, 20) * 86400000),
        ata: Math.random() < 0.7 ? new Date(eta.getTime() + randInt(-1, 2) * 86400000) : null,
        atd: null,
        free_time_days_snapshot: contract ? contract.free_time_days : 7,
        status: pickWeighted([['PLANNED', 2], ['ARRIVED', 2], ['IN_YARD', 3], ['STAGING', 1], ['DEPARTED', 2], ['CLOSED', 2], ['REJECTED', 1], ['CANCELLED', 1]]),
      });
    }
    await bulkInsert(client, 'shipment_container', ['shipment_container_id', 'shipment_id', 'container_id', 'seal_number', 'seal_type', 'gross_weight_actual'], scRows);
    await bulkInsert(
      client,
      'cargo',
      ['cargo_id', 'shipment_container_id', 'cargo_type', 'weight', 'volume', 'is_hazardous', 'temperature_min', 'temperature_max', 'humidity_min', 'humidity_max', 'special_handling'],
      cargoRows,
    );
    await bulkInsert(
      client,
      'yard_visit',
      ['yard_visit_id', 'shipment_container_id', 'current_warehouse_id', 'eta', 'etd', 'ata', 'atd', 'free_time_days_snapshot', 'status'],
      yardVisitRows,
    );

    console.log('== 9. Inspection / Movement / Event ==');
    const inspectionRows = [];
    const movementRows = [];
    const eventRows = [];
    for (const visit of yardVisitRows) {
      const inspectionCount = randInt(1, 2);
      for (let i = 0; i < inspectionCount; i++) {
        const result = pickWeighted([['Pass', 4], ['Fail', 1]]);
        inspectionRows.push({
          inspection_id: uuid(),
          yard_visit_id: visit.yard_visit_id,
          inspection_type: INSPECTION_TYPE_DB[pick(['GateIn', 'GateOut', 'AdHoc'])],
          seal_check: Math.random() < 0.9,
          result,
          fail_reason: result === 'Fail' ? pick(['seal_mismatch', 'physical_damage_minor', 'physical_damage_severe', 'other']) : null,
          damage_notes: result === 'Fail' ? 'Phát hiện hư hỏng khi kiểm tra' : null,
          inspected_at: visit.eta,
          inspected_by: pick(users).user_id,
        });
      }

      const movementCount = randInt(1, 3);
      for (let i = 0; i < movementCount; i++) {
        movementRows.push({
          movement_id: uuid(),
          yard_visit_id: visit.yard_visit_id,
          movement_type: MOVEMENT_TYPE_DB[pick(['GateIn', 'Relocation', 'Rehandle', 'GateOut'])],
          from_warehouse_id: null,
          to_warehouse_id: null,
          vehicle_id: Math.random() < 0.5 ? pick(vehicleRows).vehicle_id : null,
          reason: pick(['Sắp xếp lại bãi', 'Ưu tiên gate-out', 'Tối ưu khoảng cách', null]),
          moved_at: visit.eta,
          operator_id: pick(users).user_id,
        });
      }

      if (Math.random() < 0.25) {
        eventRows.push({
          event_id: uuid(),
          yard_visit_id: visit.yard_visit_id,
          event_type: EVENT_TYPE_DB[pick(['CustomsHold', 'Rejected', 'Dispute', 'DamageDuringMovement', 'OwnerRequest'])],
          description: 'Phát sinh trong quá trình lưu bãi (dữ liệu demo)',
          requested_by: pick(NAMES),
          occurred_at: visit.eta,
          resolution_status: pickWeighted([['Open', 1], ['Resolved', 2]]),
        });
      }
    }
    await bulkInsert(
      client,
      'inspection',
      ['inspection_id', 'yard_visit_id', 'inspection_type', 'seal_check', 'result', 'fail_reason', 'damage_notes', 'inspected_at', 'inspected_by'],
      inspectionRows,
    );
    await bulkInsert(
      client,
      'movement',
      ['movement_id', 'yard_visit_id', 'movement_type', 'from_warehouse_id', 'to_warehouse_id', 'vehicle_id', 'reason', 'moved_at', 'operator_id'],
      movementRows,
    );
    await bulkInsert(client, 'event', ['event_id', 'yard_visit_id', 'event_type', 'description', 'requested_by', 'occurred_at', 'resolution_status'], eventRows);

    console.log('== 10. Invoice + Payment ==');
    const invoiceRows = [];
    for (const contract of contractRows) {
      const invoiceCount = randInt(1, 3);
      const visitsForContract = yardVisitRows.filter((v) => {
        const sc = scRows.find((s) => s.shipment_container_id === v.shipment_container_id);
        const shipment = sc && shipmentRows.find((s) => s.shipment_id === sc.shipment_id);
        return shipment && shipment.contract_id === contract.contract_id;
      });
      for (let i = 0; i < invoiceCount; i++) {
        const invoiceType = pick(['Deposit', 'StorageFee', 'FinalSettlement', 'Other']);
        const base = randFloat(500, 5000);
        const surcharge = invoiceType === 'StorageFee' || invoiceType === 'FinalSettlement' ? randFloat(0, 800) : 0;
        invoiceRows.push({
          invoice_id: uuid(),
          contract_id: contract.contract_id,
          yard_visit_id: visitsForContract.length ? pick(visitsForContract).yard_visit_id : null,
          invoice_type: INVOICE_TYPE_DB[invoiceType],
          actual_storage_duration: invoiceType !== 'Deposit' ? randInt(1, 30) : null,
          overdue_days: invoiceType !== 'Deposit' ? randInt(0, 10) : null,
          base_storage_fee: base,
          surcharge_amount: surcharge,
          total_amount: base + surcharge,
          payment_status: pickWeighted([['Unpaid', 2], ['Partial', 2], ['Paid', 3]]),
          issued_at: daysFromNow(-randInt(1, 200)),
        });
      }
    }
    await bulkInsert(
      client,
      'invoice',
      ['invoice_id', 'contract_id', 'yard_visit_id', 'invoice_type', 'actual_storage_duration', 'overdue_days', 'base_storage_fee', 'surcharge_amount', 'total_amount', 'payment_status', 'issued_at'],
      invoiceRows,
    );

    const paymentRows = [];
    for (const invoice of invoiceRows) {
      if (invoice.payment_status === 'Unpaid') continue;
      const paidAmount = invoice.payment_status === 'Paid' ? invoice.total_amount : randFloat(0.2, 0.8) * invoice.total_amount;
      const installments = invoice.payment_status === 'Partial' ? 1 : randInt(1, 2);
      for (let i = 0; i < installments; i++) {
        paymentRows.push({
          payment_id: uuid(),
          invoice_id: invoice.invoice_id,
          amount_paid: Number((paidAmount / installments).toFixed(2)),
          payment_method: PAYMENT_METHOD_DB[pick(['BankTransfer', 'Cash', 'Card'])],
          payment_date: daysFromNow(-randInt(0, 150)),
          note: pick(['Thanh toán đúng hạn', 'Thanh toán một phần', null]),
        });
      }
    }
    await bulkInsert(client, 'payment', ['payment_id', 'invoice_id', 'amount_paid', 'payment_method', 'payment_date', 'note'], paymentRows);

    const total =
      Object.keys(roleIds).length + Object.keys(permissionIds).length + users.length +
      warehouseRows.length + vehicleRows.length +
      contractRows.length + containerRows.length + shipmentRows.length +
      scRows.length + cargoRows.length + yardVisitRows.length +
      inspectionRows.length + movementRows.length + eventRows.length +
      invoiceRows.length + paymentRows.length;

    console.log('\n== DONE ==');
    console.table({
      roles: Object.keys(roleIds).length,
      permissions: Object.keys(permissionIds).length,
      users: users.length,
      warehouses: warehouseRows.length,
      vehicles: vehicleRows.length,
      contracts: contractRows.length,
      containers: containerRows.length,
      shipments: shipmentRows.length,
      shipment_containers: scRows.length,
      cargo: cargoRows.length,
      yard_visits: yardVisitRows.length,
      inspections: inspectionRows.length,
      movements: movementRows.length,
      events: eventRows.length,
      invoices: invoiceRows.length,
      payments: paymentRows.length,
    });
    console.log(`Tổng cộng ~${total} dòng dữ liệu.`);
    console.log('\nTài khoản demo (mật khẩu chung: Passw0rd1):');
    userDefs.forEach(([email, , roleCode]) => console.log(`  - ${email}  (${roleCode})`));
  } finally {
    client.release();
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
