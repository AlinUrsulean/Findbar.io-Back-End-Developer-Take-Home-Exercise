const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { logger } = require('./utils/logger');
const { connectElasticsearch } = require('./services/elasticsearch');
const { errorHandler } = require('./middleware/errorHandler');
const analyticsMiddleware = require('./middleware/analytics');

// Import routes
const searchRoutes = require('./routes/search');
const productRoutes = require('./routes/products');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Analytics middleware
app.use(analyticsMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    elasticsearch: req.app.locals.elasticsearch ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api', searchRoutes);
app.use('/api', productRoutes);
app.use('/api', analyticsRoutes);

// Catch-all for undefined routes
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: 'Please check the API documentation for available endpoints'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize Elasticsearch connection and start server
async function startServer() {
  try {
    // Connect to Elasticsearch
    const client = await connectElasticsearch();
    app.locals.elasticsearch = client;
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`🚀 Findbar Product Search API running on port ${PORT}`);
      logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🔍 Search endpoint: http://localhost:${PORT}/api/search?q=<query>`);
      logger.info(`📦 Products endpoint: http://localhost:${PORT}/api/products`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;

