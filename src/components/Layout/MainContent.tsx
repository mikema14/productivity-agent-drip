import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 bg-gray-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8">
        {children}
      </div>
    </main>
  );
}
