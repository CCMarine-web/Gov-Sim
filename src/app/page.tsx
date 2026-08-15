/**
 * Deployment smoke test.
 *
 * This page exists to prove the pipeline works before any game logic is
 * written: fonts resolve, design tokens resolve, tabular numerals behave, and
 * the deployed build is the one we think it is.
 *
 * It is replaced by the real title screen (docs/UI.md §5.1) in Phase 1.
 */

// Evaluated at build time in a server component. Lets us confirm at a glance
// that a deploy actually shipped the commit we expect.
const BUILT_AT = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const PALETTE: ReadonlyArray<{ token: string; className: string; note: string }> = [
  { token: 'ink-800', className: 'bg-ink-800', note: 'app background' },
  { token: 'ink-600', className: 'bg-ink-600', note: 'card surface' },
  { token: 'parchment-100', className: 'bg-parchment-100', note: 'dense content' },
  { token: 'brass-400', className: 'bg-brass-400', note: 'authority / actions' },
  { token: 'oxblood-400', className: 'bg-oxblood-400', note: 'danger' },
  { token: 'verdigris-400', className: 'bg-verdigris-400', note: 'favourable' },
  { token: 'steel-400', className: 'bg-steel-400', note: 'historical data only' },
];

const CHECKS: ReadonlyArray<{ label: string; detail: string }> = [
  { label: 'Next.js 16 · App Router · TypeScript', detail: 'building' },
  { label: 'Tailwind v4 design tokens', detail: 'docs/UI.md §2' },
  { label: 'EB Garamond + Inter via next/font', detail: 'zero layout shift' },
  { label: 'Tabular numerals', detail: 'non-negotiable' },
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        {/* --- Masthead ------------------------------------------------- */}
        <p className="text-label uppercase text-content-muted">
          Deployment smoke test
        </p>
        <h1 className="mt-3 font-serif text-display text-content-primary">
          The American Experiment
        </h1>
        <p className="mt-2 font-serif text-body-serif text-content-secondary">
          A government simulator. The pipeline is proven before the game is
          built.
        </p>

        <div className="mt-8 h-px w-full bg-ink-400" />

        {/* --- What is wired ------------------------------------------- */}
        <section className="mt-8">
          <h2 className="text-label uppercase text-content-muted">Wired</h2>
          <ul className="mt-3 space-y-1.5">
            {CHECKS.map((c) => (
              <li key={c.label} className="flex items-baseline gap-3 text-body">
                <span aria-hidden className="text-brass-400">
                  ✓
                </span>
                <span className="text-content-primary">{c.label}</span>
                <span className="text-small text-content-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Palette proof -------------------------------------------- */}
        <section className="mt-8">
          <h2 className="text-label uppercase text-content-muted">
            Design tokens
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PALETTE.map((p) => (
              <div
                key={p.token}
                className="rounded-card border border-ink-400 p-2"
              >
                <div
                  className={`${p.className} h-8 w-full rounded`}
                  aria-hidden
                />
                <p className="mt-2 text-small text-content-primary">{p.token}</p>
                <p className="text-small text-content-muted">{p.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- Tabular numerals proof -----------------------------------
            The two rows below contain digits of differing widths. With tabular
            figures the columns align exactly; without them they visibly jitter.
            This is the check that matters most for a ticking clock.
        ------------------------------------------------------------------ */}
        <section className="mt-8">
          <h2 className="text-label uppercase text-content-muted">
            Tabular numerals
          </h2>
          <div className="mt-3 rounded-card border border-ink-400 bg-ink-700 p-3">
            <div className="tabular space-y-1 text-data-md text-content-primary">
              <div className="flex justify-between">
                <span className="font-sans text-body text-content-secondary">
                  Treasury
                </span>
                <span>$1,111,111</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-body text-content-secondary">
                  National debt
                </span>
                <span>$71,060,508</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-body text-content-secondary">
                  Population
                </span>
                <span>3,929,326</span>
              </div>
            </div>
            <p className="mt-3 text-small text-content-muted">
              Figures above are placeholders and are not simulation output.
            </p>
          </div>
        </section>

        {/* --- Build stamp ---------------------------------------------- */}
        <footer className="mt-10 border-t border-ink-400 pt-4">
          <p className="tabular text-small text-content-muted">
            Build {BUILT_AT}
          </p>
        </footer>
      </div>
    </main>
  );
}
