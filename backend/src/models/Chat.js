const mongoose = require('mongoose');

const hospitalRecommendationSchema = new mongoose.Schema(
  {
    name: String,
    city: String,
    specialization: String,
    rating: Number
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, index: true },
    question: { type: String, required: true },
    aiResponse: {
      symptoms: [{ type: String }],
      possibleCauses: [{ type: String }],
      prevention: [{ type: String }],
      whenToConsultDoctor: [{ type: String }],
      riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
      disclaimer: String,
      emergencyAlert: String,
      recommendedHospitals: [hospitalRecommendationSchema]
    },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', chatSchema);
