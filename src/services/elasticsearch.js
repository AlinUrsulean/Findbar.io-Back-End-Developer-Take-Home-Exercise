const { Client } = require('@elastic/elasticsearch');
const { logger } = require('../utils/logger');

let client;

/**
 * Initialize and connect to Elasticsearch
 */
async function connectElasticsearch() {
  try {
    client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      requestTimeout: 30000,
      pingTimeout: 3000,
      maxRetries: 3
    });

    // Test the connection
    await client.ping();
    logger.info('✅ Connected to Elasticsearch');

    // Ensure the products index exists
    await ensureProductsIndex();

    return client;
  } catch (error) {
    logger.error('❌ Failed to connect to Elasticsearch:', error.message);
    throw error;
  }
}

/**
 * Create the products index with proper mapping if it doesn't exist
 */
async function ensureProductsIndex() {
  const indexName = process.env.ELASTICSEARCH_INDEX || 'products';
  
  try {
    const indexExists = await client.indices.exists({ index: indexName });
    
    if (!indexExists) {
      await client.indices.create({
        index: indexName,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                custom_text_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'stop', 'stemmer']
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: { 
                type: 'text',
                analyzer: 'custom_text_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                  suggest: { type: 'completion' }
                }
              },
              description: { 
                type: 'text',
                analyzer: 'custom_text_analyzer'
              },
              category: { type: 'keyword' },
              price: { type: 'float' },
              brand: { type: 'keyword' },
              tags: { type: 'keyword' },
              created_at: { type: 'date' },
              updated_at: { type: 'date' }
            }
          }
        }
      });
      logger.info(`📋 Created index: ${indexName}`);
    } else {
      logger.info(`📋 Index already exists: ${indexName}`);
    }
  } catch (error) {
    logger.error('Failed to ensure products index:', error);
    throw error;
  }
}

/**
 * Index a single product
 */
async function indexProduct(product) {
  const indexName = process.env.ELASTICSEARCH_INDEX || 'products';
  
  try {
    const productWithTimestamp = {
      ...product,
      created_at: product.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const response = await client.index({
      index: indexName,
      id: product.id,
      body: productWithTimestamp,
      refresh: 'wait_for'
    });

    logger.debug(`Indexed product ${product.id}:`, response.result);
    return response;
  } catch (error) {
    logger.error(`Failed to index product ${product.id}:`, error);
    throw error;
  }
}

/**
 * Index multiple products in bulk
 */
async function indexProducts(products) {
  const indexName = process.env.ELASTICSEARCH_INDEX || 'products';
  
  try {
    const body = [];
    
    products.forEach(product => {
      body.push({ index: { _index: indexName, _id: product.id } });
      body.push({
        ...product,
        created_at: product.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    const response = await client.bulk({
      body,
      refresh: 'wait_for'
    });

    if (response.errors) {
      const erroredDocuments = [];
      response.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: body[i * 2],
            document: body[i * 2 + 1]
          });
        }
      });
      logger.warn('Some documents failed to index:', erroredDocuments);
    }

    const successful = response.items.filter(item => {
      const operation = Object.keys(item)[0];
      return item[operation].status >= 200 && item[operation].status < 300;
    }).length;

    logger.info(`📦 Indexed ${successful}/${products.length} products`);
    return response;
  } catch (error) {
    logger.error('Failed to bulk index products:', error);
    throw error;
  }
}

/**
 * Search products with full-text search and relevance scoring
 */
async function searchProducts(query, options = {}) {
  const indexName = process.env.ELASTICSEARCH_INDEX || 'products';
  const {
    size = 10,
    from = 0,
    fuzzy = false,
    category = null,
    minPrice = null,
    maxPrice = null
  } = options;

  try {
    const searchBody = {
      query: {
        bool: {
          must: [],
          filter: []
        }
      },
      size,
      from,
      sort: [
        { _score: { order: 'desc' } },
        { 'created_at': { order: 'desc' } }
      ],
      highlight: {
        fields: {
          title: {},
          description: {}
        }
      }
    };

    // Add text search query
    if (query && query.trim()) {
      const textQuery = {
        multi_match: {
          query: query.trim(),
          fields: ['title^3', 'description^1', 'brand^2', 'tags^1'],
          type: 'best_fields',
          fuzziness: fuzzy ? 'AUTO' : 0,
          prefix_length: 2,
          max_expansions: 50
        }
      };
      searchBody.query.bool.must.push(textQuery);
    } else {
      // If no query, match all documents
      searchBody.query.bool.must.push({ match_all: {} });
    }

    // Add filters
    if (category) {
      searchBody.query.bool.filter.push({ term: { category } });
    }

    if (minPrice !== null || maxPrice !== null) {
      const priceRange = {};
      if (minPrice !== null) priceRange.gte = minPrice;
      if (maxPrice !== null) priceRange.lte = maxPrice;
      searchBody.query.bool.filter.push({ range: { price: priceRange } });
    }

    const response = await client.search({
      index: indexName,
      body: searchBody
    });

    const results = response.hits.hits.map(hit => ({
      id: hit._id,
      score: hit._score,
      ...hit._source,
      highlights: hit.highlight
    }));

    return {
      products: results,
      total: response.hits.total.value,
      took: response.took,
      maxScore: response.hits.max_score
    };
  } catch (error) {
    logger.error('Search failed:', error);
    throw error;
  }
}

/**
 * Get product by ID
 */
async function getProduct(id) {
  const indexName = process.env.ELASTICSEARCH_INDEX || 'products';
  
  try {
    const response = await client.get({
      index: indexName,
      id
    });

    return {
      id: response._id,
      ...response._source
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }
    logger.error(`Failed to get product ${id}:`, error);
    throw error;
  }
}

/**
 * Get index statistics
 */
async function getIndexStats() {
  const indexName = process.env.ELASTICSEARCH_INDEX || 'products';
  
  try {
    const stats = await client.indices.stats({ index: indexName });
    const count = await client.count({ index: indexName });
    
    return {
      documentCount: count.count,
      indexSize: stats.indices[indexName]?.total?.store?.size_in_bytes || 0,
      indexName
    };
  } catch (error) {
    logger.error('Failed to get index stats:', error);
    throw error;
  }
}

/**
 * Delete a product
 */
async function deleteProduct(id) {
  const indexName = process.env.ELASTICSEARCH_INDEX || 'products';
  
  try {
    const response = await client.delete({
      index: indexName,
      id,
      refresh: 'wait_for'
    });

    logger.debug(`Deleted product ${id}:`, response.result);
    return response;
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }
    logger.error(`Failed to delete product ${id}:`, error);
    throw error;
  }
}

module.exports = {
  connectElasticsearch,
  indexProduct,
  indexProducts,
  searchProducts,
  getProduct,
  deleteProduct,
  getIndexStats,
  getClient: () => client
};

