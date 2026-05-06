const mongoose = require('mongoose');

const symptomCheckSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, index: true },
    symptoms: [{ type: String, required: true }],
    followUpAnswers: {
      feverDays: { type: Number, default: 0 },
      breathingDifficulty: { type: Boolean, default: false },
      chestPain: { type: Boolean, default: false },
      fatigueLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' }
    },
    riskScore: { type: Number, required: true },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    possibleDisease: { type: String, required: true },
    emergency: { type: Boolean, default: false },
    recommendations: [{ type: String }],
    riskReasoning: { type: String, default: '' },
    specialistsSuggested: [{ type: String }],
    disclaimer: { type: String, default: 'This assessment is for health awareness only and is not a medical diagnosis. Consult a qualified healthcare professional for medical advice.' },
    profileSnapshot: {
      age: { type: Number, default: null },
      gender: { type: String, default: '' },
      city: { type: String, default: '' },
      medical_notes: { type: String, default: '' }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SymptomCheck', symptomCheckSchema);
