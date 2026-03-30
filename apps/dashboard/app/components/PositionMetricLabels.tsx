import { KaTeXInline } from "./KaTeXInline";

const labelClass = "pm-katex inline-block align-baseline [&_.katex]:text-[0.95em]";

/** Math-italic *r* (ROI). */
export function RoiLabel() {
  return <KaTeXInline latex="r" className={labelClass} />;
}

/** *r* with superscript *p* and subscript *a* (PAROI). */
export function ParoiLabel() {
  return <KaTeXInline latex="r^{p}_{a}" className={labelClass} />;
}
