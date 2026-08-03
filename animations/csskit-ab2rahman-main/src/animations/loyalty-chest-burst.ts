import type { Animation } from "../data/animations";

const loyaltyChestBurst: Animation = {
  slug: "loyalty-chest-burst",
  name: "Loyalty Chest Burst",
  category: "attention",
  description:
    "Reward chest open burst — radial gold/violet glow for combo chest claim celebrations.",
  tags: ["loyalty", "chest", "burst", "reward", "celebration", "attention"],
  css: `.loyalty-chest-burst {
  --lcb-gold: rgba(250, 204, 21, 0.5);
  --lcb-violet: rgba(167, 139, 250, 0.4);
  --lcb-orange: rgba(251, 146, 60, 0.35);
  --lcb-speed: 1.1s;
  position: relative;
  overflow: hidden;
  border-radius: 1.25rem;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #f5f3ff, #fff7ed);
  border: 1px solid rgba(167, 139, 250, 0.35);
}

.loyalty-chest-burst.is-open::after {
  content: "";
  pointer-events: none;
  position: absolute;
  inset: -25%;
  background:
    radial-gradient(circle at 50% 45%, var(--lcb-gold), transparent 42%),
    radial-gradient(circle at 30% 60%, var(--lcb-violet), transparent 40%),
    radial-gradient(circle at 70% 55%, var(--lcb-orange), transparent 38%);
  animation: lcb-burst var(--lcb-speed) ease-out both;
}

.loyalty-chest-burst__label {
  position: relative;
  z-index: 1;
  font-weight: 800;
  color: #5b21b6;
}

@keyframes lcb-burst {
  0% { opacity: 0; transform: scale(0.55); }
  35% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 0; transform: scale(1.28); }
}`,
  html: `<div class="loyalty-chest-burst is-open"><span class="loyalty-chest-burst__label">Chest Opened!</span></div>`,
  params: [
    { name: "--lcb-gold", label: "Gold Glow", type: "color", default: "#facc15" },
    { name: "--lcb-violet", label: "Violet Glow", type: "color", default: "#a78bfa" },
    { name: "--lcb-speed", label: "Speed", type: "duration", default: 1.1, min: 0.4, max: 2.5, step: 0.1, unit: "s" },
  ],
  preview: { width: 340, height: 160, darkBg: false },
};

export default loyaltyChestBurst;
