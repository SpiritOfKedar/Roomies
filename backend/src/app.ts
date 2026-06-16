/**
 * =============================================================================
 * Express Application — Entry Point
 * =============================================================================
 * Bootstraps the Express server with all middleware, module routes, and
 * graceful shutdown hooks. This is the root of the application.
 *
 * Architecture: Modular Monolith
 *   - Each domain module (auth, house, tasks, voting, penalty, leaderboard)
 *     is self-contained with its own controller, service, repository, routes.
 *   - Shared infrastructure (DB, middleware, utils, jobs) lives in /shared.
 * =============================================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './shared/utils/env';
import { logger } from './shared/utils/logger';
import { initStorage } from './shared/utils/storage';
import { globalErrorHandler } from './shared/middleware/error-handler';
import { apiLimiter } from './shared/middleware/rate-limiter';
import {
  disconnectPrisma,
  warmupDatabase,
  startDatabaseHeartbeat,
  stopDatabaseHeartbeat,
} from './shared/db/prisma';
import { requestTiming } from './shared/middleware/request-timing';
import { disconnectCacheRedis, warmupRedis } from './shared/cache/redis-cache';

// ---- Module Route Imports ----
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import houseRoutes from './modules/house/house.routes';
import { houseTaskRoutes, houseChoreRoutes, choreRoutes, taskRoutes } from './modules/tasks/tasks.routes';
import { votingRoutes } from './modules/voting/voting.routes';
import { leaderboardRoutes } from './modules/leaderboard/leaderboard.routes';
import { penaltyRoutes } from './modules/penalty/penalty.routes';
import { swapRoutes } from './modules/tasks/swap.routes';
import { expenseRoutes } from './modules/expenses/expense.routes';
import { messageRoutes } from './modules/messages/messages.routes';

// ---- Background Jobs Imports ----
import { scheduleTaskSweeperJob, closeQueue } from './shared/jobs/queue';
import { startTaskSweeperWorker, closeWorker } from './shared/jobs/worker';
import {
  scheduleRecurringTasksJob,
  startRecurringTasksWorker,
  closeRecurringTasksWorker,
  closeRecurringTasksQueue,
} from './shared/jobs/recurring-tasks.worker';

// ---- Create Express App ----
const app = express();

// ---- Global Middleware ----
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestTiming);

// ---- Static uploads ----
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// ---- Health Check ----
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    },
    error: null,
  });
});

// ---- Module Routes ----
app.use('/api', apiLimiter); // Apply general API limits across all routes

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/houses/:id/tasks', houseTaskRoutes);
app.use('/api/houses/:id/chores', houseChoreRoutes);
app.use('/api/chores', choreRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks', votingRoutes);
app.use('/api/houses', leaderboardRoutes); // /api/houses/:id/leaderboard
app.use('/api/houses/:houseId/penalties', penaltyRoutes); // /api/houses/:houseId/penalties/:penaltyId/settle
app.use('/api/houses/:id/swaps', swapRoutes); // /api/houses/:id/swaps + /:swapId/resolve
app.use('/api/houses/:id/expenses', expenseRoutes); // /api/houses/:id/expenses + /splits/:splitId/settle
app.use('/api/houses/:id/messages', messageRoutes); // house-wide chat

// ---- Global Error Handler (must be registered last) ----
app.use(globalErrorHandler);

export default app;

// ---- Start Server (skipped in test mode so Supertest manages its own port) ----
if (env.NODE_ENV !== 'test') {
  const server = app.listen(env.PORT, () => {
    initStorage().catch((err) => logger.error({ err }, 'Failed to init upload storage'));
    logger.info(`🚀 Roomies backend running on port ${env.PORT} [${env.NODE_ENV}]`);
    warmupDatabase()
      .then(() => startDatabaseHeartbeat())
      .catch((err) => logger.warn({ err }, 'Database warmup failed'));
    warmupRedis().catch((err) => logger.warn({ err }, 'Redis warmup failed'));
    scheduleTaskSweeperJob().catch((err) =>
      logger.error({ err }, 'Failed to schedule task sweeper'),
    );
    startTaskSweeperWorker();
    scheduleRecurringTasksJob().catch((err) =>
      logger.error({ err }, 'Failed to schedule recurring tasks job'),
    );
    startRecurringTasksWorker();
  });

  // ---- Graceful Shutdown ----
  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      stopDatabaseHeartbeat();
      await closeQueue();
      await closeWorker();
      await closeRecurringTasksQueue();
      await closeRecurringTasksWorker();
      await disconnectCacheRedis();
      await disconnectPrisma();
      logger.info('Graceful shutdown complete.');
      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown — timeout exceeded.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // ---- Unhandled Rejection / Uncaught Exception Handlers ----
  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal({ reason }, 'Unhandled Promise Rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error }, 'Uncaught Exception');
    process.exit(1);
  });
}
