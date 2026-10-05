const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
  'warehouse:create',
  'warehouse:read',
  'warehouse:update',
  'container:create',
  'container:read',
  'container:update',
  'vehicle:create',
  'vehicle:read',
  'vehicle:update',
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

  const roleResult = await pool.query(
    `INSERT INTO management.role (code, name, is_system)
     VALUES ('ADMIN', 'Administrator', true)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_system = true
     RETURNING role_id`,
  );
  const roleId = roleResult.rows[0].role_id;

  for (const code of permissions) {
    const permissionResult = await pool.query(
      `INSERT INTO management.permission (code, name)
       VALUES ($1, $1)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING permission_id`,
      [code],
    );
    await pool.query(
      `INSERT INTO management.role_permission (role_id, permission_id)
       VALUES ($1, $2)
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
      [roleId, permissionResult.rows[0].permission_id],
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userResult = await pool.query(
    `INSERT INTO management.user (email, password_hash, display_name)
     VALUES ($1, $2, 'Bootstrap Admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
     RETURNING user_id`,
    [email, passwordHash],
  );
  await pool.query(
    `INSERT INTO management.user_role (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userResult.rows[0].user_id, roleId],
  );

  console.log(`Admin role and user are ready for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
