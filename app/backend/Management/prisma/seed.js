const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const permissions = [
  'contract:create',
  'contract:read',
  'contract:update',
  'contract:activate',
  'contract:terminate',
  'user:create',
  'user:read',
  'user:update',
  'user:delete',
  'role:create',
  'role:read',
  'role:update',
  'role:delete',
  'permission:create',
  'permission:read',
  'permission:update',
  'permission:delete',
  'container:create',
  'container:read',
  'container:update',
  'shipment:create',
  'shipment:read',
  'shipment:update',
  'yardvisit:create',
  'yardvisit:read',
  'yardvisit:update',
  'inspection:create',
  'inspection:read',
  'movement:create',
  'movement:read',
  'event:create',
  'event:read',
  'event:resolve',
  'invoice:create',
  'invoice:read',
  'payment:create',
  'payment:read',
  'report:read',
];

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || !/^(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a password with 6+ characters, an uppercase letter, and a number before seeding.');
  }

  const role = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'Administrator', isSystem: true },
    create: { code: 'ADMIN', name: 'Administrator', isSystem: true },
  });
  for (const code of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { name: code },
      create: { code, name: code },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.roleId, permissionId: permission.permissionId } },
      update: {},
      create: { roleId: role.roleId, permissionId: permission.permissionId },
    });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 12), isActive: true },
    create: { email, passwordHash: await bcrypt.hash(password, 12), displayName: 'Bootstrap Admin' },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.userId, roleId: role.roleId } },
    update: {},
    create: { userId: user.userId, roleId: role.roleId },
  });
  console.log(`Admin role and user are ready for ${email}.`);
}

main().finally(() => prisma.$disconnect());
