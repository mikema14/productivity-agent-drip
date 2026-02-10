import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 bg-drip-bg overflow-y-auto relative">
      {/* Subtle radial gradient for depth */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 70%)' }} />
      <div className="relative h-full">
        {children}
      </div>
    </main>
  );
}
