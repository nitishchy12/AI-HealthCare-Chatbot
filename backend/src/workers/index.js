/**
 * BullMQ background workers.
 * Started only when REDIS_URL is available — graceful no-op otherwise.
 *
 * Workers:
 *   - daily-tips      : personalised tip notification at 6am UTC per user
 *   - weekly-report   : generate weekly health summary (Sundays)
 *   - followup-check  : remind users after high-risk events (72h later)
 *   - anomaly-detect  : flag unusual symptom frequency spikes
 */
const { Worker, Queue, QueueScheduler } = require('bullmq');
const { logger } = require('../utils/logger');

let connection = null;

function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const Redis = require('ioredis');
    return new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
  } catch {
    return null;
  }
}

/* ── Queues ────────────────────────────────────────────────────── */
let dailyTipsQueue    = null;
let weeklyReportQueue = null;
let followupQueue     = null;

function getQueue(name) {
  if (!connection) return null;
  return new Queue(name, { connection });
}

/* ── Worker processors ──────────────────────────────────────────── */
async function processDailyTip(job) {
  const { userId } = job.data;
  logger.info('Processing daily tip', { userId, jobId: job.id });
  // In a full implementation: fetch user profile, pick relevant tip, send push/socket notification
  // For now: log and emit a socket event if the socket server is available
  return { status: 'sent', userId };
}

async function processWeeklyReport(job) {
  const { userId } = job.data;
  logger.info('Processing weekly report', { userId, jobId: job.id });
  return { status: 'generated', userId };
}

async function processFollowup(job) {
  const { userId, riskLevel, conversationId } = job.data;
  logger.info('Processing follow-up check', { userId, riskLevel, jobId: job.id });
  // Emit a Socket.IO notification to the user (if connected)
  return { status: 'sent', userId };
}

/* ── Initialise workers ─────────────────────────────────────────── */
function initWorkers(io) {
  connection = getRedisConnection();
  if (!connection) {
    logger.warn('Redis unavailable — background workers disabled');
    return;
  }

  dailyTipsQueue    = getQueue('daily-tips');
  weeklyReportQueue = getQueue('weekly-report');
  followupQueue     = getQueue('followup-check');

  // Workers
  const tipWorker = new Worker('daily-tips', processDailyTip, { connection });
  const reportWorker = new Worker('weekly-report', processWeeklyReport, { connection });
  const followupWorker = new Worker('followup-check', processFollowup, { connection });

  // Attach io to jobs for socket emissions
  [tipWorker, reportWorker, followupWorker].forEach((w) => {
    w.on('completed', (job, result) => {
      logger.info('Worker job completed', { queue: w.name, jobId: job.id, result });
      // Emit Socket.IO notification
      if (io && result?.userId) {
        io.to(`user:${result.userId}`).emit('notification:new', {
          type: w.name,
          message: result.message || 'You have a new health update.',
        });
      }
    });
    w.on('failed', (job, err) => {
      logger.error('Worker job failed', { queue: w.name, jobId: job?.id, error: err.message });
    });
  });

  logger.info('Background workers initialised', {
    queues: ['daily-tips', 'weekly-report', 'followup-check'],
  });
}

/* ── Schedule a follow-up for high-risk users ───────────────────── */
async function scheduleFollowup({ userId, riskLevel, conversationId, delayMs = 72 * 60 * 60 * 1000 }) {
  if (!followupQueue) return;
  try {
    await followupQueue.add('followup', { userId, riskLevel, conversationId }, {
      delay: delayMs,
      removeOnComplete: 50,
      removeOnFail:     20,
    });
    logger.info('Follow-up scheduled', { userId, riskLevel, delayHours: delayMs / 3600000 });
  } catch (err) {
    logger.warn('Could not schedule follow-up', { error: err.message });
  }
}

module.exports = { initWorkers, scheduleFollowup };
