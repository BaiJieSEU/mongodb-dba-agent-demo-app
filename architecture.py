"""
Architecture diagram — MongoDB Agentic DBA Demo Platform
"""
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch

# ── Colour palette ────────────────────────────────────────────────────
C_GCP_BG      = "#e8f0fe"
C_GCP_BORDER  = "#4285f4"
C_OM_BG       = "#fff8e1"
C_OM_BORDER   = "#f9a825"
C_RS_BG       = "#e8f5e9"
C_RS_BORDER   = "#2e7d32"
C_TEXT        = "#212121"
C_MUTED       = "#546e7a"

fig, ax = plt.subplots(figsize=(22, 13))
ax.set_xlim(0, 22)
ax.set_ylim(0, 13)
ax.axis("off")
fig.patch.set_facecolor("white")

# ─────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────

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
    cy = y + h / 2 + (0.16 if sub else 0)
    txt(x + w/2, cy,  title, sz=11, w="bold", z=5)
    if sub:
        txt(x + w/2, y + h/2 - 0.25, sub, sz=9, c=C_MUTED, z=5)

def arr(ax, x1, y1, x2, y2, color, lbl="", lw=2, dashed=False,
        lbl_x=None, lbl_y=None, rad=0.0):
    ls = "--" if dashed else "-"
    ax.annotate(
        "", xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(
            arrowstyle="-|>", color=color, lw=lw,
            linestyle=ls,
            connectionstyle=f"arc3,rad={rad}",
        ),
        zorder=6,
    )
    if lbl:
        mx = lbl_x if lbl_x is not None else (x1+x2)/2
        my = lbl_y if lbl_y is not None else (y1+y2)/2
        ax.text(mx, my, lbl, fontsize=9, color=color, ha="center", va="center",
                fontweight="bold", zorder=8,
                bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.9))

# ─────────────────────────────────────────────────────────────────────
# 1. External actors  (outside GCP box)
# ─────────────────────────────────────────────────────────────────────
# DBA/Browser — top-left
box(0.3, 9.2, 2.6, 2.8, "#e3f2fd", "#1a73e8", lw=2, r=0.25, z=3)
txt(1.6, 11.55, "DBA / Browser",  sz=11, w="bold",  c="#1a73e8")
txt(1.6, 11.1,  "Ops Manager UI", sz=9.5, c=C_MUTED)
txt(1.6, 10.7,  "http://:8080",   sz=9,   c=C_MUTED)

# Agentic DBA — top-right
box(19.1, 7.8, 2.6, 3.8, "#fbe9e7", "#e65100", lw=2, r=0.25, z=3)
txt(20.4, 11.2,  "Agentic DBA",    sz=11, w="bold",  c="#e65100")
txt(20.4, 10.75, "Health Check",   sz=9.5, c=C_MUTED)
txt(20.4, 10.3,  "(AI Agent)",     sz=9,   c=C_MUTED)
txt(20.4, 9.6,   "Tools:", sz=9, c=C_MUTED)
txt(20.4, 9.2,   "· OM REST API",  sz=8.5, c=C_MUTED)
txt(20.4, 8.85,  "· MongoDB wire", sz=8.5, c=C_MUTED)
txt(20.4, 8.5,   "· Index advisor", sz=8.5, c=C_MUTED)

# ─────────────────────────────────────────────────────────────────────
# 2. GCP boundary
# ─────────────────────────────────────────────────────────────────────
box(0.3, 0.6, 18.6, 11.2, C_GCP_BG, C_GCP_BORDER, lw=2.5, r=0.5, z=0, alpha=0.55)
txt(9.6, 11.65, "GCP  ·  us-central1  ·  VPC 10.10.0.0/24",
    sz=12, w="bold", c=C_GCP_BORDER)

# ─────────────────────────────────────────────────────────────────────
# 3. om-host cluster
# ─────────────────────────────────────────────────────────────────────
box(0.8, 5.0, 8.0, 6.3, C_OM_BG, C_OM_BORDER, lw=2, r=0.35, z=1)
txt(4.8, 11.1, "om-host  ·  10.10.0.10  ·  e2-standard-2  ·  30 GB",
    sz=10.5, w="bold", c=C_OM_BORDER)

# Ops Manager node
node(1.2, 8.0, 3.3, 2.8,
     "Ops Manager",
     "v8.0.21  ·  port 8080",
     fc="#fff3e0", ec=C_OM_BORDER)

# Demo App node
node(5.0, 8.0, 3.3, 2.8,
     "Demo App",
     "seed.js  ·  workload.js",
     fc="#e3f2fd", ec="#1565c0")

# AppDB (smaller, below OM)
node(1.2, 5.3, 3.3, 2.3,
     "AppDB  ·  appdbRS",
     ":27017  /  :27018  /  :27019",
     fc="#e8f5e9", ec="#2e7d32")

# ─────────────────────────────────────────────────────────────────────
# 4. demoRS cluster
# ─────────────────────────────────────────────────────────────────────
box(9.6, 0.9, 9.0, 10.3, C_RS_BG, C_RS_BORDER, lw=2, r=0.35, z=1)
txt(14.1, 11.0, "demoRS  ·  MongoDB 8.0 Enterprise  ·  3-node replica set",
    sz=10.5, w="bold", c=C_RS_BORDER)

node(10.0, 7.8, 8.2, 2.8,
     "rs-node-1  ·  10.10.0.11",
     "PRIMARY  ·  e2-medium  ·  20 GB",
     fc="#c8e6c9", ec=C_RS_BORDER)

node(10.0, 4.4, 8.2, 2.8,
     "rs-node-2  ·  10.10.0.12",
     "SECONDARY  ·  e2-medium  ·  20 GB",
     fc="#dcedc8", ec=C_RS_BORDER)

node(10.0, 1.2, 8.2, 2.8,
     "rs-node-3  ·  10.10.0.13",
     "SECONDARY  ·  e2-medium  ·  20 GB",
     fc="#dcedc8", ec=C_RS_BORDER)

# ─────────────────────────────────────────────────────────────────────
# 5. Arrows
# ─────────────────────────────────────────────────────────────────────

# DBA Browser → Ops Manager
arr(ax, 2.9, 10.2, 2.7, 10.8, "#1a73e8", "HTTP :8080",
    lw=2.2, lbl_x=3.6, lbl_y=10.5)

# Agentic DBA → Ops Manager REST API
arr(ax, 19.1, 10.5, 4.5, 9.8, "#e65100", "REST API  (Digest auth)",
    lw=2.2, lbl_x=12.2, lbl_y=10.35)

# Agentic DBA → rs-node-1 (wire protocol)
arr(ax, 19.1, 9.0, 18.2, 8.8, "#e65100", "wire protocol (diagnostics)",
    lw=1.8, dashed=True, lbl_x=18.0, lbl_y=9.3, rad=-0.1)

# Ops Manager → AppDB
arr(ax, 2.85, 8.0, 2.85, 7.6, "#757575", "AppDB connection",
    lw=1.6, dashed=True, lbl_x=4.0, lbl_y=7.8)

# Ops Manager → rs-node-1 (Automation Agent)
arr(ax, 4.5, 8.0, 10.0, 8.8, "#1565c0", "Automation Agent",
    lw=2.0, lbl_x=7.5, lbl_y=8.65)

# Ops Manager → rs-node-2 (Automation)
arr(ax, 4.5, 8.0, 10.0, 5.6, "#1565c0", "",
    lw=1.5, dashed=True, rad=0.15)

# Ops Manager → rs-node-3 (Automation)
arr(ax, 4.5, 8.0, 10.0, 2.6, "#1565c0", "",
    lw=1.5, dashed=True, rad=0.25)

# Demo App → rs-node-1  ← THE KEY STORY (bold red)
arr(ax, 8.3, 9.2, 10.0, 9.2, "#c62828",
    "slow queries  (5 missing indexes)",
    lw=3.0, lbl_x=9.2, lbl_y=9.55)

# Replication: node-1 → node-2
arr(ax, 14.1, 7.8, 14.1, 7.2, "#2e7d32", "replication",
    lw=1.8, dashed=True, lbl_x=15.5, lbl_y=7.5)

# Replication: node-2 → node-3
arr(ax, 14.1, 4.4, 14.1, 4.0, "#2e7d32", "",
    lw=1.8, dashed=True)

# ─────────────────────────────────────────────────────────────────────
# 6. Legend
# ─────────────────────────────────────────────────────────────────────
lx, ly, lh = 0.9, 0.85, 0.42
legend_items = [
    ("#1a73e8",  "solid",  "DBA browser → Ops Manager (HTTP)"),
    ("#e65100",  "solid",  "Agentic DBA → OM REST API"),
    ("#e65100",  "dashed", "Agentic DBA → MongoDB wire protocol (diagnostics)"),
    ("#c62828",  "solid",  "Demo workload → demoRS  (slow queries, missing indexes)"),
    ("#1565c0",  "solid",  "OM Automation Agent → replica set nodes"),
    ("#2e7d32",  "dashed", "RS replication (PRIMARY → SECONDARY)"),
]
for i, (color, ls, label_text) in enumerate(legend_items):
    y_pos = ly + i * lh
    linestyle = "--" if ls == "dashed" else "-"
    ax.plot([lx, lx + 0.7], [y_pos, y_pos],
            color=color, lw=2.2, linestyle=linestyle, solid_capstyle="round")
    ax.text(lx + 0.9, y_pos, label_text,
            fontsize=8.5, va="center", color="#424242")

# ─────────────────────────────────────────────────────────────────────
# 7. Title
# ─────────────────────────────────────────────────────────────────────
ax.text(11.0, 0.25, "MongoDB Agentic DBA — Demo Platform",
        fontsize=17, fontweight="bold", ha="center", va="bottom", color="#212121")

plt.tight_layout(pad=0.2)
plt.savefig("architecture.png", dpi=180, bbox_inches="tight",
            facecolor="white", edgecolor="none")
print("Saved architecture.png")
