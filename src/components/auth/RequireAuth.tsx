import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/contexts/auth';
import type { EmployeeRole } from '@/types/employee';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: EmployeeRole[];
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  // Only destructure what's still potentially used (employee for roles check)
  // user, checkEmployeeData, and isLoading are likely tied to the disabled Supabase auth
  const { employee } = useAuth(); 
  const location = useLocation();

  /*
  useEffect(() => {
    const verifyAuth = async () => {
      if (employee) {
        // Only verify employee data if we have a user but no employee
      }
    };

    verifyAuth();
  }, [employee]);
  */

  // Show loading state while checking auth - This might be removed or simplified
  /*
  if (false) { // isVerifying is removed, isLoading might always be false
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }
  */

  // First check Supabase auth
  /*
  if (false) { // Bypassing user check for offline mode
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  */

  // Then check employee auth
  /*
  if (!employee) { // Bypassing employee check for offline mode
    // Only store redirect if we're not already on the employee code page
    if (!location.pathname.includes('/employee-code')) {
      sessionStorage.setItem('auth_redirect', location.pathname);
    }
    return <Navigate to="/employee-code" state={{ from: location }} replace />;
  }
  */

  // Finally check role-based access if specified
  if (allowedRoles && (!employee || !allowedRoles.includes(employee?.role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}