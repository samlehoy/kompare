export default function ReadmeContent() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', border: 'inset 2px', height: '100%', overflowY: 'auto', fontFamily: 'var(--font-win95)' }}>
      <h2 style={{ marginTop: 0, borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>Welcome to Kompare</h2>
      <p style={{ lineHeight: '1.5' }}>
        <strong>Kompare</strong> is a Next.js rewrite of the Kompare 95 desktop console, built to be your AI-assisted Indonesian PC builder and parts advisor.
      </p>

      <h3 style={{ marginTop: '24px', borderBottom: '1px dotted #ccc', paddingBottom: '4px' }}>Walkthrough</h3>
      <ol style={{ lineHeight: '1.6', paddingLeft: '24px' }}>
        <li><strong>Build PC (Build from zero):</strong> Start here if you want a complete, fresh PC tower. Set your budget and use case, and Kompare will generate a fully compatible build recommendation.</li>
        <li><strong>Upgrade:</strong> Have an existing rig? Enter the parts you already own, and the planner will prioritize upgrades or fill in missing components while ensuring compatibility.</li>
        <li><strong>Audit:</strong> Before you buy, audit your cart screenshot or typed parts list to catch bottlenecks and compatibility risks.</li>
        <li><strong>Advisor (After Build):</strong> Once you have a generated build or upgrade result, ask grounded follow-up questions to customize the parts further!</li>
        <li><strong>Marketplace:</strong> Coming soon! Browse the catalog of EnterKomputer parts directly.</li>
      </ol>

      <h3 style={{ marginTop: '24px', borderBottom: '1px dotted #ccc', paddingBottom: '4px' }}>Tech Stack</h3>
      <ul style={{ lineHeight: '1.6', paddingLeft: '24px' }}>
        <li><strong>Frontend:</strong> Next.js (App Router), React, Zustand (state management), Playwright & Vitest for testing.</li>
        <li><strong>Backend:</strong> Python, FastAPI, Pydantic, pytest.</li>
        <li><strong>AI Providers:</strong> Google Gemini API (Free Tier) and Local AI profiles via LM Studio (Qwen3.6) + Qdrant Vector Database.</li>
        <li><strong>Data Sources:</strong> Local JSON component catalogs, meticulously curated for the Indonesian market with EnterKomputer pricing.</li>
      </ul>
      
      <p style={{ marginTop: '24px', marginBottom: 0, fontStyle: 'italic', textAlign: 'center', color: '#666' }}>
        System fully operational. Ready to assist.
      </p>
    </div>
  );
}
