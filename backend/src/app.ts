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
import { env } from './shared/utils/env';
import { logger } from './shared/utils/logger';
import { globalErrorHandler } from './shared/middleware/error-handler';
import { disconnectPrisma } from './shared/db/prisma';

// ---- Create Express App ----
const app = express();

// ---- Global Middleware ----
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

// ---- Module Routes (will be registered in subsequent phases) ----
// Phase 2: app.use('/api/auth', authRoutes);
// Phase 3: app.use('/api/houses', houseRoutes);
//          app.use('/api/tasks', taskRoutes);
// Phase 4: app.use('/api/voting', votingRoutes);
//          app.use('/api/leaderboard', leaderboardRoutes);

// ---- Global Error Handler (must be registered last) ----
app.use(globalErrorHandler);

// ---- Start Server ----
const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Roomies backend running on port ${env.PORT} [${env.NODE_ENV}]`);
});

// ---- Graceful Shutdown ----
const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
        logger.info('HTTP server closed.');
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

export default app;
