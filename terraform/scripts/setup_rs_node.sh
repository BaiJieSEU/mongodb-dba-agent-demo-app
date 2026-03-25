#!/bin/bash
# Replica set node OS prep script
# MongoDB binaries will be installed by the Ops Manager Automation Agent
set -euo pipefail
exec > /var/log/setup_rs_node.log 2>&1

echo "=== [1/3] System prep ==="
apt-get update -y
apt-get install -y curl

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

echo "=== [2/3] Kernel tuning ==="
cat >> /etc/sysctl.conf <<'EOF'
vm.swappiness=1
net.core.somaxconn=4096
EOF
sysctl -p

echo "=== [3/3] File descriptor limits ==="
cat >> /etc/security/limits.conf <<'EOF'
mongodb  soft  nofile  64000
mongodb  hard  nofile  64000
mongodb  soft  nproc   64000
mongodb  hard  nproc   64000
EOF

# Create data directory — OM Automation Agent will configure mongod to use it
mkdir -p /data/db
# mongodb user/group is created by the agent installer; pre-create dir with open perms
chmod 777 /data/db

echo "================================================================"
echo " RS node prep complete. Ready for Ops Manager Automation Agent."
echo "================================================================"
