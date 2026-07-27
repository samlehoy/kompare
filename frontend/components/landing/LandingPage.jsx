import Link from 'next/link';

/**
 * Budget tiers are duplicated from BUDGET_TIERS in pc-builder-core.js rather
 * than fetched. The landing must render instantly from the static export with
 * no loading state, and these ranges are fixed in UI_SPEC.md. If the engine's
 * tiers change, change these too.
 */
const TIERS = [
  {
    label: 'Entry-level',
    range: 'Rp 7–12 million',
    summary: 'A starter tower for office work, study, and light esports.',
    goal: 'Everyday + light esports',
    upgrade: 'Simple platform that stays easy to upgrade later.',
  },
  {
    label: 'Mid-range',
    range: 'Rp 12–22 million',
    summary: 'Balanced for 1080p ultra, with room to reach 1440p.',
    goal: '1080p ultra / entry 1440p',
    upgrade: 'Balances GPU value, RAM, and PSU headroom.',
  },
  {
    label: 'High-end',
    range: 'Rp 22–40 million',
    summary: 'High-refresh gaming and creator workloads.',
    goal: '1440p high-refresh',
    upgrade: 'Stronger cooling and a longer platform runway.',
  },
  {
    label: 'Custom',
    // Text infinity, not the emoji: the emoji renders small and pale beside
    // the other cards' bold rupiah ranges. The word carries the meaning; the
    // symbol alone left the card looking empty.
    range: 'Any budget ∞',
    summary: 'Name your own number. The same checks still run.',
    goal: 'Whatever you set',
    upgrade: 'Full compatibility checks at any number.',
  },
];

const FLOWS = [
  {
    href: '/builder',
    title: 'Start from zero',
    detail: 'Give a budget and a workload, get nine parts that are guaranteed to fit together.',
  },
  {
    href: '/upgrade',
    title: 'Upgrade my PC',
    detail: 'Type the parts you already own and see which one is worth replacing first.',
  },
  {
    href: '/audit',
    title: 'Audit before you buy',
    detail: 'Upload a cart screenshot or paste a parts list, and catch the problem before the money leaves.',
  },
];

const GUARANTEES = [
  [
    'Compatibility is checked, not guessed',
    'CPU socket, RAM generation, PSU headroom, and case fit are settled by fixed rules. AI only ranks and explains.',
  ],
  [
    'No invented parts',
    'Every part comes from a real catalog. When something is unavailable it says so, instead of making one up.',
  ],
  [
    'Indonesian prices and links',
    'Rupiah pricing from EnterKomputer, with a link straight to the product page.',
  ],
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-hero">
        <p className="landing-eyebrow">KOMPARE 95</p>
        <h1>Build a PC without buying the wrong part.</h1>
        <p className="landing-lede">
          Enter your budget. Kompare assembles a complete build from the Indonesian PC
          catalog, checks that every part actually fits the others, and explains why it
          picked them.
        </p>
        <div className="landing-cta">
          <Link className="landing-button landing-button--primary" href="/builder">
            Start from zero
          </Link>
          <Link className="landing-button" href="/upgrade">
            Upgrade my PC
          </Link>
        </div>
        <p className="landing-subcta">
          Already know your way around? <Link href="/app">Open the Kompare desktop</Link>
        </p>
      </header>

      <section className="landing-section" aria-labelledby="landing-flows">
        <h2 id="landing-flows">Three ways to use it</h2>
        <div className="landing-flow-grid">
          {FLOWS.map((flow) => (
            <Link key={flow.href} className="landing-card landing-card--flow" href={flow.href}>
              <strong>{flow.title}</strong>
              <span>{flow.detail}</span>
              <em aria-hidden="true">Open →</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-tiers">
        <h2 id="landing-tiers">Pick a budget class</h2>
        <p className="landing-section-lede">
          Each class states a performance target up front, so what you expect matches what
          the money can actually buy.
        </p>
        <div className="landing-tier-grid">
          {TIERS.map((tier) => (
            <article key={tier.label} className="landing-card landing-card--tier">
              <strong>{tier.label}</strong>
              <p className="landing-tier-range">{tier.range}</p>
              <p>{tier.summary}</p>
              <dl>
                <dt>Target</dt>
                <dd>{tier.goal}</dd>
                <dt>Upgrade path</dt>
                <dd>{tier.upgrade}</dd>
              </dl>
              <Link className="landing-button landing-button--small" href="/builder">
                Build at this tier
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-guarantees">
        <h2 id="landing-guarantees">What we guarantee</h2>
        <div className="landing-guarantee-grid">
          {GUARANTEES.map(([title, detail]) => (
            <div key={title} className="landing-card landing-card--guarantee">
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p>Kompare — a PC Builder for the Indonesian market. Component data from EnterKomputer.</p>
        <p>
          <Link href="/app">Desktop</Link>
          {' · '}
          <Link href="/builder">Build</Link>
          {' · '}
          <Link href="/upgrade">Upgrade</Link>
          {' · '}
          <Link href="/audit">Audit</Link>
        </p>
      </footer>
    </div>
  );
}
