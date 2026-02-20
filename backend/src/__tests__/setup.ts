import { execSync } from 'child_process';
import { prisma, disconnectPrisma } from '../shared/db/prisma';

// -----------------------------------------------------------------------------
// Test Setup & Teardown
// -----------------------------------------------------------------------------

beforeAll(async () => {
  // We assume the DATABASE_URL environment variable is set to a dedicated
  // test database. If not, be extremely careful doing this in development!
  try {
    // Run schema migrations against the test DB
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to run test db migrations', err);
    throw err;
  }
});

afterEach(async () => {
  // Truncate all tables after each test so tests do not pollute one another
  // PostgreSQL-specific truncation
  try {
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    const tables = tablenames
      .map((row: any) => row.tablename || row.table_name)
      .filter((name) => name && name !== '_prisma_migrations')
      .map((name) => `"public"."${name}"`)
      .join(', ');

    if (tables.length > 0) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
  } catch (error) {
    console.log('Teardown err:', error);
  }
});

afterAll(async () => {
  // Disconnect the Prisma client globally
  await disconnectPrisma();
});
