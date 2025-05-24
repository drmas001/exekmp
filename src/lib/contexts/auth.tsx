import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { Employee } from '@/types/employee';

interface AuthContextType {
  employee: Employee | null;
  setEmployeeContext: (employee: Employee | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployeeState] = useState<Employee | null>(null);

  const setEmployeeContext = (emp: Employee | null) => {
    setEmployeeState(emp);
    if (emp) {
      sessionStorage.setItem('employee', JSON.stringify(emp));
    } else {
      sessionStorage.removeItem('employee');
    }
  };

  useEffect(() => {
    try {
      const storedEmployee = sessionStorage.getItem('employee');
      if (storedEmployee) {
        setEmployeeState(JSON.parse(storedEmployee) as Employee);
      }
    } catch (e) {
      console.error("Failed to load employee from session storage", e);
      sessionStorage.removeItem('employee');
    }
  }, []);

  const value = {
    employee,
    setEmployeeContext,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}