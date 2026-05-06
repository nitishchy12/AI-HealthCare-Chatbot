const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId:          { type: Number,  required: true, index: true },
    title:           { type: String,  default: 'New conversation', maxlength: 120 },
    language:        { type: String,  enum: ['en', 'hi'], default: 'en' },
    is_deleted:      { type: Boolean, default: false },
    message_count:   { type: Number,  default: 0 },
    total_tokens:    { type: Number,  default: 0 },
    summary:         { type: String,  default: '' },  // populated when context overflows
    last_message_at: { type: Date,    default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

conversationSchema.index({ userId: 1, is_deleted: 1, last_message_at: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
