'use client';

import Header from '@/components/Header';
import AuthGate from '@/components/AuthGate';
import PaletteTool from '@/modules/tools/paleta/components/PaletteTool';

export default function PaletaPage() {
  return (
    <AuthGate>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <Header />
        <PaletteTool />
      </div>
    </AuthGate>
  );
}
