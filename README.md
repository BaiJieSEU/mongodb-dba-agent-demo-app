# MongoDB Agentic DBA — Demo Platform

> **Can an AI agent do what a DBA does at 2am?**
> This platform was built to find out.

This repository contains the full demo environment: three realistic workloads running across three MongoDB replica sets on GCP, managed by a single MongoDB Ops Manager instance — deliberately designed to surface the kinds of performance problems a DBA would need to investigate and fix.

The companion repo [mongodb-dba-agent-demo-app](https://github.com/BaiJieSEU/mongodb-dba-agent-demo-app) contains the agentic DBA that monitors, diagnoses, and explains what's wrong.

---

## The Problem

Database reliability is a 24/7 responsibility. In practice this means:

- A developer ships code without adding indexes. Queries that ran fine in staging start doing full collection scans in production.
- An on-call DBA gets paged at 2am. They SSH into the cluster, run `db.currentOp()`, inspect slow query logs, check replica lag, read `explain()` output — then figure out what to fix.
- This cycle repeats across multiple databases and clusters. The same classes of problems surface again and again, caught reactively, after users are already affected.

**The question:** Can an AI agent perform the same diagnostic workflow proactively — connect to live MongoDB clusters, identify what's wrong across all of them, explain it in plain language, and recommend fixes?

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GCP Project  ·  us-central1  ·  VPC 10.10.0.0/24   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────┐              │
│  │  om-host  ·  10.10.0.10  ·  e2-standard-2  ·  30 GB      │              │
│  │  MongoDB Ops Manager 8.0.21  ·  AppDB (appdbRS :27017–9)  │              │
│  │  Demo App  ·  /home/ubuntu/app/                            │              │
│  └───────────────┬───────────────────────────────────────────┘              │
│                  │  Automation Agent (manages all 3 replica sets)           │
│   ┌──────────────┼───────────────────────┐                                  │
│   ▼              ▼                       ▼                                  │
│  rs-node-1     rs-node-2             rs-node-3                              │
│  10.10.0.11    10.10.0.12            10.10.0.13                             │
│  e2-medium     e2-medium             e2-medium                              │
│                                                                             │
│  Each node runs 3 mongod instances:                                         │
│    :27017  →  demoRS       (ecommerce)                                      │
│    :27018  →  analyticsRS  (analytics)                                      │
│    :27019  →  crmRS        (crm)                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Infrastructure

| Component | Spec | Role |
|-----------|------|------|
| **om-host** | e2-standard-2, 30GB | MongoDB Ops Manager + AppDB + Demo App |
| **rs-node-1/2/3** | e2-medium, 20GB each | All 3 replica set members (3 mongod instances per node) |
| **VPC subnet** | 10.10.0.0/24 | Private network, all inter-node traffic |
| **Ops Manager** | 8.0.21 | Single pane of glass for all 3 clusters |
| **MongoDB** | 8.0 Enterprise | Managed by OM Automation Agent |

All infrastructure is provisioned with Terraform (`terraform/`). See [`terraform/README.md`](terraform/README.md) for setup.

---

## The 3 Clusters

### Cluster 1 — `ecommerce` (demoRS, port 27017)

Customer-facing e-commerce operations.

| Collection | Documents | Missing index |
|------------|-----------|---------------|
| `customers` | 5,000 | `email` |
| `products` | 2,000 | `category` |
| `orders` | 10,000 | `status`, `createdAt` |
| `order_items` | 30,000 | `orderId` |
| `inventory` | 2,000 | — |
| `reviews` | 4,000 | `productId`, `customerId` |
| `carts` | 1,000 | `customerId` |
| `promotions` | 200 | `code` |

### Cluster 2 — `analytics` (analyticsRS, port 27018)

Clickstream and behavioural analytics.

| Collection | Documents | Missing index |
|------------|-----------|---------------|
| `sessions` | 5,000 | `userId` |
| `page_views` | 20,000 | `userId`, `productId` |
| `search_queries` | 8,000 | `userId` |
| `product_impressions` | 15,000 | `productId` |
| `events` | 10,000 | `sessionId`, `type` |
| `conversions` | 2,000 | `sessionId` |
| `ab_tests` | 10 | — |

### Cluster 3 — `crm` (crmRS, port 27019)

Customer support and marketing campaigns.

| Collection | Documents | Missing index |
|------------|-----------|---------------|
| `agents` | 30 | — |
| `tickets` | 3,000 | `customerId`, `status` |
| `interactions` | 8,000 | `ticketId` |
| `sla_records` | 3,000 | `ticketId` |
| `campaigns` | 20 | — |
| `campaign_members` | 5,000 | `campaignId`, `customerId` |

**Total: ~120,000 documents across 21 collections in 3 clusters**

---

## The Agentic DBA

The companion project ([mongodb-dba-agent-demo-app](https://github.com/BaiJieSEU/mongodb-dba-agent-demo-app)) implements an AI agent that performs the DBA health check workflow autonomously.

### What the agent does

1. **Connects to Ops Manager** via REST API — reads all cluster topologies, node states, replica lag across all 3 clusters
2. **Connects to each MongoDB cluster** — inspects slow query logs, runs `$indexStats`, detects collection scan patterns
3. **Identifies problems** — missing indexes, slow operations, replication lag, resource pressure — across all 3 databases simultaneously
4. **Explains findings** in plain language — not just "missing index on tickets.status" but *why it matters, which queries are affected, and what the scan cost is*
5. **Recommends fixes** — exact `createIndex` commands ready to run per cluster

### The demo flow

```
workload.js running across all 3 clusters
         │
         ├── [SLOW 340ms] [ecommerce] find orders by status (scan)
         ├── [SLOW 280ms] [ecommerce] find customer by email (scan)
         ├── [SLOW 190ms] [analytics] find page_views by userId (scan)
         ├── [SLOW 220ms] [analytics] find events by type (scan)
         ├── [SLOW 160ms] [crm]       find tickets by customerId (scan)
         └── [SLOW 310ms] [crm]       find interactions by ticketId (scan)
                  │
                  ▼
          DBA Agent triggered
                  │
          ├── Checks all 3 clusters via OM: topology, lag, node states
          ├── Inspects slow query logs per cluster
          ├── Runs $indexStats across 21 collections
          └── Returns unified diagnosis:
                "Found 19 missing indexes across 3 clusters.
                 Highest impact: orders.status (10k docs scanned, ~340ms avg).
                 Recommendation: db.orders.createIndex({ status: 1 })"
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB replica set access (local or GCP)
- `.env` with all three `MONGO_URI_*` vars

### Local setup (single node, 3 ports)

```bash
# Start 3 mongod instances on different ports
mongod --port 27017 --dbpath /tmp/db1 --replSet demoRS --fork --logpath /tmp/db1.log
mongod --port 27018 --dbpath /tmp/db2 --replSet analyticsRS --fork --logpath /tmp/db2.log
mongod --port 27019 --dbpath /tmp/db3 --replSet crmRS --fork --logpath /tmp/db3.log

# Initiate each replica set
mongosh --port 27017 --eval 'rs.initiate({ _id: "demoRS", members: [{ _id: 0, host: "localhost:27017" }] })'
mongosh --port 27018 --eval 'rs.initiate({ _id: "analyticsRS", members: [{ _id: 0, host: "localhost:27018" }] })'
mongosh --port 27019 --eval 'rs.initiate({ _id: "crmRS", members: [{ _id: 0, host: "localhost:27019" }] })'

# Clone and install
git clone https://github.com/BaiJieSEU/mongodb-dba-agent-demo-app.git
cd mongodb-dba-agent-demo-app
npm install
cp .env.example .env
# Update .env to use localhost URIs
```

### GCP setup (3 replica sets on 3 VMs via Ops Manager)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: project_id, om_download_url, ssh key path
terraform init
terraform apply
```

In Ops Manager, create 3 replica sets using the Automation Agent:
- `demoRS` — rs-node-1:27017, rs-node-2:27017, rs-node-3:27017
- `analyticsRS` — rs-node-1:27018, rs-node-2:27018, rs-node-3:27018
- `crmRS` — rs-node-1:27019, rs-node-2:27019, rs-node-3:27019

Data directories: `/data/db27017`, `/data/db27018`, `/data/db27019`

### Seed and run

```bash
# Seed all 3 clusters (~120k documents, ~3–5 min)
npm run seed

# Run workload across all 3 clusters for 5 minutes
npm run workload
```

### Fix the slow queries (after agent diagnosis)

```js
// ecommerce (demoRS)
db.customers.createIndex({ email: 1 })
db.products.createIndex({ category: 1 })
db.orders.createIndex({ status: 1 })
db.orders.createIndex({ createdAt: -1 })
db.order_items.createIndex({ orderId: 1 })
db.reviews.createIndex({ productId: 1 })
db.reviews.createIndex({ customerId: 1 })
db.carts.createIndex({ customerId: 1 })
db.promotions.createIndex({ code: 1 })

// analytics (analyticsRS)
db.sessions.createIndex({ userId: 1 })
db.page_views.createIndex({ userId: 1 })
db.page_views.createIndex({ productId: 1 })
db.search_queries.createIndex({ userId: 1 })
db.product_impressions.createIndex({ productId: 1 })
db.events.createIndex({ sessionId: 1 })
db.events.createIndex({ type: 1 })
db.conversions.createIndex({ sessionId: 1 })

// crm (crmRS)
db.tickets.createIndex({ customerId: 1 })
db.tickets.createIndex({ status: 1 })
db.interactions.createIndex({ ticketId: 1 })
db.sla_records.createIndex({ ticketId: 1 })
db.campaign_members.createIndex({ campaignId: 1 })
db.campaign_members.createIndex({ customerId: 1 })
```

---

## Why This Matters

MongoDB Ops Manager gives DBAs powerful monitoring and automation tools. This demo shows what happens when you pair that operational data with an AI agent that knows how to read it:

- **Multi-cluster visibility** — the agent monitors all 3 clusters through a single OM API, just like a DBA would
- **Faster diagnosis** — correlates slow query logs, index stats, and cluster health across 21 collections in seconds
- **Lower barrier** — junior engineers get expert-level diagnosis without deep MongoDB internals knowledge
- **Proactive** — triggered on a schedule or on alert, not just when someone is already paged
- **Explainable** — findings include plain-language reasoning and ready-to-run fix commands

The pattern generalises: any database platform with a management API (Ops Manager, Atlas, Cloud Manager) can become the foundation for an agentic operational layer.

---

## Repo Structure

```
.
├── seed.js              # Seeds all 3 clusters (~120k documents)
├── workload.js          # Continuous workload across 3 clusters
├── architecture.py      # Generates architecture.png (matplotlib)
├── architecture.png     # Architecture diagram
├── .env.example         # Connection string template (3 URIs)
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
        └── setup_rs_node.sh # OS prep + 3 data dirs per node
```
