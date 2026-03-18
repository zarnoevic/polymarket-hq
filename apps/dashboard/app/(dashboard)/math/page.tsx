"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function MathBlock({ children }: { children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(children, ref.current, {
        displayMode: true,
        throwOnError: false,
        output: "html",
      });
    } catch {
      ref.current.textContent = children;
    }
  }, [children]);
  return <div ref={ref} className=" overflow-x-auto py-2" />;
}

function MathInline({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(children, ref.current, {
        displayMode: false,
        throwOnError: false,
        output: "html",
      });
    } catch {
      ref.current.textContent = children;
    }
  }, [children]);
  return <span ref={ref} className="align-middle" />;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/50">
      <div className="border-b border-slate-700/50 px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-beige">
          <Icon className="h-5 w-5 text-indigo-400" />
          {title}
        </h2>
      </div>
      <div className="space-y-6 p-6">{children}</div>
    </div>
  );
}

function TheoryBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">{title}</h4>
      <div className="space-y-2 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function ExampleBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">{title}</h4>
      <div className="space-y-2 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function PracticeBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">{title}</h4>
      <div className="space-y-2 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function IntegralIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`}>
      <MathInline>{"\\int"}</MathInline>
    </span>
  );
}

export default function MathPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--background-rgb))]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(230,230,225,.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(230,230,225,.08) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-beige">
            Polymarket Math Reference
          </h1>
          <p className="mt-2 text-slate-400">
            Textbook-level reference for Polymarket decision-making, trade sizing, and analytics. Each section covers theory, practical usage, and worked examples with real numbers.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            All formulas match the implementation in the dashboard. Blue = theory, Amber = worked examples, Green = in-practice usage.
          </p>
        </div>

        <div className="space-y-8">
          {/* 1. Core Decision Making — EV */}
          <Section title="1. Core Decision Making — Expected Value" icon={IntegralIcon}>
            <TheoryBox title="What is Expected Value?">
              <p>
                Expected value (<MathInline>{"\\text{EV}"}</MathInline>) is the average profit (or loss) per unit bet if you repeated the same bet infinitely many times. In a binary prediction market, you buy a share that pays <strong>1</strong> if the outcome occurs and <strong>0</strong> otherwise. You pay the market price (plus spread <MathInline>{"s"}</MathInline>) to buy. Your <MathInline>{"\\text{EV} = p_{\\text{app}} \\times 1 - (q + s)"}</MathInline> for YES. If <MathInline>{"\\text{EV} > 0"}</MathInline>, the bet is profitable in expectation; if <MathInline>{"\\text{EV} < 0"}</MathInline>, you lose money on average.
              </p>
              <p>
                The key insight: the market price reflects the crowd&apos;s probability. Your job is to have a better probability estimate. When your estimate exceeds the price (adjusted for costs), you have an <strong>edge</strong>.
              </p>
            </TheoryBox>

            <PracticeBox title="How we use it in Polymarket">
              The screener appraises each market (AI or manual) to get <code>appraisedYes</code> and <code>appraisedNo</code>. We compare these to the quoted <code>probabilityYes</code> / <code>probabilityNo</code>. YEV and NEV are ratio heuristics: YEV = appraisedYes ÷ quotedYes. If YEV &gt; 1, the YES side is undervalued; if NEV &gt; 1, the NO side is undervalued. You then size the bet with Kelly.
            </PracticeBox>

            <ExampleBox title="Worked example: Will X happen by March 31?">
              <p><strong>Given:</strong></p>
              <p><MathInline>{"q_{\\text{yes}} = 0.65"}</MathInline></p>
              <p><MathInline>{"q_{\\text{no}} = 0.38"}</MathInline></p>
              <p><MathInline>{"s = 0.02"}</MathInline></p>
              <p><MathInline>{"p_{\\text{app}} = 0.72"}</MathInline></p>
              <p><strong>EV for YES:</strong></p>
              <p><MathInline>{"\\text{EV}_{\\text{yes}} = 0.72 - (0.65 + 0.02) = 0.72 - 0.67 = +0.05"}</MathInline> per share → edge on YES.</p>
              <p><strong>EV for NO:</strong></p>
              <p><MathInline>{"\\text{EV}_{\\text{no}} = (1 - 0.72) - (0.38 + 0.02) = 0.28 - 0.40 = -0.12"}</MathInline> → no edge.</p>
              <p><strong>YEV:</strong> <MathInline>{"0.72 / 0.65 \\approx 1.11"}</MathInline> (&gt; 1 ✓)</p>
              <p><strong>NEV:</strong> <MathInline>{"0.28 / 0.38 \\approx 0.74"}</MathInline> (&lt; 1 ✗)</p>
              <p>Bet YES only. If you buy 100 YES at 67¢ ($67), expected profit = 100 × 0.05 = $5.</p>
            </ExampleBox>

            <p className="text-sm text-slate-300">
              Whether to enter a trade: compare your appraised probability with the quoted market price. Positive EV = edge.
            </p>

            <h3 className="text-sm font-medium text-indigo-300">Probabilities</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <MathInline>{"p_{\\text{app}}"}</MathInline> = appraised probability (your model/AI belief, 0–1)
              </li>
              <li>
                <MathInline>{"q"}</MathInline> = quoted probability (market mid-price, 0–1)
              </li>
              <li>
                <MathInline>{"p_{\\text{real}}"}</MathInline> = true probability (unknown ex ante; resolves to 0 or 1)
              </li>
              <li>
                <MathInline>{"s"}</MathInline> = spread (ask–bid, added to mid-price for buy cost)
              </li>
              <li>
                <MathInline>{"d"}</MathInline> = days to resolution (for annualization)
              </li>
            </ul>

            <h3 className="text-sm font-medium text-indigo-300">EV for binary markets</h3>
            <p className="text-sm text-slate-400">
              Each share pays 1 if the outcome occurs, 0 otherwise. You pay <MathInline>{"q + s"}</MathInline> (quoted + spread) to buy.
            </p>
            <MathBlock>{"\\text{EV}_{\\text{yes}} = p_{\\text{app}} \\cdot 1 + (1 - p_{\\text{app}}) \\cdot 0 - (q_{\\text{yes}} + s) = p_{\\text{app}} - (q_{\\text{yes}} + s)"}</MathBlock>
            <MathBlock>{"\\text{EV}_{\\text{no}} = (1 - p_{\\text{app}}) \\cdot 1 + p_{\\text{app}} \\cdot 0 - (q_{\\text{no}} + s) = (1 - p_{\\text{app}}) - (q_{\\text{no}} + s)"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">YEV / NEV (implementation)</h3>
            <p className="text-sm text-slate-400">
              The screener uses a ratio form: <strong>YEV</strong> = Yes Expected Value, <strong>NEV</strong> = No Expected Value.
            </p>
            <MathBlock>{"\\text{YEV} = \\frac{p_{\\text{app,yes}}}{q_{\\text{yes}}} \\quad \\text{(only if } q_{\\text{yes}} > 0 \\text{)}"}</MathBlock>
            <MathBlock>{"\\text{NEV} = \\frac{p_{\\text{app,no}}}{q_{\\text{no}}} = \\frac{1 - p_{\\text{app,yes}}}{q_{\\text{no}}} \\quad \\text{(only if } q_{\\text{no}} > 0 \\text{)}"}</MathBlock>
            <p className="text-sm text-slate-500">
              Implementation: <code className="rounded bg-slate-800 px-1 font-mono text-xs">yev = appraisedYes / quotedYes</code>;{" "}
              <code className="rounded bg-slate-800 px-1 font-mono text-xs">nev = appraisedNo / quotedNo</code>. YEV &gt; 1 or NEV &gt; 1 indicates positive EV for that side.
            </p>

            <h3 className="text-sm font-medium text-indigo-300">Go-in rule</h3>
            <p className="text-sm text-slate-400">
              Enter YES if <MathInline>{"p_{\\text{app}} > q_{\\text{yes}} + s"}</MathInline>. Enter NO if <MathInline>{"1 - p_{\\text{app}} > q_{\\text{no}} + s"}</MathInline>. Otherwise, pass.
            </p>
          </Section>

          {/* 2. PROI, PAROI, CAROI, CROI */}
          <Section title="2. PROI, PAROI, CAROI, CROI — ROI Metrics" icon={IntegralIcon}>
            <TheoryBox title="What are these ROI metrics?">
              <p>
                In prediction markets, each share pays <strong>1</strong> at resolution. If you buy at price <MathInline>{"P_{\\text{buy}}"}</MathInline>, your profit if you win is <MathInline>{"1 - P_{\\text{buy}}"}</MathInline>. The raw return multiple is <MathInline>{"r = \\frac{1 - P}{P}"}</MathInline> — e.g. buy at 0.50 → win 0.50 per share → <MathInline>{"r = 1"}</MathInline> (100% return).
              </p>
              <p>
                <strong>PROI</strong> (Present ROI) and <strong>CROI</strong> (Cumulative ROI) are non-annualized. <strong>PAROI</strong> and <strong>CAROI</strong> annualize by multiplying by <MathInline>{"365/d"}</MathInline>: a 30-day position with <MathInline>{"r = 0.5"}</MathInline> gets <MathInline>{"\\text{PAROI} = 0.5 \\times \\frac{365}{30} \\approx 6.08"}</MathInline> (608% annualized). This lets you compare positions with different time horizons.
              </p>
              <p>
                <MathInline>{"P"}</MathInline> = Present (current price); <MathInline>{"C"}</MathInline> = Cumulative (entry price). Use P-metrics to see how the market values your position now; use C-metrics for what you locked in at entry.
              </p>
            </TheoryBox>

            <PracticeBox title="How we use it">
              PROI/PAROI use <code>curPrice</code> — the market&apos;s current valuation. Negative values mean the market moved against you. CAROI/CROI use <code>avgPrice</code> (your average entry). Category averages are value-weighted so large positions count more.
            </PracticeBox>

            <ExampleBox title="Example: YES at 60¢, 45 days to resolution">
              <p>Buy YES at 60¢, spread 0.01.</p>
              <p><MathInline>{"P_{\\text{buy}} = 0.60 + 0.01 = 0.61"}</MathInline></p>
              <p><MathInline>{"r = \\frac{1 - 0.61}{0.61} \\approx 0.639"}</MathInline> (63.9% to resolution)</p>
              <p><MathInline>{"\\text{PAROI} = 0.639 \\times \\frac{365}{45} \\approx 5.18"}</MathInline> (518% annualized)</p>
              <p>If market moves to 70¢:</p>
              <p><MathInline>{"P_{\\text{cur}} = 0.70"}</MathInline></p>
              <p><MathInline>{"r \\approx 0.408"}</MathInline></p>
              <p><MathInline>{"\\text{PAROI} \\approx 3.31"}</MathInline></p>
            </ExampleBox>

            <p className="text-sm text-slate-300">
              ROI metrics measure return from buy price to payoff (1). Display: 1x = 100% return. Use entry or current price; annualize by time to resolution.
            </p>

            <h3 className="text-sm font-medium text-indigo-300">Buy price (with spread)</h3>
            <MathBlock>{"P_{\\text{buy}} = \\min(0.99,\\; P_{\\text{mid}} + s)"}</MathBlock>
            <p className="text-sm text-slate-500">Where <MathInline>{"P_{\\text{mid}}"}</MathInline> is mid-price and <MathInline>{"s"}</MathInline> is ask-bid spread.</p>

            <h3 className="text-sm font-medium text-indigo-300">Raw ROI (return multiple)</h3>
            <MathBlock>{"r = \\frac{1 - P_{\\text{buy}}}{P_{\\text{buy}}}"}</MathBlock>
            <p className="text-sm text-slate-500">Profit per unit staked if the event resolves in your favor.</p>

            <h3 className="text-sm font-medium text-indigo-300">PROI — Present ROI</h3>
            <p className="text-sm text-slate-400">From <strong>current</strong> market price to payoff. Non-annualized. How the market prices your position now.</p>
            <MathBlock>{"\\text{PROI} = \\frac{1 - (P_{\\text{cur}} + s)}{P_{\\text{cur}} + s}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">PAROI — Present Annualized ROI</h3>
            <p className="text-sm text-slate-400">Same as PROI but annualized over days to resolution.</p>
            <MathBlock>{"\\text{PAROI} = r \\times \\frac{365}{d} \\quad \\text{where } r = \\frac{1 - P_{\\text{buy}}}{P_{\\text{buy}}}, \\; P_{\\text{buy}} = P_{\\text{cur}} + s"}</MathBlock>
            <p className="text-sm text-slate-500">Implementation: <code className="rounded bg-slate-800 px-1 font-mono text-xs">r * (365 / days)</code> with <code className="rounded bg-slate-800 px-1 font-mono text-xs">days = daysToResolution</code>.</p>

            <h3 className="text-sm font-medium text-indigo-300">CAROI — Cumulative Annualized ROI (entry)</h3>
            <p className="text-sm text-slate-400">From <strong>entry</strong> price (<MathInline>{"P_{\\text{avg}}"}</MathInline>) to payoff, annualized.</p>
            <MathBlock>{"\\text{CAROI} = r \\times \\frac{365}{d} \\quad \\text{where } r = \\frac{1 - (P_{\\text{avg}} + s)}{P_{\\text{avg}} + s}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">CROI — Cumulative ROI (entry, non-annualized)</h3>
            <MathBlock>{"\\text{CROI} = \\frac{1 - (P_{\\text{avg}} + s)}{P_{\\text{avg}} + s}"}</MathBlock>
            <p className="text-sm text-slate-500">Same ROI formula as PROI but using <MathInline>{"P_{\\text{avg}}"}</MathInline> (average entry price).</p>

            <h3 className="text-sm font-medium text-indigo-300">YES vs NO PAROI (screener)</h3>
            <p className="text-sm text-slate-400">
              For screener events, <strong>yesParoi</strong> and <strong>noParoi</strong> are PAROI at the quoted YES/NO mid-prices:
            </p>
            <MathBlock>{"\\text{yesParoi} = \\frac{1 - q_{\\text{yes}}}{q_{\\text{yes}}} \\times \\frac{365}{d} \\quad \\text{if } q_{\\text{yes}} \\in (0,1]"}</MathBlock>
            <MathBlock>{"\\text{noParoi} = \\frac{1 - q_{\\text{no}}}{q_{\\text{no}}} \\times \\frac{365}{d} \\quad \\text{if } q_{\\text{no}} \\in (0,1]"}</MathBlock>
            <p className="text-sm text-slate-500">Used for quick comparison of implied annualized returns for YES vs NO at current quotes.</p>

            <h3 className="text-sm font-medium text-indigo-300">Category averages</h3>
            <p className="text-sm text-slate-400">Value-weighted: <MathInline>{"\\overline{\\text{PAROI}} = \\frac{\\sum_i \\text{PAROI}_i \\cdot |V_i|}{\\sum_i |V_i|}"}</MathInline> over positions in the category.</p>
          </Section>

          {/* 3. Trade Sizing — Kelly */}
          <Section title="3. Trade Sizing — Partial Kelly Criterion" icon={IntegralIcon}>
            <TheoryBox title="What is the Kelly Criterion?">
              <p>
                The Kelly criterion (1956, John Larry Kelly Jr.) answers: <strong>what fraction of your bankroll should you bet</strong> to maximize long-run growth? It balances reward (edge) and risk (variance). Bet too little and you grow slowly; bet too much and you risk ruin or severe drawdowns. Kelly finds the sweet spot that maximizes the geometric growth rate of wealth.
              </p>
              <p>
                Full Kelly is aggressive: it can recommend large bets and lead to high volatility. <strong>Fractional Kelly</strong> (e.g., half or quarter Kelly) is standard in practice — it keeps most of the growth benefit while cutting drawdowns and variance substantially.
              </p>
            </TheoryBox>

            <PracticeBox title="How we use it in Polymarket">
              In the screener, you set your appraised probability <MathInline>{"p"}</MathInline>, the Kelly divisor <MathInline>{"c"}</MathInline> (default 4 = quarter Kelly), and choose YES or NO. The system computes buy price from quoted mid + spread and outputs the optimal fraction of portfolio to bet. You can override with trader appraisal. The result is shown as a percentage and dollar amount given your portfolio value.
            </PracticeBox>

            <ExampleBox title="Worked example: Quarter Kelly">
              <p><strong>Given:</strong></p>
              <p>Quoted YES = 55¢, spread = 1¢</p>
              <p>Buy price = 56¢</p>
              <p>You appraise 65% YES</p>
              <p className="mt-2"><strong>Step 1:</strong></p>
              <p><MathInline>{"b = (1 - 0.56) / 0.56 = 0.786"}</MathInline></p>
              <p><strong>Step 2:</strong> Full Kelly <MathInline>{"f^* = 0.65 - (0.35 / 0.786) = 0.65 - 0.445 = 0.205"}</MathInline> (20.5%)</p>
              <p><strong>Step 3:</strong> Quarter Kelly (c=4): <MathInline>{"f = 0.205 / 4 = 0.051"}</MathInline> (5.1%)</p>
              <p className="mt-2">If portfolio = $10,000, bet 5.1% = <strong>$510</strong> on YES. That buys ~910 shares at 56¢. If you win, profit ≈ $400; if you lose, you lose $510.</p>
            </ExampleBox>

            <p className="text-sm text-slate-300">
              Kelly gives optimal bet size for long-run growth. Partial Kelly (divide by c) reduces variance and drawdowns.
            </p>

            <h3 className="text-sm font-medium text-indigo-300">Full Kelly (binary market)</h3>
            <MathBlock>{"f^* = p - \\frac{1 - p}{b}"}</MathBlock>
            <p className="text-sm text-slate-400">
              Where <MathInline>p</MathInline> = probability of winning (the outcome you bet on), <MathInline>b</MathInline> = net odds = profit per unit staked.
            </p>

            <h3 className="text-sm font-medium text-indigo-300">Net odds for prediction markets</h3>
            <p className="text-sm text-slate-400">You pay <MathInline>{"P_{\\text{buy}}"}</MathInline>, receive 1 if you win. Profit = <MathInline>{"1 - P_{\\text{buy}}"}</MathInline> per unit.</p>
            <MathBlock>{"b = \\frac{1 - P_{\\text{buy}}}{P_{\\text{buy}}}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">Full Kelly (prediction market)</h3>
            <MathBlock>{"f^* = p - \\frac{q}{b} \\quad \\text{where } q = 1 - p"}</MathBlock>
            <MathBlock>{"f^* = p - \\frac{1-p}{\\frac{1-P_{\\text{buy}}}{P_{\\text{buy}}}}"}</MathBlock>
            <p className="text-sm text-slate-500">Implementation: <code className="rounded bg-slate-800 px-1 font-mono text-xs">fullKelly = p - (1-p)/b</code>, <code className="rounded bg-slate-800 px-1 font-mono text-xs">b = (1 - buyPrice) / buyPrice</code>.</p>

            <h3 className="text-sm font-medium text-indigo-300">Partial Kelly (conservative)</h3>
            <MathBlock>{"f_{\\text{frac}} = \\frac{f^*}{c} \\quad c > 0"}</MathBlock>
            <p className="text-sm text-slate-400">
              <MathInline>c = 1</MathInline> → full Kelly. <MathInline>c = 2</MathInline> → half Kelly. <MathInline>c = 4</MathInline> → quarter Kelly (default in screener).
            </p>

            <h3 className="text-sm font-medium text-indigo-300">YES vs NO position</h3>
            <p className="text-sm text-slate-400">
              For YES: <MathInline>p</MathInline> = your appraised P(YES). For NO: <MathInline>p</MathInline> = your appraised P(NO) = <MathInline>{"1 - p_{\\text{YES}}"}</MathInline>. Buy price uses quoted + spread for the chosen side.
            </p>
            <MathBlock>{"P_{\\text{buy}} = \\min\\left(0.99,\\; q_{\\text{side}} + s_{\\text{side}}\\right)"}</MathBlock>
          </Section>

          {/* 4. NO vs YES Graphs */}
          <Section title="4. NO vs YES — Decision Framework" icon={IntegralIcon}>
            <TheoryBox title="Why both sides matter">
              A binary market has two outcomes: YES and NO. Each has its own token and price. The sum <MathInline>{"q_{\\text{yes}} + q_{\\text{no}}"}</MathInline> is roughly 1 (minus vig/spread). You are always choosing <em>which</em> side to bet on—or neither. At most one side has positive EV at any time (ignoring rare vig arbitrage). The Kelly toggle in the screener lets you switch: bet YES when your appraised P(YES) exceeds the YES price, or bet NO when your appraised P(NO) exceeds the NO price.
            </TheoryBox>

            <ExampleBox title="Worked example: YES vs NO choice">
              <p>Market: YES = 65¢, NO = 35¢. Your appraisal: 70% yes, 30% no.</p>
              <p><strong>EV(YES):</strong> <MathInline>{"0.70 - 0.65 = +0.05"}</MathInline> per share → bet YES</p>
              <p><strong>EV(NO):</strong> <MathInline>{"0.30 - 0.35 = -0.05"}</MathInline> per share → do not bet NO</p>
              <p>If you had appraised 40% yes:</p>
              <p><strong>EV(YES):</strong> <MathInline>{"0.40 - 0.65 = -0.25"}</MathInline></p>
              <p><strong>EV(NO):</strong> <MathInline>{"0.60 - 0.35 = +0.25"}</MathInline> → bet NO</p>
            </ExampleBox>

            <PracticeBox title="Screener workflow">
              In the screener, use the Kelly position toggle (YES/NO button) to switch sides. The appraised probability field (<code>p_YES</code>) always refers to YES; when you select NO, we use <code>1 − p_YES</code> for the Kelly formula. Compare YEV and NEV columns to decide which side has edge, then size with Kelly.
            </PracticeBox>

            <p className="text-sm text-slate-300">
              Both sides of a binary market are priced. You choose YES or NO based on where your edge lies.
            </p>

            <h3 className="text-sm font-medium text-indigo-300">Constraint</h3>
            <MathBlock>{"q_{\\text{yes}} + q_{\\text{no}} \\approx 1 \\quad \\text{(minus vig/spread)}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">EV comparison</h3>
            <MathBlock>{"\\text{Bet YES if } \\quad p_{\\text{app}} - (q_{\\text{yes}} + s) > 0"}</MathBlock>
            <MathBlock>{"\\text{Bet NO if } \\quad (1 - p_{\\text{app}}) - (q_{\\text{no}} + s) > 0"}</MathBlock>
            <p className="text-sm text-slate-400">
              At most one side has positive EV (excluding vig edge cases). Kelly position toggle in screener switches between YES and NO; <MathInline>p</MathInline> is always P(win) for the chosen side.
            </p>
          </Section>

          {/* 5. Analytics — All Calculations */}
          <Section title="5. Analytics — All Calculations" icon={IntegralIcon}>
            <TheoryBox title="What analytics measures">
              The Analytics page evaluates your trading performance using standard portfolio and risk metrics. We build an <strong>equity curve</strong> from closed round-trips (buy→sell pairs), then compute returns, volatility, drawdowns, and risk-adjusted ratios. Returns are <em>daily</em> (PnL that day ÷ equity that day); we annualize by multiplying mean return × 365 and volatility × √365. Benchmark comparison uses CSPX (S&P 500); alpha and beta come from CAPM regression.
            </TheoryBox>

            <PracticeBox title="How the dashboard uses it">
              Trade activity is fetched from Polymarket&apos;s API. We match buys and sells into round-trips, attribute PnL to sell dates, and build a calendar series of daily returns (zeros on non-trading days). All metrics—Sharpe, Sortino, VaR, Kelly fraction, risk of ruin—derive from this equity curve. The &quot;Analytics Kelly&quot; uses aggregate win rate and payoff from round-trips, not per-market Kelly.
            </PracticeBox>

            <ExampleBox title="Worked example: Key metrics">
              <p>50 round-trips over 120 days. Total PnL = $2,000, initial equity = $10,000.</p>
              <p>Cumulative return = 20%</p>
              <p>CAGR = <MathInline>{"(12\\!000/10\\!000)^{365/120} - 1 \\approx 67\\%"}</MathInline> annualized</p>
              <p>Daily std = 1.2% → annualized vol <MathInline>{"\\approx 23\\%"}</MathInline></p>
              <p>Win rate 60%, avg win $80, avg loss $50:</p>
              <p>Payoff = <MathInline>{"80/50 = 1.6"}</MathInline></p>
              <p>Kelly = <MathInline>{"0.6 - 0.4/1.6 = 0.35"}</MathInline> (35% full Kelly)</p>
              <p>Quarter Kelly ≈ 9%</p>
            </ExampleBox>

            {/* 5.1 Return Metrics */}
            <h3 className="text-sm font-medium text-indigo-300">5.1 Return Metrics</h3>
            <TheoryBox title="What are return metrics?">
              <p><strong>Total Return</strong> is raw PnL divided by initial equity — the simple percentage gain. <strong>Cumulative Return</strong> is the same but derived from the equity curve: (final − initial) ÷ initial. <strong>CAGR</strong> (Compound Annual Growth Rate) answers: what constant yearly rate would turn your starting capital into your ending capital? It geometric-annualizes: <MathInline>{"(E_T/E_0)^{1/T} - 1"}</MathInline>. <strong>Arithmetic Mean Return</strong> is the average daily return — useful but can overstate performance when returns are volatile.</p>
            </TheoryBox>
            <PracticeBox title="How we use it">
              The dashboard shows Total Return and CAGR as headline numbers. Cumulative Return appears in tooltips. We use a full calendar series (including zero-return days) so the mean and std are over true daily frequency, not inflated by sparse trading days.
            </PracticeBox>
            <ExampleBox title="Example: $10k → $12k in 120 days">
              <p>Total PnL = $2,000, <MathInline>{"E_0 = 10\\!000"}</MathInline>, <MathInline>{"E_T = 12\\!000"}</MathInline></p>
              <p>Total Return = <MathInline>{"2000/10000 = 20\\%"}</MathInline></p>
              <p>Cumulative Return = <MathInline>{"(12000 - 10000)/10000 = 20\\%"}</MathInline></p>
              <p>CAGR = <MathInline>{"(12/10)^{365/120} - 1 \\approx 67\\%"}</MathInline> annualized</p>
              <p>If mean daily return = 0.15%, Arithmetic Mean (annualized) ≈ 0.15% × 365 ≈ 55%</p>
            </ExampleBox>
            <MathBlock>{"\\text{Total Return} = \\frac{\\sum_i \\text{pnl}_i}{E_0}"}</MathBlock>
            <MathBlock>{"\\text{CAGR} = \\left(\\frac{E_T}{E_0}\\right)^{1/T} - 1 \\quad T = \\text{years}"}</MathBlock>
            <MathBlock>{"\\text{Cumulative Return} = \\frac{E_T - E_0}{E_0}"}</MathBlock>
            <MathBlock>{"\\text{Arithmetic Mean Return} = \\bar{r} = \\frac{1}{n}\\sum_i r_i"}</MathBlock>

            {/* 5.2 Risk Metrics */}
            <h3 className="text-sm font-medium text-indigo-300">5.2 Risk Metrics</h3>
            <TheoryBox title="What are risk metrics?">
              <p><strong>Volatility (σ)</strong> measures how much returns fluctuate; annualized by <MathInline>{"\\sigma_{\\text{daily}} \\times \\sqrt{365}"}</MathInline>. <strong>Downside Deviation</strong> uses only negative returns — it penalizes losses, not gains. <strong>VaR 95%</strong> is the 5th percentile: &quot;95% of the time, daily loss won&apos;t exceed this.&quot; <strong>CVaR (Expected Shortfall)</strong> is the average of the worst 5% of returns — tail risk. <strong>Skewness</strong> measures asymmetry: negative = more big down moves; <strong>Kurtosis</strong> measures tail heaviness (excess vs normal). <strong>Ulcer Index</strong> is root-mean-square drawdown — how &quot;sick&quot; the equity curve felt.</p>
            </TheoryBox>
            <PracticeBox title="How we use it">
              Volatility feeds Sharpe and Calmar. Downside Dev feeds Sortino. VaR/CVaR show worst-case loss estimates. Skewness/Kurtosis help spot non-normal return distributions. Ulcer Index appears in the risk breakdown when enough data exists.
            </PracticeBox>
            <ExampleBox title="Example: 120 days, daily σ = 1.2%, 6 bad days avg −2%">
              <p>Annualized vol = <MathInline>{"1.2\\% \\times \\sqrt{365} \\approx 23\\%"}</MathInline></p>
              <p>Downside Dev: std of negative returns only (e.g. −2%, −1.5%, …) × √365</p>
              <p>VaR 95%: 6th worst return in sorted list (6 ≈ 5% of 120)</p>
              <p>CVaR 95%: average of those 6 worst returns</p>
              <p>Ulcer Index: sqrt of mean of squared drawdown percentages</p>
            </ExampleBox>
            <MathBlock>{"\\sigma_{\\text{ann}} = \\sigma_{\\text{daily}} \\times \\sqrt{365}"}</MathBlock>
            <MathBlock>{"\\text{Downside Dev} = \\text{std}(\\{r : r < 0\\}) \\times \\sqrt{365}"}</MathBlock>
            <MathBlock>{"\\text{VaR}_{95\\%} = r_{\\lfloor 0.05n \\rfloor} \\quad \\text{(5th percentile of returns)}"}</MathBlock>
            <MathBlock>{"\\text{CVaR}_{95\\%} = \\frac{1}{\\lceil 0.05n \\rceil} \\sum_{i \\in \\text{worst 5\\%}} r_i"}</MathBlock>
            <MathBlock>{"\\text{Skewness} = \\frac{1}{n}\\sum_i \\left(\\frac{r_i - \\bar{r}}{\\sigma}\\right)^3"}</MathBlock>
            <MathBlock>{"\\text{Kurtosis} = \\frac{1}{n}\\sum_i \\left(\\frac{r_i - \\bar{r}}{\\sigma}\\right)^4 - 3"}</MathBlock>
            <MathBlock>{"\\text{Ulcer Index} = \\sqrt{\\frac{1}{n}\\sum_i \\left(\\frac{\\text{peak}_i - E_i}{\\text{peak}_i}\\right)^2} \\times 100"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">5.3 Drawdown</h3>
            <TheoryBox title="What is drawdown?">
              <strong>Max Drawdown</strong> is the largest peak-to-trough drop: &quot;How far did I fall from my highest point?&quot; Expressed as a positive % (e.g. 25% = equity fell 25% from peak). <strong>Pain Index</strong> is the average drawdown over time — captures repeated dips, not just the worst one. <strong>Pain Ratio</strong> = mean return ÷ Pain Index: higher is better (more return per unit of pain endured).
            </TheoryBox>
            <PracticeBox title="How we use it">
              Max Drawdown is the headline risk number. Calmar ratio uses it (return ÷ max DD). Pain Index and Pain Ratio appear in the drawdown section to quantify both severity and frequency of declines.
            </PracticeBox>
            <ExampleBox title="Example: Peak $14k, trough $10.5k, mean daily r = 0.15%">
              <p>Max Drawdown = <MathInline>{"(14\\!000 - 10\\!500)/14\\!000 = 25\\%"}</MathInline></p>
              <p>Pain Index: average of all drawdown values (e.g. daily drawdown from running peak)</p>
              <p>Pain Ratio = <MathInline>{"0.15\\% / \\text{Pain Index}"}</MathInline> — e.g. if Pain Index = 0.5%, ratio ≈ 0.3</p>
            </ExampleBox>
            <MathBlock>{"\\text{Max Drawdown} = -\\max_t \\left\\{\\frac{\\text{peak}_t - E_t}{\\text{peak}_t}\\right\\}"}</MathBlock>
            <MathBlock>{"\\text{Pain Index} = \\frac{1}{n}\\sum \\text{drawdown}_i"}</MathBlock>
            <MathBlock>{"\\text{Pain Ratio} = \\frac{\\bar{r}}{\\text{Pain Index}}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">5.4 Risk-Adjusted</h3>
            <TheoryBox title="What are risk-adjusted ratios?">
              <strong>Sharpe</strong> = excess return per unit of total volatility; annualized. Higher Sharpe = better risk-adjusted return. <strong>Sortino</strong> uses downside volatility only — rewards upside variance. <strong>Calmar</strong> = annual return ÷ max drawdown — return per unit of worst pain. <strong>Omega</strong> = sum of gains ÷ |sum of losses|; &gt;1 means gains exceed losses. <strong>Gain-Loss</strong> is the same idea at trade level: total wins ÷ |total losses|.
            </TheoryBox>
            <PracticeBox title="How we use it">
              Sharpe and Sortino are primary risk-adjusted metrics in the dashboard. Calmar shows return per drawdown unit. Omega and Gain-Loss help compare strategies with different risk profiles — useful when volatility alone doesn&apos;t tell the story.
            </PracticeBox>
            <ExampleBox title="Example: r̄ = 0.15%, σ = 1.2%, r_f ≈ 0">
              <p>Sharpe = <MathInline>{"(0.15/1.2) \\times \\sqrt{365} \\approx 2.3"}</MathInline></p>
              <p>If downside σ = 0.8%: Sortino = <MathInline>{"(0.15/0.8) \\times \\sqrt{365} \\approx 3.4"}</MathInline></p>
              <p>If max DD = 25%, annual r ≈ 55%: Calmar = <MathInline>{"55/25 = 2.2"}</MathInline></p>
              <p>If total wins $3,200, losses $1,200: Gain-Loss = <MathInline>{"3200/1200 = 2.67"}</MathInline></p>
            </ExampleBox>
            <MathBlock>{"\\text{Sharpe} = \\frac{\\bar{r} - r_f}{\\sigma} \\times \\sqrt{365} \\quad r_f = \\text{risk-free daily}"}</MathBlock>
            <MathBlock>{"\\text{Sortino} = \\frac{\\bar{r} - r_f}{\\sigma_{\\text{downside}}} \\times \\sqrt{365}"}</MathBlock>
            <MathBlock>{"\\text{Calmar} = \\frac{\\bar{r} \\times 365}{|\\text{Max DD}|}"}</MathBlock>
            <MathBlock>{"\\text{Omega} = \\frac{\\sum_{r>0} r}{|\\sum_{r<0} r|}"}</MathBlock>
            <MathBlock>{"\\text{Gain-Loss} = \\frac{\\sum_{\\text{wins}} \\text{pnl}}{\\left|\\sum_{\\text{losses}} \\text{pnl}\\right|}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">5.5 Beta / Alpha (vs benchmark)</h3>
            <TheoryBox title="What are Beta and Alpha?">
              <strong>Beta</strong> measures sensitivity to the benchmark (e.g. S&P 500): β = 1 means you move with the market; β &gt; 1 = amplifies; β &lt; 1 = dampens. <strong>Alpha (Jensen)</strong> is excess return after accounting for beta: <MathInline>{"\\alpha = \\bar{r}_p - (r_f + \\beta(\\bar{r}_b - r_f))"}</MathInline> — did you beat what CAPM would predict? <strong>Information Ratio</strong> = excess return over benchmark per unit of tracking error — how much outperformance per unit of deviation from the benchmark.
            </TheoryBox>
            <PracticeBox title="How we use it">
              We use CSPX (S&P 500 ETF) as benchmark. Beta and Alpha come from CAPM regression of portfolio returns on benchmark returns. Info Ratio tells you if your edge is statistically meaningful or just noise — useful when comparing to passive investing.
            </PracticeBox>
            <ExampleBox title="Example: Portfolio +55%/yr, benchmark +10%, β = 0.5">
              <p>Expected return by CAPM: <MathInline>{"r_f + 0.5(10 - r_f)"}</MathInline>; if r_f ≈ 5%, expected ≈ 7.5%</p>
              <p>Alpha = 55% − 7.5% = 47.5% — strong excess over what beta would imply</p>
              <p>Info Ratio = (55 − 10) / tracking error — high if you beat by a lot with low volatility of the difference</p>
            </ExampleBox>
            <MathBlock>{"\\beta = \\frac{\\text{cov}(r_p, r_b)}{\\text{var}(r_b)}"}</MathBlock>
            <MathBlock>{"\\alpha = \\bar{r}_p - \\left(r_f + \\beta(\\bar{r}_b - r_f)\\right)"}</MathBlock>
            <MathBlock>{"\\text{Info Ratio} = \\frac{\\bar{r}_p - \\bar{r}_b}{\\sigma(r_p - r_b) \\sqrt{365}}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">5.6 Trade-Level</h3>
            <TheoryBox title="What are trade-level metrics?">
              <strong>Win Rate</strong> = fraction of round-trips that were profitable. <strong>Profit Factor</strong> = gross profits ÷ gross losses — &gt;1 means you made more than you lost. <strong>Expectancy</strong> = average PnL per trade — the core edge per trade. <strong>Payoff Ratio</strong> = avg win ÷ avg loss — how big wins are vs losses; feeds directly into Kelly.
            </TheoryBox>
            <PracticeBox title="How we use it">
              Win rate and payoff are shown prominently — they drive the Analytics Kelly fraction. Profit Factor and Expectancy appear in the trade stats; they answer &quot;am I net positive?&quot; and &quot;how much per trade on average?&quot; These complement the return/risk metrics by focusing on individual trade quality.
            </PracticeBox>
            <ExampleBox title="Example: 30 wins, 20 losses, $2,400 wins, $800 losses">
              <p>Win Rate = 30/50 = 60%</p>
              <p>Profit Factor = <MathInline>{"2400/800 = 3"}</MathInline></p>
              <p>Expectancy = (2400 − 800)/50 = $32 per trade</p>
              <p>Payoff = avg win / avg loss = (2400/30) / (800/20) = 80/40 = 2</p>
            </ExampleBox>
            <MathBlock>{"\\text{Win Rate} = \\frac{\\# \\text{wins}}{\\# \\text{round-trips}}"}</MathBlock>
            <MathBlock>{"\\text{Profit Factor} = \\frac{\\sum_{\\text{wins}} \\text{pnl}}{\\left|\\sum_{\\text{losses}} \\text{pnl}\\right|}"}</MathBlock>
            <MathBlock>{"\\text{Expectancy} = \\frac{1}{n}\\sum_i \\text{pnl}_i"}</MathBlock>
            <MathBlock>{"\\text{Payoff Ratio} = \\frac{\\text{avg win}}{\\text{avg loss}}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">5.7 Capital Efficiency (Analytics Kelly)</h3>
            <TheoryBox title="What is Analytics Kelly?">
              The <strong>Kelly fraction</strong> from round-trips answers: &quot;What fraction of capital would have been optimal for <em>this</em> trading history?&quot; It uses aggregate win rate and payoff from your closed trades — not the per-market Kelly from the screener. Payoff = avg win ÷ avg loss. The formula <MathInline>{"f^* = p - (1-p)/b"}</MathInline> (with b = payoff) gives full Kelly; we clamp to [0, 1] and often use quarter-Kelly as a practical size.
            </TheoryBox>
            <PracticeBox title="How we use it">
              The dashboard computes this from your actual round-trip stats and displays &quot;Analytics Kelly&quot; (often as a %) and quarter-Kelly. Use it to sanity-check: if your historical win rate and payoff imply 35% Kelly but you&apos;ve been betting 5%, you may be under-betting; if it implies 10% but you&apos;ve been at 50%, you&apos;re over-betting.
            </PracticeBox>
            <ExampleBox title="Example: Win rate 60%, avg win $80, avg loss $50">
              <p>Payoff = 80/50 = 1.6</p>
              <p>Full Kelly = <MathInline>{"0.6 - 0.4/1.6 = 0.6 - 0.25 = 0.35"}</MathInline> (35%)</p>
              <p>Quarter Kelly = 8.75% — a reasonable position size guideline</p>
            </ExampleBox>
            <MathBlock>{"\\text{Payoff} = \\frac{\\text{avg win}}{\\text{avg loss}} \\quad \\text{if avg loss} > 0"}</MathBlock>
            <MathBlock>{"f^* = \\text{winRate} - \\frac{1 - \\text{winRate}}{\\text{Payoff}}"}</MathBlock>
            <MathBlock>{"\\text{Kelly Fraction} = \\max(0, \\min(1, f^*))"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">5.8 Risk of Ruin</h3>
            <TheoryBox title="What is Risk of Ruin?">
              The probability of losing your entire bankroll (or hitting zero from peak) under a simplified random-walk model. Formula: <MathInline>{"\\exp(-2\\bar{r}/\\sigma)"}</MathInline> — it drops exponentially as your edge (mean return) increases relative to volatility. High vol + low edge = high ruin risk; low vol + high edge = low ruin risk. It&apos;s a rough indicator, not exact, because real returns aren&apos;t perfectly Gaussian.
            </TheoryBox>
            <PracticeBox title="How we use it">
              Shown in the Analytics risk section. Use it as a sanity check: if Risk of Ruin is 5%+, consider reducing position sizes or improving edge. Near zero is reassuring; above 10% warrants attention.
            </PracticeBox>
            <ExampleBox title="Example: r̄ = 0.15%/day, σ = 1.2%/day">
              <p>Risk of Ruin = <MathInline>{"\\exp(-2 \\times 0.15/1.2) = \\exp(-0.25) \\approx 0.78"}</MathInline></p>
              <p>That&apos;s 78% — high! But this simplified model assumes you keep the same fraction of capital at risk. In practice, Kelly-style sizing adapts; the number is more of a relative warning (e.g. 0.78 vs 0.02) than an absolute probability.</p>
            </ExampleBox>
            <MathBlock>{"\\text{Risk of Ruin} = \\exp\\left(-2 \\cdot \\bar{r} \\cdot \\frac{E_0}{\\sigma E_0}\\right) = \\exp\\left(-\\frac{2\\bar{r}}{\\sigma}\\right)"}</MathBlock>
            <p className="text-sm text-slate-500">Simplified form used when vol &gt; 0.</p>

            <h3 className="text-sm font-medium text-indigo-300">5.9 Portfolio Construction</h3>
            <TheoryBox title="What are HHI and Diversification Ratio?">
              We weight each market by its absolute PnL contribution to measure <strong>concentration</strong>. <strong>HHI (Herfindahl-Hirschman Index)</strong> = sum of squared weights — 1 means one market dominates; 1/n means equal. <strong>Diversification Ratio</strong> = <MathInline>{"1/\\sqrt{\\text{HHI}}"}</MathInline> — effective number of independent bets; higher = more diversified.
            </TheoryBox>
            <PracticeBox title="How we use it">
              Shown in portfolio/diversification stats. HHI near 1 means you&apos;re concentrated in few markets — higher volatility of outcomes. Diversification Ratio helps compare: 5 vs 2 means you effectively have 5 vs 2 &quot;bets&quot; spread across your book.
            </PracticeBox>
            <ExampleBox title="Example: 3 markets with PnL $1000, $500, $500">
              <p>Weights: 1000/2000 = 0.5, 0.25, 0.25</p>
              <p>HHI = <MathInline>{"0.5^2 + 0.25^2 + 0.25^2 = 0.25 + 0.0625 + 0.0625 = 0.375"}</MathInline></p>
              <p>Diversification Ratio = <MathInline>{"1/\\sqrt{0.375} \\approx 1.63"}</MathInline> — between 1 (concentrated) and 3 (equal)</p>
            </ExampleBox>
            <MathBlock>{"w_i = \\frac{|\\text{pnl}_i|}{\\sum_j |\\text{pnl}_j|} \\quad \\text{(weight by market)}"}</MathBlock>
            <MathBlock>{"\\text{HHI} = \\sum_i w_i^2 \\quad \\text{Herfindahl Index}"}</MathBlock>
            <MathBlock>{"\\text{Diversification Ratio} = \\frac{1}{\\sqrt{\\text{HHI}}}"}</MathBlock>
          </Section>

          {/* 6. Volatility Days Estimate */}
          <Section title="6. Volatility Days Estimate — When Will the Bid Reach Target?" icon={IntegralIcon}>
            <TheoryBox title="What does this estimate?">
              <p>
                In the screener, the <strong>Volatility Days Estimate</strong> answers: <em>how many days until the bid reaches my target price?</em> You want to sell at a specific bid — the price at which buyers are willing to take your shares. The estimate uses price history to compute daily volatility and projects how long it will take for the market to move far enough.
              </p>
              <p>
                The key wrinkle: <strong>bid = mid − spread/2</strong>. The spread changes with market conditions and price level. We have mid-price history from the CLOB API, but not spread history. So we <em>estimate</em> what the spread will be when the price reaches the target.
              </p>
            </TheoryBox>

            <PracticeBox title="Current implementation (no spread history)">
              We use CLOB <code>/prices-history</code> for mid price only. Spread is taken from the screener (current snapshot). To estimate spread at the target, we use a heuristic: spread tends to scale with <MathInline>{"p(1-p)"}</MathInline> — uncertainty is highest at 50¢, lower near extremes.
            </PracticeBox>

            <h3 className="text-sm font-medium text-indigo-300">6.1 Mid price volatility</h3>
            <p className="text-sm text-slate-400">
              Group price history by day (UTC), take last price per day. Compute day-over-day absolute changes; volatility = standard deviation of those changes.
            </p>
            <MathBlock>{"\\sigma_{\\text{mid}} = \\text{std}(\\{|p_i - p_{i-1}|\\}) \\quad \\text{over days}"}</MathBlock>

            <h3 className="text-sm font-medium text-indigo-300">6.2 Estimated spread at target</h3>
            <p className="text-sm text-slate-400">
              Since we don&apos;t have spread history, we estimate: spread at target scales with &quot;uncertainty&quot; at that price level. Use <MathInline>{"f(p) = p(1-p)"}</MathInline> with a floor to avoid division by zero.
            </p>
            <MathBlock>{"\\hat{s}_{\\text{target}} = s_{\\text{current}} \\cdot \\frac{f(p_{\\text{target}})}{f(p_{\\text{current}})} \\quad f(p) = \\max(0.01,\\; p(1-p))"}</MathBlock>
            <p className="text-sm text-slate-500">
              At 50¢, <MathInline>{"f(0.5) = 0.25"}</MathInline> (max). At 90¢, <MathInline>{"f(0.9) = 0.09"}</MathInline>. Going 60¢→90¢ narrows estimated spread by factor 0.09/0.24 ≈ 0.375.
            </p>

            <h3 className="text-sm font-medium text-indigo-300">6.3 Days to reach target bid</h3>
            <p className="text-sm text-slate-400">
              Target is the <strong>bid</strong> — the price you can sell at. For bid = target, we need mid = target + spread/2. Use estimated spread at target for the exit.
            </p>
            <MathBlock>{"\\text{mid}_{\\text{needed}} = p_{\\text{target}} + \\frac{\\hat{s}_{\\text{target}}}{2}"}</MathBlock>
            <MathBlock>{"\\Delta = |\\text{mid}_{\\text{needed}} - p_{\\text{current}}|"}</MathBlock>
            <MathBlock>{"\\text{days} = \\frac{\\Delta}{\\sigma_{\\text{mid}}}"}</MathBlock>

            <ExampleBox title="Worked example: 60¢ → 90¢ bid, 4¢ spread, σ_mid = 0.02">
              <p><MathInline>{"f(0.6) = 0.24"}</MathInline>, <MathInline>{"f(0.9) = 0.09"}</MathInline></p>
              <p><MathInline>{"\\hat{s}_{\\text{target}} = 0.04 \\times 0.09/0.24 = 0.015"}</MathInline> (1.5¢)</p>
              <p><MathInline>{"\\text{mid}_{\\text{needed}} = 0.90 + 0.0075 = 0.9075"}</MathInline></p>
              <p><MathInline>{"\\Delta = 0.9075 - 0.60 = 0.3075"}</MathInline></p>
              <p><MathInline>{"\\text{days} = 0.3075 / 0.02 \\approx 15.4"}</MathInline> days</p>
            </ExampleBox>

            <h3 className="text-sm font-medium text-indigo-300">6.4 Ideal case: with spread history</h3>
            <TheoryBox title="If we had spread history">
              Polymarket&apos;s API does not provide spread history. In an ideal setup, we would have time-series <MathInline>{"\\{(t_i, s_i)\\}"}</MathInline> of spread. Then we could:
            </TheoryBox>

            <p className="text-sm text-slate-400 mt-2">Compute spread volatility (same day-over-day logic):</p>
            <MathBlock>{"\\sigma_s = \\text{std}(\\{|s_i - s_{i-1}|\\}) \\quad \\text{over days}"}</MathBlock>

            <p className="text-sm text-slate-400 mt-2">Because <MathInline>{"\\text{bid} = \\text{mid} - s/2"}</MathInline>, the bid changes due to both mid and spread. If we assume independent daily moves:</p>
            <MathBlock>{"\\sigma_{\\text{bid}}^2 = \\sigma_{\\text{mid}}^2 + \\left(\\frac{\\sigma_s}{2}\\right)^2"}</MathBlock>
            <MathBlock>{"\\sigma_{\\text{bid}} = \\sqrt{\\sigma_{\\text{mid}}^2 + \\frac{\\sigma_s^2}{4}}"}</MathBlock>

            <p className="text-sm text-slate-400 mt-2">Then use bid volatility for the days estimate:</p>
            <MathBlock>{"\\text{current bid} = p_{\\text{current}} - \\frac{s_{\\text{current}}}{2}"}</MathBlock>
            <MathBlock>{"\\Delta_{\\text{bid}} = |p_{\\text{target}} - \\text{current bid}|"}</MathBlock>
            <MathBlock>{"\\text{days} = \\frac{\\Delta_{\\text{bid}}}{\\sigma_{\\text{bid}}}"}</MathBlock>

            <ExampleBox title="Ideal example: σ_mid = 0.02, σ_s = 0.005">
              <p><MathInline>{"\\sigma_{\\text{bid}} = \\sqrt{0.02^2 + 0.0025^2} = \\sqrt{0.0004625} \\approx 0.0215"}</MathInline></p>
              <p>Current bid = 0.60 − 0.02 = 0.58. Target bid = 0.90.</p>
              <p><MathInline>{"\\Delta_{\\text{bid}} = 0.32"}</MathInline>, <MathInline>{"\\text{days} = 0.32 / 0.0215 \\approx 14.9"}</MathInline> days</p>
              <p className="text-sm text-slate-500 mt-2">Spread volatility slightly increases effective bid volatility → slightly fewer days (or more conservative depending on direction). With spread history we avoid the spread-estimation heuristic and model both paths.</p>
            </ExampleBox>

            <PracticeBox title="Summary">
              <strong>Current:</strong> Mid vol from prices-history. Estimate spread at target via <MathInline>{"p(1-p)"}</MathInline> heuristic. Days = (mid_needed − current_mid) / σ_mid. <strong>Ideal:</strong> With spread history, compute σ_s, combine into σ_bid, use bid distance and σ_bid for days.
            </PracticeBox>
          </Section>
        </div>
      </div>
    </div>
  );
}
