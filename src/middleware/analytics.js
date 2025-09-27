const { logger } = require('../utils/logger');

// In-memory analytics store (in production, this would be a proper database)
const analytics = {
  queries: new Map(), // query -> { count, totalResponseTime, lastQueried }
  totalSearches: 0,
  averageResponseTime: 0
};

function analyticsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Track the response
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Track search queries
    if (req.path === '/api/search' && req.method === 'GET') {
      const query = req.query.q;
      if (query) {
        trackQuery(query, responseTime);
      }
    }
    
    // Log request details
    logger.debug(`${req.method} ${req.path}`, {
      responseTime: `${responseTime}ms`,
      statusCode: res.statusCode,
      query: req.query,
      ip: req.ip
    });
    
    return originalSend.call(this, data);
  };
  
  next();
}

function trackQuery(query, responseTime) {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (analytics.queries.has(normalizedQuery)) {
    const existing = analytics.queries.get(normalizedQuery);
    existing.count += 1;
    existing.totalResponseTime += responseTime;
    existing.averageResponseTime = existing.totalResponseTime / existing.count;
    existing.lastQueried = new Date().toISOString();
  } else {
    analytics.queries.set(normalizedQuery, {
      count: 1,
      totalResponseTime: responseTime,
      averageResponseTime: responseTime,
      lastQueried: new Date().toISOString()
    });
  }
  
  analytics.totalSearches += 1;
  
  // Update global average (simple running average)
  const totalTime = Array.from(analytics.queries.values())
    .reduce((sum, q) => sum + q.totalResponseTime, 0);
  analytics.averageResponseTime = totalTime / analytics.totalSearches;
}

function getAnalytics() {
  const topQueries = Array.from(analytics.queries.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([query, stats]) => ({
      query,
      ...stats
    }));
  
  return {
    totalSearches: analytics.totalSearches,
    averageResponseTime: Math.round(analytics.averageResponseTime),
    uniqueQueries: analytics.queries.size,
    topQueries
  };
}

function clearAnalytics() {
  analytics.queries.clear();
  analytics.totalSearches = 0;
  analytics.averageResponseTime = 0;
}

module.exports = analyticsMiddleware;
module.exports.getAnalytics = getAnalytics;
module.exports.clearAnalytics = clearAnalytics;

