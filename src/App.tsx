import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { AppRoutes } from './routes.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={200}>
        <AppRoutes />
      </TooltipProvider>
    </BrowserRouter>
  );
}
