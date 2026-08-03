import type { Animation } from "../data/animations";

const loyaltyCheckinPop: Animation = {
  slug: "loyalty-checkin-pop",
  name: "Loyalty Check-in Pop",
  category: "entrance",
  description: "Bouncy success pop for daily word-of-day check-in confirmation chips.",
  tags: ["loyalty", "checkin", "pop", "entrance", "success"],
  css: `.loyalty-checkin-pop {
  --lcp-bg: #ccfbf1;
  --lcp-text: #115e59;
  --lcp-speed: 0.55s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--lcp-text);
  background: var(--lcp-bg);
  animation: lcp-pop var(--lcp-speed) cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes lcp-pop {
  0% { opacity: 0; transform: translateY(10px) scale(0.86); }
  55% { opacity: 1; transform: translateY(0) scale(1.06); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}`,
  html: `<span class="loyalty-checkin-pop">✓ Checked in today</span>`,
  params: [
    { name: "--lcp-bg", label: "Background", type: "color", default: "#ccfbf1" },
    { name: "--lcp-text", label: "Text", type: "color", default: "#115e59" },
    { name: "--lcp-speed", label: "Speed", type: "duration", default: 0.55, min: 0.2, max: 1.5, step: 0.05, unit: "s" },
  ],
  preview: { width: 300, height: 120, darkBg: false },
};

export default loyaltyCheckinPop;
