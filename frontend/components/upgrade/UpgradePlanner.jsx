'use client';

export default function UpgradePlanner() {
  return (
    <div className="retro-window-content" style={{ padding: '24px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <img src="/icons/HardwareDiag_32x32_4.png" alt="Upgrade Planner" width="64" height="64" style={{ marginBottom: '16px' }} />
      <h2>Upgrade Planner</h2>
      <p style={{ marginTop: '16px', fontSize: '1.1em' }}>Coming Soon!</p>
      <p style={{ marginTop: '8px', color: '#555', maxWidth: '400px' }}>
        We are working on perfecting the upgrade recommendation algorithm to analyze your existing setup and suggest the most compatible path.
      </p>
    </div>
  );
}
