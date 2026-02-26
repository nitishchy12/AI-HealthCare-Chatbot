const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, index: true },
    question: { type: String, required: true },
    aiResponse: {
      symptoms: String,
      possibleCauses: String,
      prevention: String,
      whenToConsultDoctor: String,
      riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
      disclaimer: String
    },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', chatSchema);
