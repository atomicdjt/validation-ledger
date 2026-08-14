import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { Layout } from './components/layout/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Projects = lazy(() => import('./pages/Projects').then((module) => ({ default: module.Projects })));
const Sources = lazy(() => import('./pages/Sources').then((module) => ({ default: module.Sources })));
const SourceDetail = lazy(() => import('./pages/SourceDetail').then((module) => ({ default: module.SourceDetail })));
const Hypotheses = lazy(() => import('./pages/Hypotheses').then((module) => ({ default: module.Hypotheses })));
const Decisions = lazy(() => import('./pages/Decisions').then((module) => ({ default: module.Decisions })));
const Report = lazy(() => import('./pages/Report').then((module) => ({ default: module.Report })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));

function RouteFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center text-surface-500" role="status">
      <LoaderCircle className="mr-2 animate-spin" size={20} />
      Loading workspace…
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/sources/:id" element={<SourceDetail />} />
            <Route path="/hypotheses" element={<Hypotheses />} />
            <Route path="/decisions" element={<Decisions />} />
            <Route path="/report" element={<Report />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
