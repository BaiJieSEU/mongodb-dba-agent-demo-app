# Terraform — MongoDB Ops Manager on GCP

Provisions 4 Ubuntu 22.04 VMs on GCP Compute Engine:

| VM | Internal IP | Role |
|---|---|---|
| `om-host` | 10.10.0.10 | Ops Manager + AppDB (single-node RS) |
| `rs-node-1` | 10.10.0.11 | Replica set member |
| `rs-node-2` | 10.10.0.12 | Replica set member |
| `rs-node-3` | 10.10.0.13 | Replica set member |

---

## Prerequisites

### 1. Install tools
```bash
brew install terraform google-cloud-sdk
```

### 2. Authenticate with GCP
```bash
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Enable GCP APIs
```bash
gcloud services enable compute.googleapis.com
```

### 4. Get the Ops Manager .deb URL
1. Go to https://www.mongodb.com/try/download/ops-manager
2. Select: **Ubuntu 22.04 (Jammy)** → **deb** → latest version
3. Copy the download link — you'll need it for `om_download_url` in tfvars

---

## Deploy

```bash
cd terraform

# Create your tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — fill in project_id and om_download_url

terraform init
terraform plan
terraform apply
```

Terraform outputs the OM UI URL and SSH commands when done.

---

## Post-deploy: Connect Ops Manager to the replica set (~15 min)

### Step 1 — Wait for startup scripts to finish (~5 min)
```bash
# Watch the OM setup log
ssh ubuntu@<om-host-ip> "tail -f /var/log/setup_om.log"
# Done when you see: "Ops Manager setup complete."
```

### Step 2 — Complete the OM web setup wizard
1. Open `http://<om-host-ip>:8080` in your browser
2. Create an admin account
3. On **"Configure Ops Manager"** page, the AppDB URI is pre-filled: accept it
4. Complete the wizard — accept all defaults

### Step 3 — Create an Organization and Project in OM
1. Click **"New Organization"** → give it a name
2. Inside the org, click **"New Project"** → give it a name
3. You're now in the project deployment view

### Step 4 — Install Automation Agents on RS nodes
In the OM UI, go to **Deployment → Agents → Downloads & Settings**.
Copy the agent install command — it looks like:

```bash
curl -OL http://10.10.0.10:8080/download/agent/automation/mongodb-mms-automation-agent-manager_VERSION_amd64.ubuntu2204.deb
sudo dpkg -i mongodb-mms-automation-agent-manager*.deb
```

Run this on each RS node:
```bash
ssh ubuntu@<rs-node-1-ip>   # paste the command
ssh ubuntu@<rs-node-2-ip>   # paste the command
ssh ubuntu@<rs-node-3-ip>   # paste the command
```

After a minute, all 3 nodes appear as **"Unmanaged"** hosts in OM.

### Step 5 — Deploy the replica set via OM
1. **Deployment → Add New → New Replica Set**
2. Name: `demoRS`
3. Add 3 members — use internal IPs `10.10.0.11`, `10.10.0.12`, `10.10.0.13`
4. MongoDB version: **8.0.x** (EA build will be downloaded automatically by OM)
5. Data directory: `/data/db`
6. Click **Review & Deploy → Confirm & Deploy**

OM downloads MongoDB binaries and starts the RS (~3 min).

### Step 6 — Update your demo app .env
```
MONGO_URI=mongodb://10.10.0.11:27017,10.10.0.12:27017,10.10.0.13:27017/ecommerce?replicaSet=demoRS
```

Run seed and workload from your local machine (or copy the app to `om-host`).

---

## Teardown
```bash
terraform destroy
```
