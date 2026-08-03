import type { Animation } from "../data/animations";

const loyaltyBadgeShine: Animation = {
  slug: "loyalty-badge-shine",
  name: "Loyalty Badge Shine",
  category: "hover",
  description: "Metallic shine sweep for Silver/Gold/Diamond loyalty badges on profile.",
  tags: ["loyalty", "badge", "shine", "hover", "profile"],
  css: `.loyalty-badge-shine {
  --lbs-from: #ede9fe;
  --lbs-to: #ffedd5;
  --lbs-text: #4c1d95;
  --lbs-shine: rgba(255, 255, 255, 0.55);
  --lbs-speed: 0.75s;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  overflow: hidden;
  padding: 0.55rem 0.9rem;
  border-radius: 1rem;
  font-weight: 800;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--lbs-text);
  background: linear-gradient(90deg, var(--lbs-from), var(--lbs-to));
  border: 1px solid rgba(124, 58, 237, 0.25);
  cursor: pointer;
}

.loyalty-badge-shine::before {
  content: "";
  position: absolute;
  top: 0;
  left: -70%;
  width: 45%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--lbs-shine), transparent);
  transform: skewX(-18deg);
}

.loyalty-badge-shine:hover::before,
.loyalty-badge-shine.is-active::before {
  animation: lbs-shine var(--lbs-speed) ease;
}

@keyframes lbs-shine {
  0% { left: -70%; }
  100% { left: 140%; }
}`,
  html: `<button class="loyalty-badge-shine is-active">Gold badge</button>`,
  params: [
    { name: "--lbs-from", label: "From", type: "color", default: "#ede9fe" },
    { name: "--lbs-to", label: "To", type: "color", default: "#ffedd5" },
    { name: "--lbs-text", label: "Text", type: "color", default: "#4c1d95" },
    { name: "--lbs-speed", label: "Speed", type: "duration", default: 0.75, min: 0.3, max: 2, step: 0.05, unit: "s" },
  ],
  preview: { width: 280, height: 120, darkBg: false },
};

export default loyaltyBadgeShine;
