require('dotenv').config();
const { MongoClient } = require('mongodb');
const { faker } = require('@faker-js/faker');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'ecommerce';

const CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports',
  'Toys', 'Beauty', 'Automotive', 'Food & Grocery', 'Office Supplies',
];

const STATUSES = ['pending', 'processing', 'shipped', 'delivered'];

function generateDescription() {
  // ~500 chars of realistic product description
  return faker.commerce.productDescription() + ' ' +
    faker.lorem.sentences(4) + ' ' +
    faker.lorem.sentence();
}

async function insertInBatches(collection, generateFn, total, batchSize = 500, label) {
  let inserted = 0;
  const results = [];

  while (inserted < total) {
    const batch = [];
    const count = Math.min(batchSize, total - inserted);
    for (let i = 0; i < count; i++) {
      batch.push(generateFn(inserted + i));
    }
    const res = await collection.insertMany(batch, { ordered: false });
    results.push(...Object.values(res.insertedIds));
    inserted += count;
    if (inserted % 1000 === 0 || inserted === total) {
      console.log(`  [${label}] ${inserted} / ${total}`);
    }
  }
  return results;
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db(DB_NAME);

  // Drop existing collections for a clean seed
  for (const col of ['customers', 'products', 'orders', 'order_items', 'inventory']) {
    await db.collection(col).drop().catch(() => {});
  }
  console.log('Dropped existing collections\n');

  // --- customers (10,000) ---
  console.log('Seeding customers...');
  const customerIds = await insertInBatches(
    db.collection('customers'),
    () => ({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      createdAt: faker.date.past({ years: 3 }),
    }),
    10_000,
    500,
    'customers'
  );

  // --- products (5,000) ---
  console.log('\nSeeding products...');
  const productIds = await insertInBatches(
    db.collection('products'),
    (i) => ({
      name: faker.commerce.productName(),
      category: CATEGORIES[i % CATEGORIES.length],
      price: parseFloat(faker.commerce.price({ min: 1, max: 2000 })),
      description: generateDescription(),
    }),
    5_000,
    500,
    'products'
  );

  // --- orders (50,000) ---
  console.log('\nSeeding orders...');
  const orderIds = await insertInBatches(
    db.collection('orders'),
    () => ({
      customerId: customerIds[Math.floor(Math.random() * customerIds.length)],
      status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
      totalAmount: parseFloat((Math.random() * 1500 + 5).toFixed(2)),
      createdAt: faker.date.past({ years: 2 }),
    }),
    50_000,
    500,
    'orders'
  );

  // --- order_items (150,000) ---
  console.log('\nSeeding order_items...');
  await insertInBatches(
    db.collection('order_items'),
    () => ({
      orderId: orderIds[Math.floor(Math.random() * orderIds.length)],
      productId: productIds[Math.floor(Math.random() * productIds.length)],
      quantity: Math.floor(Math.random() * 5) + 1,
      unitPrice: parseFloat(faker.commerce.price({ min: 1, max: 2000 })),
    }),
    150_000,
    500,
    'order_items'
  );

  // --- inventory (5,000) ---
  console.log('\nSeeding inventory...');
  await insertInBatches(
    db.collection('inventory'),
    (i) => ({
      productId: productIds[i % productIds.length],
      quantity: Math.floor(Math.random() * 1000),
      lastUpdated: faker.date.recent({ days: 30 }),
    }),
    5_000,
    500,
    'inventory'
  );

  console.log('\nSeed complete.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
