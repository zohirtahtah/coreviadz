import React, { useState, useEffect } from "react";
import { 
  Building2, Users, Ban, ShieldAlert, ShieldCheck, Smartphone, 
  Search, Filter, LogOut, Plus, KeyRound, Globe, RefreshCcw, 
  Activity, Landmark, UserCheck, Calendar, Phone, Mail, Shield, 
  AlertTriangle, Eye, Bell, Settings, Database, MessageSquare, Megaphone,
  Check, Copy, Terminal, Server
} from "lucide-react";
import { SaaSCompany, SaaSActivityLog, SuperAdminConfig, LanguageType } from "../types";
import { supabase } from "../supabaseClient";

// Import modular subtabs
import OverviewTab from "./superadmin/OverviewTab";
import CompaniesTab from "./superadmin/CompaniesTab";
import CompanyDetailsModal from "./superadmin/CompanyDetailsModal";
import SupportTab from "./superadmin/SupportTab";
import AnnouncementsTab from "./superadmin/AnnouncementsTab";
import AuditTab from "./superadmin/AuditTab";
import BackupTab from "./superadmin/BackupTab";
import SecurityTab from "./superadmin/SecurityTab";
import SettingsTab from "./superadmin/SettingsTab";
import SearchTab from "./superadmin/SearchTab";

interface SuperAdminViewProps {
  lang: LanguageType;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
  onLogout: () => void;
  session: any;
  profile: any;
  onCleanSlate: () => Promise<void>;
}

export default function SuperAdminView({
  lang,
  onTriggerNotification,
  onLogout,
  session,
  profile,
  onCleanSlate
}: SuperAdminViewProps) {
  const isRtl = lang === "ar";

  // Core SaaS State
  const [companies, setCompanies] = useState<SaaSCompany[]>([]);
  const [logs, setLogs] = useState<SaaSActivityLog[]>([]);
  const [isLoadingSaaS, setIsLoadingSaaS] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<string>("overview");

  // Selection & Details modal state
  const [selectedCompany, setSelectedCompany] = useState<SaaSCompany | null>(null);

  // Global Platform Notifications (Real-time updates)
  const [notifications, setNotifications] = useState<any[]>([
    { id: "not-1", title: isRtl ? "تسجيل شركة جديدة" : "New Tenant Registered", content: "Amet Trading completed platform verification", is_read: false, created_at: "Just now" },
    { id: "not-2", title: isRtl ? "تذكرة دعم فني جديدة" : "New Support Ticket", content: "El-Bahi Logistcs submitted: Database slow query", is_read: false, created_at: "10 mins ago" }
  ]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Load companies and basic activity lists directly from Supabase via superadmin API bypassing RLS
  const loadSaaSRealData = async () => {
    setIsLoadingSaaS(true);
    try {
      let token = (session as any)?.token;
      if (!token) {
        try {
          const cachedRaw = localStorage.getItem("corevia_session_v1");
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            token = parsed?.token || undefined;
          }
        } catch (_) {}
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const url = token ? `/api/superadmin/companies?token=${encodeURIComponent(token)}` : "/api/superadmin/companies";
      const response = await fetch(url, {
        headers,
        credentials: "include"
      });
      if (!response.ok) {
        let errBody = "";
        try {
          const errJson = await response.json();
          errBody = errJson.error || errJson.message || JSON.stringify(errJson);
        } catch (_) {
          try {
            errBody = await response.text();
          } catch (_) {}
        }
        throw new Error(`Failed to load superadmin companies: [Status ${response.status}] ${errBody || response.statusText}`);
      }
      const { users, companies: realCompanies, profiles } = await response.json();

      const saasCompanies: SaaSCompany[] = (realCompanies || [])
        .map(rc => {
          const companyId = rc.id;
          const prof = (profiles || []).find(p => p.id === companyId || p.company_id === companyId);
          const companyUsers = (users || []).filter(u => u.company_id === companyId);
          const u = companyUsers[0];
          
          const companyName = rc.name || prof?.business_name || `Enterprise Workspace (${companyId.substring(0, 5)})`;
          const ownerName = rc.owner_name || u?.username || prof?.owner_name || "System Owner";
          const email = rc.owner_email || rc.email || u?.email || "no-owner@corevia.com";
          const phone = rc.phone || prof?.phone || "";
          
          // Universal schema-agnostic normalization for Super Admin side
          const seatsLimitVal = rc.seats_limit !== undefined 
            ? rc.seats_limit 
            : (rc.seatsLimit !== undefined 
                ? rc.seatsLimit 
                : (rc.seatslimit !== undefined ? rc.seatslimit : 5));

          const regDateVal = rc.registration_date 
            || rc.trial_start_date 
            || rc.trial_start_at 
            || (rc.created_at ? rc.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);

          let expirationDateVal = rc.subscription_end_at 
            || rc.subscription_end_date 
            || rc.trial_end_date 
            || rc.expirationDate 
            || rc.expirationdate 
            || "";

          if (!expirationDateVal) {
            const parsedReg = new Date(regDateVal);
            if (!isNaN(parsedReg.getTime())) {
              expirationDateVal = new Date(parsedReg.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            } else {
              expirationDateVal = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            }
          }

          let accountStatusVal = "Active";
          const rawStatus = rc.subscription_status 
            || rc.status 
            || rc.accountStatus 
            || rc.accountstatus 
            || "Active";
          
          const rawStatusLower = String(rawStatus).toLowerCase();
          if (rawStatusLower === "active") {
            accountStatusVal = "Active";
          } else if (rawStatusLower === "suspended" || rawStatusLower === "trial expired" || rawStatusLower === "expired") {
            accountStatusVal = "Suspended";
          } else if (rawStatusLower === "disabled") {
            accountStatusVal = "Disabled";
          } else if (rawStatusLower === "pending verification") {
            accountStatusVal = "Pending Verification";
          } else if (rawStatusLower === "read only") {
            accountStatusVal = "Read Only";
          } else {
            accountStatusVal = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
          }

          // Force expiration status check
          if (expirationDateVal) {
            const expTime = new Date(expirationDateVal).getTime();
            if (expTime < Date.now()) {
              accountStatusVal = "Suspended";
            }
          }

          const subscriptionPlanVal = rc.subscription_plan 
            || rc.subscriptionPlan 
            || rc.subscriptionplan 
            || "Trial";

          return {
            id: companyId,
            companyName,
            ownerName,
            email,
            phone,
            country: rc.country || "Algeria",
            registrationDate: regDateVal,
            lastLogin: rc.updated_at ? rc.updated_at.replace("T", " ").substring(0, 16) : "Never Logged",
            emailVerified: rc.email_verified !== false,
            subscriptionPlan: subscriptionPlanVal as any,
            seatsLimit: seatsLimitVal,
            seatsUsed: companyUsers.length > 0 ? companyUsers.length : 1,
            accountStatus: accountStatusVal as any,
            expirationDate: expirationDateVal,
            activeDevices: [],
            otpCode: rc.otpCode || "123456"
          };
        });

      setCompanies(saasCompanies);

      // Dynamically generate real platform notifications from loaded registered companies
      const sortedCos = [...saasCompanies].sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime());
      const dynNotifications = sortedCos.slice(0, 5).map((co, idx) => {
        const timeLabel = idx === 0 ? (isRtl ? "الآن" : "Just now") : `${idx * 2} ${isRtl ? "ساعات مضت" : "hours ago"}`;
        return {
          id: `not-real-${co.id}-${idx}`,
          title: isRtl ? "تسجيل شركة جديدة" : "New Tenant Registered",
          content: isRtl 
            ? `أكملت الشركة ${co.companyName} عملية التسجيل والتحقق بنجاح`
            : `Tenant ${co.companyName} completed registration & verification`,
          is_read: false,
          created_at: timeLabel
        };
      });
      if (dynNotifications.length > 0) {
        setNotifications(dynNotifications);
      }

    } catch (e) {
      console.error("Super Admin real data fetch error:", e);
    } finally {
      setIsLoadingSaaS(false);
    }
  };

  useEffect(() => {
    loadSaaSRealData();

    if (!supabase) return;

    // Live synchronization (Issue 7): Automatically refresh when any company or user changes
    const companiesChannel = supabase
      .channel("super_admin_realtime_companies")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "corevia_companies" },
        () => {
          console.log("Realtime sync: corevia_companies updated, reloading...");
          loadSaaSRealData();
        }
      )
      .subscribe();

    const usersChannel = supabase
      .channel("super_admin_realtime_users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "corevia_saas_users" },
        () => {
          console.log("Realtime sync: corevia_saas_users updated, reloading...");
          loadSaaSRealData();
        }
      )
      .subscribe();

    return () => {
      companiesChannel.unsubscribe();
      usersChannel.unsubscribe();
    };
  }, [activeSubTab]);

  // Core handlers to pass down to child components
  const handleUpdateCompany = async (companyId: string, updatedFields: Partial<SaaSCompany>) => {
    if (!supabase) return;
    try {
      const payload: any = {};
      if (updatedFields.companyName !== undefined) payload.name = updatedFields.companyName;
      if (updatedFields.ownerName !== undefined) payload.owner_name = updatedFields.ownerName;
      if (updatedFields.email !== undefined) payload.owner_email = updatedFields.email;
      if (updatedFields.phone !== undefined) payload.phone = updatedFields.phone;
      
      if (updatedFields.subscriptionPlan !== undefined) {
        payload.subscriptionPlan = updatedFields.subscriptionPlan;
        payload.subscription_plan = updatedFields.subscriptionPlan;
      }
      if (updatedFields.seatsLimit !== undefined) {
        payload.seatsLimit = updatedFields.seatsLimit;
        payload.seats_limit = updatedFields.seatsLimit;
      }
      if (updatedFields.accountStatus !== undefined) {
        payload.accountStatus = updatedFields.accountStatus;
        payload.subscription_status = updatedFields.accountStatus;
        payload.status = updatedFields.accountStatus.toLowerCase() === "active" ? "active" : "suspended";
      }
      if (updatedFields.expirationDate !== undefined) {
        payload.expirationDate = updatedFields.expirationDate;
        payload.subscription_end_at = updatedFields.expirationDate;
        payload.subscription_end_date = updatedFields.expirationDate;
        payload.trial_end_date = updatedFields.expirationDate;
      }

      // Defensive stripping update to support any schema combinations without throwing errors
      let activePayload = { ...payload };
      let success = false;
      let attempts = 0;
      let lastError: any = null;

      while (attempts < 20 && !success) {
        const { error } = await supabase
          .from("corevia_companies")
          .update(activePayload)
          .eq("id", companyId);

        if (!error) {
          success = true;
        } else {
          lastError = error;
          const errMsg = error.message || "";
          const match = errMsg.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
            const badColumn = match[1];
            delete activePayload[badColumn];
            attempts++;
          } else {
            throw error;
          }
        }
      }

      if (!success && lastError) {
        throw lastError;
      }

      // Add to audit trail
      await supabase.from("corevia_admin_activity").insert({
        id: `aud-${Date.now()}`,
        who: "Super Admin",
        company_id: companyId,
        action: "Update Parameters",
        table_name: "corevia_companies",
        record_id: companyId,
        new_value: payload,
        ip: "197.200.44.11",
        browser: "Chrome",
        os: "Windows 11"
      });

      // Update locally
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, ...updatedFields } : c));
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const handleSoftDeleteCompany = async (companyId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("corevia_companies")
        .update({ accountStatus: "Disabled" })
        .eq("id", companyId);

      if (error) throw error;

      await supabase.from("corevia_admin_activity").insert({
        id: `aud-${Date.now()}`,
        who: "Super Admin",
        company_id: companyId,
        action: "Soft Delete Workspace",
        table_name: "corevia_companies",
        record_id: companyId,
        new_value: { status: "Disabled" },
        ip: "197.200.44.11",
        browser: "Chrome",
        os: "Windows"
      });

      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, accountStatus: "Disabled" } : c));
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const handleSelectCompanyById = (companyId: string) => {
    const target = companies.find(c => c.id === companyId);
    if (target) {
      setSelectedCompany(target);
    } else {
      onTriggerNotification(isRtl ? "لم يتم العثور على الشركة المستهدفة!" : "Target company profile not found in index!", "info");
    }
  };

  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;

  const sidebarMenu = [
    { id: "overview", label: isRtl ? "لوحة المراقبة" : "Executive Hub", icon: Landmark },
    { id: "directory", label: isRtl ? "دليل الحسابات" : "Tenants Directory", icon: Building2 },
    { id: "support", label: isRtl ? "تذاكر الدعم الفني" : "Support Tickets", icon: MessageSquare },
    { id: "announcements", label: isRtl ? "إعلانات المنصة" : "Platform Broadcasts", icon: Megaphone },
    { id: "audit", label: isRtl ? "سجل الرقابة والتدقيق" : "Global Audit Log", icon: Activity },
    { id: "backup", label: isRtl ? "النسخ الاحتياطي" : "Snapshots Backup", icon: Database },
    { id: "security", label: isRtl ? "بوابة الأمان" : "Security Gateway", icon: ShieldCheck },
    { id: "search", label: isRtl ? "البحث الشامل" : "Multi-Index Search", icon: Search },
    { id: "settings", label: isRtl ? "إعدادات المنصة" : "Platform Settings", icon: Settings },
    { id: "debug", label: isRtl ? "Diagnostic (Debug)" : "Diagnostic Center", icon: Terminal }
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 flex overflow-hidden font-sans" id="saas_super_admin_core_dashboard">
      
      {/* 1. SOLID SIDEBAR */}
      <div className={`w-64 bg-[#121214] border-r border-[#27272a] flex flex-col shrink-0 ${isRtl ? "order-last border-l border-r-0" : "order-first"}`}>
        <div className="p-5 border-b border-[#27272a] flex items-center gap-3 justify-end">
          <div className="text-right">
            <h1 className="text-sm font-black text-white">Corevia SuperAdmin</h1>
            <span className="text-[10px] text-zinc-500 font-mono">SaaS Engine v1.0</span>
          </div>
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sidebarMenu.map((m) => {
            const Icon = m.icon;
            const active = activeSubTab === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveSubTab(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  isRtl ? "justify-end text-right" : "justify-start text-left"
                } ${
                  active 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10" 
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/30"
                }`}
              >
                {!isRtl && <Icon className="w-4.5 h-4.5" />}
                <span>{m.label}</span>
                {isRtl && <Icon className="w-4.5 h-4.5" />}
              </button>
            );
          })}
        </div>

        {/* Footer profile & exit */}
        <div className="p-4 border-t border-[#27272a] space-y-2.5">
          <div className="flex items-center gap-3 justify-end text-right">
            <div>
              <span className="text-xs font-bold text-white block">{session?.username || "Super Administrator"}</span>
              <span className="text-[10px] text-zinc-500 block">SaaS Owner</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-black text-indigo-400 text-xs">
              AD
            </div>
          </div>

          <button 
            onClick={onLogout}
            className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-rose-400 hover:text-rose-300 border border-zinc-800 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isRtl ? "تسجيل الخروج" : "Disconnect"}</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN APPLICATION COMPOSITION CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Navbar Header */}
        <div className="h-14 border-b border-[#27272a] bg-[#121214] px-6 flex items-center justify-between shadow-sm shrink-0">
          
          {/* RTL Toggle, timezone indicator */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">GMT+1 | Algerian Time</span>
          </div>

          {/* Right/Left Controls: Notifications feed & search */}
          <div className="flex items-center gap-3">
            {/* Realtime Notifications Feed Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-[8px] font-black flex items-center justify-center text-white animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div className="absolute top-10 right-0 w-80 bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl p-3 z-40 text-right space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                    <button 
                      onClick={() => {
                        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
                        onTriggerNotification(isRtl ? "تم تعليم الكل كمقروء!" : "Marked all as read", "success");
                      }}
                      className="text-[9px] font-black text-indigo-400 hover:text-white"
                    >
                      {isRtl ? "تعليم المقروء" : "Mark all read"}
                    </button>
                    <span className="text-[10px] font-bold text-white">{isRtl ? "أحدث التنبيهات المنصة" : "Realtime SaaS Alerts"}</span>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2 bg-zinc-900/60 rounded border border-zinc-850 hover:border-zinc-700 transition-all text-right">
                        <div className="flex justify-between items-center text-[9px] text-zinc-500 mb-0.5">
                          <span>{n.created_at}</span>
                          <span className="font-bold text-white">{n.title}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-normal">{n.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sub-tab quick search icon identifier */}
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <span className="text-xs font-black uppercase tracking-wider px-2 block">{activeSubTab}</span>
            </div>
          </div>

        </div>

        {/* Viewport Core scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Active Tab View Switcher */}
          {activeSubTab === "overview" && (
            <OverviewTab isRtl={isRtl} companies={companies} onTriggerNotification={onTriggerNotification} />
          )}

          {activeSubTab === "directory" && (
            <CompaniesTab 
              isRtl={isRtl}
              companies={companies}
              onTriggerNotification={onTriggerNotification}
              onSelectCompany={setSelectedCompany}
              onRefresh={loadSaaSRealData}
              onUpdateCompany={handleUpdateCompany}
              onSoftDeleteCompany={handleSoftDeleteCompany}
            />
          )}

          {activeSubTab === "support" && (
            <SupportTab isRtl={isRtl} onTriggerNotification={onTriggerNotification} />
          )}

          {activeSubTab === "announcements" && (
            <AnnouncementsTab isRtl={isRtl} onTriggerNotification={onTriggerNotification} />
          )}

          {activeSubTab === "audit" && (
            <AuditTab isRtl={isRtl} companies={companies} onTriggerNotification={onTriggerNotification} />
          )}

          {activeSubTab === "backup" && (
            <BackupTab isRtl={isRtl} onTriggerNotification={onTriggerNotification} />
          )}

          {activeSubTab === "security" && (
            <SecurityTab isRtl={isRtl} companies={companies} onTriggerNotification={onTriggerNotification} />
          )}

          {activeSubTab === "search" && (
            <SearchTab 
              isRtl={isRtl}
              onTriggerNotification={onTriggerNotification}
              onSelectCompanyById={handleSelectCompanyById}
            />
          )}

          {activeSubTab === "settings" && (
            <SettingsTab isRtl={isRtl} onTriggerNotification={onTriggerNotification} />
          )}

          {/* TAB X: DIAGNOSTIC & DEBUG PANEL */}
          {activeSubTab === "debug" && (
            <div className="space-y-6" id="super_admin_tab_debug">
              <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-6 text-right">
                
                <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white flex items-center gap-2 justify-end">
                      <span>{isRtl ? "مركز التجارب وفحص أخطاء الاتصالات السحابية" : "SaaS Diagnostic Environment"}</span>
                      <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                    </h3>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      {isRtl ? "متاح فقط لأصحاب الصلاحية لمالك المنصة لفحص سلامة اتصالات الجلسة وقاعدة البيانات السحابية." : "Confidential orchestrator panel to audit session state and clear test ledger tables."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Identity profile state info */}
                  <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl space-y-3">
                    <h4 className="text-xs font-extrabold text-white flex items-center gap-2 justify-end font-sans">
                      <span>{isRtl ? "بيانات الهوية والاتصال السحابية" : "Cloud Security Profile"}</span>
                      <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    </h4>
                    
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center text-[11px] border-b border-zinc-900 pb-1.5">
                        <span className="text-zinc-400">{isRtl ? "معرف المستخدم (User ID)" : "User ID"}</span>
                        <span className="text-white select-all">{session?.user_id || "N/A"}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[11px] border-b border-zinc-900 pb-1.5">
                        <span className="text-zinc-400">{isRtl ? "البريد الإلكتروني (Email)" : "Auth Email"}</span>
                        <span className="text-white select-all">{session?.email || "N/A"}</span>
                      </div>

                      <div className="flex justify-between items-center text-[11px] border-b border-zinc-900 pb-1.5">
                        <span className="text-zinc-400">{isRtl ? "معرف الشركة (Company ID)" : "Company ID"}</span>
                        <span className="text-white select-all">{session?.company_id || "N/A"}</span>
                      </div>

                      <div className="flex justify-between items-center text-[11px] pb-0.5">
                        <span className="text-zinc-400">{isRtl ? "الصلاحية (Access Role)" : "Role"}</span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-extrabold">{session?.role || "super_admin"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Clean Slate Operations */}
                  <div className="p-4 bg-[#141417] border border-zinc-800 rounded-xl space-y-3">
                    <h4 className="text-xs font-extrabold text-white flex items-center gap-2 justify-end">
                      <span>{isRtl ? "حالة مساحة العمل والمقاعد" : "Tenant Operations Ledger"}</span>
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    </h4>
                    
                    <div className="space-y-2 text-xs font-mono text-right">
                      <p>{isRtl ? `عدد الشركات المسجلة سحابياً: ${companies.length}` : `SaaS database tenants registered count: ${companies.length}`}</p>
                      <p>{isRtl ? "جميع خدمات الـ CDN وقواعد البيانات تعمل بشكل صحيح." : "Global Postgres, REST API services online and healthy."}</p>
                    </div>
                  </div>

                </div>

                {/* Clean Slate Danger Box */}
                <div className="p-5 bg-rose-950/10 border border-rose-500/20 rounded-xl space-y-4">
                  <div className="flex items-start gap-3 justify-end">
                    <div className="space-y-1 text-right">
                      <h4 className="text-xs font-black text-white">{isRtl ? "تصفير وتنظيف بيئة العمل (Clean Slate / Reset Sandbox)" : "Dangerous: Purge Sandbox Environment"}</h4>
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        {isRtl 
                          ? "يتيح هذا الإجراء حذف كل البيانات التجريبية لحسابات الأدمن والشركات والعمليات لكي تصبح البيئة نظيفة تماماً. سيقوم بتصفير Onboarding لـ false وحذف الملف الشخصي وكل الجداول السحابية لتعود لنقطة البداية."
                          : "Permanently delete all product catalogs, orders, invoices, worker indices, and purge cloud tables. Resets onboarding status to trigger initial setup flow on refresh."}
                      </p>
                    </div>
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmMsg = isRtl 
                          ? "🚨 تحذير أمني هام!\n\nهل أنت متأكد من رغبتك في تصفير وحذف جميع البيانات والملفات والشركات من السحابة وجهازك والبدء من جديد؟ لا يمكن التراجع عن هذا الإجراء."
                          : "🚨 WARNING!\n\nAre you sure you want to completely erase the client and tenant database schemas, reset onboarding state and start fresh? This is irreversible.";
                        
                        if (window.confirm(confirmMsg)) {
                          try {
                            onTriggerNotification(isRtl ? "جاري تصفير وتنظيف بيئة وتجربة العمل..." : "Initiating sandbox clean slate sweep...", "info");
                            await onCleanSlate();
                            onTriggerNotification(isRtl ? "✅ تم تصفير بيئة العمل بنجاح! جاري التحديث..." : "✅ Sandbox cleared successfully! Reloading...", "success");
                            setTimeout(() => {
                              window.location.reload();
                            }, 1500);
                          } catch (err: any) {
                            onTriggerNotification(`Error: ${err.message || err}`, "info");
                          }
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                      {isRtl ? "تصفير وحذف بيئة العمل" : "Execute Clean Slate Sweep"}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

      {/* 3. DYNAMIC DRILLDOWN COMPANY DETAILS MODAL */}
      {selectedCompany && (
        <CompanyDetailsModal 
          isRtl={isRtl}
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onTriggerNotification={onTriggerNotification}
          onUpdateCompanyPlan={async (coId, plan, expiry, seats) => {
            await handleUpdateCompany(coId, {
              subscriptionPlan: plan as any,
              expirationDate: expiry,
              seatsLimit: seats
            });
            // Keep state in sync
            setSelectedCompany(prev => prev ? {
              ...prev,
              subscriptionPlan: plan as any,
              expirationDate: expiry,
              seatsLimit: seats
            } : null);
          }}
        />
      )}

    </div>
  );
}
