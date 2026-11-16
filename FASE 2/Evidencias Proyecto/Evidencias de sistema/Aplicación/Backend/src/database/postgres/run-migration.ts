import { defaultPgClient } from './client';
import { PostgresMigrator } from './migrator';
import { logger } from '../../utils/logger';

async function run(): Promise<void> {
  try {
    const migrator = new PostgresMigrator(defaultPgClient);
    const applied = await migrator.migrate();
    logger.info('PostgresCLI', `Migrations completed. Applied: ${applied.join(', ') || 'none'}`);
  } catch (err) {
    logger.error('PostgresCLI', 'Migration failed', err);
    process.exit(1);
  } finally {
    await defaultPgClient.close();
  }
}

void run();
