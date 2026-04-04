import { createRoot } from 'react-dom/client';
import { PreviewApp } from './PreviewApp.tsx';
import './style.css';

const root = createRoot(document.getElementById('root')!);
root.render(<PreviewApp />);
