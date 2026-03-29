import { useState } from 'react';
import { Handwriter } from './HandWriter.tsx';

export function HandwriterDemo() {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col p-20 gap-2 items-start">
      <textarea className="p-4 border border-gray-800 rounded" rows={1} value={text} onChange={(e) => setText(e.target.value)} />

      <Handwriter className="text-5xl" text={text} />
    </div>
  );
}
