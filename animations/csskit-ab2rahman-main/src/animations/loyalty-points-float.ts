import type { Animation } from "../data/animations";

const loyaltyPointsFloat: Animation = {
  slug: "loyalty-points-float",
  name: "Loyalty Points Float",
  category: "entrance",
  description: "Floating +points toast that rises and fades after rewards or chest claims.",
  tags: ["loyalty", "points", "float", "reward", "entrance"],
  css: `.loyalty-points-float {
  --lpf-color: #b45309;
  --lpf-speed: 1.35s;
  display: inline-block;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--lpf-color);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
  animation: lpf-float var(--lpf-speed) ease-out both;
}

@keyframes lpf-float {
  0% { opacity: 0; transform: translateY(12px) scale(0.9); }
  20% { opacity: 1; transform: translateY(0) scale(1.08); }
  70% { opacity: 1; transform: translateY(-10px) scale(1); }
  100% { opacity: 0; transform: translateY(-22px) scale(0.98); }
}`,
  html: `<span class="loyalty-points-float">+40 ball</span>`,
  params: [
    { name: "--lpf-color", label: "Color", type: "color", default: "#b45309" },
    { name: "--lpf-speed", label: "Speed", type: "duration", default: 1.35, min: 0.6, max: 2.5, step: 0.05, unit: "s" },
  ],
  preview: { width: 240, height: 140, darkBg: false },
};

export default loyaltyPointsFloat;
