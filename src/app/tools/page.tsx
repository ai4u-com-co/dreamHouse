import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Palette } from 'lucide-react';
import Header from '@/components/Header';
import { TOOLS } from '@/modules/tools/registry';

export const metadata: Metadata = { title: 'Tools | DreamHouse' };

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="px-4 sm:px-8 lg:px-12 pb-24">
        <div className="max-w-[1100px] mx-auto pt-28 sm:pt-32 space-y-10">
          <div className="space-y-3">
            <p className="text-xs font-mono font-bold uppercase tracking-[0.3em] text-primary">DreamHouse</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Tools</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
              Herramientas puntuales que parten de una imagen que ya tienes y hacen una sola cosa bien.
            </p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="tools-list">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={tool.href}
                  className="group flex h-full flex-col gap-4 p-6 border border-border bg-card/40 hover:border-primary/60 transition-colors"
                >
                  <Palette className="w-6 h-6 text-primary" aria-hidden="true" />
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">{tool.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                    Abrir <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
