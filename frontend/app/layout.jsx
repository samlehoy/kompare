import './globals.css';

export const metadata = {
  title: 'Kompare 95',
  description: 'AI-powered PC builder for the Indonesian PC market.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
