const jwt = require('jsonwebtoken');

module.exports = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next({ statusCode: 401, message: 'Unauthorized: token missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (_error) {
    return next({ statusCode: 401, message: 'Unauthorized: invalid token' });
  }
};
