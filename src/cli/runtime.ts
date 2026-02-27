import { loadConfig } from '../config/loadConfig';
import { Db } from '../db/database';
import { Repositories } from '../db/repositories';
import { buildLogger } from '../logging/logger';
import { BaileysWhatsAppTransport } from '../adapters/whatsapp';
import { NoopBrowserWorker } from '../browser/worker';
import { AgentBrowserWorker } from '../browser/agentBrowserWorker';
import { DefaultQuoteSourceAdapter } from '../adapters/sourceAdapter';
import { QuoteExtractor } from '../ingestion/extractor';
import { DeduplicationService } from '../services/deduplicationService';
import { QuoteCuratorService } from '../services/quoteCuratorService';
import { SourceSyncService } from '../services/sourceSyncService';
import { CurationService } from '../services/curationService';
import { RoutePlannerService } from '../routing/routePlannerService';
import { WhatsAppPublisherService } from '../publisher/whatsAppPublisherService';
import { SchedulerService } from '../scheduler/schedulerService';
import { BootSupervisorService } from '../services/bootSupervisorService';
import { HealthMonitorService } from '../health/healthMonitorService';
import { BootstrapService } from '../services/bootstrapService';
import { ReindexService } from '../services/reindexService';
import { DbCheckService } from '../services/dbCheckService';
import {
  HeuristicLLMCuratorAgent,
  NoopLLMCuratorAgent,
  type LLMCuratorAgent
} from '../services/llmCuratorAgent';
import { ReviewQueueService } from '../services/reviewQueueService';
import { CsvExportService } from '../services/csvExportService';
import { DbBackupService } from '../services/dbBackupService';

export const createRuntime = () => {
  const config = loadConfig();
  const logger = buildLogger(config);
  const db = new Db(config);
  db.runMigrations();

  const repos = new Repositories(db);
  const transport = new BaileysWhatsAppTransport({
    authDir: config.BAILEYS_AUTH_DIR,
    printQR: config.BAILEYS_PRINT_QR,
    browserName: config.BAILEYS_BROWSER_NAME
  });
  const browserWorker =
    config.BROWSER_WORKER_ADAPTER === 'agent-browser'
      ? new AgentBrowserWorker({
          provider: config.AGENT_BROWSER_PROVIDER,
          headless: config.AGENT_BROWSER_HEADLESS,
          navigationTimeoutMs: config.AGENT_BROWSER_NAV_TIMEOUT_MS
        })
      : new NoopBrowserWorker();
  const sourceAdapter = new DefaultQuoteSourceAdapter(browserWorker);
  const extractor = new QuoteExtractor();
  const dedup = new DeduplicationService();
  const curator = new QuoteCuratorService(dedup);
  const sourceSync = new SourceSyncService(logger, repos, sourceAdapter, extractor, curator);
  const llmCurator: LLMCuratorAgent =
    config.LLM_CURATION_ENABLED && config.LLM_PROVIDER_NAME === 'heuristic'
      ? new HeuristicLLMCuratorAgent()
      : new NoopLLMCuratorAgent();
  const curation = new CurationService(repos, curator, logger, config, llmCurator);
  const planner = new RoutePlannerService(repos, config);
  const publisher = new WhatsAppPublisherService(transport, repos, planner, logger, config);
  const scheduler = new SchedulerService(repos, publisher, logger);
  const bootSupervisor = new BootSupervisorService(repos, publisher, logger, config);
  const health = new HealthMonitorService(repos, transport, logger, config);
  const bootstrap = new BootstrapService(db);
  const reindex = new ReindexService(repos);
  const dbCheck = new DbCheckService(repos);
  const reviewQueue = new ReviewQueueService(repos, logger);
  const csvExport = new CsvExportService(repos);
  const dbBackup = new DbBackupService(db);

  return {
    config,
    logger,
    db,
    repos,
    transport,
    sourceSync,
    curation,
    publisher,
    scheduler,
    bootSupervisor,
    health,
    bootstrap,
    reindex,
    dbCheck,
    reviewQueue,
    csvExport,
    dbBackup
  };
};

export type AppRuntime = ReturnType<typeof createRuntime>;
