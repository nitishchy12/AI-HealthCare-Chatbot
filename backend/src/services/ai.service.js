const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

const symptomKnowledge = [
  {
    key: 'fever',
    patterns: ['fever', 'temperature', 'chills'],
    symptoms: 'Fever, chills, weakness, dehydration risk',
    causes: ['viral infection', 'dengue', 'malaria', 'flu'],
    prevention: ['drink plenty of water', 'monitor body temperature', 'take rest', 'avoid exposure to mosquitoes'],
    whenToConsultDoctor: 'Consult a doctor if fever stays for more than 2 to 3 days, becomes very high, or is associated with rash or severe weakness.'
  },
  {
    key: 'cough',
    patterns: ['cough', 'coughing', 'sore throat', 'throat'],
    symptoms: 'Cough, throat irritation, mucus, sore throat',
    causes: ['common cold', 'throat irritation', 'seasonal allergy', 'mild respiratory infection'],
    prevention: ['drink warm fluids', 'avoid cold drinks', 'steam inhalation', 'rest your throat'],
    whenToConsultDoctor: 'Consult a doctor if cough lasts more than 1 week, produces blood, or is associated with breathing trouble.'
  },
  {
    key: 'headache',
    patterns: ['headache', 'head pain', 'migraine'],
    symptoms: 'Headache, heaviness in head, light sensitivity',
    causes: ['migraine', 'viral fever', 'stress', 'dehydration'],
    prevention: ['stay hydrated', 'sleep properly', 'reduce stress', 'avoid prolonged screen strain'],
    whenToConsultDoctor: 'Consult a doctor if headache is severe, frequent, associated with vomiting, or follows high fever.'
  },
  {
    key: 'chest pain',
    patterns: ['chest pain', 'tightness in chest', 'chest tightness'],
    symptoms: 'Chest pain, pressure, tightness, discomfort',
    causes: ['heart-related condition', 'muscle strain', 'acid reflux'],
    prevention: ['avoid physical strain', 'do not ignore persistent pain', 'seek urgent evaluation if pain is severe'],
    whenToConsultDoctor: 'Get immediate medical help if chest pain occurs with sweating, breathing difficulty, dizziness, or pain spreading to arm or jaw.'
  },
  {
    key: 'breathing difficulty',
    patterns: ['breathing difficulty', 'shortness of breath', 'breathlessness', 'difficulty breathing'],
    symptoms: 'Breathlessness, wheezing, chest discomfort',
    causes: ['asthma flare', 'respiratory infection', 'allergy', 'cardiopulmonary emergency'],
    prevention: ['avoid smoke and dust exposure', 'rest in an upright position', 'use prescribed inhaler if available'],
    whenToConsultDoctor: 'Seek medical help immediately if breathing difficulty is sudden, worsening, or happens with chest pain.'
  },
  {
    key: 'vomiting',
    patterns: ['vomiting', 'vomit', 'nausea'],
    symptoms: 'Vomiting, nausea, weakness, dehydration',
    causes: ['food poisoning', 'gastric irritation', 'viral infection'],
    prevention: ['take oral fluids slowly', 'eat bland food', 'avoid oily or contaminated food'],
    whenToConsultDoctor: 'Consult a doctor if vomiting is repeated, severe, or associated with blood, dizziness, or inability to keep fluids down.'
  },
  {
    key: 'stomach pain',
    patterns: ['stomach pain', 'abdominal pain', 'abdomen pain'],
    symptoms: 'Stomach pain, cramps, discomfort, acidity',
    causes: ['food-borne illness', 'acidity', 'indigestion', 'intestinal infection'],
    prevention: ['eat light meals', 'avoid spicy and oily food', 'drink safe water'],
    whenToConsultDoctor: 'Consult a doctor if abdominal pain is severe, localizes to one side, or is associated with vomiting or fever.'
  }
];

const buildGeneralFallback = () => ({
  symptoms: 'General health concern without a strong symptom match.',
  possibleCauses: 'Possible causes may include infection, allergy, dehydration, or mild inflammation.',
  prevention: 'Stay hydrated, get rest, maintain hygiene, and avoid self-medication without guidance.',
  whenToConsultDoctor: 'Consult a doctor if symptoms persist, worsen, or interfere with normal daily activity.',
  riskLevel: 'Low'
});

const inferRiskLevel = (text) => {
  const t = text.toLowerCase();
  if (/(chest pain|breathing difficulty|shortness of breath|unconscious|seizure|blood)/.test(t)) return 'High';
  if (/(fever|vomit|infection|persistent pain|migraine|abdominal pain)/.test(t)) return 'Medium';
  return 'Low';
};

const extractKnowledgeMatches = (question) => {
  const normalized = question.toLowerCase();
  return symptomKnowledge.filter((item) => item.patterns.some((pattern) => normalized.includes(pattern)));
};

const fetchDiseaseMatches = async (question, knowledgeMatches) => {
  const normalized = question.toLowerCase();
  const keywords = [
    normalized,
    ...knowledgeMatches.flatMap((item) => item.patterns)
  ].filter(Boolean);

  if (keywords.length === 0) return [];

  const clauses = [];
  const values = [];

  keywords.forEach((keyword, index) => {
    const valueIndex = index + 1;
    clauses.push(
      `(LOWER(disease_name) LIKE '%' || $${valueIndex} || '%' OR LOWER(symptoms) LIKE '%' || $${valueIndex} || '%' OR LOWER(risk_factors) LIKE '%' || $${valueIndex} || '%')`
    );
    values.push(keyword);
  });

  const query = `
    SELECT disease_name, symptoms, prevention, treatment, risk_factors
    FROM diseases
    WHERE ${clauses.join(' OR ')}
    ORDER BY disease_name ASC
    LIMIT 4
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const uniqueList = (items) => [...new Set(items.filter(Boolean))];

const buildRuleBasedResponse = async (question) => {
  const knowledgeMatches = extractKnowledgeMatches(question);
  const diseaseMatches = await fetchDiseaseMatches(question, knowledgeMatches);

  if (knowledgeMatches.length === 0 && diseaseMatches.length === 0) {
    return buildGeneralFallback();
  }

  const symptomText = uniqueList([
    ...knowledgeMatches.map((item) => item.symptoms),
    ...diseaseMatches.map((item) => item.symptoms)
  ]).slice(0, 4).join('; ');

  const possibleCauses = uniqueList([
    ...knowledgeMatches.flatMap((item) => item.causes),
    ...diseaseMatches.map((item) => item.disease_name),
    ...diseaseMatches.map((item) => item.risk_factors)
  ]).slice(0, 6).join(', ');

  const prevention = uniqueList([
    ...knowledgeMatches.flatMap((item) => item.prevention),
    ...diseaseMatches.map((item) => item.prevention)
  ]).slice(0, 6).join(', ');

  const whenToConsultDoctor = uniqueList([
    ...knowledgeMatches.map((item) => item.whenToConsultDoctor),
    ...diseaseMatches.map((item) => item.treatment)
  ]).slice(0, 3).join(' ');

  return {
    symptoms: symptomText || buildGeneralFallback().symptoms,
    possibleCauses: possibleCauses || buildGeneralFallback().possibleCauses,
    prevention: prevention || buildGeneralFallback().prevention,
    whenToConsultDoctor: whenToConsultDoctor || buildGeneralFallback().whenToConsultDoctor,
    riskLevel: inferRiskLevel(question)
  };
};

const parseStructuredJson = async (content, question) => {
  try {
    const parsed = JSON.parse(content);
    const fallback = await buildRuleBasedResponse(question);
    return {
      symptoms: parsed.symptoms || fallback.symptoms,
      possibleCauses: parsed.possibleCauses || fallback.possibleCauses,
      prevention: parsed.prevention || fallback.prevention,
      whenToConsultDoctor: parsed.whenToConsultDoctor || fallback.whenToConsultDoctor,
      riskLevel: ['Low', 'Medium', 'High'].includes(parsed.riskLevel) ? parsed.riskLevel : inferRiskLevel(question)
    };
  } catch (_err) {
    return buildRuleBasedResponse(question);
  }
};

const getAIResponse = async (question) => {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey === 'replace_with_api_key') {
    return buildRuleBasedResponse(question);
  }

  const prompt = `You are a public health awareness assistant. Return strict JSON only with keys: symptoms, possibleCauses, prevention, whenToConsultDoctor, riskLevel. Use medical-context-aware causes and prevention based on the user's symptoms. Use riskLevel in [Low, Medium, High]. User question: ${question}`;

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
    const fallback = await buildRuleBasedResponse(question);
    return {
      ...fallback,
      disclaimer: 'AI service was unavailable, so verified fallback information is shown.'
    };
  }
};

module.exports = { buildResponse };
