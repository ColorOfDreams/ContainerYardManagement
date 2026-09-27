// prisma/seed-fake.js — sinh dữ liệu giả (~1000-2000 dòng) trải đủ mọi bảng
// trong schema "management" để có sẵn dữ liệu test/demo, không cần tạo tay
// qua từng API (nhiều bảng chưa có API — insert thẳng qua Prisma Client).
//
// Chạy: docker compose exec management-service node prisma/seed-fake.js
// An toàn chạy lại nhiều lần: mỗi lần chạy dùng UUID/mã mới, không xóa dữ
// liệu cũ — muốn làm sạch trước thì tự truncate bảng rồi chạy lại.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

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

// ---- counts (đủ ~1000-2000 dòng cộng dồn các bảng) ----
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

async function main() {
  console.log('== 1. Roles & Permissions ==');
  const permissionDefs = [
    'contract:create', 'contract:read', 'contract:update', 'contract:activate', 'contract:terminate',
    'user:create', 'user:read', 'user:update', 'user:delete',
    'role:create', 'role:read', 'role:update', 'role:delete',
    'permission:create', 'permission:read', 'permission:update', 'permission:delete',
  ];
  const permissions = {};
  for (const code of permissionDefs) {
    permissions[code] = await prisma.permission.upsert({
      where: { code }, update: {}, create: { code, name: code },
    });
  }

  const roleDefs = {
    ADMIN: permissionDefs,
    DISPATCHER: ['contract:read', 'contract:create'],
    OPERATOR: ['contract:read'],
    INSPECTOR: ['contract:read'],
    ACCOUNTANT: ['contract:read'],
    VIEWER: ['contract:read'],
  };
  const roles = {};
  for (const [code, permCodes] of Object.entries(roleDefs)) {
    const role = await prisma.role.upsert({
      where: { code }, update: {}, create: { code, name: code, isSystem: code === 'ADMIN' },
    });
    roles[code] = role;
    for (const permCode of permCodes) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.roleId, permissionId: permissions[permCode].permissionId } },
        update: {}, create: { roleId: role.roleId, permissionId: permissions[permCode].permissionId },
      });
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
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, displayName, roles: { create: [{ roleId: roles[roleCode].roleId }] } },
    });
    users.push(user);
  }

  console.log(`== 3. Contracts x${N_CONTRACTS} ==`);
  const contractRows = Array.from({ length: N_CONTRACTS }, () => {
    const effectiveDate = daysFromNow(-randInt(30, 400));
    return {
      contractId: uuid(),
      customerId: uuid(),
      effectiveDate,
      expiryDate: daysFromNow(randInt(30, 700)),
      unitPrice: randFloat(20, 200),
      freeTimeDays: randInt(3, 14),
      surchargeRate: randFloat(0.01, 0.1, 4),
      paymentTerms: pick(['Net 15', 'Net 30', 'Net 45', 'COD']),
      status: pickWeighted([['Draft', 2], ['Active', 6], ['Expired', 1], ['Terminated', 1]]),
    };
  });
  await prisma.contract.createMany({ data: contractRows });

  console.log(`== 4. Containers x${N_CONTAINERS} ==`);
  const usedCodes = new Set();
  const containerRows = Array.from({ length: N_CONTAINERS }, () => {
    let code;
    do {
      code = `${pick(['MSCU', 'MAEU', 'CMAU', 'ONEU', 'COSU', 'HLXU'])}${randInt(1000000, 9999999)}`;
    } while (usedCodes.has(code));
    usedCodes.add(code);
    const tare = randFloat(1900, 4200, 0);
    return {
      containerId: uuid(),
      containerCode: code,
      containerType: pick(CONTAINER_TYPES),
      sizeTypeCode: pick(SIZE_TYPES),
      tareWeight: tare,
      maxGrossWeight: tare + randFloat(20000, 28000, 0),
      maxPayload: randFloat(18000, 26000, 0),
      capacity: randFloat(25, 76, 1),
      status: pickWeighted([['AVAILABLE', 7], ['MAINTENANCE', 2], ['DAMAGED', 1]]),
    };
  });
  await prisma.container.createMany({ data: containerRows });

  console.log(`== 5. Shipments x${N_SHIPMENTS} ==`);
  const shipmentRows = Array.from({ length: N_SHIPMENTS }, () => ({
    shipmentId: uuid(),
    contractId: pick(contractRows).contractId,
    shipper: pick(SHIPPERS),
    consignee: pick(SHIPPERS),
    carrier: pick(CARRIERS),
    origin: pick(PORTS),
    loadingPort: pick(PORTS),
    dischargePort: pick(PORTS),
    vessel: `${pick(CARRIERS).split(' ')[0]} ${randInt(1, 999)}`,
    voyage: `V${randInt(100, 999)}${pick(['N', 'S', 'E', 'W'])}`,
    status: pickWeighted([['Planned', 3], ['InTransit', 3], ['Arrived', 2], ['Completed', 2]]),
  }));
  await prisma.shipment.createMany({ data: shipmentRows });

  console.log(`== 6. ShipmentContainer + Cargo + YardVisit x${N_SHIPMENT_CONTAINERS} ==`);
  const scRows = [];
  const cargoRows = [];
  const yardVisitRows = [];
  for (let i = 0; i < N_SHIPMENT_CONTAINERS; i++) {
    const shipment = pick(shipmentRows);
    const container = pick(containerRows);
    const contract = contractRows.find((c) => c.contractId === shipment.contractId);
    const scId = uuid();
    scRows.push({
      shipmentContainerId: scId,
      shipmentId: shipment.shipmentId,
      containerId: container.containerId,
      sealNumber: `SL${randInt(100000, 999999)}`,
      sealType: pick(['Bolt Seal', 'Cable Seal']),
      grossWeightActual: randFloat(5000, 25000, 0),
    });

    const cargoType = pick(CARGO_TYPES);
    const isFrozenOrChem = cargoType === 'Frozen Food' || cargoType === 'Chemicals';
    cargoRows.push({
      cargoId: uuid(),
      shipmentContainerId: scId,
      cargoType,
      weight: randFloat(3000, 22000, 0),
      volume: randFloat(10, 70, 1),
      isHazardous: cargoType === 'Chemicals' && Math.random() < 0.3,
      temperatureMin: isFrozenOrChem ? randFloat(-20, 2, 1) : null,
      temperatureMax: isFrozenOrChem ? randFloat(3, 10, 1) : null,
      humidityMin: isFrozenOrChem ? randFloat(40, 60, 1) : null,
      humidityMax: isFrozenOrChem ? randFloat(61, 90, 1) : null,
      specialHandling: isFrozenOrChem ? 'Giữ lạnh liên tục, tránh sốc nhiệt' : null,
    });

    const eta = daysFromNow(randInt(-60, 30));
    yardVisitRows.push({
      yardVisitId: uuid(),
      shipmentContainerId: scId,
      currentSlotId: null,
      eta,
      etd: new Date(eta.getTime() + randInt(2, 20) * 86400000),
      ata: Math.random() < 0.7 ? new Date(eta.getTime() + randInt(-1, 2) * 86400000) : null,
      atd: null,
      freeTimeDaysSnapshot: contract ? contract.freeTimeDays : 7,
      status: pickWeighted([['PLANNED', 2], ['ARRIVED', 2], ['IN_YARD', 3], ['STAGING', 1], ['DEPARTED', 2], ['CLOSED', 2], ['REJECTED', 1], ['CANCELLED', 1]]),
    });
  }
  await prisma.shipmentContainer.createMany({ data: scRows });
  await prisma.cargo.createMany({ data: cargoRows });
  await prisma.yardVisit.createMany({ data: yardVisitRows });

  console.log('== 7. Inspection / Movement / YardEvent ==');
  const inspectionRows = [];
  const movementRows = [];
  const eventRows = [];
  for (const visit of yardVisitRows) {
    const inspectionCount = randInt(1, 2);
    for (let i = 0; i < inspectionCount; i++) {
      const result = pickWeighted([['Pass', 4], ['Fail', 1]]);
      inspectionRows.push({
        inspectionId: uuid(),
        yardVisitId: visit.yardVisitId,
        inspectionType: pick(['GateIn', 'GateOut', 'AdHoc']),
        sealCheck: Math.random() < 0.9,
        result,
        failReason: result === 'Fail' ? pick(['seal_mismatch', 'physical_damage_minor', 'physical_damage_severe', 'other']) : null,
        damageNotes: result === 'Fail' ? 'Phát hiện hư hỏng khi kiểm tra' : null,
        inspectedAt: visit.eta,
        inspectedBy: pick(users).userId,
      });
    }

    const movementCount = randInt(1, 3);
    for (let i = 0; i < movementCount; i++) {
      movementRows.push({
        movementId: uuid(),
        yardVisitId: visit.yardVisitId,
        movementType: pick(['GateIn', 'Relocation', 'Rehandle', 'GateOut']),
        fromSlotId: null,
        toSlotId: null,
        reason: pick(['Sắp xếp lại bãi', 'Ưu tiên gate-out', 'Tối ưu khoảng cách', null]),
        movedAt: visit.eta,
        operatorId: pick(users).userId,
      });
    }

    if (Math.random() < 0.25) {
      eventRows.push({
        eventId: uuid(),
        yardVisitId: visit.yardVisitId,
        eventType: pick(['CustomsHold', 'Rejected', 'Dispute', 'DamageDuringMovement', 'OwnerRequest']),
        description: 'Phát sinh trong quá trình lưu bãi (dữ liệu demo)',
        requestedBy: pick(NAMES),
        occurredAt: visit.eta,
        resolutionStatus: pickWeighted([['Open', 1], ['Resolved', 2]]),
      });
    }
  }
  await prisma.inspection.createMany({ data: inspectionRows });
  await prisma.movement.createMany({ data: movementRows });
  await prisma.yardEvent.createMany({ data: eventRows });

  console.log('== 8. Invoice + Payment ==');
  const invoiceRows = [];
  for (const contract of contractRows) {
    const invoiceCount = randInt(1, 3);
    const visitsForContract = yardVisitRows.filter((v) => {
      const sc = scRows.find((s) => s.shipmentContainerId === v.shipmentContainerId);
      const shipment = sc && shipmentRows.find((s) => s.shipmentId === sc.shipmentId);
      return shipment && shipment.contractId === contract.contractId;
    });
    for (let i = 0; i < invoiceCount; i++) {
      const invoiceType = pick(['Deposit', 'StorageFee', 'FinalSettlement', 'Other']);
      const base = randFloat(500, 5000);
      const surcharge = invoiceType === 'StorageFee' || invoiceType === 'FinalSettlement' ? randFloat(0, 800) : 0;
      invoiceRows.push({
        invoiceId: uuid(),
        contractId: contract.contractId,
        yardVisitId: visitsForContract.length ? pick(visitsForContract).yardVisitId : null,
        invoiceType,
        actualStorageDuration: invoiceType !== 'Deposit' ? randInt(1, 30) : null,
        overdueDays: invoiceType !== 'Deposit' ? randInt(0, 10) : null,
        baseStorageFee: base,
        surchargeAmount: surcharge,
        totalAmount: base + surcharge,
        paymentStatus: pickWeighted([['Unpaid', 2], ['Partial', 2], ['Paid', 3]]),
        issuedAt: daysFromNow(-randInt(1, 200)),
      });
    }
  }
  await prisma.invoice.createMany({ data: invoiceRows });

  const paymentRows = [];
  for (const invoice of invoiceRows) {
    if (invoice.paymentStatus === 'Unpaid') continue;
    const paidAmount = invoice.paymentStatus === 'Paid' ? invoice.totalAmount : randFloat(0.2, 0.8) * invoice.totalAmount;
    const installments = invoice.paymentStatus === 'Partial' ? 1 : randInt(1, 2);
    for (let i = 0; i < installments; i++) {
      paymentRows.push({
        paymentId: uuid(),
        invoiceId: invoice.invoiceId,
        amountPaid: Number((paidAmount / installments).toFixed(2)),
        paymentMethod: pick(['BankTransfer', 'Cash', 'Card']),
        paymentDate: daysFromNow(-randInt(0, 150)),
        note: pick(['Thanh toán đúng hạn', 'Thanh toán một phần', null]),
      });
    }
  }
  await prisma.payment.createMany({ data: paymentRows });

  const total =
    Object.keys(roles).length + Object.keys(permissions).length + users.length +
    contractRows.length + containerRows.length + shipmentRows.length +
    scRows.length + cargoRows.length + yardVisitRows.length +
    inspectionRows.length + movementRows.length + eventRows.length +
    invoiceRows.length + paymentRows.length;

  console.log('\n== DONE ==');
  console.table({
    roles: Object.keys(roles).length,
    permissions: Object.keys(permissions).length,
    users: users.length,
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
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
