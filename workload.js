require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'ecommerce';
const LOOP_DELAY_MS = 100;
const RUN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SLOW_THRESHOLD_MS = 100;

const STATUSES = ['pending', 'processing', 'shipped', 'delivered'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function timed(label, fn) {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  if (elapsed > SLOW_THRESHOLD_MS) {
    console.warn(`[SLOW ${elapsed}ms] ${label}`);
  }
  return result;
}

async function runWorkload(db, cachedIds) {
  const { orderIds, productIds, customerIds } = cachedIds;

  // --- SLOW: collection scan on orders.status (no index) ---
  await timed('find orders by status (scan)', () =>
    db.collection('orders')
      .find({ status: pick(STATUSES) })
      .limit(20)
      .toArray()
  );

  // --- SLOW: collection scan on customers.email (no index) ---
  const fakeEmail = `user${Math.floor(Math.random() * 10000)}@example.com`;
  await timed('find customer by email (scan)', () =>
    db.collection('customers')
      .findOne({ email: fakeEmail })
  );

  // --- SLOW: collection scan on products.category, no projection (fat docs) ---
  const categories = [
    'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports',
    'Toys', 'Beauty', 'Automotive', 'Food & Grocery', 'Office Supplies',
  ];
  await timed('find products by category, no projection (scan)', () =>
    db.collection('products')
      .find({ category: pick(categories) })
      .limit(20)
      .toArray()
  );

  // --- FAST: lookup by _id ---
  await timed('find order by _id', () =>
    db.collection('orders')
      .findOne({ _id: pick(orderIds) })
  );

  await timed('find product by _id', () =>
    db.collection('products')
      .findOne({ _id: pick(productIds) })
  );

  // --- WRITE: update a random order's status ---
  await timed('update order status', () =>
    db.collection('orders').updateOne(
      { _id: pick(orderIds) },
      { $set: { status: pick(STATUSES), updatedAt: new Date() } }
    )
  );
}

async function loadIds(db) {
  console.log('Loading cached IDs from DB...');
  const [orderIds, productIds, customerIds] = await Promise.all([
    db.collection('orders').find({}, { projection: { _id: 1 } }).limit(5000).toArray()
      .then(docs => docs.map(d => d._id)),
    db.collection('products').find({}, { projection: { _id: 1 } }).toArray()
      .then(docs => docs.map(d => d._id)),
    db.collection('customers').find({}, { projection: { _id: 1 } }).limit(5000).toArray()
      .then(docs => docs.map(d => d._id)),
  ]);
  console.log(`Loaded ${orderIds.length} order IDs, ${productIds.length} product IDs, ${customerIds.length} customer IDs\n`);
  return { orderIds, productIds, customerIds };
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db(DB_NAME);
  const cachedIds = await loadIds(db);

  const endTime = Date.now() + RUN_DURATION_MS;
  let iterations = 0;

  console.log('Starting workload (5 minutes)...\n');

  while (Date.now() < endTime) {
    await runWorkload(db, cachedIds);
    iterations++;
    if (iterations % 50 === 0) {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      console.log(`[${new Date().toISOString()}] iterations=${iterations}, ~${remaining}s remaining`);
    }
    await new Promise(resolve => setTimeout(resolve, LOOP_DELAY_MS));
  }

  console.log(`\nWorkload complete. Total iterations: ${iterations}`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
