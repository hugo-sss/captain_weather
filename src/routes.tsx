import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import { Shell } from '@/components/Shell.tsx';
import Login from '@/pages/Login.tsx';
import Passages from '@/pages/Passages.tsx';
import PassageBuilder from '@/pages/PassageBuilder.tsx';
import Passage from '@/pages/Passage.tsx';
import PassageTable from '@/pages/PassageTable.tsx';
import ComparisonView from '@/pages/ComparisonView.tsx';
import AnchorageStay from '@/pages/AnchorageStay.tsx';
import VesselSettings from '@/pages/VesselSettings.tsx';
import WeatherMap from '@/pages/WeatherMap.tsx';
import Alerts from '@/pages/Alerts.tsx';
import Settings from '@/pages/Settings.tsx';
import PassagePrint from '@/pages/PassagePrint.tsx';

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

/** Old mode URLs (/simple, /active) land on the one passage page so saved links keep working. */
function RedirectToPassage() {
  const { id } = useParams();
  return <Navigate to={`/passages/${id}`} replace />;
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
      {/* Print layout renders without the shell: white page, no header, no footer chrome. */}
      <Route path="passages/:id/print" element={<Protected><PassagePrint /></Protected>} />
      <Route element={<Protected><Shell /></Protected>}>
        <Route index element={<WeatherMap />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="notifications" element={<Navigate to="/alerts" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="passages" element={<Passages />} />
        <Route path="passages/new" element={<PassageBuilder />} />
        <Route path="passages/:id/edit" element={<PassageBuilder />} />
        <Route path="passages/:id" element={<Passage />} />
        <Route path="passages/:id/simple" element={<RedirectToPassage />} />
        <Route path="passages/:id/active" element={<RedirectToPassage />} />
        <Route path="passages/:id/table" element={<PassageTable />} />
        <Route path="passages/:id/comparison" element={<ComparisonView />} />
        <Route path="passages/:id/anchorage/:wpId" element={<AnchorageStay />} />
        <Route path="vessels" element={<VesselSettings />} />
        <Route path="vessels/:id" element={<VesselSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
