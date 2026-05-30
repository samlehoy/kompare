import Link from 'next/link';

const FLOWS = [
  { href: '/builder', title: 'Build from zero', detail: 'Generate a complete compatible tower from budget and workload.' },
  { href: '/upgrade', title: 'Upgrade existing PC', detail: 'Prioritize upgrades around parts you already own.' },
  { href: '/audit', title: 'Audit cart or parts list', detail: 'Check compatibility before purchasing a build.' },
  { href: '/builder#advisor', title: 'Advisor after build', detail: 'Ask grounded follow-up questions once a result exists.' },
];

export default function ControlPanel() {
  return (
    <div className="control-panel">
      <nav className="control-panel-grid" aria-label="Kompare workflows">
        {FLOWS.map((flow) => (
          <Link key={flow.title} className="control-panel-tile" href={flow.href}>
            <strong>{flow.title}</strong>
            <span>{flow.detail}</span>
          </Link>
        ))}
      </nav>
      <div className="control-panel-status">
        <strong>READY</strong>
        <span>FastAPI backend stays connected through /api.</span>
      </div>
    </div>
  );
}
