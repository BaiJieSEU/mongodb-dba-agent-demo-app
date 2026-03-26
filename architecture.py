"""
Architecture diagram — MongoDB Agentic DBA Demo Platform (3 clusters)
"""
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

C_GCP_BG     = "#e8f0fe"
C_GCP_BORDER = "#4285f4"
C_OM_BG      = "#fff8e1"
C_OM_BORDER  = "#f9a825"
C_RS1_BG     = "#e8f5e9";  C_RS1_BORDER = "#2e7d32"
C_RS2_BG     = "#e3f2fd";  C_RS2_BORDER = "#1565c0"
C_RS3_BG     = "#fce4ec";  C_RS3_BORDER = "#ad1457"
C_TEXT       = "#212121"
C_MUTED      = "#546e7a"

fig, ax = plt.subplots(figsize=(26, 16))
ax.set_xlim(0, 26)
ax.set_ylim(0, 16)
ax.axis("off")
fig.patch.set_facecolor("white")

def box(x, y, w, h, fc, ec, lw=2, r=0.25, z=1, alpha=1.0):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h,
        boxstyle=f"round,pad=0,rounding_size={r}",
        facecolor=fc, edgecolor=ec, linewidth=lw, zorder=z, alpha=alpha,
    ))

def txt(x, y, s, sz=11, c=C_TEXT, w="normal", ha="center", va="center", z=10):
    ax.text(x, y, s, fontsize=sz, color=c, fontweight=w,
            ha=ha, va=va, zorder=z, multialignment="center")

def node(x, y, w, h, title, sub="", fc="#bbdefb", ec="#1565c0"):
    box(x, y, w, h, fc, ec, lw=1.8, r=0.2, z=4)
    cy = y + h / 2 + (0.18 if sub else 0)
    txt(x + w/2, cy, title, sz=10.5, w="bold", z=5)
    if sub:
        txt(x + w/2, y + h/2 - 0.28, sub, sz=9, c=C_MUTED, z=5)

def arr(x1, y1, x2, y2, color, lbl="", lw=2, dashed=False, lbl_x=None, lbl_y=None, rad=0.0):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(arrowstyle="-|>", color=color, lw=lw,
                        linestyle="--" if dashed else "-",
                        connectionstyle=f"arc3,rad={rad}"),
        zorder=6)
    if lbl:
        mx = lbl_x if lbl_x is not None else (x1+x2)/2
        my = lbl_y if lbl_y is not None else (y1+y2)/2
        ax.text(mx, my, lbl, fontsize=9, color=color, ha="center", va="center",
                fontweight="bold", zorder=8,
                bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.92))

# ─── GCP boundary ──────────────────────────────────────────────────────
box(0.3, 0.5, 25.2, 14.7, C_GCP_BG, C_GCP_BORDER, lw=2.5, r=0.5, z=0, alpha=0.5)
txt(13.0, 15.0, "GCP  ·  us-central1  ·  VPC 10.10.0.0/24", sz=13, w="bold", c=C_GCP_BORDER)

# ─── External actors ───────────────────────────────────────────────────
# DBA Browser
box(0.0, 12.0, 3.0, 3.0, "#e3f2fd", "#1a73e8", lw=2, r=0.25, z=3)
txt(1.5, 14.5, "DBA / Browser",  sz=11.5, w="bold",  c="#1a73e8")
txt(1.5, 13.9, "Ops Manager UI", sz=9.5,  c=C_MUTED)
txt(1.5, 13.4, "http://:8080",   sz=9,    c=C_MUTED)

# Agentic DBA
box(22.9, 10.5, 3.0, 5.0, "#fbe9e7", "#e65100", lw=2, r=0.25, z=3)
txt(24.4, 15.1,  "Agentic DBA",     sz=11.5, w="bold", c="#e65100")
txt(24.4, 14.55, "Health Check",    sz=9.5,  c=C_MUTED)
txt(24.4, 14.1,  "(AI Agent)",      sz=9,    c=C_MUTED)
txt(24.4, 13.4,  "Tools:",          sz=9,    c=C_MUTED)
txt(24.4, 12.95, "· OM REST API",   sz=8.5,  c=C_MUTED)
txt(24.4, 12.55, "· MongoDB wire",  sz=8.5,  c=C_MUTED)
txt(24.4, 12.15, "  (3 clusters)",  sz=8.5,  c=C_MUTED)
txt(24.4, 11.5,  "· Index advisor", sz=8.5,  c=C_MUTED)
txt(24.4, 11.1,  "· Slow log scan", sz=8.5,  c=C_MUTED)

# ─── om-host ───────────────────────────────────────────────────────────
box(0.8, 8.5, 9.5, 5.8, C_OM_BG, C_OM_BORDER, lw=2, r=0.35, z=1)
txt(5.55, 14.1, "om-host  ·  10.10.0.10  ·  e2-standard-2  ·  30 GB", sz=11, w="bold", c=C_OM_BORDER)

node(1.2, 11.2, 4.0, 2.8, "Ops Manager", "v8.0.21  ·  port 8080", fc="#fff3e0", ec=C_OM_BORDER)
node(5.5, 11.2, 4.3, 2.8, "Demo App", "seed.js  ·  workload.js", fc="#e3f2fd", ec="#1565c0")
node(1.2, 8.8,  4.0, 2.1, "AppDB  ·  appdbRS", ":27017 / :27018 / :27019", fc="#e8f5e9", ec="#2e7d32")

# ─── RS nodes (shared by all 3 clusters) ───────────────────────────────
box(11.0, 0.8, 11.5, 13.5, "#f5f5f5", "#9e9e9e", lw=1.5, r=0.35, z=1, alpha=0.6)
txt(16.75, 14.1, "rs-node-1 / rs-node-2 / rs-node-3  ·  e2-medium  ·  20 GB each", sz=11, w="bold", c="#424242")

# Cluster 1 — demoRS (green)
box(11.4, 9.2, 10.7, 4.6, C_RS1_BG, C_RS1_BORDER, lw=2, r=0.3, z=2)
txt(16.75, 13.6, "Cluster 1 — demoRS  ·  port 27017  ·  ecommerce db", sz=10, w="bold", c=C_RS1_BORDER)
node(11.8, 9.5,  3.0, 3.6, "rs-node-1\n10.10.0.11", "PRIMARY", fc="#c8e6c9", ec=C_RS1_BORDER)
node(15.1, 9.5,  3.0, 3.6, "rs-node-2\n10.10.0.12", "SECONDARY", fc="#dcedc8", ec=C_RS1_BORDER)
node(18.4, 9.5,  3.1, 3.6, "rs-node-3\n10.10.0.13", "SECONDARY", fc="#dcedc8", ec=C_RS1_BORDER)

# Cluster 2 — analyticsRS (blue)
box(11.4, 4.8, 10.7, 4.1, C_RS2_BG, C_RS2_BORDER, lw=2, r=0.3, z=2)
txt(16.75, 8.7, "Cluster 2 — analyticsRS  ·  port 27018  ·  analytics db", sz=10, w="bold", c=C_RS2_BORDER)
node(11.8, 5.1,  3.0, 3.3, "rs-node-1\n10.10.0.11", "PRIMARY", fc="#bbdefb", ec=C_RS2_BORDER)
node(15.1, 5.1,  3.0, 3.3, "rs-node-2\n10.10.0.12", "SECONDARY", fc="#e3f2fd", ec=C_RS2_BORDER)
node(18.4, 5.1,  3.1, 3.3, "rs-node-3\n10.10.0.13", "SECONDARY", fc="#e3f2fd", ec=C_RS2_BORDER)

# Cluster 3 — crmRS (pink)
box(11.4, 1.0, 10.7, 3.5, C_RS3_BG, C_RS3_BORDER, lw=2, r=0.3, z=2)
txt(16.75, 4.3, "Cluster 3 — crmRS  ·  port 27019  ·  crm db", sz=10, w="bold", c=C_RS3_BORDER)
node(11.8, 1.3,  3.0, 2.7, "rs-node-1\n10.10.0.11", "PRIMARY", fc="#f8bbd0", ec=C_RS3_BORDER)
node(15.1, 1.3,  3.0, 2.7, "rs-node-2\n10.10.0.12", "SECONDARY", fc="#fce4ec", ec=C_RS3_BORDER)
node(18.4, 1.3,  3.1, 2.7, "rs-node-3\n10.10.0.13", "SECONDARY", fc="#fce4ec", ec=C_RS3_BORDER)

# ─── Arrows ────────────────────────────────────────────────────────────

# DBA → Ops Manager
arr(3.0, 13.2, 3.2, 12.8, "#1a73e8", "HTTP :8080", lw=2.2, lbl_x=4.2, lbl_y=13.2)

# Agentic DBA → Ops Manager (REST API)
arr(22.9, 13.5, 5.2, 12.8, "#e65100", "REST API (Digest auth)", lw=2.2, lbl_x=14.5, lbl_y=13.7)

# Agentic DBA → demoRS primary (wire)
arr(22.9, 12.0, 21.5, 11.2, "#e65100", "wire protocol", lw=1.8, dashed=True, lbl_x=22.5, lbl_y=12.0)

# Agentic DBA → analyticsRS primary (wire)
arr(22.9, 11.2, 21.5, 6.8, "#e65100", "", lw=1.6, dashed=True, rad=0.05)

# Agentic DBA → crmRS primary (wire)
arr(22.9, 10.7, 21.5, 2.7, "#e65100", "", lw=1.5, dashed=True, rad=0.1)

# Ops Manager → AppDB
arr(3.2, 11.2, 3.2, 10.9, "#757575", "AppDB", lw=1.5, dashed=True, lbl_x=4.3, lbl_y=11.05)

# Ops Manager → demoRS (automation)
arr(5.2, 11.2, 13.3, 11.3, C_RS1_BORDER, "Automation Agent", lw=2.0, lbl_x=9.7, lbl_y=11.55)

# Ops Manager → analyticsRS (automation)
arr(5.2, 11.2, 13.3, 6.7, C_RS2_BORDER, "Automation Agent", lw=2.0, lbl_x=9.0, lbl_y=9.5, rad=0.1)

# Ops Manager → crmRS (automation)
arr(5.2, 11.2, 13.3, 2.6, C_RS3_BORDER, "Automation Agent", lw=2.0, lbl_x=8.5, lbl_y=7.5, rad=0.2)

# Demo App → demoRS (slow queries) — KEY STORY
arr(9.8, 12.0, 11.4, 11.5, "#c62828", "slow queries\n(9 missing indexes)", lw=3.0, lbl_x=10.9, lbl_y=12.25)

# Demo App → analyticsRS
arr(9.8, 11.5, 11.4, 6.8, "#c62828", "slow queries\n(7 missing indexes)", lw=2.5, lbl_x=11.0, lbl_y=9.6, rad=0.08)

# Demo App → crmRS
arr(9.8, 11.0, 11.4, 2.6, "#c62828", "slow queries\n(5 missing indexes)", lw=2.0, lbl_x=11.2, lbl_y=7.0, rad=0.15)

# RS replication arrows (demoRS)
arr(14.8, 11.3, 15.1, 11.3, C_RS1_BORDER, "", lw=1.5)
arr(18.1, 11.3, 18.4, 11.3, C_RS1_BORDER, "", lw=1.5)

# RS replication arrows (analyticsRS)
arr(14.8, 6.7, 15.1, 6.7, C_RS2_BORDER, "", lw=1.5)
arr(18.1, 6.7, 18.4, 6.7, C_RS2_BORDER, "", lw=1.5)

# RS replication arrows (crmRS)
arr(14.8, 2.65, 15.1, 2.65, C_RS3_BORDER, "", lw=1.5)
arr(18.1, 2.65, 18.4, 2.65, C_RS3_BORDER, "", lw=1.5)

# ─── Legend ────────────────────────────────────────────────────────────
lx, ly = 0.9, 1.0
items = [
    ("#1a73e8", "-",  "DBA browser → Ops Manager (HTTP)"),
    ("#e65100", "-",  "Agentic DBA → OM REST API"),
    ("#e65100", "--", "Agentic DBA → MongoDB wire (diagnostics)"),
    ("#c62828", "-",  "Demo workload → clusters (slow queries, missing indexes)"),
    (C_RS1_BORDER, "-", "OM Automation Agent → replica set nodes"),
    ("#9e9e9e", "--", "RS replication (PRIMARY → SECONDARY)"),
]
for i, (color, ls, label) in enumerate(items):
    y_pos = ly + i * 0.5
    ax.plot([lx, lx + 0.8], [y_pos, y_pos], color=color, lw=2.2,
            linestyle=ls, solid_capstyle="round")
    ax.text(lx + 1.0, y_pos, label, fontsize=9, va="center", color="#424242")

# ─── Title ─────────────────────────────────────────────────────────────
ax.text(13.0, 0.22, "MongoDB Agentic DBA — Demo Platform  ·  3 Clusters  ·  21 Collections  ·  ~120k Documents",
        fontsize=13, fontweight="bold", ha="center", va="bottom", color="#212121")

plt.tight_layout(pad=0.2)
plt.savefig("architecture.png", dpi=180, bbox_inches="tight", facecolor="white", edgecolor="none")
print("Saved architecture.png")
