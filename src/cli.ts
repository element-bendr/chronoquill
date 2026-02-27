import { Command } from 'commander';
import cron, { type ScheduledTask } from 'node-cron';
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
      await withRuntime(async (rt) => {
        await rt.curation.runPendingCuration();
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
    .command('review-list')
    .description('List quotes currently waiting in manual review state')
    .option('-l, --limit <number>', 'Max review quotes to show', '100')
    .action(async (options: { limit: string }) => {
      await withRuntime((rt) => {
        const limit = Number(options.limit);
        const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;
        const rows = rt.reviewQueue.list(safeLimit);
        if (rows.length === 0) {
          console.log('Review queue is empty.');
          return;
        }

        for (const row of rows) {
          const preview = row.text.length > 120 ? `${row.text.slice(0, 117)}...` : row.text;
          console.log(`${row.id}\t${row.author}\t${row.confidence.toFixed(2)}\t${preview}`);
        }
      });
    });

  program
    .command('review-approve')
    .description('Approve a quote currently in review state')
    .argument('<quoteId>', 'Quote id')
    .option('-r, --reason <text>', 'Optional operator reason')
    .action(async (quoteId: string, options: { reason?: string }) => {
      await withRuntime((rt) => {
        rt.reviewQueue.setDecision(quoteId, 'approved', options.reason);
      });
    });

  program
    .command('review-reject')
    .description('Reject a quote currently in review state')
    .argument('<quoteId>', 'Quote id')
    .option('-r, --reason <text>', 'Optional operator reason')
    .action(async (quoteId: string, options: { reason?: string }) => {
      await withRuntime((rt) => {
        rt.reviewQueue.setDecision(quoteId, 'rejected', options.reason);
      });
    });

  program
    .command('export-send-history')
    .description('Export send event history to CSV')
    .option('-o, --out <path>', 'Output CSV path', './exports/send-history.csv')
    .option('-l, --limit <number>', 'Max rows to export', '1000')
    .action(async (options: { out: string; limit: string }) => {
      await withRuntime((rt) => {
        const limit = Number(options.limit);
        const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1000;
        const result = rt.csvExport.exportSendHistory(options.out, safeLimit);
        rt.logger.info({ path: result.path, count: result.count }, 'csv_export_send_history_complete');
      });
    });

  program
    .command('export-review-queue')
    .description('Export review queue to CSV')
    .option('-o, --out <path>', 'Output CSV path', './exports/review-queue.csv')
    .option('-l, --limit <number>', 'Max rows to export', '1000')
    .action(async (options: { out: string; limit: string }) => {
      await withRuntime((rt) => {
        const limit = Number(options.limit);
        const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1000;
        const result = rt.csvExport.exportReviewQueue(options.out, safeLimit);
        rt.logger.info({ path: result.path, count: result.count }, 'csv_export_review_queue_complete');
      });
    });

  program
    .command('run-service')
    .description('Start long-lived scheduler service with boot catch-up and health check')
    .action(async () => {
      await withRuntime(async (rt) => {
        const serviceJobs: ScheduledTask[] = [];
        await rt.publisher.connect();
        await rt.bootSupervisor.runCatchupCheck();
        rt.scheduler.register();
        await rt.health.check();

        if (rt.config.SOURCE_SYNC_ENABLED) {
          const sourceSyncJob = cron.schedule(
            rt.config.SOURCE_SYNC_SCHEDULE,
            async () => {
              try {
                await rt.sourceSync.syncAllSources();
              } catch (error) {
                rt.logger.error(
                  { error: error instanceof Error ? error.message : String(error) },
                  'scheduled_source_sync_failed'
                );
              }
            },
            { timezone: rt.config.TIMEZONE }
          );
          serviceJobs.push(sourceSyncJob);
          rt.logger.info({ cron: rt.config.SOURCE_SYNC_SCHEDULE }, 'scheduler_source_sync_registered');
        }

        rt.logger.info('service_started');
        await new Promise<void>((resolve) => {
          const close = () => {
            rt.scheduler.stop();
            for (const job of serviceJobs) {
              job.stop();
              job.destroy();
            }
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
