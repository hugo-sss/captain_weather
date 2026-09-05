import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import { Shell } from '@/components/Shell.tsx';
import Login from '@/pages/Login.tsx';
import PassageHistory from '@/pages/PassageHistory.tsx';
import PassageBuilder from '@/pages/PassageBuilder.tsx';
import DashboardPro from '@/pages/DashboardPro.tsx';
import DashboardSimple from '@/pages/DashboardSimple.tsx';
import ComparisonView from '@/pages/ComparisonView.tsx';
import ActivePassage from '@/pages/ActivePassage.tsx';
import AnchorageStay from '@/pages/AnchorageStay.tsx';
import VesselSettings from '@/pages/VesselSettings.tsx';
import WeatherMap from '@/pages/WeatherMap.tsx';

// Dev-only component gallery. `import.meta.env.DEV` is a build-time constant, so the route and the
// lazy chunk behind it are dropped from production bundles entirely.
const PreviewIndex = import.meta.env.DEV ? lazy(() => import('@/preview/PreviewIndex.tsx')) : null;

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-6 text-text-2">Loading session…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {PreviewIndex && (
        <Route path="/preview" element={<Shell />}>
          <Route index element={<Suspense fallback={null}><PreviewIndex /></Suspense>} />
        </Route>
      )}
      <Route element={<Protected><Shell /></Protected>}>
        <Route index element={<WeatherMap />} />
        <Route path="passages" element={<PassageHistory />} />
        <Route path="passages/new" element={<PassageBuilder />} />
        <Route path="passages/:id/edit" element={<PassageBuilder />} />
        <Route path="passages/:id" element={<DashboardPro />} />
        <Route path="passages/:id/simple" element={<DashboardSimple />} />
        <Route path="passages/:id/comparison" element={<ComparisonView />} />
        <Route path="passages/:id/active" element={<ActivePassage />} />
        <Route path="passages/:id/anchorage/:wpId" element={<AnchorageStay />} />
        <Route path="vessels" element={<VesselSettings />} />
        <Route path="vessels/:id" element={<VesselSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
