const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

const buildFallback = async (question) => {
  const q = question.toLowerCase();
  const diseases = await pool.query('SELECT * FROM diseases');

  const matched = diseases.rows.find((d) => q.includes(d.disease_name.toLowerCase()));
  if (!matched) {
    return {
      symptoms: 'Common symptoms may vary from person to person.',
      possibleCauses: 'Could be due to infection, allergy, stress, or other conditions.',
      prevention: 'Stay hydrated, maintain hygiene, and monitor symptoms.',
      whenToConsultDoctor: 'If symptoms persist for more than 2-3 days or worsen, consult a doctor.',
      riskLevel: 'Low'
    };
  }

  return {
    symptoms: matched.symptoms,
    possibleCauses: matched.risk_factors,
    prevention: matched.prevention,
    whenToConsultDoctor: matched.treatment,
    riskLevel: 'Medium'
  };
};

const inferRiskLevel = (text) => {
  const t = text.toLowerCase();
  if (/(chest pain|breathing difficulty|unconscious|seizure|blood)/.test(t)) return 'High';
  if (/(fever|vomit|infection|persistent pain)/.test(t)) return 'Medium';
  return 'Low';
};

const parseStructuredJson = (content, question) => {
  try {
    const parsed = JSON.parse(content);
    return {
      symptoms: parsed.symptoms || 'Symptoms are not clearly identified from the question.',
      possibleCauses: parsed.possibleCauses || 'Possible causes are unclear.',
      prevention: parsed.prevention || 'Maintain hygiene, hydration, and healthy routine.',
      whenToConsultDoctor: parsed.whenToConsultDoctor || 'Consult doctor if symptoms persist or worsen.',
      riskLevel: ['Low', 'Medium', 'High'].includes(parsed.riskLevel) ? parsed.riskLevel : inferRiskLevel(question)
    };
  } catch (_err) {
    return {
      symptoms: 'Symptoms are not clearly identified from the question.',
      possibleCauses: 'Possible causes are unclear.',
      prevention: 'Maintain hygiene, hydration, and healthy routine.',
      whenToConsultDoctor: 'Consult doctor if symptoms persist or worsen.',
      riskLevel: inferRiskLevel(question)
    };
  }
};

const getAIResponse = async (question) => {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey === 'replace_with_api_key') {
    return {
      symptoms: `Based on your query, possible symptoms linked are: ${question}.`,
      possibleCauses: 'Possible causes include viral infection, seasonal allergy, or mild inflammation.',
      prevention: 'Get enough rest, drink water, and avoid self-medication without guidance.',
      whenToConsultDoctor: 'Consult a doctor if symptoms are severe, sudden, or continue beyond 2-3 days.',
      riskLevel: inferRiskLevel(question)
    };
  }

  const prompt = `You are a public health awareness assistant. Return strict JSON only with keys: symptoms, possibleCauses, prevention, whenToConsultDoctor, riskLevel. Use riskLevel in [Low, Medium, High]. User question: ${question}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You generate safe health-awareness information in JSON format.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI API failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  return parseStructuredJson(content, question);
};

const buildResponse = async (question) => {
  try {
    const aiData = await getAIResponse(question);
    return {
      ...aiData,
      disclaimer: 'This information is for awareness only and not a substitute for professional medical advice.'
    };
  } catch (error) {
    logger.error('AI generation failed, serving fallback', { error: error.message });
    const fallback = await buildFallback(question);
    return {
      ...fallback,
      disclaimer: 'AI service was unavailable, so verified fallback information is shown.'
    };
  }
};

module.exports = { buildResponse };
