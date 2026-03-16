const Chat = require('../models/Chat');
const SymptomCheck = require('../models/SymptomCheck');
const { pool } = require('../config/db');

const getNotifications = async (req, res, next) => {
  try {
    const [profileResult, latestChat, latestCheck] = await Promise.all([
      pool.query('SELECT city FROM users WHERE id = $1', [req.user.id]),
      Chat.findOne({ userId: req.user.id }).sort({ createdAt: -1 }),
      SymptomCheck.findOne({ userId: req.user.id }).sort({ createdAt: -1 })
    ]);

    const notifications = [];
    const city = profileResult.rows[0]?.city;

    if (city) {
      notifications.push({
        type: 'Awareness',
        message: `Public health advisory: monitor seasonal fever and mosquito-borne symptoms in ${city}.`
      });
    }

    if (latestCheck?.riskLevel === 'Medium' || latestCheck?.riskLevel === 'High') {
      notifications.push({
        type: 'Follow-up',
        message: `Your last symptom check risk level was ${latestCheck.riskLevel}. Monitor symptoms closely.`
      });
    } else if (latestChat?.riskLevel === 'Medium' || latestChat?.riskLevel === 'High') {
      notifications.push({
        type: 'Follow-up',
        message: `Your latest chatbot assessment showed ${latestChat.riskLevel} risk. Consider medical advice if symptoms continue.`
      });
    }

    if (notifications.length === 0) {
      notifications.push({
        type: 'Reminder',
        message: 'No urgent alerts right now. Keep your profile and health history updated for better guidance.'
      });
    }

    return res.status(200).json({ success: true, message: 'Notifications fetched', data: notifications });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getNotifications };
