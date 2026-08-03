import type { Animation } from "../data/animations";

const loyaltyProgressFill: Animation = {
  slug: "loyalty-progress-fill",
  name: "Loyalty Progress Fill",
  category: "loading",
  description: "Animated gradient fill bar for next combo chest / streak milestone progress.",
  tags: ["loyalty", "progress", "bar", "loading", "streak"],
  css: `.loyalty-progress-fill {
  --lpr-from: #8b5cf6;
  --lpr-to: #f59e0b;
  --lpr-track: #ede9fe;
  --lpr-value: 62%;
  --lpr-speed: 1.2s;
  width: 220px;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--lpr-track);
}

.loyalty-progress-fill__bar {
  height: 100%;
  width: var(--lpr-value);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--lpr-from), var(--lpr-to));
  background-size: 200% 100%;
  animation: lpr-fill var(--lpr-speed) ease-out both, lpr-shimmer 1.8s linear infinite;
}

@keyframes lpr-fill {
  from { width: 0%; }
  to { width: var(--lpr-value); }
}

@keyframes lpr-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}`,
  html: `<div class="loyalty-progress-fill"><div class="loyalty-progress-fill__bar"></div></div>`,
  params: [
    { name: "--lpr-from", label: "From", type: "color", default: "#8b5cf6" },
    { name: "--lpr-to", label: "To", type: "color", default: "#f59e0b" },
    { name: "--lpr-value", label: "Value", type: "text", default: "62%" },
    { name: "--lpr-speed", label: "Fill Speed", type: "duration", default: 1.2, min: 0.3, max: 2.5, step: 0.1, unit: "s" },
  ],
  preview: { width: 300, height: 100, darkBg: false },
};

export default loyaltyProgressFill;
