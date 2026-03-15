require('dotenv').config();
const { pool, connectMongo, connectPostgres, closeConnections } = require('../config/db');
const { logger } = require('./logger');

const hospitals = [
  ['City Care Hospital', 'Bhubaneswar', 'Main Road, Unit 4', '9876543210', '20.2961', '85.8245', 4.4, 'General Physician'],
  ['Sunrise Medical Center', 'Bhubaneswar', 'Patia Square', '9876543211', '20.3534', '85.8195', 4.6, 'Pulmonologist'],
  ['Metro Health Point', 'Cuttack', 'Ring Road', '9876543212', '20.4625', '85.8830', 4.3, 'General Physician'],
  ['Green Life Clinic', 'Cuttack', 'College Square', '9876543213', '20.4749', '85.8772', 4.2, 'Pediatrician'],
  ['Lifeline Hospital', 'Pune', 'Baner Road', '9876543214', '18.5590', '73.7868', 4.8, 'Cardiologist'],
  ['Seva Hospital', 'Pune', 'Kothrud', '9876543215', '18.5074', '73.8077', 4.3, 'General Physician'],
  ['Hope General Hospital', 'Delhi', 'Rohini Sector 9', '9876543216', '28.7328', '77.1190', 4.5, 'Pulmonologist'],
  ['National Care Center', 'Delhi', 'Karol Bagh', '9876543217', '28.6518', '77.1909', 4.7, 'Cardiologist'],
  ['Wellness Hospital', 'Mumbai', 'Andheri East', '9876543218', '19.1136', '72.8697', 4.6, 'Neurologist'],
  ['Harbor Medical', 'Mumbai', 'Dadar West', '9876543219', '19.0178', '72.8478', 4.2, 'General Physician'],
  ['Noble Hospital', 'Bengaluru', 'Indiranagar', '9876543220', '12.9784', '77.6408', 4.7, 'Cardiologist'],
  ['People Care Hospital', 'Bengaluru', 'Whitefield', '9876543221', '12.9698', '77.7499', 4.4, 'Pulmonologist'],
  ['Sanjeevani Health', 'Hyderabad', 'Madhapur', '9876543222', '17.4504', '78.3908', 4.5, 'General Physician'],
  ['Trust Hospital', 'Hyderabad', 'Secunderabad', '9876543223', '17.4399', '78.4983', 4.4, 'Cardiologist'],
  ['Apollo Life Center', 'Chennai', 'T Nagar', '9876543224', '13.0418', '80.2341', 4.8, 'General Physician'],
  ['City Heal Hospital', 'Chennai', 'Velachery', '9876543225', '12.9756', '80.2212', 4.5, 'Pulmonologist'],
  ['Care Plus', 'Kolkata', 'Salt Lake', '9876543226', '22.5867', '88.4172', 4.6, 'Neurologist'],
  ['Unity Medical', 'Kolkata', 'Park Street', '9876543227', '22.5519', '88.3522', 4.3, 'General Physician'],
  ['Prime Hospital', 'Jaipur', 'Malviya Nagar', '9876543228', '26.8506', '75.8060', 4.5, 'Cardiologist'],
  ['Guardian Hospital', 'Jaipur', 'Vaishali Nagar', '9876543229', '26.9124', '75.7499', 4.1, 'General Physician']
];

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
  ['Dehydration', 'Dry mouth, fatigue, dark urine', 'Drink sufficient water daily', 'Oral fluids, emergency care if severe', 'Heat exposure, low intake']
];

const tips = [
  ['Hydration Reminder', 'Drink 2 to 3 liters of water daily unless a doctor advised otherwise.', 'Hydration'],
  ['Sleep Routine', 'Aim for at least 7 hours of sleep to support recovery and immunity.', 'Lifestyle'],
  ['Avoid Self Medication', 'Do not start antibiotics or strong medicines without medical advice.', 'Safety'],
  ['Daily Movement', 'Even 20 to 30 minutes of walking can improve energy and circulation.', 'Fitness']
];

(async () => {
  try {
    await connectPostgres();
    await connectMongo();

    for (const h of hospitals) {
      const [name, city, address, phone, latitude, longitude, rating, specialization] = h;
      const exists = await pool.query(
        'SELECT id FROM hospitals WHERE LOWER(name)=LOWER($1) AND LOWER(city)=LOWER($2) AND LOWER(address)=LOWER($3) LIMIT 1',
        [name, city, address]
      );

      if (exists.rowCount === 0) {
        await pool.query(
          'INSERT INTO hospitals (name, city, address, phone, latitude, longitude, rating, specialization) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [name, city, address, phone, latitude, longitude, rating, specialization]
        );
      }
    }

    for (const d of diseases) {
      await pool.query(
        'INSERT INTO diseases (disease_name, symptoms, prevention, treatment, risk_factors) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (disease_name) DO NOTHING',
        d
      );
    }

    for (const tip of tips) {
      const [title, description, category] = tip;
      const exists = await pool.query('SELECT id FROM health_tips WHERE LOWER(title)=LOWER($1) LIMIT 1', [title]);
      if (exists.rowCount === 0) {
        await pool.query(
          'INSERT INTO health_tips (title, description, category) VALUES ($1, $2, $3)',
          [title, description, category]
        );
      }
    }

    logger.info('Seed data inserted without duplicates');
    await closeConnections();
    process.exit(0);
  } catch (error) {
    logger.error('Seed failed', error);
    await closeConnections();
    process.exit(1);
  }
})();
