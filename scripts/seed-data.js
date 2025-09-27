const { faker } = require('@faker-js/faker');
const { connectElasticsearch, indexProducts } = require('../src/services/elasticsearch');
const { logger } = require('../src/utils/logger');

// Load environment variables
require('dotenv').config();

const BATCH_SIZE = 100;
const TOTAL_PRODUCTS = 1500;

// Product categories with realistic subcategories
const CATEGORIES = {
  electronics: ['smartphones', 'laptops', 'tablets', 'headphones', 'cameras', 'monitors', 'keyboards', 'mice'],
  clothing: ['shirts', 'pants', 'dresses', 'shoes', 'jackets', 'sweaters', 'accessories', 'bags'],
  home: ['furniture', 'decor', 'kitchen', 'bathroom', 'lighting', 'storage', 'textiles', 'appliances'],
  books: ['fiction', 'non-fiction', 'technical', 'educational', 'children', 'comics', 'biographies', 'self-help'],
  sports: ['fitness', 'outdoor', 'team-sports', 'water-sports', 'winter-sports', 'equipment', 'apparel', 'nutrition'],
  beauty: ['skincare', 'makeup', 'haircare', 'fragrance', 'tools', 'men-grooming', 'organic', 'anti-aging'],
  toys: ['educational', 'action-figures', 'dolls', 'puzzles', 'board-games', 'outdoor-toys', 'electronics', 'craft'],
  automotive: ['parts', 'accessories', 'tools', 'oils', 'tires', 'electronics', 'cleaning', 'safety']
};

// Popular brands by category
const BRANDS = {
  electronics: ['Apple', 'Samsung', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Logitech', 'Canon'],
  clothing: ['Nike', 'Adidas', 'H&M', 'Zara', 'Levi\'s', 'Gap', 'Uniqlo', 'Tommy Hilfiger', 'Calvin Klein', 'Puma'],
  home: ['IKEA', 'West Elm', 'Pottery Barn', 'Crate & Barrel', 'Target', 'HomeDepot', 'Wayfair', 'CB2', 'Williams Sonoma', 'KitchenAid'],
  books: ['Penguin', 'Random House', 'HarperCollins', 'Simon & Schuster', 'Macmillan', 'Scholastic', 'Oxford', 'Cambridge', 'McGraw-Hill', 'Pearson'],
  sports: ['Nike', 'Adidas', 'Under Armour', 'Puma', 'Reebok', 'New Balance', 'The North Face', 'Patagonia', 'Columbia', 'Wilson'],
  beauty: ['L\'Oréal', 'Maybelline', 'MAC', 'Clinique', 'Estée Lauder', 'Revlon', 'Neutrogena', 'Olay', 'Dove', 'Nivea'],
  toys: ['LEGO', 'Mattel', 'Hasbro', 'Fisher-Price', 'Playmobil', 'Melissa & Doug', 'VTech', 'Little Tikes', 'Ravensburger', 'Crayola'],
  automotive: ['Bosch', 'Michelin', 'Castrol', 'Mobil 1', 'ACDelco', 'Denso', 'NGK', 'Fram', 'K&N', 'Meguiar\'s']
};

// Generate descriptive adjectives for products
const ADJECTIVES = [
  'premium', 'professional', 'advanced', 'lightweight', 'durable', 'compact', 'ergonomic', 'innovative',
  'stylish', 'modern', 'classic', 'vintage', 'eco-friendly', 'wireless', 'waterproof', 'portable',
  'high-performance', 'energy-efficient', 'user-friendly', 'versatile', 'reliable', 'affordable',
  'luxury', 'industrial', 'commercial', 'residential', 'outdoor', 'indoor', 'smart', 'digital'
];

function generateProduct(id) {
  // Randomly select a category
  const categoryKeys = Object.keys(CATEGORIES);
  const mainCategory = faker.helpers.arrayElement(categoryKeys);
  const subCategory = faker.helpers.arrayElement(CATEGORIES[mainCategory]);
  
  // Select brand from category or random
  const brandPool = BRANDS[mainCategory] || ['Generic', 'Unknown', 'Store Brand'];
  const brand = faker.helpers.arrayElement(brandPool);
  
  // Generate product name with adjectives
  const adjective = faker.helpers.arrayElement(ADJECTIVES);
  const productType = subCategory.charAt(0).toUpperCase() + subCategory.slice(1).replace('-', ' ');
  
  const title = `${brand} ${adjective} ${productType} ${faker.commerce.productName()}`;
  
  // Generate detailed description
  const features = [];
  for (let i = 0; i < faker.number.int({ min: 2, max: 5 }); i++) {
    features.push(faker.commerce.productDescription());
  }
  
  const description = `${faker.commerce.productDescription()} Features include: ${features.join(', ')}.`;
  
  // Generate realistic price based on category
  let priceRange = { min: 10, max: 100 };
  switch (mainCategory) {
    case 'electronics':
      priceRange = { min: 50, max: 2000 };
      break;
    case 'clothing':
      priceRange = { min: 15, max: 300 };
      break;
    case 'home':
      priceRange = { min: 25, max: 800 };
      break;
    case 'books':
      priceRange = { min: 8, max: 60 };
      break;
    case 'sports':
      priceRange = { min: 20, max: 500 };
      break;
    case 'beauty':
      priceRange = { min: 5, max: 150 };
      break;
    case 'toys':
      priceRange = { min: 10, max: 200 };
      break;
    case 'automotive':
      priceRange = { min: 15, max: 400 };
      break;
  }
  
  const price = parseFloat(faker.commerce.price(priceRange.min, priceRange.max));
  
  // Generate tags
  const tags = [
    mainCategory,
    subCategory,
    brand.toLowerCase(),
    adjective,
    faker.helpers.arrayElement(['bestseller', 'new-arrival', 'limited-edition', 'eco-friendly', 'premium'])
  ];
  
  return {
    id: id.toString(),
    title: title,
    description: description,
    category: mainCategory,
    subcategory: subCategory,
    price: price,
    brand: brand,
    tags: tags,
    sku: faker.string.alphanumeric(8).toUpperCase(),
    stock: faker.number.int({ min: 0, max: 1000 }),
    rating: parseFloat(faker.number.float({ min: 1, max: 5, precision: 0.1 }).toFixed(1)),
    reviewCount: faker.number.int({ min: 0, max: 5000 }),
    availability: faker.helpers.arrayElement(['in-stock', 'out-of-stock', 'pre-order', 'limited']),
    created_at: faker.date.between({ from: '2023-01-01', to: new Date() }).toISOString()
  };
}

async function seedData() {
  try {
    logger.info('🌱 Starting data seeding process...');
    
    // Connect to Elasticsearch
    await connectElasticsearch();
    
    logger.info(`📦 Generating ${TOTAL_PRODUCTS} products...`);
    
    // Generate and index products in batches
    for (let i = 0; i < TOTAL_PRODUCTS; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - i);
      const products = [];
      
      for (let j = 0; j < batchSize; j++) {
        products.push(generateProduct(i + j + 1));
      }
      
      logger.info(`📥 Indexing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE)} (${products.length} products)...`);
      
      await indexProducts(products);
      
      // Small delay to prevent overwhelming Elasticsearch
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info('✅ Data seeding completed successfully!');
    logger.info(`📊 Total products indexed: ${TOTAL_PRODUCTS}`);
    logger.info('🔍 You can now test the search API:');
    logger.info('   GET /api/search?q=laptop');
    logger.info('   GET /api/search?q=nike&category=clothing');
    logger.info('   GET /api/search?q=smartphone&fuzzy=true');
    
  } catch (error) {
    logger.error('❌ Data seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the seeding process
if (require.main === module) {
  seedData();
}

module.exports = { generateProduct, seedData };

