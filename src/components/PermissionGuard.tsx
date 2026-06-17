import React, { useEffect, useState } from "react";

// Maps each page tab to the required permission code
const PAGE_PERMISSION_MAP: Record<string, string | null> = {
  "dashboard": null,
  "orders": "orders.view",
  "customers": "customers.view",
  "inventory": "inventory.view",
  "products": null,
  "suppliers": "suppliers.view",
  "warehouses": "warehouses.view",
  "workers": "employees.view",
  "expenses": "expenses.view",
  "profit": "reports.view",
  "yearly": "reports.view",
  "settings": "settings.view",
  "users-permissions": "company_users.view",
  "activity-log": null,
  "communication": null,
  "my-profile": null,
  "super-admin": null,
};

interface PermissionCheck {
  status: "loading" | "granted" | "denied";
  reason?: string;
}

function checkBackendPermission(page: string): Promise<boolean> {
  const permCode = PAGE_PERMISSION_MAP[page];
  if (!permCode) return Promise.resolve(true);
  // Cookie-based auth via requireAuth middleware
  return fetch(`/api/permissions/check?code=${encodeURIComponent(permCode)}`)
    .then(r => r.json())
    .then(d => d.granted === true)
    .catch(() => true);
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

    // Super admins / admin / owner have full access
    const adminRoles = ["super_admin", "super-admin", "admin", "owner"];
    if (adminRoles.includes(session.role)) {
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

      // Check allowed_pages (frontend list)
      const allowedPages = session.allowedPages || [];
      if (!allowedPages.includes(requestedPage)) {
        setResult({
          status: "denied",
          reason: `Access denied. You do not have permission for this page.`
        });
        return;
      }

      // Check backend permission code (async)
      checkBackendPermission(requestedPage).then(granted => {
        if (granted) {
          setResult({ status: "granted" });
        } else {
          setResult({
            status: "denied",
            reason: "Access denied. Missing required permission."
          });
        }
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
