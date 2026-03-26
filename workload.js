/**
 * workload.js — MongoDB Agentic DBA Demo Platform
 *
 * Simulates continuous mixed read/write workload across 3 clusters,
 * deliberately hitting unindexed fields to generate slow operations.
 *
 * Logs any operation over SLOW_THRESHOLD_MS as [SLOW Xms].
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const URIS = {
  ecommerce: process.env.MONGO_URI_ECOMMERCE || process.env.MONGO_URI,
  analytics: process.env.MONGO_URI_ANALYTICS,
  crm:       process.env.MONGO_URI_CRM,
};

const LOOP_DELAY_MS    = 150;
const RUN_DURATION_MS  = 5 * 60 * 1000;
const SLOW_THRESHOLD_MS = 100;

const ORDER_STATUSES  = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const TICKET_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const EVENT_TYPES     = ['click', 'view', 'add_to_cart', 'checkout', 'purchase'];
const CATEGORIES      = ['Electronics','Clothing','Books','Home & Garden','Sports',
                         'Toys','Beauty','Automotive','Food & Grocery','Office Supplies'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function timed(label, fn) {
  const start = Date.now();
  const result = await fn();
  const ms = Date.now() - start;
  if (ms > SLOW_THRESHOLD_MS) console.warn(`[SLOW ${ms}ms] ${label}`);
  return result;
}

// ── Load a sample of IDs upfront ────────────────────────────────────
async function loadIds(db, collection, field = '_id', limit = 2000) {
  const docs = await db.collection(collection)
    .find({}, { projection: { [field]: 1 } })
    .limit(limit).toArray();
  return docs.map(d => d[field]);
}

// ══════════════════════════════════════════════════════════════════════
// CLUSTER 1 — ecommerce workload
// ══════════════════════════════════════════════════════════════════════
async function runEcommerceWorkload(db, ids) {
  const { orderIds, productIds, customerIds } = ids;

  // SLOW — scan orders.status (no index)
  await timed('[ecommerce] find orders by status (scan)', () =>
    db.collection('orders').find({ status: pick(ORDER_STATUSES) }).limit(20).toArray()
  );

  // SLOW — scan customers.email (no index)
  await timed('[ecommerce] find customer by email (scan)', () =>
    db.collection('customers').findOne({
      email: `user${Math.floor(Math.random() * 5000)}@example.com`
    })
  );

  // SLOW — scan products.category with fat docs (no index)
  await timed('[ecommerce] find products by category (scan)', () =>
    db.collection('products').find({ category: pick(CATEGORIES) }).limit(20).toArray()
  );

  // SLOW — scan reviews.productId (no index)
  await timed('[ecommerce] find reviews by productId (scan)', () =>
    db.collection('reviews').find({ productId: pick(productIds) }).limit(10).toArray()
  );

  // SLOW — scan carts.customerId (no index)
  await timed('[ecommerce] find cart by customerId (scan)', () =>
    db.collection('carts').findOne({ customerId: pick(customerIds) })
  );

  // FAST — _id lookups
  await timed('[ecommerce] find order by _id', () =>
    db.collection('orders').findOne({ _id: pick(orderIds) })
  );

  // WRITE — update order status
  await timed('[ecommerce] update order status', () =>
    db.collection('orders').updateOne(
      { _id: pick(orderIds) },
      { $set: { status: pick(ORDER_STATUSES), updatedAt: new Date() } }
    )
  );
}

// ══════════════════════════════════════════════════════════════════════
// CLUSTER 2 — analytics workload
// ══════════════════════════════════════════════════════════════════════
async function runAnalyticsWorkload(db, ids) {
  const { sessionIds, userIds } = ids;

  // SLOW — scan page_views.userId (no index)
  await timed('[analytics] find page_views by userId (scan)', () =>
    db.collection('page_views').find({
      userId: pick(userIds)
    }).limit(20).toArray()
  );

  // SLOW — scan events.type (no index)
  await timed('[analytics] find events by type (scan)', () =>
    db.collection('events').find({ type: pick(EVENT_TYPES) }).limit(20).toArray()
  );

  // SLOW — scan search_queries.userId (no index)
  await timed('[analytics] find search_queries by userId (scan)', () =>
    db.collection('search_queries').find({
      userId: pick(userIds)
    }).limit(10).toArray()
  );

  // SLOW — scan conversions.sessionId (no index)
  await timed('[analytics] find conversions by sessionId (scan)', () =>
    db.collection('conversions').find({ sessionId: pick(sessionIds) }).toArray()
  );

  // FAST — _id lookup
  await timed('[analytics] find session by _id', () =>
    db.collection('sessions').findOne({ _id: pick(sessionIds) })
  );

  // WRITE — insert a new event
  await timed('[analytics] insert event', () =>
    db.collection('events').insertOne({
      sessionId:  pick(sessionIds),
      userId:     pick(userIds),
      type:       pick(EVENT_TYPES),
      properties: { value: parseFloat((Math.random() * 100).toFixed(2)) },
      createdAt:  new Date(),
    })
  );
}

// ══════════════════════════════════════════════════════════════════════
// CLUSTER 3 — crm workload
// ══════════════════════════════════════════════════════════════════════
async function runCrmWorkload(db, ids) {
  const { ticketIds, customerIds, campaignIds } = ids;

  // SLOW — scan tickets.status (no index)
  await timed('[crm] find tickets by status (scan)', () =>
    db.collection('tickets').find({ status: pick(TICKET_STATUSES) }).limit(20).toArray()
  );

  // SLOW — scan tickets.customerId (no index)
  await timed('[crm] find tickets by customerId (scan)', () =>
    db.collection('tickets').find({ customerId: pick(customerIds) }).toArray()
  );

  // SLOW — scan interactions.ticketId (no index)
  await timed('[crm] find interactions by ticketId (scan)', () =>
    db.collection('interactions').find({ ticketId: pick(ticketIds) }).toArray()
  );

  // SLOW — scan campaign_members.campaignId (no index)
  await timed('[crm] find campaign_members by campaignId (scan)', () =>
    db.collection('campaign_members').find({
      campaignId: pick(campaignIds)
    }).limit(20).toArray()
  );

  // FAST — _id lookup
  await timed('[crm] find ticket by _id', () =>
    db.collection('tickets').findOne({ _id: pick(ticketIds) })
  );

  // WRITE — update ticket status
  await timed('[crm] update ticket status', () =>
    db.collection('tickets').updateOne(
      { _id: pick(ticketIds) },
      { $set: { status: pick(TICKET_STATUSES), updatedAt: new Date() } }
    )
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════
async function main() {
  const missing = Object.entries(URIS).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.map(k => `MONGO_URI_${k.toUpperCase()}`).join(', ')}`);
    process.exit(1);
  }

  console.log('Connecting to 3 clusters...');
  const clients = {
    ecommerce: new MongoClient(URIS.ecommerce),
    analytics: new MongoClient(URIS.analytics),
    crm:       new MongoClient(URIS.crm),
  };
  await Promise.all(Object.values(clients).map(c => c.connect()));
  const dbs = {
    ecommerce: clients.ecommerce.db('ecommerce'),
    analytics: clients.analytics.db('analytics'),
    crm:       clients.crm.db('crm'),
  };

  console.log('Loading IDs...');
  const ids = {
    ecommerce: {
      orderIds:    await loadIds(dbs.ecommerce, 'orders'),
      productIds:  await loadIds(dbs.ecommerce, 'products'),
      customerIds: await loadIds(dbs.ecommerce, 'customers'),
    },
    analytics: {
      sessionIds: await loadIds(dbs.analytics, 'sessions'),
      userIds:    (await dbs.analytics.collection('sessions')
                    .find({}, { projection: { userId: 1 } }).limit(2000).toArray())
                    .map(d => d.userId).filter(Boolean),
    },
    crm: {
      ticketIds:   await loadIds(dbs.crm, 'tickets'),
      customerIds: (await dbs.crm.collection('tickets')
                    .find({}, { projection: { customerId: 1 } }).limit(2000).toArray())
                    .map(d => d.customerId),
      campaignIds: await loadIds(dbs.crm, 'campaigns'),
    },
  };

  const endTime = Date.now() + RUN_DURATION_MS;
  let iterations = 0;
  console.log('\nStarting workload across 3 clusters (5 minutes)...\n');

  while (Date.now() < endTime) {
    await runEcommerceWorkload(dbs.ecommerce, ids.ecommerce);
    await runAnalyticsWorkload(dbs.analytics, ids.analytics);
    await runCrmWorkload(dbs.crm, ids.crm);

    iterations++;
    if (iterations % 20 === 0) {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      console.log(`[${new Date().toISOString()}] iterations=${iterations}, ~${remaining}s remaining`);
    }
    await new Promise(r => setTimeout(r, LOOP_DELAY_MS));
  }

  console.log(`\nWorkload complete. Total iterations: ${iterations}`);
  await Promise.all(Object.values(clients).map(c => c.close()));
}

main().catch(err => { console.error(err); process.exit(1); });
