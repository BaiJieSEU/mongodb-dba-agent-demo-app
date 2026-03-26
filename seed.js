/**
 * seed.js — MongoDB Agentic DBA Demo Platform
 *
 * Seeds 3 replica sets (clusters) with intentionally missing indexes:
 *
 *   Cluster 1 — demoRS    (MONGO_URI_ECOMMERCE)  → ecommerce db  — 8 collections
 *   Cluster 2 — analyticsRS (MONGO_URI_ANALYTICS) → analytics db  — 7 collections
 *   Cluster 3 — crmRS     (MONGO_URI_CRM)        → crm db        — 6 collections
 *
 * Missing indexes are deliberate — they are the signal the DBA agent detects.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { faker } = require('@faker-js/faker');

// ── Connection strings ───────────────────────────────────────────────
const URIS = {
  ecommerce: process.env.MONGO_URI_ECOMMERCE || process.env.MONGO_URI,
  analytics: process.env.MONGO_URI_ANALYTICS,
  crm:       process.env.MONGO_URI_CRM,
};

// ── Shared lookup data ───────────────────────────────────────────────
const PRODUCT_CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports',
  'Toys', 'Beauty', 'Automotive', 'Food & Grocery', 'Office Supplies',
];
const ORDER_STATUSES   = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const TICKET_STATUSES  = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const EVENT_TYPES      = ['click', 'view', 'add_to_cart', 'remove_from_cart', 'checkout', 'purchase'];
const PROMO_TYPES      = ['percentage', 'fixed_amount', 'free_shipping', 'buy_one_get_one'];
const CHANNELS         = ['email', 'sms', 'push', 'in_app'];

// ── Batch insert helper ──────────────────────────────────────────────
async function insertBatch(collection, generateFn, total, batchSize = 500, label) {
  let inserted = 0;
  const ids = [];
  while (inserted < total) {
    const count = Math.min(batchSize, total - inserted);
    const batch = Array.from({ length: count }, (_, i) => generateFn(inserted + i));
    const res = await collection.insertMany(batch, { ordered: false });
    ids.push(...Object.values(res.insertedIds));
    inserted += count;
    if (inserted % 2000 === 0 || inserted === total) {
      process.stdout.write(`\r  [${label}] ${inserted}/${total}`);
    }
  }
  console.log();
  return ids;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ═══════════════════════════════════════════════════════════════════════
// CLUSTER 1 — ecommerce (demoRS, port 27017)
// ═══════════════════════════════════════════════════════════════════════
async function seedEcommerce(uri) {
  console.log('\n══════════════════════════════════════════════');
  console.log(' Cluster 1 — ecommerce (demoRS)');
  console.log('══════════════════════════════════════════════');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('ecommerce');

  const cols = ['customers','products','orders','order_items','inventory','reviews','carts','promotions'];
  for (const c of cols) await db.collection(c).drop().catch(() => {});

  // ── customers (5,000) — MISSING INDEX: email ────────────────────────
  console.log('\nSeeding customers...');
  const customerIds = await insertBatch(db.collection('customers'), () => ({
    name:        faker.person.fullName(),
    email:       faker.internet.email(),          // ← no index — scan on login
    phone:       faker.phone.number(),
    address: {
      street: faker.location.streetAddress(),
      city:   faker.location.city(),
      state:  faker.location.state(),
      zip:    faker.location.zipCode(),
      country: 'US',
    },
    tier:        pick(['bronze','silver','gold','platinum']),
    createdAt:   faker.date.past({ years: 3 }),
  }), 5_000, 500, 'customers');

  // ── products (2,000) — MISSING INDEX: category ──────────────────────
  console.log('Seeding products...');
  const productIds = await insertBatch(db.collection('products'), (i) => ({
    name:        faker.commerce.productName(),
    category:    PRODUCT_CATEGORIES[i % PRODUCT_CATEGORIES.length], // ← no index
    price:       parseFloat(faker.commerce.price({ min: 1, max: 2000 })),
    brand:       faker.company.name(),
    sku:         faker.string.alphanumeric(10).toUpperCase(),
    description: faker.commerce.productDescription() + ' ' + faker.lorem.sentences(2),
    rating:      parseFloat((Math.random() * 2 + 3).toFixed(1)),
    createdAt:   faker.date.past({ years: 2 }),
  }), 2_000, 500, 'products');

  // ── orders (10,000) — MISSING INDEXES: status, createdAt ────────────
  console.log('Seeding orders...');
  const orderIds = await insertBatch(db.collection('orders'), () => ({
    customerId:   pick(customerIds),
    status:       pick(ORDER_STATUSES),             // ← no index
    totalAmount:  parseFloat((Math.random() * 1500 + 5).toFixed(2)),
    currency:     'USD',
    shippingAddr: faker.location.streetAddress(),
    createdAt:    faker.date.past({ years: 2 }),    // ← no index
    updatedAt:    faker.date.recent({ days: 30 }),
  }), 10_000, 500, 'orders');

  // ── order_items (30,000) — MISSING INDEX: orderId ───────────────────
  console.log('Seeding order_items...');
  await insertBatch(db.collection('order_items'), () => ({
    orderId:   pick(orderIds),                      // ← no index
    productId: pick(productIds),
    quantity:  Math.floor(Math.random() * 5) + 1,
    unitPrice: parseFloat(faker.commerce.price({ min: 1, max: 2000 })),
    discount:  parseFloat((Math.random() * 0.3).toFixed(2)),
  }), 30_000, 500, 'order_items');

  // ── inventory (2,000) ────────────────────────────────────────────────
  console.log('Seeding inventory...');
  await insertBatch(db.collection('inventory'), (i) => ({
    productId:   productIds[i % productIds.length],
    quantity:    Math.floor(Math.random() * 1000),
    warehouse:   pick(['US-EAST', 'US-WEST', 'EU-CENTRAL']),
    lastUpdated: faker.date.recent({ days: 30 }),
  }), 2_000, 500, 'inventory');

  // ── reviews (4,000) — MISSING INDEXES: productId, customerId ────────
  console.log('Seeding reviews...');
  await insertBatch(db.collection('reviews'), () => ({
    productId:  pick(productIds),                   // ← no index
    customerId: pick(customerIds),                  // ← no index
    rating:     Math.floor(Math.random() * 5) + 1,
    title:      faker.lorem.sentence(),
    body:       faker.lorem.paragraph(),
    verified:   Math.random() > 0.3,
    createdAt:  faker.date.past({ years: 1 }),
    helpful:    Math.floor(Math.random() * 50),
  }), 4_000, 500, 'reviews');

  // ── carts (1,000) — MISSING INDEX: customerId ───────────────────────
  console.log('Seeding carts...');
  await insertBatch(db.collection('carts'), () => {
    const itemCount = Math.floor(Math.random() * 5) + 1;
    return {
      customerId: pick(customerIds),                // ← no index
      items: Array.from({ length: itemCount }, () => ({
        productId: pick(productIds),
        quantity:  Math.floor(Math.random() * 3) + 1,
      })),
      updatedAt: faker.date.recent({ days: 7 }),
    };
  }, 1_000, 500, 'carts');

  // ── promotions (200) — MISSING INDEX: code ──────────────────────────
  console.log('Seeding promotions...');
  await insertBatch(db.collection('promotions'), (i) => ({
    code:        `PROMO${String(i).padStart(4, '0')}`,  // ← no index
    type:        pick(PROMO_TYPES),
    value:       parseFloat((Math.random() * 50 + 5).toFixed(2)),
    minOrder:    parseFloat((Math.random() * 50).toFixed(2)),
    active:      Math.random() > 0.3,
    startsAt:    faker.date.past({ years: 1 }),
    expiresAt:   faker.date.future({ years: 1 }),
    usageCount:  Math.floor(Math.random() * 500),
  }), 200, 200, 'promotions');

  await client.close();
  console.log('\n✓ ecommerce seeded');
}

// ═══════════════════════════════════════════════════════════════════════
// CLUSTER 2 — analytics (analyticsRS, port 27018)
// ═══════════════════════════════════════════════════════════════════════
async function seedAnalytics(uri) {
  console.log('\n══════════════════════════════════════════════');
  console.log(' Cluster 2 — analytics (analyticsRS)');
  console.log('══════════════════════════════════════════════');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('analytics');

  const cols = ['sessions','page_views','search_queries','product_impressions','events','conversions','ab_tests'];
  for (const c of cols) await db.collection(c).drop().catch(() => {});

  // Seed some fake user IDs and product IDs to reference
  const userCount    = 3_000;
  const productCount = 2_000;
  const userIds    = Array.from({ length: userCount },    () => faker.string.uuid());
  const productIds = Array.from({ length: productCount }, () => faker.string.uuid());

  // ── sessions (5,000) — MISSING INDEX: userId ────────────────────────
  console.log('\nSeeding sessions...');
  const sessionIds = await insertBatch(db.collection('sessions'), () => ({
    userId:    pick(userIds),                       // ← no index
    device:    pick(['mobile', 'desktop', 'tablet']),
    browser:   pick(['chrome', 'safari', 'firefox', 'edge']),
    country:   faker.location.countryCode(),
    startedAt: faker.date.recent({ days: 30 }),
    duration:  Math.floor(Math.random() * 1800),   // seconds
    pageCount: Math.floor(Math.random() * 20) + 1,
  }), 5_000, 500, 'sessions');

  // ── page_views (20,000) — MISSING INDEXES: userId, productId ────────
  console.log('Seeding page_views...');
  await insertBatch(db.collection('page_views'), () => ({
    sessionId: pick(sessionIds),
    userId:    Math.random() > 0.2 ? pick(userIds) : null,  // ← no index
    productId: Math.random() > 0.4 ? pick(productIds) : null, // ← no index
    url:       faker.internet.url(),
    referrer:  Math.random() > 0.5 ? faker.internet.url() : null,
    timeOnPage: Math.floor(Math.random() * 300),
    createdAt: faker.date.recent({ days: 30 }),
  }), 20_000, 500, 'page_views');

  // ── search_queries (8,000) — MISSING INDEX: userId ──────────────────
  console.log('Seeding search_queries...');
  await insertBatch(db.collection('search_queries'), () => ({
    userId:      Math.random() > 0.3 ? pick(userIds) : null,  // ← no index
    query:       faker.commerce.productName(),
    resultsCount: Math.floor(Math.random() * 200),
    clicked:     Math.random() > 0.4,
    sessionId:   pick(sessionIds),
    createdAt:   faker.date.recent({ days: 30 }),
  }), 8_000, 500, 'search_queries');

  // ── product_impressions (15,000) — MISSING INDEX: productId ─────────
  console.log('Seeding product_impressions...');
  await insertBatch(db.collection('product_impressions'), () => ({
    productId: pick(productIds),                    // ← no index
    sessionId: pick(sessionIds),
    position:  Math.floor(Math.random() * 50) + 1,
    source:    pick(['search', 'browse', 'recommendation', 'homepage']),
    createdAt: faker.date.recent({ days: 30 }),
  }), 15_000, 500, 'product_impressions');

  // ── events (10,000) — MISSING INDEXES: sessionId, type ─────────────
  console.log('Seeding events...');
  await insertBatch(db.collection('events'), () => ({
    sessionId:  pick(sessionIds),                   // ← no index
    userId:     Math.random() > 0.3 ? pick(userIds) : null,
    type:       pick(EVENT_TYPES),                  // ← no index
    properties: {
      productId: pick(productIds),
      value:     parseFloat((Math.random() * 200).toFixed(2)),
    },
    createdAt: faker.date.recent({ days: 30 }),
  }), 10_000, 500, 'events');

  // ── conversions (2,000) — MISSING INDEX: sessionId ──────────────────
  console.log('Seeding conversions...');
  await insertBatch(db.collection('conversions'), () => ({
    sessionId:  pick(sessionIds),                   // ← no index
    userId:     pick(userIds),
    orderId:    faker.string.uuid(),
    revenue:    parseFloat((Math.random() * 500 + 10).toFixed(2)),
    itemCount:  Math.floor(Math.random() * 5) + 1,
    channel:    pick(['organic', 'paid', 'email', 'social', 'direct']),
    createdAt:  faker.date.recent({ days: 30 }),
  }), 2_000, 500, 'conversions');

  // ── ab_tests (10) ────────────────────────────────────────────────────
  console.log('Seeding ab_tests...');
  await insertBatch(db.collection('ab_tests'), (i) => ({
    name:        `Test ${String.fromCharCode(65 + i)}: ${faker.commerce.productAdjective()} variant`,
    variants:    ['control', 'treatment'],
    metric:      pick(['conversion_rate', 'revenue', 'click_through']),
    status:      pick(['running', 'concluded', 'paused']),
    startedAt:   faker.date.past({ years: 1 }),
    traffic:     parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)),
  }), 10, 10, 'ab_tests');

  await client.close();
  console.log('\n✓ analytics seeded');
}

// ═══════════════════════════════════════════════════════════════════════
// CLUSTER 3 — crm (crmRS, port 27019)
// ═══════════════════════════════════════════════════════════════════════
async function seedCrm(uri) {
  console.log('\n══════════════════════════════════════════════');
  console.log(' Cluster 3 — crm (crmRS)');
  console.log('══════════════════════════════════════════════');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('crm');

  const cols = ['agents','tickets','interactions','sla_records','campaigns','campaign_members'];
  for (const c of cols) await db.collection(c).drop().catch(() => {});

  // Seed some fake customer IDs to reference across collections
  const customerCount = 5_000;
  const customerIds = Array.from({ length: customerCount }, () => faker.string.uuid());

  // ── agents (30) ──────────────────────────────────────────────────────
  console.log('\nSeeding agents...');
  const agentIds = await insertBatch(db.collection('agents'), (i) => ({
    name:       faker.person.fullName(),
    email:      faker.internet.email(),
    team:       pick(['tier1','tier2','tier3','billing','technical']),
    active:     Math.random() > 0.1,
    joinedAt:   faker.date.past({ years: 3 }),
    skillScore: Math.floor(Math.random() * 100),
  }), 30, 30, 'agents');

  // ── tickets (3,000) — MISSING INDEXES: customerId, status ───────────
  console.log('Seeding tickets...');
  const ticketIds = await insertBatch(db.collection('tickets'), () => ({
    customerId: pick(customerIds),                  // ← no index
    agentId:    Math.random() > 0.2 ? pick(agentIds) : null,
    status:     pick(TICKET_STATUSES),              // ← no index
    priority:   pick(['low','medium','high','critical']),
    category:   pick(['billing','shipping','product','account','refund','other']),
    subject:    faker.lorem.sentence(),
    channel:    pick(CHANNELS),
    createdAt:  faker.date.past({ years: 1 }),
    resolvedAt: Math.random() > 0.4 ? faker.date.recent({ days: 60 }) : null,
  }), 3_000, 500, 'tickets');

  // ── interactions (8,000) — MISSING INDEX: ticketId ──────────────────
  console.log('Seeding interactions...');
  await insertBatch(db.collection('interactions'), () => ({
    ticketId:   pick(ticketIds),                    // ← no index
    agentId:    Math.random() > 0.3 ? pick(agentIds) : null,
    type:       pick(['note','reply','status_change','escalation']),
    body:       faker.lorem.paragraph(),
    internal:   Math.random() > 0.7,
    createdAt:  faker.date.recent({ days: 90 }),
  }), 8_000, 500, 'interactions');

  // ── sla_records (3,000) — MISSING INDEX: ticketId ───────────────────
  console.log('Seeding sla_records...');
  await insertBatch(db.collection('sla_records'), () => {
    const target = pick([4, 8, 24, 48]);  // hours
    const actual = Math.random() * target * 1.5;
    return {
      ticketId:    pick(ticketIds),                 // ← no index
      policy:      pick(['standard','priority','vip']),
      targetHours: target,
      actualHours: parseFloat(actual.toFixed(2)),
      breached:    actual > target,
      measuredAt:  faker.date.recent({ days: 90 }),
    };
  }, 3_000, 500, 'sla_records');

  // ── campaigns (20) ───────────────────────────────────────────────────
  console.log('Seeding campaigns...');
  const campaignIds = await insertBatch(db.collection('campaigns'), (i) => ({
    name:      `${faker.commerce.productAdjective()} ${pick(['Spring','Summer','Flash','Re-engagement'])} Campaign ${i+1}`,
    channel:   pick(CHANNELS),
    status:    pick(['draft','active','paused','completed']),
    audience:  pick(['all','silver','gold','platinum','churned']),
    sentCount: Math.floor(Math.random() * 10000),
    openRate:  parseFloat((Math.random() * 0.4 + 0.1).toFixed(3)),
    clickRate: parseFloat((Math.random() * 0.1 + 0.01).toFixed(3)),
    startedAt: faker.date.past({ years: 1 }),
  }), 20, 20, 'campaigns');

  // ── campaign_members (5,000) — MISSING INDEXES: customerId, campaignId
  console.log('Seeding campaign_members...');
  await insertBatch(db.collection('campaign_members'), () => ({
    campaignId:  pick(campaignIds),                 // ← no index
    customerId:  pick(customerIds),                 // ← no index
    status:      pick(['sent','opened','clicked','converted','unsubscribed']),
    sentAt:      faker.date.recent({ days: 90 }),
    openedAt:    Math.random() > 0.5 ? faker.date.recent({ days: 60 }) : null,
    clickedAt:   Math.random() > 0.7 ? faker.date.recent({ days: 30 }) : null,
  }), 5_000, 500, 'campaign_members');

  await client.close();
  console.log('\n✓ crm seeded');
}

// ═══════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  const missing = Object.entries(URIS).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.map(k => `MONGO_URI_${k.toUpperCase()}`).join(', ')}`);
    console.error('Copy .env.example to .env and fill in all three URIs.');
    process.exit(1);
  }

  console.log('MongoDB Agentic DBA — Demo Seed');
  console.log('================================');
  console.log(`  Cluster 1 (ecommerce):  ${URIS.ecommerce}`);
  console.log(`  Cluster 2 (analytics):  ${URIS.analytics}`);
  console.log(`  Cluster 3 (crm):        ${URIS.crm}`);

  await seedEcommerce(URIS.ecommerce);
  await seedAnalytics(URIS.analytics);
  await seedCrm(URIS.crm);

  console.log('\n════════════════════════════════════════════');
  console.log(' All 3 clusters seeded successfully.');
  console.log('\n Missing indexes (intentional — DBA agent targets):');
  console.log('  ecommerce  → customers.email, orders.status, orders.createdAt,');
  console.log('               products.category, order_items.orderId,');
  console.log('               reviews.{productId,customerId}, carts.customerId, promotions.code');
  console.log('  analytics  → page_views.{userId,productId}, search_queries.userId,');
  console.log('               product_impressions.productId, events.{sessionId,type},');
  console.log('               conversions.sessionId, sessions.userId');
  console.log('  crm        → tickets.{customerId,status}, interactions.ticketId,');
  console.log('               sla_records.ticketId, campaign_members.{campaignId,customerId}');
  console.log('════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
