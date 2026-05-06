const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    userId:         { type: Number, required: true, index: true },
    messageId:      { type: String, required: true },
    conversationId: { type: String, default: '' },
    rating:         { type: Number, enum: [-1, 0, 1], required: true },
    reason:         { type: String, default: '' },
    comment:        { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at' } },
);

feedbackSchema.index({ userId: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
