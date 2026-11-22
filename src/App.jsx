import React, { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TeamProvider, useTeamContext } from "./context/TeamContext";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { calculateRiskScore } from "./utils/scoring";

// Lazy-loaded routes for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const WorkloadView = lazy(() => import("./pages/WorkloadView"));
const Tasks = lazy(() => import("./pages/Tasks"));
const TeamMembers = lazy(() => import("./pages/TeamMembers"));
const SkillMatrix = lazy(() => import("./pages/SkillMatrix"));
const BurnoutRisk = lazy(() => import("./pages/BurnoutRisk"));
const Insights = lazy(() => import("./pages/Insights"));
const Reports = lazy(() => import("./pages/Reports"));
const About = lazy(() => import("./pages/About"));
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));

function RouteLoading() {
  return (
    <div className="flex-1 flex items-center justify-center p-xl text-secondary font-body-sm min-h-[300px]">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
        <span>Loading view...</span>
      </div>
    </div>
  );
}

function AppLayout({ children, search, onSearch, searchPlaceholder }) {
  const { members } = useTeamContext();
  const location = useLocation();

  const highRiskCount = useMemo(
    () => members.filter((member) => calculateRiskScore(member).tier === "High").length,
    [members],
  );

  const titles = {
    "/dashboard": "Team Ops Portal",
    "/workload": "Team Workload",
    "/workload-view": "Team Workload",
    "/tasks": "Task Management",
    "/team-members": "Team Directory",
    "/skill-matrix": "Skill Matrix",
    "/burnout-risk": "Burnout Risk",
    "/insights": "Insights",
    "/reports": "Reports",
    "/about": "About",
  };

  return (
    <div className="bg-background text-on-surface antialiased font-body-md text-body-md h-screen flex w-full overflow-hidden">
      <Sidebar highRiskCount={highRiskCount} />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Topbar
          title={titles[location.pathname] ?? "Team Ops Portal"}
          placeholder={searchPlaceholder}
          searchValue={search}
          onSearch={onSearch}
        />
        <Suspense fallback={<RouteLoading />}>{children}</Suspense>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-md p-xl text-center">
      <span className="font-display-lg text-display-lg text-primary">404</span>
      <h2 className="text-xl font-bold text-primary">Page Not Found</h2>
      <p className="font-body-md text-body-md text-secondary max-w-md">
        The requested operations view does not exist or has moved.
      </p>
      <a
        href="/dashboard"
        className="mt-md inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-sm hover:bg-primary transition-colors"
      >
        Return to Dashboard
      </a>
    </main>
  );
}

export default function App() {
  return (
    <TeamProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              }
            />
            <Route
              path="/workload"
              element={
                <AppLayout>
                  <WorkloadView />
                </AppLayout>
              }
            />
            <Route path="/workload-view" element={<Navigate to="/workload" replace />} />
            <Route
              path="/tasks"
              element={
                <AppLayout>
                  <Tasks />
                </AppLayout>
              }
            />
            <Route
              path="/team-members"
              element={
                <AppLayout>
                  <TeamMembers />
                </AppLayout>
              }
            />
            <Route
              path="/skill-matrix"
              element={
                <AppLayout>
                  <SkillMatrix />
                </AppLayout>
              }
            />
            <Route
              path="/burnout-risk"
              element={
                <AppLayout>
                  <BurnoutRisk />
                </AppLayout>
              }
            />
            <Route
              path="/insights"
              element={
                <AppLayout>
                  <Insights />
                </AppLayout>
              }
            />
            <Route
              path="/reports"
              element={
                <AppLayout>
                  <Reports />
                </AppLayout>
              }
            />
            <Route
              path="/about"
              element={
                <AppLayout>
                  <About />
                </AppLayout>
              }
            />
            <Route
              path="*"
              element={
                <AppLayout>
                  <NotFound />
                </AppLayout>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TeamProvider>
  );
}
