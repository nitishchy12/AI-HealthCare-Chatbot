require('dotenv').config();
const { pool, connectMongo, connectPostgres, closeConnections } = require('../config/db');
const { logger } = require('./logger');
const hospitalDataset = require('../data/hospitals.json');

const diseases = [
  ['Dengue', 'High fever, headache, muscle pain, rash', 'Use mosquito nets and avoid water stagnation', 'Doctor consultation and hydration', 'Mosquito exposure, weak immunity'],
  ['Malaria', 'Fever with chills, sweating, fatigue', 'Use repellents and clean surroundings', 'Antimalarial medicines as prescribed', 'Mosquito bites in endemic areas'],
  ['Typhoid', 'Prolonged fever, stomach pain, weakness', 'Drink clean water and maintain hygiene', 'Antibiotics under medical supervision', 'Contaminated food and water'],
  ['Influenza', 'Fever, cough, sore throat, body ache', 'Hand hygiene and annual flu vaccination', 'Rest, fluids, and doctor advice', 'Seasonal spread, close contact'],
  ['Diabetes', 'Frequent urination, thirst, fatigue', 'Balanced diet and regular exercise', 'Medication, sugar monitoring', 'Family history, obesity'],
  ['Hypertension', 'Headache, dizziness, often no symptoms', 'Low salt diet and stress control', 'BP monitoring and medicines', 'Stress, obesity, genetics'],
  ['Asthma', 'Wheezing, breathlessness, chest tightness', 'Avoid triggers like dust and smoke', 'Inhalers and doctor follow-up', 'Allergies, pollution'],
  ['Tuberculosis', 'Long cough, weight loss, night sweats', 'Early diagnosis and mask usage', 'Complete anti-TB treatment', 'Close contact with infected person'],
  ['Food Poisoning', 'Nausea, vomiting, diarrhea, cramps', 'Eat hygienic fresh food', 'ORS, hydration, medical help if severe', 'Contaminated food'],
  ['Dehydration', 'Dry mouth, fatigue, dark urine', 'Drink sufficient water daily', 'Oral fluids, emergency care if severe', 'Heat exposure, low intake'],
  ['Viral Fever', 'Mild fever, body ache, fatigue', 'Rest, fluids, and hygiene', 'Symptom monitoring and doctor advice if prolonged', 'Seasonal infection exposure'],
  ['Migraine', 'Severe headache, nausea, light sensitivity', 'Manage stress and avoid triggers', 'Pain relief under medical advice', 'Sleep issues, stress, family history'],
  ['Anemia', 'Weakness, pale skin, dizziness', 'Iron-rich diet and regular checkups', 'Medical evaluation and supplements if advised', 'Poor diet, blood loss'],
  ['GERD', 'Acidity, chest burning, sour taste', 'Avoid oily foods and late-night meals', 'Doctor guidance and lifestyle changes', 'Spicy food, obesity'],
  ['Common Cold', 'Sneezing, cough, runny nose', 'Hand washing and rest', 'Home care and doctor visit if worsening', 'Viral exposure'],
];

const tips = [
  ['Hydration Reminder', 'Drink 2 to 3 liters of water daily unless a doctor advised otherwise.', 'Hydration'],
  ['Sleep Routine', 'Aim for at least 7 hours of sleep to support recovery and immunity.', 'Lifestyle'],
  ['Avoid Self Medication', 'Do not start antibiotics or strong medicines without medical advice.', 'Safety'],
  ['Daily Movement', 'Even 20 to 30 minutes of walking can improve energy and circulation.', 'Fitness'],
  ['Balanced Meals', 'Include protein, fruits, and vegetables in your daily meals for better recovery.', 'Nutrition'],
  ['Wash Hands Often', 'Wash hands with soap for at least 20 seconds before meals and after public contact.', 'Hygiene'],
  ['Use ORS Early', 'If diarrhea or vomiting starts, begin oral rehydration early and monitor fluid intake.', 'Safety'],
  ['Protect Your Sleep', 'Avoid screens before bedtime and keep a fixed sleep schedule.', 'Lifestyle'],
  ['Seasonal Protection', 'Use mosquito repellent and remove stagnant water during monsoon.', 'Prevention'],
  ['Monitor Fever', 'If fever lasts more than 2 to 3 days, consult a doctor instead of waiting too long.', 'Awareness'],
  ['Food Safety', 'Eat freshly cooked food and avoid uncovered street food in hot weather.', 'Nutrition'],
  ['Breathing Check', 'Do not ignore wheezing or shortness of breath, especially if it feels new.', 'Respiratory'],
  ['Stress Breaks', 'Take short breaks, stretch, and breathe deeply during long work sessions.', 'Mental Health'],
  ['Stay Vaccinated', 'Follow recommended vaccines and booster schedules as advised by health authorities.', 'Prevention'],
  ['Limit Sugary Drinks', 'Reduce high-sugar beverages and choose water or unsweetened drinks more often.', 'Nutrition'],
  ['Heart Health Walk', 'A brisk walk most days of the week helps circulation and heart health.', 'Fitness'],
  ['Check Blood Pressure', 'Adults should monitor blood pressure regularly if they have stress or family history.', 'Awareness'],
  ['Screen Time Care', 'Rest your eyes and maintain good posture if you use screens for many hours.', 'Lifestyle'],
  ['Clean Water First', 'Prefer filtered or boiled water when safe drinking water is uncertain.', 'Safety'],
  ['Recovery Rest', 'During illness, sleep and hydration matter more than heavy activity.', 'Recovery'],
];

async function seedHospitals() {
  let inserted = 0;
  let skipped = 0;

  for (const h of hospitalDataset) {
    const exists = await pool.query(
      'SELECT id FROM hospitals WHERE LOWER(name)=LOWER($1) AND LOWER(city)=LOWER($2) AND LOWER(address)=LOWER($3) LIMIT 1',
      [h.name, h.city, h.address],
    );

    if (exists.rowCount === 0) {
      const specialtiesArray = Array.isArray(h.specialties) && h.specialties.length
        ? h.specialties
        : [h.specialization || 'General Physician'];

      await pool.query(
        `INSERT INTO hospitals
           (name, city, address, phone, latitude, longitude, rating,
            specialization, emergency_24h, specialties)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          h.name,
          h.city,
          h.address,
          h.phone || '',
          String(h.latitude),
          String(h.longitude),
          h.rating || 4.2,
          h.specialization || 'General Physician',
          Boolean(h.emergency_24h),
          specialtiesArray,
        ],
      );
      inserted++;
    } else {
      skipped++;
    }
  }

  logger.info(`Hospitals: ${inserted} inserted, ${skipped} already existed`);
}

async function seedDiseases() {
  let inserted = 0;
  for (const d of diseases) {
    const result = await pool.query(
      'INSERT INTO diseases (disease_name, symptoms, prevention, treatment, risk_factors) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (disease_name) DO NOTHING',
      d,
    );
    inserted += result.rowCount;
  }
  logger.info(`Diseases: ${inserted} inserted`);
}

async function seedTips() {
  let inserted = 0;
  for (const [title, description, category] of tips) {
    const exists = await pool.query(
      'SELECT id FROM health_tips WHERE LOWER(title)=LOWER($1) LIMIT 1',
      [title],
    );
    if (exists.rowCount === 0) {
      await pool.query(
        'INSERT INTO health_tips (title, description, category) VALUES ($1, $2, $3)',
        [title, description, category],
      );
      inserted++;
    }
  }
  logger.info(`Health tips: ${inserted} inserted`);
}

(async () => {
  try {
    await connectPostgres();
    await connectMongo();

    await seedHospitals();
    await seedDiseases();
    await seedTips();

    logger.info('Seed completed successfully');
    await closeConnections();
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed', error);
    await closeConnections();
    process.exit(1);
  }
})();
