# Operations Runbook

## GCP Infrastructure

| Resource | Value |
|----------|-------|
| Project | `green-thumb-64168` |
| Zone | `us-central1-a` |
| om-host | `34.31.172.84` (static) |
| SSH | `ssh ubuntu@34.31.172.84 -i ~/.ssh/id_rsa` |

---

## Shut Down

**Step 1 — gracefully stop OM and AppDB on om-host:**
```bash
ssh ubuntu@34.31.172.84 -i ~/.ssh/id_rsa "~/stop.sh"
```

**Step 2 — stop all GCP instances:**
```bash
gcloud compute instances stop om-host rs-node-1 rs-node-2 rs-node-3 \
  --project=green-thumb-64168 --zone=us-central1-a
```

---

## Start Up

**Step 1 — start all GCP instances:**
```bash
gcloud compute instances start om-host rs-node-1 rs-node-2 rs-node-3 \
  --project=green-thumb-64168 --zone=us-central1-a
```

**Step 2 — start AppDB then Ops Manager on om-host:**
```bash
ssh ubuntu@34.31.172.84 -i ~/.ssh/id_rsa "~/start.sh"
```

**Step 3 — verify everything is up:**
```bash
curl -s http://34.31.172.84:8080 > /dev/null && echo "OM up" || echo "OM not ready"
```

---

## Run the Demo Workload

SSH into om-host and run:
```bash
ssh ubuntu@34.31.172.84 -i ~/.ssh/id_rsa
cd ~/app
node workload.js
```

Or re-seed all 3 clusters from scratch:
```bash
cd ~/app
node seed.js
```

---

## Ops Manager

| Item | Value |
|------|-------|
| URL | http://34.31.172.84:8080 |
| API public key | `xdhnvfhx` |
| API private key | `31cc5434-b684-4937-a210-151ab0274e16` |
| Group ID | `69c671934a7bef19230f8362` |

---

## MongoDB Clusters

| Cluster | Replica Set | Port | Database | Connection String |
|---------|-------------|------|----------|-------------------|
| Ecommerce | `demoRS` | 27017 | `ecommerce` | `mongodb://10.10.0.11:27017,10.10.0.12:27017,10.10.0.13:27017/ecommerce?replicaSet=demoRS` |
| Analytics | `analyticsRS` | 27018 | `analytics` | `mongodb://10.10.0.11:27018,10.10.0.12:27018,10.10.0.13:27018/analytics?replicaSet=analyticsRS` |
| CRM | `crmRS` | 27019 | `crm` | `mongodb://10.10.0.11:27019,10.10.0.12:27019,10.10.0.13:27019/crm?replicaSet=crmRS` |

---

## ⚠️ Important Notes

- **Always run `~/stop.sh` before stopping GCP instances** — hard-stopping om-host corrupts the AppDB (OM's internal database)
- RS nodes (rs-node-1/2/3) can be hard-stopped safely — MongoDB handles it via WiredTiger journaling
- om-host has a **static external IP** (`34.31.172.84`) — it won't change on restart
- RS node external IPs are **ephemeral** — they change on every start (use internal IPs `10.10.0.11/12/13` for MongoDB connections)
