import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";

// ─── Lazy-loaded routes (code splitting per route) ───
const Landing = lazy(() => import("@/pages/Landing"));
const Auth = lazy(() => import("@/pages/Auth"));
const OtpVerification = lazy(() => import("@/pages/OtpVerification"));
const PhoneVerification = lazy(() => import("@/pages/PhoneVerification"));
const IitVerification = lazy(() => import("@/pages/IitVerification"));
const Forum = lazy(() => import("@/pages/Forum"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const Network = lazy(() => import("@/pages/Network"));
const Consult = lazy(() => import("@/pages/Consult"));
const Jobs = lazy(() => import("@/pages/Jobs"));
const Profile = lazy(() => import("@/pages/Profile"));
const Chats = lazy(() => import("@/pages/Chats"));
const Settings = lazy(() => import("@/pages/Settings"));
const Admin = lazy(() => import("@/pages/Admin"));
const Blogs = lazy(() => import("@/pages/Blogs"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// ─── Loading fallback ───
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Global QueryClient — data stays cached until explicit refresh
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <a href="#main-content" className="skip-to-main">Skip to main content</a>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/otp-verify" element={<OtpVerification />} />
                <Route path="/phone-verify" element={<PhoneVerification />} />
                <Route path="/iit-verify" element={<IitVerification />} />

                {/* App routes with layout — Forum is the primary product */}
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  {/* Forum — Discord-style, primary landing after login */}
                  <Route path="/cirkle-forum" element={<Forum />} />
                  <Route path="/cirkle-forum/*" element={<Forum />} />

                  {/* Homepage → redirect to forum */}
                  <Route path="/home" element={<Navigate to="/cirkle-forum" replace />} />

                  {/* Network */}
                  <Route path="/network" element={<Network />} />
                  <Route path="/network/connections" element={<Network />} />
                  <Route path="/network/suggestions" element={<Network />} />

                  {/* Consult / Mentoring */}
                  <Route path="/consult" element={<Consult />} />
                  <Route path="/consult/mentors" element={<Consult />} />
                  <Route path="/consult/bookings" element={<Consult />} />

                  {/* Jobs */}
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/jobs/internships" element={<Jobs />} />
                  <Route path="/jobs/full-time" element={<Jobs />} />
                  <Route path="/jobs/part-time" element={<Jobs />} />
                  <Route path="/jobs/remote" element={<Jobs />} />

                  {/* Calendar & Blogs */}
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/blogs" element={<Blogs />} />
                  <Route path="/blogs/:slug" element={<Blogs />} />
                </Route>

                {/* Profile routes */}
                <Route path="/u/:slug" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
                <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Profile /></Suspense></ProtectedRoute>} />
                <Route path="/profile/:userId" element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />

                {/* Utility routes */}
                <Route path="/chats" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Chats /></Suspense></ProtectedRoute>} />
                <Route path="/chats/:roomId" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Chats /></Suspense></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
                <Route path="/settings/account" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
                <Route path="/settings/privacy" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Admin /></Suspense></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Admin /></Suspense></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute><Suspense fallback={<PageLoader />}><Admin /></Suspense></ProtectedRoute>} />

                {/* Legacy redirects */}
                <Route path="/forum" element={<Navigate to="/cirkle-forum" replace />} />
                <Route path="/forum/*" element={<Navigate to="/cirkle-forum" replace />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
