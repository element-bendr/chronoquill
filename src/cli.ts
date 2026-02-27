import { Command } from 'commander';
import { createRuntime } from './cli/runtime';

const withRuntime = async (work: (runtime: ReturnType<typeof createRuntime>) => Promise<void> | void): Promise<void> => {
  const runtime = createRuntime();
  try {
    await work(runtime);
  } finally {
    await runtime.publisher.disconnect().catch(() => undefined);
    runtime.db.close();
  }
};

const run = async (): Promise<void> => {
  const program = new Command();
  program.name('chronoquill').description('Deterministic local-first quote scheduler and publisher').version('1.0.0');

  program
    .command('bootstrap')
    .description('Run migrations and seed initial sources/routes')
    .action(async () => {
      await withRuntime((rt) => {
        rt.bootstrap.run();
        rt.logger.info('bootstrap_complete');
      });
    });

  program
    .command('sync-sources')
    .description('Fetch and ingest quote candidates from enabled sources')
    .action(async () => {
      await withRuntime(async (rt) => {
        await rt.sourceSync.syncAllSources();
      });
    });

  program
    .command('curate-quotes')
    .description('Run deterministic curation pass for candidate/review quotes')
    .action(async () => {
      await withRuntime((rt) => {
        rt.curation.runPendingCuration();
      });
    });

  program
    .command('send-now')
    .description('Send immediately for all enabled routes')
    .action(async () => {
      await withRuntime(async (rt) => {
        await rt.publisher.connect();
        const routes = rt.repos.getEnabledRoutes();
        for (const route of routes) {
          await rt.publisher.sendRoute(route, { dryRun: false, catchup: false });
        }
      });
    });

  program
    .command('dry-run')
    .description('Run route selection and send planning without transport send')
    .action(async () => {
      await withRuntime(async (rt) => {
        await rt.publisher.connect();
        const routes = rt.repos.getEnabledRoutes();
        for (const route of routes) {
          await rt.publisher.sendRoute(route, { dryRun: true, catchup: false });
        }
      });
    });

  program
    .command('reindex')
    .description('Recompute normalized text and hashes for approved quotes')
    .action(async () => {
      await withRuntime((rt) => {
        const count = rt.reindex.run();
        rt.logger.info({ count }, 'reindex_complete');
      });
    });

  program
    .command('db-check')
    .description('Run DB integrity checks')
    .action(async () => {
      await withRuntime((rt) => {
        const status = rt.dbCheck.run();
        rt.logger.info(status, 'db_check_result');
        if (!status.ok) {
          process.exitCode = 1;
        }
      });
    });

  program
    .command('run-service')
    .description('Start long-lived scheduler service with boot catch-up and health check')
    .action(async () => {
      await withRuntime(async (rt) => {
        await rt.publisher.connect();
        await rt.bootSupervisor.runCatchupCheck();
        rt.scheduler.register();
        await rt.health.check();

        rt.logger.info('service_started');
        await new Promise<void>((resolve) => {
          const close = () => {
            rt.scheduler.stop();
            resolve();
          };
          process.once('SIGINT', close);
          process.once('SIGTERM', close);
        });
      });
    });

  await program.parseAsync(process.argv);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
