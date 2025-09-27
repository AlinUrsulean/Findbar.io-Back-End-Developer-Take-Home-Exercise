const express = require('express');
const { getAnalytics, clearAnalytics } = require('../middleware/analytics');
const searchCache = require('../services/cache');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/analytics
 * Get search analytics and performance metrics
 */
router.get('/analytics', (req, res) => {
  try {
    const analytics = getAnalytics();
    const cacheStats = searchCache.getStats();

    res.json({
      searchAnalytics: analytics,
      cachePerformance: cacheStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Analytics endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics',
      message: error.message
    });
  }
});

/**
 * POST /api/analytics/clear
 * Clear all analytics data
 */
router.post('/analytics/clear', (req, res) => {
  try {
    clearAnalytics();
    searchCache.clear();
    
    logger.info('Analytics and cache cleared');

    res.json({
      message: 'Analytics and cache cleared successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Clear analytics error:', error);
    res.status(500).json({
      error: 'Failed to clear analytics',
      message: error.message
    });
  }
});

/**
 * GET /api/analytics/cache
 * Get detailed cache information
 */
router.get('/analytics/cache', (req, res) => {
  try {
    const stats = searchCache.getStats();
    const keys = searchCache.getKeys();

    res.json({
      statistics: stats,
      cachedQueries: keys,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Cache analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve cache analytics',
      message: error.message
    });
  }
});

module.exports = router;

