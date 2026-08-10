import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Social sign-ins (Google) must complete mobile verification first
  const hasPhone = Boolean((user.user_metadata as any)?.phone);
  if (!hasPhone && location.pathname !== "/phone-verify") {
    return <Navigate to="/phone-verify" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
