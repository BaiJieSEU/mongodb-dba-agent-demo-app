#!/bin/bash
# Replica set node setup script
# Configures 3 mongod instances per node (ports 27017/27018/27019)
# serving 3 separate replica sets managed by Ops Manager.
set -euo pipefail
exec > /var/log/setup_rs_node.log 2>&1

echo "=== [1/4] System prep ==="
apt-get update -y
apt-get install -y curl gnupg wget

# Disable Transparent Huge Pages
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

echo "=== [2/4] Kernel tuning ==="
cat >> /etc/sysctl.conf <<'EOF'
vm.swappiness=1
net.core.somaxconn=4096
EOF
sysctl -p

echo "=== [3/4] File descriptor limits ==="
cat >> /etc/security/limits.conf <<'EOF'
mongodb  soft  nofile  64000
mongodb  hard  nofile  64000
mongodb  soft  nproc   64000
mongodb  hard  nproc   64000
EOF

echo "=== [4/4] Prepare data directories for 3 mongod instances ==="
# Port 27017 → demoRS      (ecommerce)
# Port 27018 → analyticsRS (analytics)
# Port 27019 → crmRS       (crm)
for PORT in 27017 27018 27019; do
  mkdir -p /data/db$PORT
  mkdir -p /var/log/mongodb
  mkdir -p /var/run/mongodb
  # mongodb user/group created by OM agent installer; pre-create with open perms
  chmod 777 /data/db$PORT
done
chmod 777 /var/log/mongodb /var/run/mongodb

echo "================================================================"
echo " RS node prep complete."
echo " Data dirs: /data/db27017  /data/db27018  /data/db27019"
echo " Ready for Ops Manager Automation Agent."
echo " OM will deploy:"
echo "   demoRS      (port 27017) — ecommerce db"
echo "   analyticsRS (port 27018) — analytics db"
echo "   crmRS       (port 27019) — crm db"
echo "================================================================"
