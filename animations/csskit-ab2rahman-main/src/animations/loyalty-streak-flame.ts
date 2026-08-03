import type { Animation } from "../data/animations";

const loyaltyStreakFlame: Animation = {
  slug: "loyalty-streak-flame",
  name: "Loyalty Streak Flame",
  category: "attention",
  description: "Soft pulsing flame badge for daily streak counters — warm and readable.",
  tags: ["loyalty", "streak", "flame", "pulse", "badge", "attention"],
  css: `.loyalty-streak-flame {
  --lsf-from: #f59e0b;
  --lsf-to: #ea580c;
  --lsf-speed: 1.4s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.8rem;
  color: #78350f;
  background: linear-gradient(135deg, #fef3c7, #ffedd5);
  border: 1px solid rgba(245, 158, 11, 0.35);
  box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35);
  animation: lsf-pulse var(--lsf-speed) ease-in-out infinite;
}

.loyalty-streak-flame__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--lsf-from), var(--lsf-to));
  box-shadow: 0 0 8px var(--lsf-from);
  animation: lsf-flicker calc(var(--lsf-speed) * 0.55) ease-in-out infinite;
}

@keyframes lsf-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.25); }
  50% { transform: scale(1.04); box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
}

@keyframes lsf-flicker {
  0%, 100% { transform: scale(1) translateY(0); opacity: 1; }
  50% { transform: scale(1.25) translateY(-1px); opacity: 0.85; }
}`,
  html: `<span class="loyalty-streak-flame"><span class="loyalty-streak-flame__dot"></span>7 day streak</span>`,
  params: [
    { name: "--lsf-from", label: "Flame From", type: "color", default: "#f59e0b" },
    { name: "--lsf-to", label: "Flame To", type: "color", default: "#ea580c" },
    { name: "--lsf-speed", label: "Speed", type: "duration", default: 1.4, min: 0.6, max: 3, step: 0.1, unit: "s" },
  ],
  preview: { width: 280, height: 120, darkBg: false },
};

export default loyaltyStreakFlame;
