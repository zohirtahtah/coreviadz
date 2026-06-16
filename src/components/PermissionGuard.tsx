import React, { useEffect, useState } from "react";

interface PermissionCheck {
  status: "loading" | "granted" | "denied";
  reason?: string;
}

export function usePermissions(
  session: any,
  requestedPage: string
): PermissionCheck {
  const [result, setResult] = useState<PermissionCheck>({ status: "loading" });

  useEffect(() => {
    if (!session) {
      setResult({ status: "denied", reason: "No active session." });
      return;
    }

    // Super admins have full access
    if (session.role === "super_admin" || session.role === "super-admin") {
      setResult({ status: "granted" });
      return;
    }

    // Admins/owners have full access
    if (session.role === "admin" || session.role === "owner") {
      setResult({ status: "granted" });
      return;
    }

    // Employees need page-level checks
    if (session.role === "employee") {
      // Implicitly allowed pages
      const implicitlyAllowed = ["my-profile", "communication"];
      if (implicitlyAllowed.includes(requestedPage)) {
        setResult({ status: "granted" });
        return;
      }

      const allowedPages = session.allowedPages || [];
      if (allowedPages.includes(requestedPage)) {
        setResult({ status: "granted" });
        return;
      }

      setResult({
        status: "denied",
        reason: `Access denied. You do not have permission for this page.`
      });
      return;
    }

    setResult({ status: "denied", reason: "Unknown role." });
  }, [session, requestedPage]);

  return result;
}

export function PermissionGuard({
  session,
  requiredPage,
  fallback,
  children
}: {
  session: any;
  requiredPage: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const permission = usePermissions(session, requiredPage);

  if (permission.status === "loading") {
    return null;
  }

  if (permission.status === "denied") {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/50 border-2 border-red-500/20 rounded-2xl text-center max-w-xl mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Access Denied</h2>
        <p className="text-sm text-slate-400">{permission.reason || "You do not have permission to access this page."}</p>
      </div>
    );
  }

  return <>{children}</>;
}
