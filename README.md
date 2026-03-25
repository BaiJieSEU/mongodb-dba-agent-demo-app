# MongoDB Agentic DBA — Demo Platform

> **Can an AI agent do what a DBA does at 2am?**
> This platform was built to find out.

This repository contains the full demo environment: a realistic e-commerce workload running against a production-grade MongoDB replica set on GCP, managed by MongoDB Ops Manager — deliberately designed to surface the kinds of performance problems a DBA would need to investigate and fix.

The companion repo [mongodb-dba-agent-demo-app](https://github.com/BaiJieSEU/mongodb-dba-agent-demo-app) contains the agentic DBA that monitors, diagnoses, and explains what's wrong.

---

## The Problem

Database reliability is a 24/7 responsibility. In practice this means:

- A developer ships code without adding indexes. Queries that ran fine in staging start doing full collection scans in production.
- An on-call DBA gets paged at 2am. They SSH into the cluster, run `db.currentOp()`, inspect slow query logs, check replica lag, read `explain()` output — then figure out what to fix.
- This cycle repeats. The same classes of problems surface again and again, caught reactively, after users are already affected.

**The question:** Can an AI agent perform the same diagnostic workflow proactively — connect to a live MongoDB cluster, identify what's wrong, explain it in plain language, and recommend a fix?

---

## Platform Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GCP Project (us-central1)                     │
│                                                                      │
│  ┌─────────────────────────────────┐                                 │
│  │         om-host (10.10.0.10)    │  ← e2-standard-2, 30GB         │
│  │  MongoDB Ops Manager 8.0.21     │                                 │
│  │  AppDB: 3-node RS (ports        │                                 │
│  │  27017/27018/27019)             │                                 │
│  │  App: /home/ubuntu/app/         │                                 │
│  └────────────┬────────────────────┘                                 │
│               │  manages via Automation Agent                        │
│    ┌──────────┼──────────┐                                           │
│    ▼          ▼          ▼                                           │
│  rs-node-1  rs-node-2  rs-node-3    ← e2-medium, 20GB each          │
│  10.10.0.11 10.10.0.12 10.10.0.13                                   │
│                                                                      │
│  demoRS — MongoDB 8.0 Enterprise (3-node replica set)               │
│  Database: ecommerce (220,000 documents)                             │
└──────────────────────────────────────────────────────────────────────┘
```

### Infrastructure

| Component | Spec | Role |
|-----------|------|------|
| **om-host** | e2-standard-2, 30GB | MongoDB Ops Manager + AppDB + Demo App |
| **rs-node-1/2/3** | e2-medium, 20GB each | demoRS replica set members |
| **VPC subnet** | 10.10.0.0/24 | Private network, all internal traffic |
| **Ops Manager** | 8.0.21 | Cluster automation, monitoring, agent management |
| **MongoDB** | 8.0.20 Enterprise | Managed by OM Automation Agent |

All infrastructure is provisioned with Terraform (`terraform/`). See [`terraform/README.md`](terraform/README.md) for setup instructions.

---

## The Demo App

An e-commerce workload simulator with **intentionally missing indexes** to produce realistic slow queries.

### Data Model

| Collection | Documents | Description |
|------------|-----------|-------------|
| `customers` | 10,000 | Name, email, created date |
| `products` | 5,000 | Name, category, price, long description |
| `orders` | 50,000 | Customer ref, status, amount, created date |
| `order_items` | 150,000 | Order ref, product ref, quantity, price |
| `inventory` | 5,000 | Product ref, stock quantity |

**Total: ~220,000 documents**

### Simulated Workload

Every 100ms the workload runner fires a mix of read and write operations:

| Operation | Pattern | Expected behaviour |
|-----------|---------|-------------------|
| Find orders by status | `find({ status: "shipped" })` | **SLOW** — full collection scan |
| Find customer by email | `findOne({ email: "..." })` | **SLOW** — full collection scan |
| Find products by category | `find({ category: "Electronics" })` | **SLOW** — full collection scan + fat docs |
| Find order by `_id` | `findOne({ _id: ObjectId(...) })` | Fast — default `_id` index |
| Find product by `_id` | `findOne({ _id: ObjectId(...) })` | Fast — default `_id` index |
| Update order status | `updateOne({ _id: ... }, { $set: ... })` | Write op |

Any operation over 100ms is logged as `[SLOW Xms]`.

### Missing Indexes (intentional)

These indexes are **deliberately absent** — this is the signal the DBA agent is designed to detect:

| Collection | Missing field | Impact |
|------------|--------------|--------|
| `customers` | `email` | Login/lookup queries scan 10k docs |
| `orders` | `status` | Status filter scans 50k docs |
| `orders` | `createdAt` | Date range queries scan 50k docs |
| `products` | `category` | Category browse scans 5k docs (with large payloads) |
| `order_items` | `orderId` | Order detail lookup scans 150k docs |

---

## The Agentic DBA

The companion project ([mongodb-dba-agent-demo-app](https://github.com/BaiJieSEU/mongodb-dba-agent-demo-app)) implements an AI agent that performs the DBA health check workflow autonomously.

### What the agent does

1. **Connects to Ops Manager** via REST API — reads cluster topology, checks node states, replica lag
2. **Connects to MongoDB** — inspects slow query logs, runs `$indexStats`, checks collection scan patterns
3. **Identifies problems** — missing indexes, slow operations, replication lag, resource pressure
4. **Explains findings** in plain language — not just "missing index on orders.status" but *why it matters and what queries are affected*
5. **Recommends fixes** — exact `createIndex` commands ready to run

### The demo flow

```
workload.js running (generating slow ops)
        │
        ▼
[SLOW 340ms] find orders by status (scan)
[SLOW 280ms] find customer by email (scan)
[SLOW 190ms] find products by category, no projection (scan)
        │
        ▼
  DBA Agent triggered
        │
        ├── Checks OM: cluster healthy, 3 nodes, no lag
        ├── Inspects slow query log: 3 collection scan patterns
        ├── Runs $indexStats: confirms 0 uses on unindexed fields
        └── Returns diagnosis:
              "Found 3 missing indexes causing full collection scans.
               orders.status: 50k docs scanned per query (~340ms avg).
               Recommendation: db.orders.createIndex({ status: 1 })"
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Access to a MongoDB replica set (local or GCP)
- `.env` with `MONGO_URI`

### Local setup (MongoDB Community)

```bash
# Install MongoDB CE via Homebrew (macOS)
brew tap mongodb/brew
brew install mongodb-community@8.0
brew services start mongodb-community@8.0

# Clone and install
git clone https://github.com/BaiJieSEU/mongodb-dba-agent-demo-app.git
cd mongodb-dba-agent-demo-app
npm install
cp .env.example .env
# Set MONGO_URI=mongodb://localhost:27017/ecommerce
```

### GCP setup (replica set managed by Ops Manager)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: project_id, om_download_url, ssh key path
terraform init
terraform apply
```

Ops Manager UI will be available at the `ops_manager_ui_url` output once the startup script completes (~5–8 minutes).

### Seed and run

```bash
# Seed 220k documents (~2–3 min)
npm run seed

# Run workload for 5 minutes — watch for [SLOW Xms] lines
npm run workload
```

### Fix the slow queries

```js
// Run in mongosh to resolve all slow operations
db.customers.createIndex({ email: 1 })
db.orders.createIndex({ status: 1 })
db.orders.createIndex({ createdAt: -1 })
db.products.createIndex({ category: 1 })
db.order_items.createIndex({ orderId: 1 })
```

---

## Why This Matters

MongoDB Ops Manager gives DBAs powerful monitoring and automation tools. This demo shows what happens when you pair that operational data with an AI agent that knows how to read it:

- **Faster diagnosis** — the agent correlates slow query logs, index stats, and cluster health in seconds
- **Lower barrier** — junior engineers can get expert-level diagnosis without deep MongoDB internals knowledge
- **Proactive** — the agent can be triggered on a schedule or on alert, not just when someone is already paged
- **Explainable** — findings come with plain-language reasoning, not just raw metrics

The pattern is general: any database platform with a management API (Ops Manager, Atlas, Cloud Manager) can become the foundation for an agentic operational layer.

---

## Repo Structure

```
.
├── seed.js              # Seeds 220k documents into ecommerce DB
├── workload.js          # Continuous mixed read/write workload
├── .env.example         # Connection string template
├── package.json
└── terraform/
    ├── main.tf          # GCP provider
    ├── network.tf       # VPC, subnet, firewall rules
    ├── compute.tf       # om-host + 3x rs-node instances
    ├── variables.tf     # All input variables
    ├── outputs.tf       # IPs, SSH commands, OM URL
    ├── terraform.tfvars.example
    └── scripts/
        ├── setup_om.sh      # Installs OM + AppDB 3-node RS
        └── setup_rs_node.sh # OS prep for RS nodes
```
