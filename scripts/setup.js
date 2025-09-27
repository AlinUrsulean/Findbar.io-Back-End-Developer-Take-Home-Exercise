const { connectElasticsearch, getIndexStats } = require('../src/services/elasticsearch');
const { logger } = require('../src/utils/logger');

// Load environment variables
require('dotenv').config();

async function setup() {
  try {
    logger.info('🔧 Setting up Findbar Product Search API...');
    
    // Test Elasticsearch connection
    logger.info('🔍 Testing Elasticsearch connection...');
    const client = await connectElasticsearch();
    
    // Get index statistics
    try {
      const stats = await getIndexStats();
      logger.info('📊 Index statistics:', stats);
    } catch (error) {
      logger.info('📊 Index not yet created (this is normal for first-time setup)');
    }
    
    logger.info('✅ Setup completed successfully!');
    logger.info('🚀 You can now start the server with: npm start');
    logger.info('🌱 To seed sample data, run: npm run seed');
    
  } catch (error) {
    logger.error('❌ Setup failed:', error);
    logger.error('Please ensure Elasticsearch is running on:', process.env.ELASTICSEARCH_URL || 'http://localhost:9200');
    logger.error('You can start Elasticsearch with Docker: docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.11.0');
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setup();
}

module.exports = { setup };

