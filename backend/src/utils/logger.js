const logger = {
  info: (message, data) => console.log(JSON.stringify({ level: 'info', message, data, at: new Date().toISOString() })),
  warn: (message, data) => console.warn(JSON.stringify({ level: 'warn', message, data, at: new Date().toISOString() })),
  error: (message, data) => console.error(JSON.stringify({ level: 'error', message, data, at: new Date().toISOString() }))
};

module.exports = { logger };
