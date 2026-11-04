import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { PwaProvider } from '@/components/PwaProvider';
import { AuthProvider } from '@/context/AuthContext';

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DreamHouse | AI Architecture Studio',
  description: 'Where Vision Meets Structure — AI-powered architectural exterior generation.',
  keywords: ['architecture', 'AI', 'exterior design', 'Colombia', 'DreamHouse'],
  applicationName: 'DreamHouse',
  // iPhone/iPad: ícono y modo app al "Añadir a pantalla de inicio" (el manifest lo cubre Android)
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'DreamHouse', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // usa el área completa en teléfonos con muesca; el contenido respeta safe-area
  themeColor: '#050505',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}>
        {/* Architectural grid overlay — purely decorative */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <ThemeProvider>
          <PwaProvider>
            <AuthProvider>{children}</AuthProvider>
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
