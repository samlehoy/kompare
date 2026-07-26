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
    range: 'Rp 7 – 12 juta',
    summary: 'Rakitan pemula untuk kerja, kuliah, dan esports ringan.',
    goal: 'Harian + esports ringan',
    upgrade: 'Platform sederhana, gampang di-upgrade nanti.',
  },
  {
    label: 'Mid-range',
    range: 'Rp 12 – 22 juta',
    summary: 'Seimbang untuk 1080p ultra, dengan ruang ke 1440p.',
    goal: '1080p ultra / 1440p awal',
    upgrade: 'Menyeimbangkan nilai GPU, RAM, dan headroom PSU.',
  },
  {
    label: 'High-end',
    range: 'Rp 22 – 40 juta',
    summary: 'Gaming refresh tinggi dan beban kerja kreator.',
    goal: '1440p high-refresh',
    upgrade: 'Pendinginan lebih kuat dan umur platform lebih panjang.',
  },
  {
    label: 'Custom',
    // Text infinity, not the emoji: the emoji renders small and pale beside
    // the other cards' bold rupiah ranges. The word carries the meaning; the
    // symbol alone left the card looking empty.
    range: 'Bebas ∞',
    summary: 'Tentukan angkamu sendiri, pemeriksaannya tetap sama.',
    goal: 'Sesuai budget kamu',
    upgrade: 'Cek kompatibilitas penuh di angka berapa pun.',
  },
];

const FLOWS = [
  {
    href: '/builder',
    title: 'Rakit dari nol',
    detail: 'Masukkan budget dan kebutuhan, terima sembilan komponen yang dijamin cocok satu sama lain.',
  },
  {
    href: '/upgrade',
    title: 'Upgrade PC lama',
    detail: 'Ketik komponen yang sudah kamu punya, lihat bagian mana yang paling berdampak diganti duluan.',
  },
  {
    href: '/audit',
    title: 'Audit sebelum beli',
    detail: 'Unggah screenshot keranjang atau tempel daftar partmu, temukan masalah sebelum uang keluar.',
  },
];

const GUARANTEES = [
  ['Kompatibilitas dicek mesin, bukan ditebak AI', 'Soket CPU, generasi RAM, daya PSU, dan muat casing diperiksa aturan pasti. AI hanya mengurutkan dan menjelaskan.'],
  ['Tidak ada komponen karangan', 'Setiap part berasal dari katalog nyata. Kalau stok tidak ada, ditulis tidak ada — bukan dikarang.'],
  ['Harga dan link Indonesia', 'Harga rupiah dari EnterKomputer, lengkap dengan tautan ke halaman produknya.'],
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-hero">
        <p className="landing-eyebrow">KOMPARE 95</p>
        <h1>Rakit PC tanpa salah beli.</h1>
        <p className="landing-lede">
          Masukkan budgetmu. Kompare menyusun rakitan lengkap dari katalog PC Indonesia,
          memeriksa setiap komponen benar-benar cocok, lalu menjelaskan alasannya.
        </p>
        <div className="landing-cta">
          <Link className="landing-button landing-button--primary" href="/builder">
            Rakit dari nol
          </Link>
          <Link className="landing-button" href="/upgrade">
            Upgrade PC lama
          </Link>
        </div>
        <p className="landing-subcta">
          Sudah tahu jalannya? <Link href="/app">Buka desktop Kompare</Link>
        </p>
      </header>

      <section className="landing-section" aria-labelledby="landing-flows">
        <h2 id="landing-flows">Tiga cara memakainya</h2>
        <div className="landing-flow-grid">
          {FLOWS.map((flow) => (
            <Link key={flow.href} className="landing-card landing-card--flow" href={flow.href}>
              <strong>{flow.title}</strong>
              <span>{flow.detail}</span>
              <em aria-hidden="true">Mulai →</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-tiers">
        <h2 id="landing-tiers">Pilih kelas budget</h2>
        <p className="landing-section-lede">
          Setiap kelas punya target performa yang jelas, supaya harapanmu sesuai dengan yang bisa dibeli.
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
                <dt>Upgrade</dt>
                <dd>{tier.upgrade}</dd>
              </dl>
              <Link className="landing-button landing-button--small" href="/builder">
                Rakit di kelas ini
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-guarantees">
        <h2 id="landing-guarantees">Yang kami jamin</h2>
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
        <p>
          Kompare — PC Builder untuk pasar Indonesia. Data komponen dari EnterKomputer.
        </p>
        <p>
          <Link href="/app">Desktop</Link>
          {' · '}
          <Link href="/builder">Rakit</Link>
          {' · '}
          <Link href="/upgrade">Upgrade</Link>
          {' · '}
          <Link href="/audit">Audit</Link>
        </p>
      </footer>
    </div>
  );
}
