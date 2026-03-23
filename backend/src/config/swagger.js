const swaggerJsdoc = require('swagger-jsdoc');

module.exports = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI-Driven Public Health Chatbot API',
      version: '1.0.0',
      description: 'API documentation for auth, chat, history, reports, profile, hospitals, and admin operations.'
    },
    servers: [
      { url: 'http://localhost:5000/api' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    paths: {
      '/health': {
        get: { summary: 'Service health check', responses: { '200': { description: 'Health status' } } }
      },
      '/auth/register': {
        post: { summary: 'Register user', responses: { '201': { description: 'User registered' } } }
      },
      '/auth/login': {
        post: { summary: 'Login user', responses: { '200': { description: 'Login successful' } } }
      },
      '/chat': {
        post: {
          summary: 'Create health assessment',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Assessment created' } }
        }
      },
      '/chat/history': {
        get: {
          summary: 'Get chat history',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'History fetched' } }
        },
        delete: {
          summary: 'Clear chat history',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'History cleared' } }
        }
      },
      '/reports': {
        get: {
          summary: 'Get analytics report',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Report generated' } }
        }
      },
      '/profile': {
        get: {
          summary: 'Get user profile',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Profile fetched' } }
        },
        put: {
          summary: 'Update user profile',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Profile updated' } }
        }
      }
    }
  },
  apis: []
});
