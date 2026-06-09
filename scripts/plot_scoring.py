import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from scipy.optimize import curve_fit

BREAKPOINTS = [
    (0.01, 13),
    (0.02, 12),
    (0.03, 11),
    (0.06, 10),
    (0.09,  9),
    (0.15,  7),
    (0.25,  6),
    (0.30,  5),
    (0.40,  4),
    (0.45,  3),
    (0.75,  2),
    (0.90,  1),
]

probs = np.array([p for p, _ in BREAKPOINTS])
pts   = np.array([v for _, v in BREAKPOINTS], dtype=float)

# ── Fit exponencial: f(p) = a·exp(b·p) + c ───────────────────────────────────

def exp_model(p, a, b, c):
    return a * np.exp(b * p) + c

params, _ = curve_fit(exp_model, probs, pts, p0=[13.0, -3.0, 0.5], maxfev=10000)
a, b, c = params
rmse = np.sqrt(np.mean((pts - exp_model(probs, *params)) ** 2))

print(f"f(p) = {a:.4f} · exp({b:.4f} · p) + {c:.4f}")
print(f"RMSE = {rmse:.4f}\n")
print(f"{'prob':>6}  {'esperado':>9}  {'ajustado':>9}  {'erro':>7}")
for p, actual in zip(probs, pts):
    fitted = exp_model(p, *params)
    print(f"{p*100:5.0f}%  {actual:9.0f}  {fitted:9.2f}  {fitted-actual:+7.2f}")

# ── Curvas ────────────────────────────────────────────────────────────────────

x = np.linspace(0.005, 0.98, 1000)
y_cont    = np.where(x < 0.015, 13, np.clip(exp_model(x, *params), 1, 13))
y_rounded = np.where(x < 0.015, 13, np.clip(np.round(exp_model(x, *params)), 1, 13))

# ── Plot ──────────────────────────────────────────────────────────────────────

def _style_ax(ax):
    ax.set_xlabel("Probabilidade (%)")
    ax.set_ylabel("Pontos")
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 14)
    ax.xaxis.set_major_formatter(mticker.FormatStrFormatter("%g%%"))
    ax.yaxis.set_major_locator(mticker.MultipleLocator(1))
    ax.grid(True, alpha=0.3)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle(
    f"Fit exponencial — f(p) = {a:.3f}·exp({b:.3f}·p) + {c:.3f}   RMSE={rmse:.3f}",
    fontsize=12, fontweight="bold",
)

ax = axes[0]
ax.set_title("Curva contínua")
ax.plot(x * 100, y_cont, color="#16a34a", linewidth=2, label="Exponencial")
ax.scatter(probs * 100, pts, color="#dc2626", zorder=5, s=60, label="Breakpoints")
_style_ax(ax)
ax.legend()

ax2 = axes[1]
ax2.set_title("Pontos efetivos (arredondados)")
ax2.step(x * 100, y_rounded, color="#16a34a", linewidth=2, where="mid", label="Exponencial")
ax2.scatter(probs * 100, pts, color="#dc2626", zorder=5, s=60, label="Breakpoints")
_style_ax(ax2)
ax2.legend()

plt.tight_layout()
plt.savefig("scripts/scoring_curve_v2.png", dpi=150)
plt.show()
print("\nGráfico salvo em scripts/scoring_curve_v2.png")
