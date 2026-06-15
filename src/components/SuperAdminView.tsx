import React, { useState, useEffect, useMemo } from "react";
import {
  Building2, Users, Ban, ShieldAlert, ShieldCheck,
  Search, Filter, LogOut, Plus, KeyRound, Globe, RefreshCcw,
  Activity, UserCheck, Calendar, Phone, Mail, Shield, AlertTriangle, Eye,
  BarChart3, ChevronRight, ChevronLeft, X, CheckCircle, Clock, Zap,
  CreditCard, DollarSign, Package, MessageSquare, HardDrive, TrendingUp,
  TrendingDown, MoreVertical, Edit3, Trash2, ArrowUpDown, Download,
  Layers, Bell, BellOff, Settings, HelpCircle, ExternalLink, Timer,
  History, ArrowUp, ArrowDown, Target, Award
} from "lucide-react";
import { SaaSCompany, SaaSActivityLog, SuperAdminConfig, LanguageType, UserSession, SubscriptionHistoryRecord } from "../types";
import { supabase } from "../supabaseClient";
import {
  getSubscription, upsertSubscription, updateSubscriptionSeats,
  getSeatManagement, upsertSeatManagement, updateSeatsLimit,
  getSubscriptionHistory, addSubscriptionHistory,
  getNotificationsForCompany, createNotification,
  getExpirationGroups, calcEndDate, daysRemaining, getDaysColor, PLAN_DETAILS
} from "../subscriptionService";

interface SuperAdminViewProps {
  lang: LanguageType;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
  onLogout: () => void;
  session: UserSession;
  profile: any;
  onCleanSlate: () => Promise<void>;
}

const PLANS = PLAN_DETAILS;

type SaView = "dashboard" | "companies" | "company-detail" | "activity" | "subscriptions" | "expiration-center";

export default function SuperAdminView({
  lang, onTriggerNotification, onLogout, session, profile, onCleanSlate
}: SuperAdminViewProps) {
  const isRtl = lang === "ar";
  const t = (ar: string, en: string) => isRtl ? ar : en;

  const [view, setView] = useState<SaView>("dashboard");
  const [companies, setCompanies] = useState<SaaSCompany[]>([]);
  const [logs, setLogs] = useState<SaaSActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPlan, setNewPlan] = useState<"Free" | "Basic" | "Pro" | "Enterprise">("Basic");
  const [secConfig, setSecConfig] = useState<SuperAdminConfig>(() => {
    const saved = localStorage.getItem("corevia_saas_security_config_v1");
    return saved ? JSON.parse(saved) : { twoFactorGlobalState: false, failedLoginAttemptsCount: 14, ipTrackingEnabled: true };
  });

  // Subscription editing states
  const [editPlan, setEditPlan] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editDuration, setEditDuration] = useState("1");
  const [editEndDate, setEditEndDate] = useState("");
  const [editSeatsLimit, setEditSeatsLimit] = useState(5);
  const [editStatus, setEditStatus] = useState("Active");

  // Seat management states
  const [seatLimitInput, setSeatLimitInput] = useState(5);
  const [seatHistory, setSeatHistory] = useState<SubscriptionHistoryRecord[]>([]);
  const [activeNotifs, setActiveNotifs] = useState<{ companyId: string; message: string; type: "yellow" | "orange" | "red" }[]>([]);

  // Expiration center filter
  const [expFilter, setExpFilter] = useState<string>("ALL");

  useEffect(() => {
    localStorage.setItem("corevia_saas_security_config_v1", JSON.stringify(secConfig));
  }, [secConfig]);

  const loadData = async () => {
    if (!supabase) {
      const saved = localStorage.getItem("corevia_saas_companies_v1");
      if (saved) try { setCompanies(JSON.parse(saved)); } catch (e) {}
      const savedLogs = localStorage.getItem("corevia_saas_activity_logs_v1");
      if (savedLogs) try { setLogs(JSON.parse(savedLogs)); } catch (e) {}
      return;
    }
    setIsLoading(true);
    try {
      const { data: users } = await supabase.from("corevia_saas_users").select("*");
      const { data: regularCompanies } = await supabase.from("companies").select("*");
      const { data: realCompanies } = await supabase.from("corevia_companies").select("*");
      const { data: profiles } = await supabase.from("corevia_profile").select("*");
      const { data: subscriptions } = await supabase.from("corevia_subscriptions").select("*");

      const saasCompanies: SaaSCompany[] = (users || []).map(u => {
        const comp = (regularCompanies || []).find(c => c.id === u.company_id);
        const prof = (profiles || []).find(p => p.id === u.company_id || p.company_id === u.company_id);
        const realC = (realCompanies || []).find(rc => rc.id === u.company_id);
        const sub = (subscriptions || []).find((s: any) => s.company_id === u.company_id);

        const companyName = prof?.business_name || comp?.company_name || realC?.name || comp?.name || `${u.username || u.email.split("@")[0]} Trading`;
        const ownerName = u.username || prof?.owner_name || realC?.owner_name || comp?.owner_name || u.email.split("@")[0];
        const email = u.email;
        const phone = prof?.phone || realC?.phone || comp?.phone || "";
        const registrationDate = u.created_at ? u.created_at.split("T")[0] : new Date().toISOString().split("T")[0];
        const seatsLimitVal = sub?.seats_limit ?? realC?.seatsLimit ?? realC?.seatslimit ?? 5;
        const accountStatusVal = realC?.accountStatus ?? realC?.accountstatus ?? (u.has_completed_onboarding ? "Active" : "Pending Verification");
        const subscriptionPlanVal = sub?.plan_name ?? realC?.subscriptionPlan ?? realC?.subscriptionplan ?? "Basic";
        let expirationDateVal = sub?.end_date ?? realC?.expirationDate ?? realC?.expiration_date ?? "";
        if (!expirationDateVal) {
          const regTime = new Date(registrationDate).getTime();
          expirationDateVal = subscriptionPlanVal === "Trial"
            ? new Date(regTime + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
            : new Date(regTime + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        }

        return {
          id: u.company_id || `cop_${u.user_id.substring(0, 15)}`,
          companyName, ownerName, email, phone,
          country: realC?.country || prof?.country || "Algeria",
          registrationDate,
          lastLogin: comp?.updated_at ? comp.updated_at.replace("T", " ").substring(0, 16) : "Never Logged",
          emailVerified: accountStatusVal !== "Pending Verification",
          subscriptionPlan: subscriptionPlanVal as any,
          seatsLimit: seatsLimitVal,
          seatsUsed: sub?.seats_used ?? 1,
          accountStatus: accountStatusVal as any,
          expirationDate: expirationDateVal,
          activeDevices: [],
          otpCode: realC?.otpCode || realC?.otp_code || "123456"
        };
      });

      setCompanies(saasCompanies);

      // Build notifications from expiration data
      const notifs: { companyId: string; message: string; type: "yellow" | "orange" | "red" }[] = [];
      saasCompanies.forEach(co => {
        if (!co.expirationDate) return;
        const d = daysRemaining(co.expirationDate);
        if (d <= 0) {
          notifs.push({ companyId: co.id, message: `"${co.companyName}" — ${t("انتهى الاشتراك. يرجى التجديد.", "Subscription expired. Please renew.")}`, type: "red" });
        } else if (d <= 1) {
          notifs.push({ companyId: co.id, message: `"${co.companyName}" — ${t("سينتهي اشتراكك غداً.", "Your subscription expires tomorrow.")}`, type: "red" });
        } else if (d <= 3) {
          notifs.push({ companyId: co.id, message: `"${co.companyName}" — ${t(`سينتهي الاشتراك خلال ${d} أيام.`, `Subscription expires in ${d} days.`)}`, type: "orange" });
        } else if (d <= 7) {
          notifs.push({ companyId: co.id, message: `"${co.companyName}" — ${t(`سينتهي الاشتراك خلال ${d} أيام.`, `Subscription expires in ${d} days.`)}`, type: "orange" });
        } else if (d <= 15) {
          notifs.push({ companyId: co.id, message: `"${co.companyName}" — ${t(`سينتهي الاشتراك خلال ${d} يوماً.`, `Subscription expires in ${d} days.`)}`, type: "yellow" });
        } else if (d <= 30) {
          notifs.push({ companyId: co.id, message: `"${co.companyName}" — ${t(`سينتهي الاشتراك خلال ${d} يوماً.`, `Subscription expires in ${d} days.`)}`, type: "yellow" });
        }
      });
      setActiveNotifs(notifs.slice(0, 50));

      const saasLogs: SaaSActivityLog[] = (users || []).map((u, i) => {
        const coName = u.username || u.email.split("@")[0];
        return {
          id: `log-reg-${u.user_id}`,
          timestamp: u.created_at || new Date().toISOString(),
          companyName: (saasCompanies || []).find((c: any) => c.email === u.email)?.companyName || `${coName} Trading`,
          email: u.email,
          operation: u.has_completed_onboarding ? t("اكتمل الإعداد", "Onboarding Complete") : t("إنشاء حساب", "Account Created"),
          details: u.has_completed_onboarding
            ? t(`اكتمل إعداد ${coName}`, `Onboarding completed for ${coName}`)
            : t("حساب جديد بانتظار الإعداد", "New account pending onboarding"),
          ipAddress: "197.200." + Math.floor(10 + (i * 12) % 200) + "." + Math.floor(5 + (i * 20) % 250)
        };
      });
      saasLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(saasLogs);
    } catch (e) {
      console.error("Super Admin data fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => { localStorage.setItem("corevia_saas_companies_v1", JSON.stringify(companies)); }, [companies]);
  useEffect(() => { localStorage.setItem("corevia_saas_activity_logs_v1", JSON.stringify(logs)); }, [logs]);

  const persistToSupabase = async (companyId: string, updates: Record<string, any>) => {
    if (!supabase) return;
    try {
      await supabase.from("corevia_companies").update(updates).eq("id", companyId);
    } catch (err) {
      console.error("Supabase persist error:", err);
    }
  };

  const addLog = (companyName: string, email: string, operation: string, details: string) => {
    const newLog: SaaSActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(), companyName, email, operation, details,
      ipAddress: "197.200." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255)
    };
    setLogs(prev => [newLog, ...prev]);
    if (supabase) {
      supabase.from("corevia_activity_logs").insert({
        id: newLog.id, company_id: companies.find(c => c.email === email)?.id || "",
        actor_name: "Super Admin", actor_role: "Orchestrator",
        operation, item_type: "super_admin_action", new_value: { details },
        ip_address: newLog.ipAddress
      }).then().then(undefined, () => {});
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const q = searchTerm.toLowerCase();
      const matchSearch = !q || c.companyName.toLowerCase().includes(q) || c.ownerName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || c.accountStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [companies, searchTerm, statusFilter]);

  const selectedCompany = useMemo(() => companies.find(c => c.id === selectedCompanyId), [selectedCompanyId, companies]);

  const stats = useMemo(() => {
    const total = companies.length;
    let active = 0, suspended = 0, trial = 0, expired = 0, pending = 0;
    let totalSeatsUsed = 0, totalSeatsLimit = 0;

    companies.forEach(c => {
      if (c.accountStatus === "Active") active++;
      else if (c.accountStatus === "Suspended") suspended++;
      else if (c.subscriptionPlan === "Free" || c.subscriptionPlan === "Trial") trial++;
      if (c.expirationDate && new Date(c.expirationDate) < new Date()) expired++;
      if (c.accountStatus === "Pending Verification") pending++;
      totalSeatsUsed += c.seatsUsed || 1;
      totalSeatsLimit += c.seatsLimit;
    });

    return { total, active, suspended, trial, expired, pending, totalSeatsUsed, totalSeatsLimit };
  }, [companies]);

  // ========== COMPANY CONTROL ACTIONS ==========
  const handleActivate = (co: SaaSCompany) => {
    setCompanies(prev => prev.map(c => c.id === co.id ? { ...c, accountStatus: "Active", emailVerified: true } : c));
    persistToSupabase(co.id, { accountStatus: "Active" });
    addLog(co.companyName, co.email, t("تفعيل", "Activate"), t(`تم تفعيل حساب ${co.companyName}`, `Activated ${co.companyName}`));
    onTriggerNotification(t("تم التفعيل", "Activated"), "success");
  };

  const handleSuspend = (co: SaaSCompany) => {
    setCompanies(prev => prev.map(c => c.id === co.id ? { ...c, accountStatus: "Suspended" } : c));
    persistToSupabase(co.id, { accountStatus: "Suspended" });
    addLog(co.companyName, co.email, t("تعليق", "Suspend"), t(`تم تعليق حساب ${co.companyName}`, `Suspended ${co.companyName}`));
    onTriggerNotification(t("تم التعليق", "Suspended"), "success");
  };

  const handleDisable = (co: SaaSCompany) => {
    setCompanies(prev => prev.map(c => c.id === co.id ? { ...c, accountStatus: "Disabled" } : c));
    persistToSupabase(co.id, { accountStatus: "Disabled" });
    addLog(co.companyName, co.email, t("تعطيل", "Disable"), t(`تم تعطيل حساب ${co.companyName}`, `Disabled ${co.companyName}`));
    onTriggerNotification(t("تم التعطيل", "Disabled"), "info");
  };

  const handleReactivate = (co: SaaSCompany) => {
    setCompanies(prev => prev.map(c => c.id === co.id ? { ...c, accountStatus: "Active" } : c));
    persistToSupabase(co.id, { accountStatus: "Active" });
    addLog(co.companyName, co.email, t("إعادة تفعيل", "Reactivate"), t(`تم إعادة تفعيل حساب ${co.companyName}`, `Reactivated ${co.companyName}`));
    onTriggerNotification(t("تم إعادة التفعيل", "Reactivated"), "success");
  };

  // Subscription management
  useEffect(() => {
    if (selectedCompany) {
      setEditPlan(selectedCompany.subscriptionPlan);
      setEditStartDate(selectedCompany.registrationDate || new Date().toISOString().split("T")[0]);
      setEditDuration("1");
      setEditSeatsLimit(selectedCompany.seatsLimit || 5);
      setEditStatus(selectedCompany.accountStatus);
      setSeatLimitInput(selectedCompany.seatsLimit || 5);
      const start = selectedCompany.registrationDate ? new Date(selectedCompany.registrationDate) : new Date();
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
      setEditEndDate(selectedCompany.expirationDate || end.toISOString().split("T")[0]);
      // Load history
      getSubscriptionHistory(selectedCompany.id).then(h => setSeatHistory(h));
    }
  }, [selectedCompanyId, companies]);

  const calcEndDateLocal = (start: string, dur: string) => {
    if (dur === "custom") return;
    const s = start ? new Date(start) : new Date();
    const months = parseInt(dur) || 1;
    const end = new Date(s.getFullYear(), s.getMonth() + months, s.getDate());
    setEditEndDate(end.toISOString().split("T")[0]);
  };

  const handleSaveSubscription = async () => {
    if (!selectedCompany) return;
    // Pure manual control — no auto-override from plan limits
    const finalSeats = editSeatsLimit;

    await persistToSupabase(selectedCompany.id, {
      subscriptionPlan: editPlan, seatsLimit: finalSeats,
      expirationDate: editEndDate, accountStatus: editStatus
    });

    // Also write to corevia_subscriptions
    await upsertSubscription({
      company_id: selectedCompany.id,
      plan_name: editPlan,
      start_date: editStartDate,
      duration_months: parseInt(editDuration) || 1,
      end_date: editEndDate,
      seats_limit: finalSeats,
      seats_used: selectedCompany.seatsUsed || 1,
      status: editStatus
    });

    // Record in history
    await addSubscriptionHistory(
      selectedCompany.id, parseInt(editDuration) || 1, editPlan,
      finalSeats, PLANS[editPlan]?.price || 0, session?.email || "super-admin",
      t("تجديد من لوحة الإدارة", "Renewed from admin panel")
    );

    // Update seat management
    await updateSeatsLimit(selectedCompany.id, finalSeats, session?.email || "super-admin");

    setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? {
      ...c, subscriptionPlan: editPlan as any, seatsLimit: finalSeats,
      expirationDate: editEndDate, accountStatus: editStatus as any
    } : c));

    // Refresh history
    getSubscriptionHistory(selectedCompany.id).then(h => setSeatHistory(h));

    addLog(selectedCompany.companyName, selectedCompany.email, t("تجديد اشتراك", "Subscription Renewal"),
      t(`تم تجديد الاشتراك: ${editPlan}، الحالة: ${editStatus}، المقاعد: ${finalSeats}، ينتهي ${editEndDate}`,
        `Subscription saved: ${editPlan}, status: ${editStatus}, seats: ${finalSeats}, expires ${editEndDate}`));
    onTriggerNotification(t("تم حفظ الاشتراك", "Subscription saved"), "success");
  };

  // ========== SEAT MANAGEMENT ACTIONS ==========
  const handleIncreaseSeats = async () => {
    if (!selectedCompany) return;
    const newLimit = selectedCompany.seatsLimit + 5;
    setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? { ...c, seatsLimit: newLimit } : c));
    await persistToSupabase(selectedCompany.id, { seatsLimit: newLimit });
    await updateSubscriptionSeats(selectedCompany.id, newLimit);
    await updateSeatsLimit(selectedCompany.id, newLimit, session?.email || "super-admin");
    setSeatLimitInput(newLimit);
    addLog(selectedCompany.companyName, selectedCompany.email, t("زيادة المقاعد", "Increase Seats"),
      t(`تم زيادة المقاعد إلى ${newLimit}`, `Seats increased to ${newLimit}`));
    onTriggerNotification(t(`تم زيادة المقاعد إلى ${newLimit}`, `Seats increased to ${newLimit}`), "success");
  };

  const handleDecreaseSeats = async () => {
    if (!selectedCompany) return;
    const newLimit = Math.max(1, selectedCompany.seatsLimit - 5);
    setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? { ...c, seatsLimit: newLimit } : c));
    await persistToSupabase(selectedCompany.id, { seatsLimit: newLimit });
    await updateSubscriptionSeats(selectedCompany.id, newLimit);
    await updateSeatsLimit(selectedCompany.id, newLimit, session?.email || "super-admin");
    setSeatLimitInput(newLimit);
    addLog(selectedCompany.companyName, selectedCompany.email, t("خفض المقاعد", "Decrease Seats"),
      t(`تم خفض المقاعد إلى ${newLimit}`, `Seats decreased to ${newLimit}`));
    onTriggerNotification(t(`تم خفض المقاعد إلى ${newLimit}`, `Seats decreased to ${newLimit}`), "success");
  };

  const handleCustomSeats = async () => {
    if (!selectedCompany || seatLimitInput < 1) return;
    setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? { ...c, seatsLimit: seatLimitInput } : c));
    await persistToSupabase(selectedCompany.id, { seatsLimit: seatLimitInput });
    await updateSubscriptionSeats(selectedCompany.id, seatLimitInput);
    await updateSeatsLimit(selectedCompany.id, seatLimitInput, session?.email || "super-admin");
    addLog(selectedCompany.companyName, selectedCompany.email, t("تعيين المقاعد", "Set Seats"),
      t(`تم تعيين المقاعد إلى ${seatLimitInput}`, `Seats set to ${seatLimitInput}`));
    onTriggerNotification(t(`تم تعيين المقاعد إلى ${seatLimitInput}`, `Seats set to ${seatLimitInput}`), "success");
  };

  // ========== RENDER ==========
  const btnClass = "px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer";

  // Expiration groups
  const expGroups = useMemo(() => {
    const groups = [
      { period: "30", label: t("30 يوم", "30 Days"), companies: [] as SaaSCompany[] },
      { period: "15", label: t("15 يوم", "15 Days"), companies: [] as SaaSCompany[] },
      { period: "7", label: t("7 أيام", "7 Days"), companies: [] as SaaSCompany[] },
      { period: "3", label: t("3 أيام", "3 Days"), companies: [] as SaaSCompany[] },
      { period: "expired", label: t("منتهية", "Expired"), companies: [] as SaaSCompany[] },
    ];
    companies.forEach(co => {
      if (!co.expirationDate) return;
      const d = daysRemaining(co.expirationDate);
      if (d <= 0) groups[4].companies.push(co);
      else if (d <= 3) groups[3].companies.push(co);
      else if (d <= 7) groups[2].companies.push(co);
      else if (d <= 15) groups[1].companies.push(co);
      else if (d <= 30) groups[0].companies.push(co);
    });
    return groups;
  }, [companies]);

  return (
    <div className={`min-h-screen bg-[#09090b] text-white ${isRtl ? "rtl" : "ltr"}`}>
      {/* TOP BAR */}
      <header className="h-14 border-b border-[#27272a] flex items-center justify-between px-4 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white text-sm">SA</div>
          <span className="text-sm font-bold">{t("لوحة التحكم الرئيسية", "Platform Owner Dashboard")}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadData()} className="p-2 hover:bg-[#27272a] rounded-lg transition-colors" title={t("تحديث", "Refresh")}>
            <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <span className="text-[10px] text-slate-500">{session?.email}</span>
          <button onClick={onLogout} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors" title={t("خروج", "Logout")}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* NAV TABS */}
      <nav className="flex border-b border-[#27272a] px-4 gap-1 overflow-x-auto">
        {(["dashboard", "companies", "expiration-center", "activity", "subscriptions"] as SaView[]).map(v => (
          <button key={v} onClick={() => { setView(v); if (v !== "company-detail") setSelectedCompanyId(null); }}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              view === v ? "border-violet-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}>
            {v === "dashboard" && <BarChart3 className="w-3.5 h-3.5 inline mr-1.5" />}
            {v === "companies" && <Building2 className="w-3.5 h-3.5 inline mr-1.5" />}
            {v === "expiration-center" && <Timer className="w-3.5 h-3.5 inline mr-1.5" />}
            {v === "activity" && <Activity className="w-3.5 h-3.5 inline mr-1.5" />}
            {v === "subscriptions" && <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />}
            {t({ dashboard: "الإحصائيات", companies: "الشركات", "expiration-center": "مركز الانتهاء", activity: "النشاطات", subscriptions: "الاشتراكات", "company-detail": "" }[v] || v,
               { dashboard: "Dashboard", companies: "Companies", "expiration-center": "Expiration", activity: "Activity", subscriptions: "Subscriptions", "company-detail": "" }[v] || v)}
          </button>
        ))}
      </nav>

      <div className="p-4 max-w-7xl mx-auto">
        {/* ==================== DASHBOARD VIEW ==================== */}
        {view === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<Building2 className="w-5 h-5" />} label={t("إجمالي الشركات", "Total Companies")} value={stats.total} color="bg-indigo-500/10 text-indigo-400" />
              <KpiCard icon={<CheckCircle className="w-5 h-5" />} label={t("شركات نشطة", "Active")} value={stats.active} color="bg-emerald-500/10 text-emerald-400" />
              <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label={t("معلقة", "Suspended")} value={stats.suspended} color="bg-amber-500/10 text-amber-400" />
              <KpiCard icon={<ShieldAlert className="w-5 h-5" />} label={t("منتهية", "Expired")} value={stats.expired} color="bg-red-500/10 text-red-400" />
              <KpiCard icon={<Zap className="w-5 h-5" />} label={t("تجريبية", "Trial")} value={stats.trial} color="bg-violet-500/10 text-violet-400" />
              <KpiCard icon={<Users className="w-5 h-5" />} label={t("المستخدمين", "Total Users")} value={stats.totalSeatsUsed} color="bg-blue-500/10 text-blue-400" />
              <KpiCard icon={<Layers className="w-5 h-5" />} label={t("المقاعد", "Seats")} value={`${stats.totalSeatsUsed}/${stats.totalSeatsLimit}`} color="bg-cyan-500/10 text-cyan-400" />
              <KpiCard icon={<Clock className="w-5 h-5" />} label={t("قيد الانتظار", "Pending")} value={stats.pending} color="bg-slate-500/10 text-slate-400" />
            </div>

            {/* Subscription Health Summary */}
            <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
              <h3 className="text-xs font-bold text-slate-400 mb-3">{t("حالة الاشتراكات", "Subscription Health")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {expGroups.map(g => (
                  <div key={g.period} className={`p-3 rounded-lg border text-center ${
                    g.period === "expired" ? "bg-red-500/10 border-red-500/20" :
                    g.period === "3" ? "bg-red-500/10 border-red-500/20" :
                    g.period === "7" ? "bg-orange-500/10 border-orange-500/20" :
                    g.period === "15" ? "bg-amber-500/10 border-amber-500/20" :
                    "bg-yellow-500/10 border-yellow-500/20"
                  }`}>
                    <div className={`text-lg font-black ${
                      g.period === "expired" ? "text-red-400" :
                      g.period === "3" ? "text-red-400" :
                      g.period === "7" ? "text-orange-400" :
                      g.period === "15" ? "text-amber-400" : "text-yellow-400"
                    }`}>{g.companies.length}</div>
                    <div className="text-[10px] text-slate-400">{g.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
                <h3 className="text-xs font-bold text-slate-400 mb-3">{t("توزيع الشركات", "Company Distribution")}</h3>
                <div className="space-y-2">
                  {[
                    { label: t("نشط", "Active"), value: stats.active, color: "bg-emerald-500", total: Math.max(1, stats.total) },
                    { label: t("معلق", "Suspended"), value: stats.suspended, color: "bg-amber-500", total: Math.max(1, stats.total) },
                    { label: t("منتهي", "Expired"), value: stats.expired, color: "bg-red-500", total: Math.max(1, stats.total) },
                    { label: t("تجريبي", "Trial"), value: stats.trial, color: "bg-violet-500", total: Math.max(1, stats.total) },
                    { label: t("قيد الانتظار", "Pending"), value: stats.pending, color: "bg-slate-500", total: Math.max(1, stats.total) },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-slate-400">{s.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#1c1c1e] overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${(s.value / s.total) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-bold text-slate-300">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
                <h3 className="text-xs font-bold text-slate-400 mb-3">{t("إجراءات سريعة", "Quick Actions")}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowAddModal(true)}
                    className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-all">
                    <Plus className="w-4 h-4 mx-auto mb-1" /> {t("شركة جديدة", "New Company")}
                  </button>
                  <button onClick={() => setView("companies")}
                    className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all">
                    <Building2 className="w-4 h-4 mx-auto mb-1" /> {t("إدارة الشركات", "Manage Companies")}
                  </button>
                  <button onClick={() => setView("expiration-center")}
                    className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all">
                    <Timer className="w-4 h-4 mx-auto mb-1" /> {t("مركز الانتهاء", "Expiration Center")}
                  </button>
                  <button onClick={() => setView("activity")}
                    className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all">
                    <Activity className="w-4 h-4 mx-auto mb-1" /> {t("سجل النشاطات", "Activity Log")}
                  </button>
                </div>
              </div>
            </div>

            {/* Subscription Notification Banners */}
            {activeNotifs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400">{t("تنبيهات الاشتراك", "Subscription Alerts")}</h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {activeNotifs.map((n, i) => (
                    <div key={i} className={`p-2 rounded-lg text-xs border ${
                      n.type === "red" ? "bg-red-500/10 border-red-500/20 text-red-300" :
                      n.type === "orange" ? "bg-orange-500/10 border-orange-500/20 text-orange-300" :
                      "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
                    }`}>{n.message}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
              <h3 className="text-xs font-bold text-slate-400 mb-3">{t("آخر النشاطات", "Recent Activity")}</h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {logs.slice(0, 10).map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#1c1c1e] text-xs">
                    <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 truncate">{log.operation} — {log.companyName}</p>
                      <p className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-xs text-slate-500 text-center py-4">{t("لا توجد نشاطات", "No activity yet")}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ==================== COMPANIES VIEW ==================== */}
        {view === "companies" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder={t("بحث بالاسم أو البريد أو الهاتف...", "Search by name, email, phone or ID...")}
                  className="w-full bg-[#121214] border border-[#27272a] rounded-xl py-2 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-all" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-[#121214] border border-[#27272a] rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-violet-500">
                <option value="ALL">{t("جميع الحالات", "All Status")}</option>
                <option value="Active">{t("نشط", "Active")}</option>
                <option value="Suspended">{t("معلق", "Suspended")}</option>
                <option value="Disabled">{t("معطل", "Disabled")}</option>
                <option value="Pending Verification">{t("قيد التحقق", "Pending Verification")}</option>
              </select>
              <button onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> {t("إضافة شركة", "Add Company")}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#27272a]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#121214] border-b border-[#27272a]">
                    <th className="text-right p-3 text-slate-400 font-bold">{t("الشركة", "Company")}</th>
                    <th className="text-right p-3 text-slate-400 font-bold">{t("المالك", "Owner")}</th>
                    <th className="text-right p-3 text-slate-400 font-bold">{t("الباقة", "Plan")}</th>
                    <th className="text-right p-3 text-slate-400 font-bold">{t("المقاعد", "Seats")}</th>
                    <th className="text-right p-3 text-slate-400 font-bold">{t("الحالة", "Status")}</th>
                    <th className="text-right p-3 text-slate-400 font-bold">{t("تاريخ الانتهاء", "Expires")}</th>
                    <th className="text-right p-3 text-slate-400 font-bold">{t("الإجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map(co => {
                    const days = daysRemaining(co.expirationDate);
                    const dc = getDaysColor(days);
                    return (
                      <tr key={co.id} className="border-b border-[#1c1c1e] hover:bg-[#121214] transition-colors">
                        <td className="p-3">
                          <button onClick={() => { setSelectedCompanyId(co.id); setView("company-detail"); }}
                            className="text-violet-400 hover:text-violet-300 font-bold text-left">{co.companyName}</button>
                        </td>
                        <td className="p-3 text-slate-300">{co.ownerName}<br /><span className="text-[10px] text-slate-500">{co.email}</span></td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PLANS[co.subscriptionPlan]?.color || "bg-slate-600"} text-white`}>
                            {co.subscriptionPlan}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{co.seatsUsed}/{co.seatsLimit}</td>
                        <td className="p-3">
                          <StatusBadge status={co.accountStatus} />
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${dc.bg} ${dc.text}`}>
                            {days <= 0 ? t("منتهي", "Expired") : `${days} ${t("يوم", "days")}`}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleActivate(co)} className={`${btnClass} bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`} title={t("تفعيل", "Activate")}>
                              <CheckCircle className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleSuspend(co)} className={`${btnClass} bg-amber-500/10 text-amber-400 hover:bg-amber-500/20`} title={t("تعليق", "Suspend")}>
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDisable(co)} className={`${btnClass} bg-red-500/10 text-red-400 hover:bg-red-500/20`} title={t("تعطيل", "Disable")}>
                              <Ban className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCompanies.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">{t("لا توجد شركات", "No companies found")}</div>
              )}
            </div>
          </div>
        )}

        {/* ==================== EXPIRATION CENTER ==================== */}
        {view === "expiration-center" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold">{t("مركز مراقبة الاشتراكات", "Subscription Monitoring Center")}</h2>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: "ALL", label: t("الكل", "All") },
                { id: "30", label: t("30 يوم", "30 Days") },
                { id: "15", label: t("15 يوم", "15 Days") },
                { id: "7", label: t("7 أيام", "7 Days") },
                { id: "3", label: t("3 أيام", "3 Days") },
                { id: "expired", label: t("منتهية", "Expired") },
              ].map(f => (
                <button key={f.id} onClick={() => setExpFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    expFilter === f.id ? "bg-violet-600 text-white" : "bg-[#121214] text-slate-400 hover:text-white border border-[#27272a]"
                  }`}>{f.label}</button>
              ))}
            </div>

            {/* Expiration groups */}
            {expGroups.filter(g => expFilter === "ALL" || g.period === expFilter).map(g => (
              <div key={g.period} className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400">{g.label} ({g.companies.length})</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    g.period === "expired" ? "bg-red-500/10 text-red-400" :
                    g.period === "3" ? "bg-red-500/10 text-red-400" :
                    g.period === "7" ? "bg-orange-500/10 text-orange-400" :
                    g.period === "15" ? "bg-amber-500/10 text-amber-400" : "bg-yellow-500/10 text-yellow-400"
                  }`}>{g.label}</span>
                </div>
                <div className="space-y-1">
                  {g.companies.sort((a, b) => daysRemaining(a.expirationDate) - daysRemaining(b.expirationDate)).slice(0, 50).map(co => {
                    const d = daysRemaining(co.expirationDate);
                    return (
                      <div key={co.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1c1c1e] text-xs">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setSelectedCompanyId(co.id); setView("company-detail"); }}
                            className="text-violet-400 hover:text-violet-300 font-bold">{co.companyName}</button>
                          <span className="text-slate-500">{co.email}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PLANS[co.subscriptionPlan]?.color || "bg-slate-600"} text-white`}>{co.subscriptionPlan}</span>
                          <StatusBadge status={co.accountStatus} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${d <= 0 ? "text-red-400" : d <= 3 ? "text-red-400" : d <= 7 ? "text-orange-400" : d <= 15 ? "text-amber-400" : "text-yellow-400"}`}>
                            {d <= 0 ? t("منتهي", "Expired") : `${d} ${t("يوم", "days")}`}
                          </span>
                          <div className="flex gap-1">
                            <button onClick={() => handleActivate(co)} className={`${btnClass} bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`} title={t("تفعيل", "Activate")}>
                              <CheckCircle className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleSuspend(co)} className={`${btnClass} bg-amber-500/10 text-amber-400 hover:bg-amber-500/20`} title={t("تعليق", "Suspend")}>
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {g.companies.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">{t("لا توجد شركات في هذه الفئة", "No companies in this category")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================== COMPANY DETAIL VIEW ==================== */}
        {view === "company-detail" && selectedCompany && (
          <CompanyDetailView
            company={selectedCompany}
            isRtl={isRtl}
            t={t}
            onBack={() => { setView("companies"); setSelectedCompanyId(null); }}
            onActivate={handleActivate}
            onSuspend={handleSuspend}
            onDisable={handleDisable}
            onReactivate={handleReactivate}
            editPlan={editPlan} setEditPlan={setEditPlan}
            editStartDate={editStartDate} setEditStartDate={setEditStartDate}
            editDuration={editDuration} setEditDuration={setEditDuration}
            editEndDate={editEndDate} setEditEndDate={setEditEndDate}
            editSeatsLimit={editSeatsLimit} setEditSeatsLimit={setEditSeatsLimit}
            editStatus={editStatus} setEditStatus={setEditStatus}
            onSaveSubscription={handleSaveSubscription}
            onCalcEndDate={calcEndDateLocal}
            daysRemaining={daysRemaining}
            onTriggerNotification={onTriggerNotification}
            // Seats management
            seatLimitInput={seatLimitInput} setSeatLimitInput={setSeatLimitInput}
            onIncreaseSeats={handleIncreaseSeats}
            onDecreaseSeats={handleDecreaseSeats}
            onCustomSeats={handleCustomSeats}
            seatHistory={seatHistory}
          />
        )}

        {/* ==================== ACTIVITY VIEW ==================== */}
        {view === "activity" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{t("سجل النشاطات", "Platform Activity Log")}</h2>
              <span className="text-[10px] text-slate-500">{logs.length} {t("حدث", "events")}</span>
            </div>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#121214] border border-[#27272a] text-xs hover:border-violet-500/20 transition-all">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.operation.includes("تفعيل") || log.operation.includes("Activat") ? "bg-emerald-500" :
                    log.operation.includes("تعليق") || log.operation.includes("Suspend") ? "bg-amber-500" :
                    log.operation.includes("تعطيل") || log.operation.includes("Disable") ? "bg-red-500" :
                    "bg-violet-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{log.operation}</span>
                      <span className="text-slate-400">— {log.companyName}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{log.details}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">
                      {new Date(log.timestamp).toLocaleString()} • {log.email} • IP: {log.ipAddress}
                    </p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">{t("لا توجد نشاطات", "No activity recorded yet.")}</div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SUBSCRIPTIONS VIEW ==================== */}
        {view === "subscriptions" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold">{t("إدارة الاشتراكات", "Subscription Management")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {["Free", "Basic", "Pro", "Enterprise"].map(plan => {
                const count = companies.filter(c => c.subscriptionPlan === plan).length;
                const p = PLANS[plan];
                return (
                  <div key={plan} className={`p-4 rounded-xl ${p.color}/10 border ${p.color}/20`}>
                    <div className="text-xs font-bold text-slate-400">{plan}</div>
                    <div className="text-2xl font-black text-white mt-1">${p.price}<span className="text-xs font-normal text-slate-500">/mo</span></div>
                    <div className="text-xs text-slate-400 mt-1">{count} {t("شركة", "companies")}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{p.seats} {t("مقعد", "seats")}</div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
              <h3 className="text-xs font-bold text-slate-400 mb-3">{t("اشتراكات على وشك الانتهاء", "Subscriptions Expiring Soon")}</h3>
              <div className="space-y-2">
                {companies.filter(c => {
                  const d = daysRemaining(c.expirationDate);
                  return d > 0 && d <= 30;
                }).sort((a, b) => daysRemaining(a.expirationDate) - daysRemaining(b.expirationDate)).slice(0, 20).map(co => {
                  const d = daysRemaining(co.expirationDate);
                  const dc = getDaysColor(d);
                  return (
                    <div key={co.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1c1c1e] text-xs">
                      <div>
                        <span className="text-slate-200 font-bold">{co.companyName}</span>
                        <span className="text-slate-500 mx-2">—</span>
                        <span className={`${dc.text}`}>{dc.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{co.expirationDate}</span>
                    </div>
                  );
                })}
                {companies.filter(c => { const d = daysRemaining(c.expirationDate); return d > 0 && d <= 30; }).length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">{t("جميع الاشتراكات سارية", "All subscriptions are active")}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD COMPANY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">{t("إضافة شركة جديدة", "Add New Company")}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-[#27272a] rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              if (!newCompanyName.trim() || !newOwnerName.trim() || !newEmail.trim() || !newPhone.trim()) {
                onTriggerNotification(t("يرجى ملء جميع الحقول", "Fill all fields"), "info");
                return;
              }
              const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
              const newCo: SaaSCompany = {
                id: `cop-${Date.now()}`,
                companyName: newCompanyName.trim(), ownerName: newOwnerName.trim(),
                email: newEmail.trim().toLowerCase(), phone: newPhone.trim(),
                country: "Algeria",
                registrationDate: new Date().toISOString().split("T")[0],
                lastLogin: "Never Logged", emailVerified: false,
                subscriptionPlan: newPlan, seatsLimit: PLANS[newPlan].seats,
                seatsUsed: 1, accountStatus: "Pending Verification",
                expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                otpCode, activeDevices: []
              };
              if (supabase) {
                supabase.from("corevia_companies").upsert({
                  id: newCo.id, name: newCo.companyName, business_type: "تجارة إلكترونية",
                  owner_name: newCo.ownerName, phone: newCo.phone, email: newCo.email,
                  seatsLimit: newCo.seatsLimit, accountStatus: newCo.accountStatus,
                  subscriptionPlan: newCo.subscriptionPlan
                }).then(() => {});
                supabase.from("companies").upsert({
                  id: newCo.id, company_name: newCo.companyName, owner_id: "saas-provisioned",
                  email: newCo.email, phone: newCo.phone, address: ""
                }).then(() => {});
                supabase.from("corevia_saas_users").upsert({
                  user_id: `usr-${Date.now()}`, company_id: newCo.id,
                  email: newCo.email, username: newCo.ownerName,
                  has_completed_onboarding: false, role: "admin"
                }).then(() => {});
                // Also create seat management record
                supabase.from("corevia_company_seat_management").upsert({
                  company_id: newCo.id, current_seats_limit: newCo.seatsLimit,
                  used_seats: 1, available_seats: newCo.seatsLimit - 1
                }).then(() => {});
              }
              setCompanies(prev => [newCo, ...prev]);
              setShowAddModal(false);
              addLog(newCo.companyName, newCo.email, t("إنشاء حساب", "Account Created"), t(`تم إنشاء حساب ${newCo.companyName}`, `Created ${newCo.companyName}`));
              onTriggerNotification(t("تم إنشاء الحساب", "Account created"), "success");
              setNewCompanyName(""); setNewOwnerName(""); setNewEmail(""); setNewPhone("");
            }} className="space-y-3">
              <input required value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}
                placeholder={t("اسم الشركة", "Company Name")} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-2.5 text-xs" />
              <input required value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)}
                placeholder={t("اسم المالك", "Owner Name")} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-2.5 text-xs" />
              <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="Email" className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-2.5 text-xs" />
              <input required type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder={t("رقم الهاتف", "Phone")} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-2.5 text-xs" />
              <select value={newPlan} onChange={e => setNewPlan(e.target.value as any)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-2.5 text-xs">
                {Object.keys(PLANS).map(p => <option key={p} value={p}>{p} (${PLANS[p].price}/mo - {PLANS[p].seats} seats)</option>)}
              </select>
              <button type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all">
                {t("إنشاء الشركة", "Create Company")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a] hover:border-violet-500/20 transition-all">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-2`}>{icon}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "Active": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "Suspended": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "Disabled": "bg-red-500/10 text-red-400 border-red-500/20",
    "Pending Verification": "bg-slate-500/10 text-slate-400 border-slate-500/20",
    "Read Only": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colors[status] || colors["Pending Verification"]}`}>
      {status}
    </span>
  );
}

function CompanyDetailView({
  company, isRtl, t, onBack, onActivate, onSuspend, onDisable, onReactivate,
  editPlan, setEditPlan, editStartDate, setEditStartDate, editDuration, setEditDuration,
  editEndDate, setEditEndDate, editSeatsLimit, setEditSeatsLimit,
  editStatus, setEditStatus,
  onSaveSubscription, onCalcEndDate, daysRemaining, onTriggerNotification,
  seatLimitInput, setSeatLimitInput, onIncreaseSeats, onDecreaseSeats, onCustomSeats,
  seatHistory
}: {
  company: SaaSCompany; isRtl: boolean; t: (ar: string, en: string) => string;
  onBack: () => void; onActivate: (c: SaaSCompany) => void; onSuspend: (c: SaaSCompany) => void;
  onDisable: (c: SaaSCompany) => void; onReactivate: (c: SaaSCompany) => void;
  editPlan: string; setEditPlan: (v: string) => void; editStartDate: string;
  setEditStartDate: (v: string) => void; editDuration: string; setEditDuration: (v: string) => void;
  editEndDate: string; setEditEndDate: (v: string) => void;
  editSeatsLimit: number; setEditSeatsLimit: (v: number) => void;
  editStatus: string; setEditStatus: (v: string) => void;
  onSaveSubscription: () => Promise<void>; onCalcEndDate: (start: string, dur: string) => void;
  daysRemaining: (d: string) => number; onTriggerNotification: (msg: string, type: "success" | "info") => void;
  seatLimitInput: number; setSeatLimitInput: (v: number) => void;
  onIncreaseSeats: () => Promise<void>; onDecreaseSeats: () => Promise<void>; onCustomSeats: () => Promise<void>;
  seatHistory: SubscriptionHistoryRecord[];
}) {
  const days = daysRemaining(company.expirationDate);
  const dc = getDaysColor(days);
  const availableSeats = Math.max(0, company.seatsLimit - company.seatsUsed);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
        {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        {t("العودة إلى القائمة", "Back to list")}
      </button>

      {/* Expired Banner */}
      {days <= 0 && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold">
          {t("انتهى اشتراك هذه الشركة. يرجى تجديد الاشتراك لاستخدام Corevia.", "This company's subscription has expired. Please renew to continue using Corevia.")}
        </div>
      )}

      {/* Company Header */}
      <div className="flex items-start justify-between p-4 rounded-xl bg-[#121214] border border-[#27272a]">
        <div>
          <h2 className="text-base font-black">{company.companyName}</h2>
          <p className="text-xs text-slate-400 mt-1">{company.email} • {company.phone}</p>
          <p className="text-xs text-slate-500 mt-0.5">{company.country} • ID: {company.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {company.accountStatus === "Suspended" || company.accountStatus === "Disabled" ? (
            <button onClick={() => onReactivate(company)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all">
              {t("إعادة التفعيل", "Reactivate")}
            </button>
          ) : (
            <>
              <button onClick={() => onActivate(company)}
                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-all">
                {t("تفعيل", "Activate")}
              </button>
              <button onClick={() => onSuspend(company)}
                className="px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs font-bold transition-all">
                {t("تعليق", "Suspend")}
              </button>
              <button onClick={() => onDisable(company)}
                className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all">
                {t("تعطيل", "Disable")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subscription Info */}
        <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
          <h3 className="text-xs font-bold text-slate-400 mb-3">{t("معلومات الاشتراك", "Subscription Info")}</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">{t("الباقة", "Plan")}:</span><StatusBadge status={company.subscriptionPlan} /></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("المقاعد", "Seats")}:</span><span className="text-slate-200">{company.seatsUsed}/{company.seatsLimit}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("المقاعد المتاحة", "Available")}:</span><span className="text-slate-200">{availableSeats}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("الحالة", "Status")}:</span><StatusBadge status={company.accountStatus} /></div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("تاريخ البدء", "Start")}:</span>
              <span className="text-slate-200">{company.registrationDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("تاريخ الانتهاء", "Expires")}:</span>
              <span className={dc.text}>{company.expirationDate || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("الأيام المتبقية", "Days Left")}:</span>
              <span className={`font-bold ${dc.text}`}>
                {days <= 0 ? t("منتهي", "Expired") : `${days} ${t("يوم", "days")}`}
              </span>
            </div>
            {/* Progress bar for subscription */}
            {company.registrationDate && company.expirationDate && days > 0 && (
              <div className="pt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>{t("استخدام الاشتراك", "Subscription Usage")}</span>
                  <span>{Math.round((1 - days / 365) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1c1c1e] overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${dc.text.replace("text-", "bg-")}`}
                    style={{ width: `${Math.min(100, Math.round((1 - days / 365) * 100))}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Company Info */}
        <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
          <h3 className="text-xs font-bold text-slate-400 mb-3">{t("معلومات الشركة", "Company Info")}</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">{t("الاسم", "Name")}:</span><span className="text-slate-200">{company.companyName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("المالك", "Owner")}:</span><span className="text-slate-200">{company.ownerName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Email:</span><span className="text-slate-200">{company.email}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("الهاتف", "Phone")}:</span><span className="text-slate-200">{company.phone}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("الدولة", "Country")}:</span><span className="text-slate-200">{company.country}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("التسجيل", "Registered")}:</span><span className="text-slate-200">{company.registrationDate}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t("آخر نشاط", "Last Activity")}:</span><span className="text-slate-200">{company.lastLogin}</span></div>
          </div>
        </div>
      </div>

      {/* Subscription Edit — Full Manual Control */}
      <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
        <h3 className="text-xs font-bold text-slate-400 mb-3">{t("تعديل الاشتراك (تحكم يدوي كامل)", "Subscription Edit (Full Manual Control)")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">{t("الباقة", "Plan")}</label>
            <select value={editPlan} onChange={e => setEditPlan(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs">
              {Object.keys(PLANS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">{t("تاريخ البدء", "Start")}</label>
            <input type="date" value={editStartDate} onChange={e => { setEditStartDate(e.target.value); onCalcEndDate(e.target.value, editDuration); }}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">{t("المدة (أشهر)", "Duration")}</label>
            <select value={editDuration} onChange={e => { setEditDuration(e.target.value); onCalcEndDate(editStartDate, e.target.value); }}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs">
              <option value="1">1 {t("شهر", "month")}</option>
              <option value="3">3 {t("أشهر", "months")}</option>
              <option value="6">6 {t("أشهر", "months")}</option>
              <option value="12">12 {t("شهر", "months")}</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">{t("تاريخ الانتهاء", "End")}</label>
            <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">{t("عدد المقاعد", "Seats Limit")}</label>
            <input type="number" min={1} value={editSeatsLimit} onChange={e => setEditSeatsLimit(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">{t("حالة الشركة", "Company Status")}</label>
            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs">
              <option value="Active">{t("نشط", "Active")}</option>
              <option value="Suspended">{t("معلق", "Suspended")}</option>
              <option value="Disabled">{t("معطل", "Disabled")}</option>
              <option value="Read Only">{t("قراءة فقط", "Read Only")}</option>
            </select>
          </div>
        </div>
        <button onClick={onSaveSubscription}
          className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-all">
          {t("حفظ الاشتراك", "Save Subscription")}
        </button>
      </div>

      {/* Seats Management */}
      <SeatsManagementSection
        company={company}
        t={t}
        seatLimitInput={seatLimitInput}
        setSeatLimitInput={setSeatLimitInput}
        onIncreaseSeats={onIncreaseSeats}
        onDecreaseSeats={onDecreaseSeats}
        onCustomSeats={onCustomSeats}
        availableSeats={availableSeats}
        daysRemaining={daysRemaining}
      />

      {/* Renewal History */}
      <RenewalHistorySection history={seatHistory} t={t} />
    </div>
  );
}

function SeatsManagementSection({
  company, t, seatLimitInput, setSeatLimitInput, onIncreaseSeats, onDecreaseSeats, onCustomSeats, availableSeats, daysRemaining
}: {
  company: SaaSCompany; t: (ar: string, en: string) => string;
  seatLimitInput: number; setSeatLimitInput: (v: number) => void;
  onIncreaseSeats: () => Promise<void>; onDecreaseSeats: () => Promise<void>; onCustomSeats: () => Promise<void>;
  availableSeats: number; daysRemaining: (d: string) => number;
}) {
  const days = daysRemaining(company.expirationDate);
  const isExpired = days <= 0;
  const seatLimitReached = company.seatsUsed >= company.seatsLimit;

  return (
    <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
      <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
        <Target className="w-3.5 h-3.5" />
        {t("إدارة المقاعد", "Seats Management")}
      </h3>

      {/* Seat limit warning */}
      {seatLimitReached && (
        <div className="p-3 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          {t("لقد وصلت إلى الحد الأقصى للموظفين. يرجى ترقية الباقة أو الاتصال بالدعم.", "You have reached your employee limit. Please upgrade your subscription or contact support.")}
        </div>
      )}

      {/* Seat stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-[#09090b] border border-[#27272a] text-center">
          <div className="text-[10px] text-slate-500">{t("حد المقاعد", "Seats Limit")}</div>
          <div className="text-lg font-black text-white">{company.seatsLimit}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#09090b] border border-[#27272a] text-center">
          <div className="text-[10px] text-slate-500">{t("المستخدم", "Used")}</div>
          <div className="text-lg font-black text-violet-400">{company.seatsUsed}</div>
        </div>
        <div className="p-3 rounded-lg bg-[#09090b] border border-[#27272a] text-center">
          <div className="text-[10px] text-slate-500">{t("المتاح", "Available")}</div>
          <div className={`text-lg font-black ${availableSeats <= 0 ? "text-red-400" : "text-emerald-400"}`}>{availableSeats}</div>
        </div>
      </div>

      {/* Seat progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>{t("استخدام المقاعد", "Seat Usage")}</span>
          <span>{Math.round((company.seatsUsed / Math.max(1, company.seatsLimit)) * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#1c1c1e] overflow-hidden">
          <div className={`h-full rounded-full transition-all ${
            (company.seatsUsed / Math.max(1, company.seatsLimit)) >= 0.9 ? "bg-red-500" :
            (company.seatsUsed / Math.max(1, company.seatsLimit)) >= 0.7 ? "bg-amber-500" : "bg-emerald-500"
          }`} style={{ width: `${Math.min(100, (company.seatsUsed / Math.max(1, company.seatsLimit)) * 100)}%` }} />
        </div>
      </div>

      {isExpired ? (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs text-center">
          {t("انتهى الاشتراك. لا يمكن تعديل المقاعد حتى يتم التجديد.", "Subscription expired. Cannot modify seats until renewal.")}
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button onClick={onIncreaseSeats}
              className="flex items-center justify-center gap-1 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all">
              <ArrowUp className="w-3 h-3" /> +5
            </button>
            <button onClick={onDecreaseSeats}
              className="flex items-center justify-center gap-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all">
              <ArrowDown className="w-3 h-3" /> -5
            </button>
            <button onClick={onCustomSeats}
              className="flex items-center justify-center gap-1 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 text-xs font-bold transition-all">
              <Target className="w-3 h-3" /> {t("تعيين", "Set")}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={seatLimitInput}
              onChange={e => setSeatLimitInput(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 bg-[#09090b] border border-[#27272a] rounded-lg p-2 text-xs text-center" />
            <button onClick={onCustomSeats}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-all">
              {t("تطبيق العدد المخصص", "Set Custom Number")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RenewalHistorySection({ history, t }: { history: SubscriptionHistoryRecord[]; t: (ar: string, en: string) => string }) {
  if (history.length === 0) return null;
  return (
    <div className="p-4 rounded-xl bg-[#121214] border border-[#27272a]">
      <h3 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
        <History className="w-3.5 h-3.5" />
        {t("سجل التجديد", "Renewal History")}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-[#27272a]">
              <th className="p-2 text-slate-500 text-left">{t("التاريخ", "Date")}</th>
              <th className="p-2 text-slate-500 text-left">{t("المدة", "Duration")}</th>
              <th className="p-2 text-slate-500 text-left">{t("الباقة", "Plan")}</th>
              <th className="p-2 text-slate-500 text-left">{t("المقاعد", "Seats")}</th>
              <th className="p-2 text-slate-500 text-left">{t("المبلغ", "Amount")}</th>
              <th className="p-2 text-slate-500 text-left">{t("المسؤول", "Admin")}</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id} className="border-b border-[#1c1c1e]">
                <td className="p-2 text-slate-200">{h.renewal_date}</td>
                <td className="p-2 text-slate-300">{h.duration_months}mo</td>
                <td className="p-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PLANS[h.plan_name]?.color || "bg-slate-600"} text-white`}>{h.plan_name}</span>
                </td>
                <td className="p-2 text-slate-300">{h.seats_purchased}</td>
                <td className="p-2 text-slate-300">${h.amount_paid}</td>
                <td className="p-2 text-slate-500">{h.admin_user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


