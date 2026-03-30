import katex from "katex";
import "katex/dist/katex.min.css";

function renderInline(latex: string): string {
  try {
    return katex.renderToString(latex, {
      displayMode: false,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return latex;
  }
}

/** Inline KaTeX (same rendering as the math page). */
export function KaTeXInline({
  latex,
  className,
}: {
  latex: string;
  className?: string;
}) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderInline(latex) }}
    />
  );
}
