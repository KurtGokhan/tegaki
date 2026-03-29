import { createRoot } from 'react-dom/client';
import font from '#src/font.ts';
import { ChatScreenDemo } from './ChatScreenDemo.tsx';

const root = createRoot(document.getElementById('root')!);
root.render(<ChatScreenDemo font={font} />);
