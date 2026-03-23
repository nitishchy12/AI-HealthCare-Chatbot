const Joi = require('joi');

module.exports = (schema) => (req, _res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return next({
      statusCode: 400,
      message: 'Validation error',
      error: error.details.map((d) => d.message).join(', ')
    });
  }
  return next();
};

module.exports.schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/[A-Z]/).pattern(/[0-9]/).required(),
    age: Joi.number().min(1).max(120).allow(null),
    gender: Joi.string().valid('Male', 'Female', 'Other', 'Prefer not to say').allow('', null),
    medical_notes: Joi.string().max(500).allow('', null),
    city: Joi.string().max(80).allow('', null)
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  chat: Joi.object({
    question: Joi.string().min(5).max(500).required(),
    language: Joi.string().valid('en', 'hi').optional()
  }),
  hospital: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    city: Joi.string().min(2).max(80).required(),
    address: Joi.string().min(5).max(250).required(),
    phone: Joi.string().allow('', null),
    latitude: Joi.string().allow('', null),
    longitude: Joi.string().allow('', null),
    rating: Joi.number().min(1).max(5).allow(null),
    specialization: Joi.string().min(2).max(100).allow('', null)
  }),
  disease: Joi.object({
    disease_name: Joi.string().min(2).max(120).required(),
    symptoms: Joi.string().min(5).required(),
    prevention: Joi.string().min(5).required(),
    treatment: Joi.string().min(5).required(),
    risk_factors: Joi.string().min(5).required()
  }),
  symptomCheck: Joi.object({
    symptoms: Joi.array().items(Joi.string().min(2)).min(1).required(),
    feverDays: Joi.number().min(0).max(30).required(),
    breathingDifficulty: Joi.boolean().required(),
    chestPain: Joi.boolean().required(),
    fatigueLevel: Joi.string().valid('Low', 'Medium', 'High').required()
  }),
  tip: Joi.object({
    title: Joi.string().min(3).max(160).required(),
    description: Joi.string().min(5).max(500).required(),
    category: Joi.string().min(2).max(80).required()
  }),
  profile: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    age: Joi.number().min(1).max(120).allow(null),
    gender: Joi.string().valid('Male', 'Female', 'Other', 'Prefer not to say').allow('', null),
    medical_notes: Joi.string().max(500).allow('', null),
    city: Joi.string().max(80).allow('', null)
  })
};
