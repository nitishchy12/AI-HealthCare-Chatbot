const Joi = require('joi');

module.exports = (schema) => (req, _res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return next({ statusCode: 400, message: error.details.map((d) => d.message).join(', ') });
  }
  return next();
};

module.exports.schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/[A-Z]/).pattern(/[0-9]/).required()
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  chat: Joi.object({
    question: Joi.string().min(5).max(500).required()
  }),
  hospital: Joi.object({
    name: Joi.string().min(2).max(150).required(),
    city: Joi.string().min(2).max(80).required(),
    address: Joi.string().min(5).max(250).required(),
    phone: Joi.string().allow('', null),
    latitude: Joi.string().allow('', null),
    longitude: Joi.string().allow('', null)
  }),
  disease: Joi.object({
    disease_name: Joi.string().min(2).max(120).required(),
    symptoms: Joi.string().min(5).required(),
    prevention: Joi.string().min(5).required(),
    treatment: Joi.string().min(5).required(),
    risk_factors: Joi.string().min(5).required()
  })
};
