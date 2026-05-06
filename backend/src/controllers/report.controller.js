const Chat        = require('../models/Chat');
const SymptomCheck = require('../models/SymptomCheck');
const Message     = require('../models/Message');
const { buildResponse } = require('../services/ai.service');
const { logger }  = require('../utils/logger');

// ── Redis helpers (graceful no-op if Redis unavailable) ───────────
let _redis = null;
const getRedis = () => {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (process.env.NODE_ENV === 'test') return null;
  if (!url) return null;
  try {
    const Redis = require('ioredis');
    _redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    return _redis;
  } catch { return null; }
};
const rcGet = async (key) => { try { return await getRedis()?.get(key); } catch { return null; } };
const rcSet = async (key, val, ttl) => { try { await getRedis()?.setex(key, ttl, val); } catch {} };
const rcDel = async (key) => { try { await getRedis()?.del(key); } catch {} };

// ── Helpers ───────────────────────────────────────────────────────
const uniqueList = (items, limit = 8) => {
  const seen = new Set();
  return items
    .map((v) => String(v || '').trim())
    .filter((v) => { if (!v || seen.has(v.toLowerCase())) return false; seen.add(v.toLowerCase()); return true; })
    .slice(0, limit);
};

/* GET /api/reports ──────────────────────────────────────────────── */
const getHealthReport = async (req, res, next) => {
  try {
    const [recentChats, recentChecks, recentMessages] = await Promise.all([
      Chat.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30),
      SymptomCheck.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(30),
      Message.find({ role: 'assistant', structured_output: { $ne: null } }).sort({ created_at: -1 }).limit(100).lean().catch(() => []),
    ]);

    const symptomPool    = [];
    const riskLevels     = [];
    const symptomCounts  = {};
    const activityByDate = {};

    recentChats.forEach((chat) => {
      const chatSymptoms = Array.isArray(chat.aiResponse?.symptoms) ? chat.aiResponse.symptoms : [];
      symptomPool.push(...chatSymptoms);
      chatSymptoms.forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
      if (chat.riskLevel) riskLevels.push(chat.riskLevel);
      const d = new Date(chat.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      activityByDate[d] = (activityByDate[d] || 0) + 1;
    });

    recentChecks.forEach((check) => {
      symptomPool.push(...check.symptoms);
      riskLevels.push(check.riskLevel);
      check.symptoms.forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
      const d = new Date(check.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      activityByDate[d] = (activityByDate[d] || 0) + 1;
    });

    recentMessages.forEach((message) => {
      const output = message.structured_output || {};
      const messageSymptoms = Array.isArray(output.symptoms) ? output.symptoms : Array.isArray(output.symptoms_detected) ? output.symptoms_detected : [];
      symptomPool.push(...messageSymptoms);
      messageSymptoms.forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
      if (output.riskLevel || output.risk_level) riskLevels.push(output.riskLevel || output.risk_level);
      const date = message.created_at || message.createdAt;
      if (date) {
        const d = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        activityByDate[d] = (activityByDate[d] || 0) + 1;
      }
    });

    const currentRisk   = riskLevels[0] || 'Low';
    const sortedSymptoms = Object.entries(symptomCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    const recommendations =
      currentRisk === 'High'   ? ['Seek urgent medical help immediately.', 'Visit a hospital without delay.'] :
      currentRisk === 'Medium' ? ['Rest, hydration, and symptom monitoring are important.', 'Consult a doctor if symptoms persist beyond 2–3 days.'] :
                                 ['Rest and hydration are recommended.', 'Monitor symptoms for 2–3 days.'];

    return res.status(200).json({
      success: true,
      message: 'Health report generated',
      data: {
        recentSymptoms:           uniqueList(symptomPool, 8),
        currentRisk,
        riskTrend:                riskLevels.slice(0, 5).reverse().join(' → ') || 'Low',
        recommendations,
        symptom_frequency:        sortedSymptoms.map(({ name, value }) => ({ symptom: name, count: value })),
        symptomChart:             sortedSymptoms,
        riskChart:                riskLevels.slice(0, 10).map((level, i) => ({
          name: `#${i + 1}`,
          date: `#${i + 1}`,
          level,
          risk: level === 'High' ? 2 : level === 'Medium' ? 1 : 0,
        })),
        activityChart:            Object.entries(activityByDate).map(([date, count]) => ({ date, count })),
        weeklyTrend:              sortedSymptoms.slice(0, 3),
        recentChatsCount:         recentChats.length,
        recentSymptomChecksCount: recentChecks.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/reports/insights?refresh=true ────────────────────────── */
const getInsights = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const cacheKey = `insights:${userId}`;
    const bust     = req.query.refresh === 'true';

    if (!bust) {
      const cached = await rcGet(cacheKey);
      if (cached) {
        return res.status(200).json({ success: true, message: 'Insights (cached)', data: JSON.parse(cached) });
      }
    }

    // Pull last 14 days of data
    const since = new Date(Date.now() - 14 * 86400000);
    const [chats, checks] = await Promise.all([
      Chat.find({ userId, createdAt: { $gte: since } }).sort({ createdAt: -1 }),
      SymptomCheck.find({ userId, createdAt: { $gte: since } }).sort({ createdAt: -1 }),
    ]);

    const allSymptoms = [
      ...chats.flatMap((c) => Array.isArray(c.aiResponse?.symptoms) ? c.aiResponse.symptoms : []),
      ...checks.flatMap((c) => c.symptoms),
    ];
    const riskLevels = [
      ...chats.map((c) => c.riskLevel),
      ...checks.map((c) => c.riskLevel),
    ].filter(Boolean);

    if (allSymptoms.length === 0) {
      const fallback = {
        summary: 'No health events recorded in the last 14 days. Keep using the platform to build your health timeline.',
        recommendation: 'Start a symptom check or chat session to generate personalised insights.',
        anomalies: [],
      };
      return res.status(200).json({ success: true, message: 'No data yet', data: fallback });
    }

    const symptomSummary = [...new Set(allSymptoms)].slice(0, 10).join(', ');
    const riskSummary    = riskLevels.join(', ') || 'Low';
    const question       = `Patient health summary over 14 days: Symptoms reported: ${symptomSummary}. Risk levels: ${riskSummary}. Write a 2-sentence health awareness summary and one specific actionable recommendation. Be warm and clear. Do not diagnose.`;

    let summary        = '';
    let recommendation = '';
    try {
      const aiResult = await buildResponse(question, userId, 'en');
      const causes   = aiResult.possibleCauses || [];
      const recs     = aiResult.whenToConsultDoctor || aiResult.prevention || [];
      summary        = causes.length
        ? `Based on your recent activity, common patterns include: ${causes.slice(0, 3).join(', ')}.`
        : `You've had ${allSymptoms.length} symptom events over the last 14 days with a current risk level of ${riskLevels[0] || 'Low'}.`;
      recommendation  = recs[0] || 'Continue monitoring your symptoms and stay hydrated.';
    } catch (err) {
      logger.warn('Insights AI fallback', { error: err.message });
      summary        = `You had ${chats.length} chat sessions and ${checks.length} symptom checks in the last 14 days.`;
      recommendation = 'Keep tracking your symptoms consistently for better personalised insights.';
    }

    // Simple anomaly detection: symptom appearing > 3 times in 14 days
    const symCount = {};
    allSymptoms.forEach((s) => { symCount[s] = (symCount[s] || 0) + 1; });
    const anomalies = Object.entries(symCount)
      .filter(([, count]) => count >= 3)
      .map(([symptom, count]) => ({
        symptom,
        count,
        message: `"${symptom}" appeared ${count} times in the last 14 days.`,
      }));

    const data = { summary, recommendation, anomalies };
    await rcSet(cacheKey, JSON.stringify(data), 6 * 3600);

    return res.status(200).json({ success: true, message: 'Insights generated', data });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/reports/pdf ──────────────────────────────────────────── */
const getReportPdf = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { pool } = require('../config/db');
    const userResult = await pool.query('SELECT name, email FROM users WHERE id=$1', [userId]);
    const userName   = userResult.rows[0]?.name || 'User';

    const [recentChats, recentChecks] = await Promise.all([
      Chat.find({ userId }).sort({ createdAt: -1 }).limit(10),
      SymptomCheck.find({ userId }).sort({ createdAt: -1 }).limit(10),
    ]);

    const riskLevels = [...recentChats.map((c) => c.riskLevel), ...recentChecks.map((c) => c.riskLevel)].filter(Boolean);
    const symptomCounts = {};
    [...recentChats.flatMap((c) => c.aiResponse?.symptoms || []),
     ...recentChecks.flatMap((c) => c.symptoms)]
      .forEach((s) => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });

    const topSymptoms = Object.entries(symptomCounts).sort(([,a],[,b]) => b-a).slice(0,8);
    const currentRisk = riskLevels[0] || 'Low';
    const dateStr     = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="health-report-${Date.now()}.pdf"`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill('#0F766E');
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
      .text('HealthBot — Personal Health Report', 50, 25);
    doc.fontSize(11).font('Helvetica').text(`Generated: ${dateStr}  |  Patient: ${userName}`, 50, 52);

    doc.fillColor('#0F172A');
    let y = 110;

    // Risk Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Risk Summary', 50, y);
    y += 22;
    const riskColor = currentRisk === 'High' ? '#EF4444' : currentRisk === 'Medium' ? '#F59E0B' : '#10B981';
    doc.roundedRect(50, y, 180, 36, 6).fill(riskColor);
    doc.fillColor('#FFFFFF').fontSize(13).font('Helvetica-Bold')
      .text(`Current Risk: ${currentRisk}`, 60, y + 10);
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica')
      .text(`Based on ${riskLevels.length} recent health events.`, 240, y + 10);
    y += 60;

    // Risk history
    if (riskLevels.length > 1) {
      doc.fontSize(12).font('Helvetica-Bold').text('Risk History (recent → oldest)', 50, y);
      y += 18;
      riskLevels.slice(0, 8).forEach((r, i) => {
        doc.fontSize(10).font('Helvetica')
          .text(`${i + 1}. ${r}`, 60, y + i * 15);
      });
      y += riskLevels.slice(0, 8).length * 15 + 20;
    }

    // Top Symptoms
    if (topSymptoms.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Most Frequent Symptoms', 50, y);
      y += 22;
      topSymptoms.forEach(([name, count], i) => {
        const barW = Math.min(200, count * 30);
        doc.rect(60, y + i * 22, barW, 14).fill('#CCFBF1');
        doc.rect(60, y + i * 22, barW, 14).stroke('#0F766E');
        doc.fillColor('#0F172A').fontSize(10).font('Helvetica')
          .text(`${name} (${count}×)`, 270, y + i * 22 + 2);
      });
      y += topSymptoms.length * 22 + 20;
    }

    // Recommendations
    const recs = currentRisk === 'High'
      ? ['Seek urgent medical attention immediately.', 'Do not delay visiting a hospital or clinic.']
      : currentRisk === 'Medium'
      ? ['Rest, stay hydrated, and monitor symptoms daily.', 'Consult a doctor if symptoms persist beyond 2–3 days.']
      : ['Maintain hydration and regular sleep patterns.', 'Continue monitoring your symptoms.'];

    doc.fontSize(14).font('Helvetica-Bold').text('Recommendations', 50, y);
    y += 20;
    recs.forEach((rec) => {
      doc.fontSize(11).font('Helvetica').text(`• ${rec}`, 60, y);
      y += 18;
    });

    // Footer
    const footerY = doc.page.height - 50;
    doc.moveTo(50, footerY - 10).lineTo(doc.page.width - 50, footerY - 10).stroke('#E2E8F0');
    doc.fontSize(9).fillColor('#64748B').font('Helvetica')
      .text('This report is for health awareness only and is not a substitute for professional medical advice.', 50, footerY, { align: 'center' });

    doc.end();
  } catch (error) {
    return next(error);
  }
};

module.exports = { getHealthReport, getInsights, getReportPdf };
