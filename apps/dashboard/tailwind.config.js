/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist: [
    // Blindspots report: classes in API-generated HTML (Tailwind can't detect)
    "font-semibold", "font-normal", "text-slate-200", "text-slate-100", "text-slate-300", "text-amber-200/90", "text-amber-400", "text-amber-300", "text-base", "text-sm", "text-xs",
    "border-b", "border-l-2", "border-slate-600/60", "border-amber-500/50", "bg-amber-500/5", "bg-slate-700/50",
    "pb-2", "mb-4", "mb-2", "mb-1.5", "mt-5", "mt-3", "my-2", "my-3", "my-0.5", "py-0.5", "px-3", "px-1", "py-0.5",
    "leading-relaxed", "rounded-r", "rounded", "list-disc", "list-decimal", "pl-5", "underline", "hover:text-amber-300",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        beige: "rgb(var(--beige-rgb))",
      },
    },
  },
  plugins: [],
};
