module.exports = (req, _res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next({ statusCode: 403, message: 'Forbidden: admin access required' });
  }
  return next();
};
