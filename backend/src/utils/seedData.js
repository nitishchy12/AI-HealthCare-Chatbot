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
  ['Guardian Hospital', 'Jaipur', 'Vaishali Nagar', '9876543229', '26.9124', '75.7499', 4.1, 'General Physician'],
  ['Skyline Multispeciality', 'Ahmedabad', 'SG Highway', '9876543230', '23.0434', '72.5293', 4.7, 'Cardiologist'],
  ['Riverfront Care', 'Ahmedabad', 'Ashram Road', '9876543231', '23.0258', '72.5714', 4.4, 'General Physician'],
  ['Coastal Health Center', 'Visakhapatnam', 'Beach Road', '9876543232', '17.6868', '83.2185', 4.6, 'Pulmonologist'],
  ['Harbor City Clinic', 'Visakhapatnam', 'MVP Colony', '9876543233', '17.7420', '83.3362', 4.2, 'Pediatrician'],
  ['Lotus Wellness Hospital', 'Lucknow', 'Gomti Nagar', '9876543234', '26.8467', '80.9462', 4.5, 'Neurologist'],
  ['North Care Hospital', 'Lucknow', 'Hazratganj', '9876543235', '26.8500', '80.9499', 4.3, 'General Physician'],
  ['Blue Oak Medical', 'Indore', 'Vijay Nagar', '9876543236', '22.7533', '75.8937', 4.4, 'Cardiologist'],
  ['Sarthak Health Hub', 'Indore', 'Palasia', '9876543237', '22.7196', '75.8577', 4.1, 'General Physician'],
  ['Meadow Hospital', 'Nagpur', 'Dharampeth', '9876543238', '21.1458', '79.0882', 4.6, 'Pulmonologist'],
  ['Orange City Medical', 'Nagpur', 'Sitabuldi', '9876543239', '21.1466', '79.0888', 4.2, 'General Physician']
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
  ['Dehydration', 'Dry mouth, fatigue, dark urine', 'Drink sufficient water daily', 'Oral fluids, emergency care if severe', 'Heat exposure, low intake'],
  ['Viral Fever', 'Mild fever, body ache, fatigue', 'Rest, fluids, and hygiene', 'Symptom monitoring and doctor advice if prolonged', 'Seasonal infection exposure'],
  ['Migraine', 'Severe headache, nausea, light sensitivity', 'Manage stress and avoid triggers', 'Pain relief under medical advice', 'Sleep issues, stress, family history'],
  ['Anemia', 'Weakness, pale skin, dizziness', 'Iron-rich diet and regular checkups', 'Medical evaluation and supplements if advised', 'Poor diet, blood loss'],
  ['GERD', 'Acidity, chest burning, sour taste', 'Avoid oily foods and late-night meals', 'Doctor guidance and lifestyle changes', 'Spicy food, obesity'],
  ['Common Cold', 'Sneezing, cough, runny nose', 'Hand washing and rest', 'Home care and doctor visit if worsening', 'Viral exposure']
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
  ['Recovery Rest', 'During illness, sleep and hydration matter more than heavy activity.', 'Recovery']
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
