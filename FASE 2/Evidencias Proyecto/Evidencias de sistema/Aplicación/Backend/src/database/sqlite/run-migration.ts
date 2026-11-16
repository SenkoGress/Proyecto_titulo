import { defaultSqliteClient } from './client';
import { SqliteMigrator } from './migrator';
import { logger } from '../../utils/logger';

function run(): void {
  try {
    const migrator = new SqliteMigrator(defaultSqliteClient);
    const applied = migrator.migrate();
    logger.info('SqliteCLI', `Migrations completed. Applied: ${applied.join(', ') || 'none'}`);
  } catch (err) {
    logger.error('SqliteCLI', 'Migration failed', err);
    process.exit(1);
  } finally {
    defaultSqliteClient.close();
  }
}

run();
