#!/bin/bash
# Ops Manager host setup script
# Runs as root via GCP metadata startup-script
set -euo pipefail
exec > /var/log/setup_om.log 2>&1

echo "=== [1/6] System prep ==="
apt-get update -y
apt-get install -y curl gnupg wget

# Disable Transparent Huge Pages (required for MongoDB)
cat > /etc/systemd/system/disable-thp.service <<'EOF'
[Unit]
Description=Disable Transparent Huge Pages
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled && echo never > /sys/kernel/mm/transparent_hugepage/defrag'
RemainAfterExit=yes

[Install]
WantedBy=basic.target
EOF
systemctl daemon-reload
systemctl enable --now disable-thp.service

# Increase file descriptor and process limits for mongod/mms
cat >> /etc/security/limits.conf <<'EOF'
mongodb  soft  nofile  64000
mongodb  hard  nofile  64000
mongodb  soft  nproc   64000
mongodb  hard  nproc   64000
EOF

echo "=== [2/6] Install MongoDB ${mongodb_version} Community (AppDB) ==="
curl -fsSL https://www.mongodb.org/static/pgp/server-${mongodb_version}.asc \
  | gpg -o /usr/share/keyrings/mongodb-server-${mongodb_version}.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${mongodb_version}.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/${mongodb_version} multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-${mongodb_version}.list

apt-get update -y
apt-get install -y mongodb-org
systemctl disable mongod  # we manage 3 instances manually below

echo "=== [3/6] Configure AppDB as 3-node replica set (ports 27017/27018/27019) ==="
# OM 8.0 requires at least 3 nodes in the AppDB replica set.
# We run all 3 on this host using different ports and data directories.

for PORT in 27017 27018 27019; do
  mkdir -p /data/appdb$PORT
  chown mongodb:mongodb /data/appdb$PORT

  cat > /etc/mongod-appdb$PORT.conf <<EOF
storage:
  dbPath: /data/appdb$PORT
net:
  port: $PORT
  bindIp: 127.0.0.1
replication:
  replSetName: appdbRS
systemLog:
  destination: file
  path: /var/log/mongodb/appdb$PORT.log
  logAppend: true
processManagement:
  pidFilePath: /var/run/mongodb/appdb$PORT.pid
EOF

  cat > /etc/systemd/system/mongod-appdb$PORT.service <<EOF
[Unit]
Description=MongoDB AppDB node on port $PORT
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod-appdb$PORT.conf
PIDFile=/var/run/mongodb/appdb$PORT.pid
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
done

mkdir -p /var/run/mongodb
chown mongodb:mongodb /var/run/mongodb

systemctl daemon-reload
systemctl enable mongod-appdb27017 mongod-appdb27018 mongod-appdb27019
systemctl start  mongod-appdb27017 mongod-appdb27018 mongod-appdb27019
sleep 8

# Initialize the 3-node replica set
mongosh --port 27017 --quiet --eval '
rs.initiate({
  _id: "appdbRS",
  members: [
    { _id: 0, host: "localhost:27017" },
    { _id: 1, host: "localhost:27018" },
    { _id: 2, host: "localhost:27019" }
  ]
})'
sleep 5
echo "AppDB 3-node replica set initialized."

echo "=== [4/6] Download and install Ops Manager ==="
wget -q -O /tmp/mongodb-mms.deb "${om_download_url}"
dpkg -i /tmp/mongodb-mms.deb
rm /tmp/mongodb-mms.deb

echo "=== [5/6] Configure Ops Manager ==="
OM_CONF="/opt/mongodb/mms/conf/conf-mms.properties"

# AppDB connection string — all 3 nodes
sed -i "s|^mongo.mongoUri=.*|mongo.mongoUri=mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=appdbRS|" "$OM_CONF"

# Use the static internal IP as the OM central URL (agents connect back here)
OM_URL="http://${om_host_ip}:8080"
sed -i "s|^mms.centralUrl=.*|mms.centralUrl=$OM_URL|" "$OM_CONF"

echo "=== [6/6] Start Ops Manager ==="
systemctl enable mongodb-mms
systemctl start mongodb-mms

# Wait up to 3 minutes for OM to become reachable
echo "Waiting for Ops Manager to be ready..."
for i in $(seq 1 36); do
  if curl -sf http://localhost:8080 > /dev/null 2>&1; then
    echo "Ops Manager is up."
    break
  fi
  sleep 5
done

echo ""
echo "================================================================"
echo " Ops Manager setup complete."
echo " Open: http://${om_host_ip}:8080"
echo "================================================================"
