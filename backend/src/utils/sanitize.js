const sanitizeHtml = require('sanitize-html');

const clean = (value) => sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();

module.exports = {
  clean
};
