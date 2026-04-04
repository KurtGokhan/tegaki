import { useEffect, useState } from 'react';
import type { TegakiBundle } from 'tegaki';
import { ChatScreenDemo } from './ChatScreenDemo.tsx';

export function ChatScreenDemoLoader() {
  const [font, setFont] = useState<TegakiBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import('./font.ts').then((mod) => setFont(mod.default)).catch((err) => setError((err as Error).message));
  }, []);

  if (error) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: 'red' }}
      >
        {error}
      </div>
    );
  }

  if (!font) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Loading chat demo...
      </div>
    );
  }

  return <ChatScreenDemo font={font} />;
}
