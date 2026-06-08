import React, { useState, useEffect, useMemo } from "react";
import { 
  Building2, Users, Ban, ShieldAlert, BookOpen, ShieldCheck, Smartphone, 
  Search, Filter, LogOut, Plus, Minus, KeyRound, Globe, RefreshCcw, 
  Activity, Landmark, UserCheck, Calendar, Phone, Mail, Shield, AlertTriangle, Eye, ShieldX
} from "lucide-react";
import { SaaSCompany, SaaSActivityLog, SuperAdminConfig, LanguageType } from "../types";

interface SuperAdminViewProps {
  lang: LanguageType;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
  onLogout: () => void;
  session: any;
  profile: any;
  onCleanSlate: () => Promise<void>;
}

// Subscription pricing structures
const PLANS = {
  Free: { price: 0, seats: 2, storage: "1GB", features: "Basic Inventory" },
  Basic: { price: 29, seats: 5, storage: "5GB", features: "Advanced Inventory, 1 Sheets Sync" },
  Pro: { price: 79, seats: 15, storage: "20GB", features: "API Access, Realtime Analytics" },
  Enterprise: { price: 249, seats: 100, storage: "Unlimited", features: "Custom Domain, Dedicated Support" }
};

// Initial Seed Companies List
const DEFAULT_SaaS_COMPANIES: SaaSCompany[] = [
  {
    id: "cop-1",
    companyName: "الشركة الوطنية للمنسوجات",
    ownerName: "أحمد بن بلة",
    email: "ahmed@nationaltex.dz",
    phone: "+213 552 10 20 30",
    country: "Algeria",
    registrationDate: "2026-01-10",
    lastLogin: "2026-06-07 18:00",
    emailVerified: true,
    subscriptionPlan: "Pro",
    seatsLimit: 15,
    seatsUsed: 12,
    accountStatus: "Active",
    expirationDate: "2027-01-10",
    activeDevices: [
      { id: "dev-1-1", browser: "Chrome", os: "Windows", activityType: "Desktop Session", lastActive: "2026-06-07 18:30" },
      { id: "dev-1-2", browser: "Safari", os: "iOS", activityType: "Mobile Native", lastActive: "2026-06-07 15:45" },
      { id: "dev-1-3", browser: "Chrome", os: "Android", activityType: "Mobile Browser", lastActive: "2026-06-06 14:20" }
    ]
  },
  {
    id: "cop-2",
    companyName: "شحن الجزائر السريع",
    ownerName: "كمال بوضياف",
    email: "kamal@djazair-log.dz",
    phone: "+213 661 40 50 60",
    country: "Algeria",
    registrationDate: "2026-02-15",
    lastLogin: "2026-06-05 09:12",
    emailVerified: true,
    subscriptionPlan: "Enterprise",
    seatsLimit: 100,
    seatsUsed: 84,
    accountStatus: "Active",
    expirationDate: "2027-02-15",
    activeDevices: [
      { id: "dev-2-1", browser: "Firefox", os: "Linux", activityType: "Server Webhook", lastActive: "2026-06-05 09:15" },
      { id: "dev-2-2", browser: "Chrome", os: "Windows", activityType: "Desktop Session", lastActive: "2026-06-04 11:30" }
    ]
  },
  {
    id: "cop-3",
    companyName: "حلول تقنية لووران (Oran Tech)",
    ownerName: "مراد يوسف",
    email: "mourad@tech-oran.com",
    phone: "+213 770 99 88 11",
    country: "Algeria",
    registrationDate: "2026-04-01",
    lastLogin: "2026-06-07 12:44",
    emailVerified: false,
    subscriptionPlan: "Basic",
    seatsLimit: 5,
    seatsUsed: 4,
    accountStatus: "Pending Verification",
    expirationDate: "2026-07-01",
    otpCode: "284950",
    activeDevices: [
      { id: "dev-3-1", browser: "Chrome", os: "macOS", activityType: "Developer API", lastActive: "2026-06-07 12:45" }
    ]
  },
  {
    id: "cop-4",
    companyName: "تجارة بجاية المحدومة",
    ownerName: "سليم مقران",
    email: "salim@bejaia-trade.com",
    phone: "+213 550 44 22 11",
    country: "Algeria",
    registrationDate: "2026-03-10",
    lastLogin: "2026-05-20 16:30",
    emailVerified: true,
    subscriptionPlan: "Free",
    seatsLimit: 2,
    seatsUsed: 2,
    accountStatus: "Suspended",
    expirationDate: "2026-06-10",
    activeDevices: [
      { id: "dev-4-1", browser: "Chrome", os: "Android", activityType: "Mobile Browser", lastActive: "2026-05-20 16:32" }
    ]
  },
  {
    id: "cop-5",
    companyName: "محلات الباهية للملابس",
    ownerName: "أمينة بوعلام",
    email: "amina@elbahia.dz",
    phone: "+213 662 11 33 55",
    country: "Algeria",
    registrationDate: "2026-05-01",
    lastLogin: "2026-06-02 11:00",
    emailVerified: true,
    subscriptionPlan: "Basic",
    seatsLimit: 5,
    seatsUsed: 3,
    accountStatus: "Read Only",
    expirationDate: "2026-08-01",
    activeDevices: [
      { id: "dev-5-1", browser: "Edge", os: "Windows", activityType: "Desktop Session", lastActive: "2026-06-02 11:15" }
    ]
  },
  {
    id: "cop-6",
    companyName: "صحراء فود للتجارة",
    ownerName: "بلقاسم غردية",
    email: "belgacem@sahara-trade.com",
    phone: "+213 29 88 77 66",
    country: "Algeria",
    registrationDate: "2026-01-20",
    lastLogin: "2026-06-01 10:00",
    emailVerified: true,
    subscriptionPlan: "Pro",
    seatsLimit: 15,
    seatsUsed: 15,
    accountStatus: "Disabled",
    expirationDate: "2026-07-20",
    activeDevices: [
      { id: "dev-6-1", browser: "Chrome", os: "Windows", activityType: "Desktop Session", lastActive: "2026-06-01 10:11" }
    ]
  }
];

// Initial Seed Activity Logs
const DEFAULT_LOGS: SaaSActivityLog[] = [
  {
    id: "log-1",
    timestamp: "2026-06-07T18:30:11Z",
    companyName: "الشركة الوطنية للمنسوجات",
    email: "ahmed@nationaltex.dz",
    operation: "تسجيل دخول",
    details: "تم تسجيل الدخول بنجاح من جهاز Chrome - Windows",
    ipAddress: "197.200.41.92"
  },
  {
    id: "log-2",
    timestamp: "2026-06-07T17:40:22Z",
    companyName: "الشركة الوطنية للمنسوجات",
    email: "ahmed@nationaltex.dz",
    operation: "تعديل الاشتراك",
    details: "ترقية الباقة بنجاح من Basic إلى Pro",
    ipAddress: "197.200.41.92"
  },
  {
    id: "log-3",
    timestamp: "2026-06-07T14:15:00Z",
    companyName: "حلول تقنية لوهران (Oran Tech)",
    email: "mourad@tech-oran.com",
    operation: "إنشاء حساب",
    details: "تم إنشاء حساب المؤسسة الجديد، وبانتظار تفعيل البريد الإلكتروني (رمز التحقق البصري 284950)",
    ipAddress: "105.101.99.3"
  },
  {
    id: "log-4",
    timestamp: "2026-06-07T11:20:45Z",
    companyName: "محلات الباهية للملابس",
    email: "amina@elbahia.dz",
    operation: "تفعيل البريد",
    details: "تم تفعيل رمز OTP بنجاح والموافقة الفورية على الحساب",
    ipAddress: "197.112.5.21"
  },
  {
    id: "log-5",
    timestamp: "2026-06-06T09:44:11Z",
    companyName: "تجارة بجاية المحدودة",
    email: "salim@bejaia-trade.com",
    operation: "تجميد الحساب",
    details: "تم تجميد الحساب من قبل نظام الحماية لعدم سداد الفواتير الشهرية",
    ipAddress: "System Security"
  },
  {
    id: "log-6",
    timestamp: "2026-06-05T14:30:00Z",
    companyName: "شحن الجزائر السريع",
    email: "kamal@djazair-log.dz",
    operation: "تغيير عدد المقاعد",
    details: "زيادة حد المقاعد الإضافي من 80 إلى 100 مقعد للمندوبين",
    ipAddress: "197.220.12.33"
  }
];

export default function SuperAdminView({
  lang,
  onTriggerNotification,
  onLogout,
  session,
  profile,
  onCleanSlate
}: SuperAdminViewProps) {
  const isRtl = lang === "ar";

  // State Persistency
  const [companies, setCompanies] = useState<SaaSCompany[]>(() => {
    const saved = localStorage.getItem("corevia_saas_companies_v1");
    return saved ? JSON.parse(saved) : DEFAULT_SaaS_COMPANIES;
  });

  const [logs, setLogs] = useState<SaaSActivityLog[]>(() => {
    const saved = localStorage.getItem("corevia_saas_activity_logs_v1");
    return saved ? JSON.parse(saved) : DEFAULT_LOGS;
  });

  const [secConfig, setSecConfig] = useState<SuperAdminConfig>(() => {
    const saved = localStorage.getItem("corevia_saas_security_config_v1");
    return saved ? JSON.parse(saved) : {
      twoFactorGlobalState: false,
      failedLoginAttemptsCount: 14,
      ipTrackingEnabled: true
    };
  });

  // Keep Sync
  useEffect(() => {
    localStorage.setItem("corevia_saas_companies_v1", JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem("corevia_saas_activity_logs_v1", JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem("corevia_saas_security_config_v1", JSON.stringify(secConfig));
  }, [secConfig]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "logs" | "security" | "debug">("directory");

  // Selection state for drill-down action of device list or editing
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // New Client Registration form states
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPlan, setNewPlan] = useState<"Free" | "Basic" | "Pro" | "Enterprise">("Basic");

  // Filter computation
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const matchSearch = 
        c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === "ALL" || c.accountStatus === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [companies, searchTerm, statusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = companies.length;
    let active = 0;
    let suspended = 0;
    let pendingVerification = 0;
    let readOnly = 0;
    let seatsUsed = 0;
    let seatsLimit = 0;
    let revenue = 0;

    companies.forEach(c => {
      if (c.accountStatus === "Active") active++;
      else if (c.accountStatus === "Suspended") suspended++;
      else if (c.accountStatus === "Pending Verification") pendingVerification++;
      else if (c.accountStatus === "Read Only") readOnly++;

      seatsUsed += c.seatsUsed;
      seatsLimit += c.seatsLimit;

      const planDetails = PLANS[c.subscriptionPlan];
      if (planDetails && c.accountStatus !== "Disabled" && c.accountStatus !== "Suspended") {
        revenue += planDetails.price;
      }
    });

    return {
      total,
      active,
      suspended,
      pendingVerification,
      readOnly,
      seatsUsed,
      seatsAvailable: Math.max(0, seatsLimit - seatsUsed),
      revenue,
      newRegThisMonth: 2 // seeded representation
    };
  }, [companies]);

  // Insert custom logging event
  const addSystemLog = (companyName: string, email: string, operation: string, details: string) => {
    const newLog: SaaSActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      companyName,
      email,
      operation,
      details,
      ipAddress: "197.200." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255)
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Change Subscription Plan
  const handleUpgradePlan = (companyId: string, value: "Free" | "Basic" | "Pro" | "Enterprise") => {
    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        const previousPlan = c.subscriptionPlan;
        const planLimit = PLANS[value].seats;
        
        // Push notification of success
        onTriggerNotification(
          isRtl 
            ? `تم تعديل باقة الاشتراك إلى ${value} بنجاح` 
            : `Subscription adjusted to ${value}`, 
          "success"
        );

        addSystemLog(
          c.companyName, 
          c.email, 
          "تعديل الاشتراك", 
          `تغيير باقة الاشتراك للمؤسسة من ${previousPlan} إلى ${value} (تلقائي حد المقاعد: ${planLimit})`
        );

        return {
          ...c,
          subscriptionPlan: value,
          seatsLimit: planLimit
        };
      }
      return c;
    }));
  };

  // Change Account Status
  const handleUpdateStatus = (companyId: string, status: "Pending Verification" | "Active" | "Read Only" | "Suspended" | "Disabled") => {
    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        const previousStatus = c.accountStatus;
        onTriggerNotification(
          isRtl 
            ? `تم تعديل حالة الحساب بنجاح إلى: ${status}` 
            : `Account status updated to ${status}`, 
          "success"
        );

        // Map log operation title
        let opName = "تعديل حالة";
        if (status === "Suspended") opName = "تجميد الحساب";
        else if (status === "Disabled") opName = "تعطيل الحساب";
        else if (status === "Active" && previousStatus === "Pending Verification") opName = "تفعيل البريد";

        addSystemLog(
          c.companyName,
          c.email,
          opName,
          `تم تغيير حالة المؤسسة من ${previousStatus} إلى ${status}`
        );

        return {
          ...c,
          accountStatus: status,
          // Verify email immediately if set to Active
          emailVerified: status === "Active" ? true : c.emailVerified
        };
      }
      return c;
    }));
  };

  // Manual Adjust Seats Limit
  const handleModifySeatsLimit = (companyId: string, action: "increment" | "decrement") => {
    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        const changeValue = action === "increment" ? 1 : -1;
        const targetLimit = Math.max(c.seatsUsed, c.seatsLimit + changeValue);

        if (action === "decrement" && c.seatsLimit <= c.seatsUsed) {
          onTriggerNotification(
            isRtl ? "عذراً! لا يمكن خفض المقاعد إلى أقل من المقاعد المستخدمة بالفعل." : "Cannot lower below currently used seats",
            "info"
          );
          return c;
        }

        onTriggerNotification(
          isRtl ? `تم تحديث عدد مقاعد المؤسسة إلى: ${targetLimit}` : `Seats limit set to ${targetLimit}`,
          "success"
        );

        addSystemLog(
          c.companyName,
          c.email,
          "تغيير عدد المقاعد",
          `تعديل المقاعد القصوى يدوياً من ${c.seatsLimit} إلى ${targetLimit} مقعد`
        );

        return {
          ...c,
          seatsLimit: targetLimit
        };
      }
      return c;
    }));
  };

  // Force Logout of Device
  const handleForceLogoutDevice = (companyId: string, deviceId: string, browser: string, os: string) => {
    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        const filteredDevices = c.activeDevices.filter(d => d.id !== deviceId);
        
        onTriggerNotification(
          isRtl 
            ? `تم فصل جهاز العميل وغلق الجلسة بنجاح (${browser} - ${os})` 
            : `Terminated session of device (${browser} - ${os})`, 
          "info"
        );

        addSystemLog(
          c.companyName,
          c.email,
          "تسجيل خروج",
          `تم طرد وإنهاء جلسة الجهاز يدوياً من السوبر أدمن (${browser} - ${os})`
        );

        return {
          ...c,
          activeDevices: filteredDevices
        };
      }
      return c;
    }));
  };

  // Simulate OTP Code validation for pending accounts
  const handleSimulateOTPVerification = (companyId: string) => {
    setCompanies(prev => prev.map(c => {
      if (c.id === companyId) {
        onTriggerNotification(
          isRtl 
            ? `تم عمل محاكاة لتسجيل الدخول والتحقق برمز OTP الخاص بالعميل (${c.otpCode})` 
            : `OTP confirmed successfully for code: ${c.otpCode}`, 
          "success"
        );

        addSystemLog(
          c.companyName,
          c.email,
          "تفعيل البريد",
          `تفعيل البريد والتحقق بنجاح برمز OTP ذي 6 أرقام: ${c.otpCode}`
        );

        return {
          ...c,
          emailVerified: true,
          accountStatus: "Active"
        };
      }
      return c;
    }));
  };

  // Create new SaaS client
  const handleCreateNewSaaSCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newOwnerName.trim() || !newEmail.trim() || !newPhone.trim()) {
      onTriggerNotification(isRtl ? "يرجى تعبئة جميع الخانات لإنشاء الحساب الجديد" : "Please fill in all blanks", "info");
      return;
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const defaultSeats = PLANS[newPlan].seats;

    const newCompany: SaaSCompany = {
      id: `cop-${Date.now()}`,
      companyName: newCompanyName.trim(),
      ownerName: newOwnerName.trim(),
      email: newEmail.trim().toLowerCase(),
      phone: newPhone.trim(),
      country: "Algeria",
      registrationDate: new Date().toISOString().split("T")[0],
      lastLogin: "Never Logged",
      emailVerified: false,
      subscriptionPlan: newPlan,
      seatsLimit: defaultSeats,
      seatsUsed: 1, // Primary owner account
      accountStatus: "Pending Verification",
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days
      otpCode,
      activeDevices: [
        { id: `dev-${Date.now()}-1`, browser: "Chrome", os: "Windows", activityType: "Registration Portal", lastActive: new Date().toISOString().replace("T", " ").substr(0, 16) }
      ]
    };

    setCompanies(prev => [newCompany, ...prev]);
    setShowAddCompanyModal(false);

    onTriggerNotification(
      isRtl ? "تم تسجيل الحساب الجديد وبانتظار تفعيل كود OTP" : "SaaS client registered, pending verification",
      "success"
    );

    addSystemLog(
      newCompany.companyName,
      newCompany.email,
      "إنشاء حساب",
      `تم إنشاء حساب SaaS جديد (الباقة: ${newPlan}، رمز التحقق OTP الذي أرسل للعميل: ${otpCode})`
    );

    // Resets
    setNewCompanyName("");
    setNewOwnerName("");
    setNewEmail("");
    setNewPhone("");
    setNewPlan("Basic");
  };

  return (
    <div className="space-y-6" id="super_admin_view_container">
      
      {/* Visual Header Banner - Styled for high craftsmanship */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8" id="super_admin_header">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Super Admin Dashboard</span>
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isRtl ? "كونسول الإشراف العام - Corevia SaaS" : "Platform Orchestrator Console"}
            </h1>
            <p className="text-xs text-slate-400 max-w-xl">
              {isRtl 
                ? "لوحة التحكم السحابية الموحدة لمالك المنصة للتحكم الكامل في حسابات الشركات والعملاء، تتبع الاشتراكات، حد المقاعد، والتحقق الميداني."
                : "The central nervous system for platform control, subscription metering, tenant auditing, and device authentication structures."}
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAddCompanyModal(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRtl ? "مؤسسة جديدة" : "New Company"}</span>
            </button>
            
            <button
              onClick={() => {
                setCompanies(DEFAULT_SaaS_COMPANIES);
                setLogs(DEFAULT_LOGS);
                onTriggerNotification(isRtl ? "تم إعادة ضبط قواعد البيانات المصنعة المرجعية" : "Seeded database reset to initial", "success");
              }}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl border border-slate-700/50 hover:text-white transition-all cursor-pointer"
              title={isRtl ? "إعادة تعيين وبذر البيانات الافتراضية" : "Re-seed original simulated clients"}
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid Decker */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5" id="saas_dashboard_stats_grid">
        
        {/* TOTAL COMPANIES */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400">{isRtl ? "إجمالي الشركات" : "Total Companies"}</span>
            <div className="p-1.5 bg-indigo-550/10 text-indigo-400 rounded-lg"><Building2 className="w-4 h-4" /></div>
          </div>
          <span className="text-xl font-extrabold text-white">{stats.total}</span>
          <span className="text-[9px] text-indigo-400 font-semibold block mt-1 tracking-tight">● Multi-Tenant Units</span>
        </div>

        {/* ACTIVE ACCOUNTS */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-400">{isRtl ? "الحسابات النشطة" : "Active SaaS"}</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><ShieldCheck className="w-4 h-4" /></div>
          </div>
          <span className="text-xl font-extrabold text-white">{stats.active}</span>
          <span className="text-[9px] text-emerald-400 font-semibold block mt-1 tracking-tight">({Math.round((stats.active/stats.total)*100 || 0)}%) {isRtl ? "صلاحيات تامة" : "Full access"}</span>
        </div>

        {/* PENDING VERIFICATION ACCOUNTS */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-400">{isRtl ? "بانتظار التحقق (OTP)" : "Pending OTP"}</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"><KeyRound className="w-4 h-4" /></div>
          </div>
          <span className="text-xl font-extrabold text-white">{stats.pendingVerification}</span>
          <span className="text-[9px] text-amber-400 font-semibold block mt-1 tracking-tight">6-digit Verification Codes</span>
        </div>

        {/* READ ONLY ACCOUNTS */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-sky-400">{isRtl ? "للقراءة فقط" : "Read-Only Units"}</span>
            <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg"><BookOpen className="w-4 h-4" /></div>
          </div>
          <span className="text-xl font-extrabold text-white">{stats.readOnly}</span>
          <span className="text-[9px] text-sky-400 font-semibold block mt-1 tracking-tight">{isRtl ? "مشاهدة وعرض فقط" : "No mutation possible"}</span>
        </div>

        {/* SUSPENDED ACCOUNTS */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-400">{isRtl ? "الحسابات المجمدة" : "Suspended Hubs"}</span>
            <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg"><Ban className="w-4 h-4" /></div>
          </div>
          <span className="text-xl font-extrabold text-white">{stats.suspended}</span>
          <span className="text-[9px] text-rose-400 font-semibold block mt-1 tracking-tight">{isRtl ? "شاشات حظر تجميد" : "Blocked gates"}</span>
        </div>

        {/* SEATS PERFORMANCE IN USE */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400">{isRtl ? "المقاعد المستخدمة بالفعل" : "Seats Allocation"}</span>
            <div className="p-1.5 bg-indigo-550/10 text-indigo-400 rounded-lg"><Users className="w-4 h-4" /></div>
          </div>
          <span className="text-xl font-extrabold text-white">{stats.seatsUsed}</span>
          <span className="text-[9px] text-indigo-400 font-semibold block mt-1 tracking-tight">Limit check active</span>
        </div>

        {/* SEATS AVAILABLE FOR UPGRADES */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400">{isRtl ? "المقاعد المتاحة للتفعيل" : "Available Seats"}</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><UserCheck className="w-4 h-4" /></div>
          </div>
          <span className="text-xl font-extrabold text-white">{stats.seatsAvailable}</span>
          <span className="text-[9px] text-emerald-400 font-semibold block mt-1 tracking-tight">Ready to map</span>
        </div>

        {/* MONTHLY CONSOLIDATED REVENUE */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-indigo-400">{isRtl ? "العائد السحابي المتوقع" : "MRR Projected"}</span>
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg"><Landmark className="w-4 h-4" /></div>
          </div>
          <span className="text-lg font-black text-emerald-400">${stats.revenue}</span>
          <span className="text-[9px] text-indigo-300 font-semibold block mt-1 tracking-tight">{isRtl ? "إيراد شهري SaaS" : "Recurring core projection"}</span>
        </div>

        {/* RECENT REGISTRATIONS */}
        <div className="p-4 bg-[#121214] border border-[#27272a] rounded-2xl relative overflow-hidden col-span-2 md:col-span-1 xl:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-indigo-300">{isRtl ? "التسجيلات الجديدة هذا الشهر" : "New registrations"}</span>
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg"><Globe className="w-4 h-4" /></div>
          </div>
          <div className="flex justify-between items-baseline mt-1">
            <span className="text-2xl font-black text-indigo-400">+{stats.newRegThisMonth}</span>
            <span className="text-[10px] font-mono text-slate-500">M-TD Growth Log</span>
          </div>
        </div>

      </div>

      {/* Nav tabs selection and Search filter bar */}
      <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-4 space-y-4" id="saas_navigation_hub">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" id="tab_controls_and_filters">
          
          {/* Inner Sub Tabs Navigation */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl" id="admin_sub_tabs">
            <button
              onClick={() => setActiveSubTab("directory")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "directory" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{isRtl ? "دليل الحسابات" : "Directory"}</span>
            </button>
            <button
              onClick={() => setActiveSubTab("logs")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "logs" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isRtl ? "سجل العمليات" : "Activity Log"}</span>
            </button>
            <button
              onClick={() => setActiveSubTab("security")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "security" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isRtl ? "الأمان وحالات الدخول" : "Security Gateway"}</span>
            </button>
            <button
              onClick={() => setActiveSubTab("debug")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === "debug" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>{isRtl ? "فحص المشاكل (Debug)" : "Debug Panel"}</span>
            </button>
          </div>

          {activeSubTab === "directory" && (
            <div className="flex items-center gap-2 w-full sm:w-auto" id="filters_cluster">
              
              {/* Account Status Filter Dropdown */}
              <div className="relative">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="p-2 pl-3 select-box cursor-pointer text-xs font-bold bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white outline-none focus:border-indigo-600 transition-colors"
                >
                  <option value="ALL">{isRtl ? "جميع الحالات" : "All Status"}</option>
                  <option value="Active">{isRtl ? "نشط (Active)" : "Active"}</option>
                  <option value="Pending Verification">{isRtl ? "بانتظار التحقق (Pending)" : "Pending Verification"}</option>
                  <option value="Read Only">{isRtl ? "للقراءة فقط (Read Only)" : "Read Only"}</option>
                  <option value="Suspended">{isRtl ? "مجمد (Suspended)" : "Suspended"}</option>
                  <option value="Disabled">{isRtl ? "معطل بالكامل (Disabled)" : "Disabled"}</option>
                </select>
              </div>

              {/* Dynamic Live Search Input */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute top-2.5 right-3" />
                <input
                  type="text"
                  placeholder={isRtl ? "البحث بالشركة، المدير، البريد..." : "Search by tenant..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2 pr-9 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl placeholder-slate-500 outline-none focus:border-indigo-600 transition-all text-right"
                />
              </div>

            </div>
          )}

        </div>

      </div>

      {/* MAIN VIEWPORT CONDITIONALS */}

      {/* TAB I: DIRECTORY LIST */}
      {activeSubTab === "directory" && (
        <div className="space-y-6" id="super_admin_tab_directory">
          
          {/* Main Account Ledger */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl overflow-hidden" id="accounts_ledger_table_card">
            <div className="p-4 border-b border-[#27272a] bg-slate-900/30 flex justify-between items-center">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>{isRtl ? "قائمة تراخيص العملاء والشركات" : "SaaS Customer Ledger"}</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-lg">
                Showing {filteredCompanies.length} / {companies.length} Tenants
              </span>
            </div>

            {filteredCompanies.length === 0 ? (
              <div className="p-12 text-center" id="empty_directory_log">
                <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-xs">{isRtl ? "لم يتم العثور على أي مؤسسات مسجلة تطابق محددات البحث." : "No accounts match lookup criteria."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right pr-2">
                  <thead className="bg-[#0e0e10] text-[#a1a1aa] uppercase text-[10px] font-black border-b border-[#27272a]">
                    <tr>
                      <th className="px-4 py-3">{isRtl ? "المؤسسة / المدير" : "Company & Owner"}</th>
                      <th className="px-4 py-3">{isRtl ? "معلومات الاتصال" : "Contact Meta"}</th>
                      <th className="px-4 py-3">{isRtl ? "التسجيل / انتهاء الصلاحية" : "Cycle Dates"}</th>
                      <th className="px-4 py-3">{isRtl ? "البريد / الأجهزة" : "Email & Devices"}</th>
                      <th className="px-4 py-3">{isRtl ? "باقة الاشتراك" : "Plan"}</th>
                      <th className="px-4 py-3">{isRtl ? "استهلاك المقاعد" : "Seats Gauge"}</th>
                      <th className="px-4 py-3">{isRtl ? "حالة الحساب" : "Account Status"}</th>
                      <th className="px-4 py-3 text-center">{isRtl ? "عمليات التحفيز" : "Operations"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {filteredCompanies.map((c) => {
                      const isSelected = selectedCompanyId === c.id;

                      return (
                        <React.Fragment key={c.id}>
                          <tr className={`hover:bg-slate-900/50 transition-colors ${isSelected ? "bg-indigo-600/5" : ""}`}>
                            
                            {/* COMPANY & OWNER */}
                            <td className="px-4 py-3.5">
                              <div className="font-extrabold text-white text-sm">{c.companyName}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-start gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                <span>{c.ownerName}</span>
                              </div>
                            </td>

                            {/* CONTACT META */}
                            <td className="px-4 py-3.5 font-mono">
                              <div className="flex items-center gap-1 text-slate-300">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span>{c.email}</span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-400 mt-1">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{c.phone}</span>
                              </div>
                            </td>

                            {/* CYCLE DATES */}
                            <td className="px-4 py-3.5 text-[11px] text-slate-300">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 text-[10px]">{isRtl ? "أنشئ:" : "Reg:"}</span>
                                <span className="font-mono text-xs">{c.registrationDate}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-rose-400">
                                <span className="text-slate-500 text-[10px]">{isRtl ? "ينتهي:" : "Exp:"}</span>
                                <span className="font-mono font-medium">{c.expirationDate}</span>
                              </div>
                            </td>

                            {/* EMAIL & DEVICES */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${c.emailVerified ? "bg-emerald-500" : "bg-amber-500"}`} />
                                <span className="text-[11px] font-bold text-slate-300">
                                  {c.emailVerified ? (isRtl ? "مؤكد" : "Verified") : (isRtl ? "غير مؤكد" : "Pending")}
                                </span>
                              </div>
                              
                              {/* Devices tracker action trigger */}
                              <button
                                onClick={() => setSelectedCompanyId(isSelected ? null : c.id)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1.5 rounded bg-slate-800 text-[10px] text-indigo-400 hover:text-white transition-all cursor-pointer"
                              >
                                <Smartphone className="w-3 h-3" />
                                <span>{c.activeDevices.length} {isRtl ? "أجهزة نشطة" : "Active Devices"}</span>
                              </button>
                            </td>

                            {/* PLAN */}
                            <td className="px-4 py-3.5">
                              <div className="relative">
                                <select
                                  value={c.subscriptionPlan}
                                  onChange={(e) => handleUpgradePlan(c.id, e.target.value as any)}
                                  className="p-1 px-2 text-xs font-black bg-slate-900 border border-slate-800 rounded-lg text-indigo-400 hover:text-white outline-none cursor-pointer"
                                >
                                  <option value="Free">Free ($0)</option>
                                  <option value="Basic">Basic ($29)</option>
                                  <option value="Pro">Pro ($79)</option>
                                  <option value="Enterprise">Enterprise ($249)</option>
                                </select>
                              </div>
                              <div className="text-[9px] text-slate-500 mt-1 font-bold">
                                {PLANS[c.subscriptionPlan].storage} Storage max
                              </div>
                            </td>

                            {/* SEATS GAUGE */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-black ${c.seatsUsed >= c.seatsLimit ? "text-rose-400" : "text-emerald-400"}`}>
                                  {c.seatsUsed} / {c.seatsLimit}
                                </span>
                                <span className="text-[10px] text-slate-500">{isRtl ? "مقعد" : "seats"}</span>
                              </div>
                              
                              {/* Seat limits rapid control trigger */}
                              <div className="flex items-center gap-1 mt-1.5" id="seats_adjusters">
                                <button
                                  onClick={() => handleModifySeatsLimit(c.id, "increment")}
                                  className="w-5 h-5 bg-slate-800 hover:bg-indigo-600 rounded text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                  title={isRtl ? "ترقية مقعد" : "Add 1 seat"}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleModifySeatsLimit(c.id, "decrement")}
                                  className="w-5 h-5 bg-slate-800 hover:bg-rose-600 rounded text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                  title={isRtl ? "تقليص مقعد" : "Subtract 1 seat"}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* ACCOUNT STATUS */}
                            <td className="px-4 py-3.5">
                              <div className="relative">
                                <select
                                  value={c.accountStatus}
                                  onChange={(e) => handleUpdateStatus(c.id, e.target.value as any)}
                                  className={`p-1.5 text-[11px] font-black rounded-xl cursor-pointer outline-none transition-colors ${
                                    c.accountStatus === "Active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                    c.accountStatus === "Pending Verification" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                    c.accountStatus === "Read Only" ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" :
                                    c.accountStatus === "Suspended" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                    "bg-slate-800 text-slate-400 border border-slate-700"
                                  }`}
                                >
                                  <option value="Pending Verification">{isRtl ? "Pending Verification" : "Pending OTP"}</option>
                                  <option value="Active">{isRtl ? "Active (نشط)" : "Active"}</option>
                                  <option value="Read Only">{isRtl ? "Read Only (للقراءة)" : "Read Only"}</option>
                                  <option value="Suspended">{isRtl ? "Suspended (مجمد)" : "Suspended"}</option>
                                  <option value="Disabled">{isRtl ? "Disabled (معطل)" : "Disabled"}</option>
                                </select>
                              </div>
                            </td>

                            {/* OPERATIONS */}
                            <td className="px-4 py-3.5 text-center">
                              {c.accountStatus === "Pending Verification" && c.otpCode ? (
                                <button
                                  onClick={() => handleSimulateOTPVerification(c.id)}
                                  className="p-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] rounded-lg shadow-sm transition-all animate-pulse cursor-pointer"
                                  title={isRtl ? "نظام التحقق: محاكاة إدخال رمز OTP الخاص بالعميل" : "Simulate OTP validation"}
                                >
                                  {isRtl ? "تأكيد الرمز يدوياً" : "Confirm OTP"}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setSelectedCompanyId(isSelected ? null : c.id)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  id="actions_collapsible_trigger"
                                >
                                  {isSelected ? (isRtl ? "إغلاق" : "Collapse") : (isRtl ? "استعراض الأجهزة" : "Inspect Session")}
                                </button>
                              )}
                            </td>

                          </tr>

                          {/* NESTED INSPECT DRAWER - DEVICE TERMINALS Hub */}
                          {isSelected && (
                            <tr className="bg-slate-950/80 animate-fade-in border-t-0 border-[#27272a]">
                              <td colSpan={8} className="p-4 px-6 text-right">
                                <div className="space-y-3 max-w-4xl mx-auto" id="devices_hub_drawer">
                                  
                                  <div className="flex justify-between items-center pb-2 border-b border-[#27272a]">
                                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                                      <Smartphone className="w-4 h-4 text-rose-400" />
                                      <span>
                                        {isRtl 
                                          ? `الأجهزة النشطة في حساب: ${c.companyName} (${c.activeDevices.length})` 
                                          : `Authorized Live Sessions for: ${c.companyName}`}
                                      </span>
                                    </h4>
                                    <span className="text-[10px] text-indigo-400 font-mono">Tenant UUID Profile: cop-{c.id.substr(-6)}</span>
                                  </div>

                                  {c.activeDevices.length === 0 ? (
                                    <p className="text-slate-500 text-xs py-3 text-center">{isRtl ? "لا توجد أجهزة متصلة مسجلة حالياً." : "No active terminals found."}</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      {c.activeDevices.map(d => (
                                        <div key={d.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between h-24 relative overflow-hidden" id="device_session_card">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-extrabold text-white">{d.browser} - {d.os}</span>
                                            <span className="text-[9px] rounded-full px-2 py-0.5 bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">{d.activityType}</span>
                                          </div>
                                          
                                          <div className="flex justify-between items-center col-span-2 mt-3">
                                            <div className="text-[10px] text-slate-500 font-mono">
                                              <span>{isRtl ? "آخر نشاط:" : "Active:"}</span> <span className="text-slate-300">{d.lastActive}</span>
                                            </div>
                                            
                                            <button
                                              onClick={() => handleForceLogoutDevice(c.id, d.id, d.browser, d.os)}
                                              className="p-1 px-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                                              title={isRtl ? "طرد وإنهاء جلسة الجهاز الفورية" : "Drop authorization token"}
                                            >
                                              {isRtl ? "طرد فوري" : "Force Log out"}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB II: ACTIVITY LOGS */}
      {activeSubTab === "logs" && (
        <div className="space-y-4" id="super_admin_tab_logs">
          
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl overflow-hidden p-4 space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>{isRtl ? "سجل النشاط العام للمنصة (SaaS Audit Logs)" : "SaaS Global Orchestrator Logs"}</span>
              </h3>
              
              <button
                onClick={() => {
                  setLogs([]);
                  onTriggerNotification(isRtl ? "تم تفريغ سجل العمليات بنجاح" : "Activity schema wiped", "success");
                }}
                className="text-[10px] text-rose-400 hover:underline cursor-pointer"
              >
                {isRtl ? "تفريغ السجلات" : "Purge Auditor"}
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="text-center text-slate-500 py-12 text-xs">{isRtl ? "لا يوجد أي تسجيلات نشاط حتى الآن." : "Activity logs directory empty."}</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden text-right leading-relaxed" id="activity_log_ledger_card">
                    <div className="absolute top-0 right-0 h-full w-[3px] bg-indigo-500" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-xs">{log.companyName}</span>
                        <span className="text-[10px] text-slate-500">({log.email})</span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                        <span>IP: {log.ipAddress}</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-2.5 mt-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black ${
                        log.operation === "إنشاء حساب" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        log.operation === "تجميد الحساب" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        log.operation === "تفعيل البريد" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        log.operation === "تعديل الاشتراك" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                        "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}>
                        {log.operation}
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{log.details}</p>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB III: SECURITY GATEWAY */}
      {activeSubTab === "security" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="super_admin_tab_security">
          
          {/* Controls list */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 space-y-6 md:col-span-5 text-right">
            <h3 className="text-sm font-black text-white pb-2 border-b border-[#27272a] flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>{isRtl ? "إعدادات الأمان وقفل المنصة" : "Global Security Locks"}</span>
            </h3>

            {/* Simulated 2FA toggle button with full feedback */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="space-y-1">
                  <span className="text-xs font-black text-white block">{isRtl ? "المصادقة الثنائية الإلزامية (2FA)" : "Global 2FA Mandated"}</span>
                  <span className="text-[10px] text-slate-500 block">{isRtl ? "إلزام جميع المدراء ببريد تأكيدي ثانٍ" : "Force key-checks on login."}</span>
                </div>
                <button
                  onClick={() => {
                    setSecConfig(prev => ({ ...prev, twoFactorGlobalState: !prev.twoFactorGlobalState }));
                    onTriggerNotification(
                      isRtl 
                        ? `تم ${!secConfig.twoFactorGlobalState ? "تفعيل" : "إلغاء تفعيل"} المصادقة الثنائية للمنصة`
                        : "SaaS 2FA constraints adjusted",
                      "info"
                    );
                  }}
                  className={`p-1 px-3.5 text-[10px] font-black rounded-lg cursor-pointer transition-all ${
                    secConfig.twoFactorGlobalState 
                      ? "bg-emerald-600 text-white hover:bg-emerald-500" 
                      : "bg-slate-800 text-slate-400 hover:bg-slate-750"
                  }`}
                >
                  {secConfig.twoFactorGlobalState ? (isRtl ? "نشط" : "ACTIVE") : (isRtl ? "معطل" : "DISABLED")}
                </button>
              </div>

              {/* IP Tracking */}
              <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="space-y-1">
                  <span className="text-xs font-black text-white block">{isRtl ? "تتبع الـ IP المطور" : "Advanced IP Geolocation"}</span>
                  <span className="text-[10px] text-slate-500 block">{isRtl ? "مراقبة عناوين الجزائر السريعة" : "Verify country coordinates"}</span>
                </div>
                <button
                  onClick={() => {
                    setSecConfig(prev => ({ ...prev, ipTrackingEnabled: !prev.ipTrackingEnabled }));
                    onTriggerNotification(
                      isRtl ? "تم تعديل تفضيلات تتبع الـ IP" : "IP auditor updated",
                      "info"
                    );
                  }}
                  className={`p-1 px-3.5 text-[10px] font-black rounded-lg cursor-pointer transition-all ${
                    secConfig.ipTrackingEnabled 
                      ? "bg-emerald-600 text-white hover:bg-emerald-500" 
                      : "bg-slate-800 text-slate-400 hover:bg-slate-750"
                  }`}
                >
                  {secConfig.ipTrackingEnabled ? (isRtl ? "نشط" : "ACTIVE") : (isRtl ? "معطل" : "DISABLED")}
                </button>
              </div>

              {/* Metric Counter for failed attempts */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400">{isRtl ? "محاولات الدخول الخاطئة المحتجزة" : "Prevented Brute-Force Attacks"}</span>
                  <span className="text-xs font-mono font-black text-rose-450 bg-rose-500/10 px-2 py-0.5 rounded">
                    {secConfig.failedLoginAttemptsCount}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">{isRtl ? "تلقائياً يتم تجميد الـ IP بعد 5 محاولات متتالية." : "Automatic suspension triggers after 5 consecutive failures."}</p>
                
                <button
                  onClick={() => {
                    setSecConfig(prev => ({ ...prev, failedLoginAttemptsCount: 0 }));
                    onTriggerNotification(isRtl ? "تم تصفير عداد الهجمات بنجاح" : "Brute force counter flushed", "success");
                  }}
                  className="w-full py-1 bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-300 hover:text-white rounded font-bold mt-2 cursor-pointer transition-colors"
                >
                  {isRtl ? "تصفير العداد" : "Flush Logs counter"}
                </button>
              </div>
            </div>

          </div>

          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-5 md:col-span-7 space-y-4 text-right">
            <h3 className="text-sm font-black text-white pb-2 border-b border-[#27272a] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-rose-450" />
              <span>{isRtl ? "مراقبة سجل حماية تسجيل الدخول" : "Live Security Traffic Monitoring"}</span>
            </h3>

            {/* Mocked Live Login History entries with beautiful Algerian IP list */}
            <div className="space-y-2.5">
              {[
                { time: "2026-06-07 18:30", action: "تسجيل دخول مقبول", email: "ahmed@nationaltex.dz", ip: "197.200.41.92", client: "Chrome / Windows 11", status: "success" },
                { time: "2026-06-07 18:28", action: "محاولة فاشلة - كلمة مرور غير مطابقة", email: "ahmed@nationaltex.dz", ip: "197.200.41.92", client: "Chrome / Windows 11", status: "failed" },
                { time: "2026-06-07 15:45", action: "تسجيل دخول مقبول", email: "ahmed@nationaltex.dz", ip: "197.112.55.20", client: "Mobile App / iOS 17.2", status: "success" },
                { time: "2026-06-07 12:44", action: "تسجيل دخول مقبول برمز OTP", email: "mourad@tech-oran.com", ip: "105.101.99.3", client: "Firefox / macOS Sonoma", status: "success" },
                { time: "2026-06-06 09:40", action: "محاولة تسجيل دخول مرفوضة - حساب مجمّد", email: "salim@bejaia-trade.com", ip: "105.105.10.4", client: "Chrome / Windows 11", status: "blocked" }
              ].map((h, index) => (
                <div key={index} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs" id="login_audit_record">
                  
                  <div className="space-y-1 max-w-[200px]">
                    <span className="font-extrabold text-white block truncate">{h.email}</span>
                    <span className="text-[10px] text-slate-500 font-mono block">{h.client}</span>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={`text-[10px] font-bold ${
                        h.status === "success" ? "text-emerald-400" :
                        h.status === "failed" ? "text-amber-400" : "text-rose-400"
                      }`}>
                        {h.action}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        h.status === "success" ? "bg-emerald-500" :
                        h.status === "failed" ? "bg-amber-500" : "bg-rose-500"
                      }`} />
                    </div>

                    <div className="flex items-center gap-2 justify-end text-[9px] text-slate-500 font-mono">
                      <span>IP: {h.ip}</span>
                      <span>{h.time}</span>
                    </div>
                  </div>

                </div>
              ))}
            </div>

          </div>

        </div>
      )}

      {/* TAB IV: DIAGNOSTIC & DEBUG PANEL */}
      {activeSubTab === "debug" && (
        <div className="space-y-6" id="super_admin_tab_debug">
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-6 text-right">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                  <span>{isRtl ? "صفحة تجارب الأداء وفحص المشاكل (SaaS Diagnostic Center)" : "SaaS Diagnostic and Sandbox Environment"}</span>
                </h3>
                <p className="text-[11px] text-slate-500 leading-normal">
                  {isRtl ? "متاح فقط لأصحاب الصلاحية لمالك المنصة لفحص سلامة اتصالات الجلسة وقاعدة البيانات السحابية." : "Confidential orchestrator panel to audit session state and clear test ledger tables."}
                </p>
              </div>
            </div>

            {/* Diagnostic Session Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Card I: Identity State */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-extrabold text-white flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isRtl ? "بيانات الهوية والاتصال السحابية" : "Cloud Security Profile"}</span>
                </h4>
                
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/40 pb-1.5">
                    <span className="text-slate-400">{isRtl ? "معرف المستخدم (User ID)" : "User ID"}</span>
                    <span className="text-white select-all">{session?.user_id || "N/A"}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/40 pb-1.5">
                    <span className="text-slate-400">{isRtl ? "البريد الإلكتروني (Email)" : "Auth Email"}</span>
                    <span className="text-white select-all">{session?.email || "N/A"}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/40 pb-1.5">
                    <span className="text-slate-400">{isRtl ? "معرف الشركة (Company ID)" : "Company ID"}</span>
                    <span className="text-white select-all">{session?.company_id || "N/A"}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pb-0.5">
                    <span className="text-slate-400">{isRtl ? "الصلاحية (Access Role)" : "Role"}</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-extrabold">{session?.role || "super_admin"}</span>
                  </div>
                </div>
              </div>

              {/* Card II: Onboarding & Subscription State */}
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-extrabold text-white flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isRtl ? "حالة مساحة العمل والمقاعد" : "Tenant Operations Ledger"}</span>
                </h4>
                
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/40 pb-1.5">
                    <span className="text-slate-400">{isRtl ? "تفعيل البريد الإلكتروني" : "Email Verified"}</span>
                    <span className="text-emerald-400 font-bold">✓ {isRtl ? "مؤكد" : "Verified"}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/40 pb-1.5">
                    <span className="text-slate-400">{isRtl ? "تهيئة Onboarding" : "Completed Onboarding"}</span>
                    <span className={profile && profile.businessName ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                      {profile && profile.businessName ? (isRtl ? "مكتمل (True)" : "Yes") : (isRtl ? "غير مكتمل (False)" : "No")}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] border-b border-slate-800/40 pb-1.5">
                    <span className="text-slate-400">{isRtl ? "اسم المؤسسة النشطة" : "Active Business Name"}</span>
                    <span className="text-white font-sans">{profile?.businessName || "N/A"}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pb-0.5">
                    <span className="text-slate-400">{isRtl ? "الجلسة الزمنية النشطة" : "Active Session"}</span>
                    <span className="text-slate-400">{new Date().toLocaleTimeString()} Algerian Time</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Clean Slate & Reset Sandbox Section */}
            <div className="p-5 bg-rose-950/10 border border-rose-500/20 rounded-xl space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white">{isRtl ? "تصفير وتنظيف بيئة العمل (Clean Slate / Reset Sandbox)" : "Dangerous: Purge Sandbox Environment"}</h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    {isRtl 
                      ? "يتيح هذا الإجراء حذف كل البيانات التجريبية لحسابات الأدمن والشركات والعمليات لكي تصبح البيئة نظيفة تماماً. سيقوم بتصفير Onboarding لـ false وحذف الملف الشخصي وكل الجداول السحابية لتعود لنقطة البداية."
                      : "Permanently delete all product catalogs, orders, invoices, worker indices, and purge cloud tables. Resets onboarding status to trigger initial setup flow on refresh."}
                  </p>
                </div>
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
                        onTriggerNotification(isRtl ? "جاري تصفير وتنظيف بيئة وتجربة العمل..." : "Initiate sandbox clean slate sweep...", "info");
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

      {/* NEW COMPANY REGISTRATION MODAL FORM */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="add_company_modal">
          <div className="w-full max-w-md bg-[#121214] border border-[#27272a] shadow-2xl rounded-2xl p-6 relative overflow-hidden" id="add_company_card">
            
            {/* Top gradient layout banner */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 to-rose-550" />
            
            <div className="flex justify-between items-center pb-3 border-b border-[#27272a] mb-4 text-right">
              <button 
                type="button" 
                onClick={() => setShowAddCompanyModal(false)}
                className="text-slate-400 hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
              <h3 className="text-base font-black text-white">{isRtl ? "إنشاء حساب شركة جديدة (SaaS)" : "Provision SaaS Tenant"}</h3>
            </div>

            <form onSubmit={handleCreateNewSaaSCompany} className="space-y-4 text-right">
              
              {/* COMPANY NAME */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">{isRtl ? "اسم الشركة / المؤسسة" : "Company Title"}</label>
                <input
                  type="text"
                  required
                  placeholder={isRtl ? "مثال: هوديز الجزائر للملابس" : "Example: West Cargo Ltd"}
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl placeholder-slate-600 outline-none focus:border-indigo-600 text-right"
                />
              </div>

              {/* OWNER / MANAGER */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">{isRtl ? "اسم المدير المسؤول" : "Owner Full Name"}</label>
                <input
                  type="text"
                  required
                  placeholder={isRtl ? "مثال: عادل بوطرفة" : "Example: Adel Boutarfa"}
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl placeholder-slate-600 outline-none focus:border-indigo-600 text-right"
                />
              </div>

              {/* EMAIL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">{isRtl ? "البريد الإلكتروني الأساسي" : "Corporate Email"}</label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl placeholder-slate-600 outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>

              {/* PHONE */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">{isRtl ? "رقم الهاتف" : "Phone line"}</label>
                <input
                  type="text"
                  required
                  placeholder="+213 000 000 000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl placeholder-slate-600 outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>

              {/* PRICING PLANS DECK */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">{isRtl ? "باقة الاشتراك الافتراضية" : "Initial Plan Subscription"}</label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-xs text-indigo-400 font-extrabold rounded-xl outline-none focus:border-indigo-600 text-right"
                >
                  <option value="Free">Free (Seats: 2, Price: $0)</option>
                  <option value="Basic">Basic (Seats: 5, Price: $29)</option>
                  <option value="Pro">Pro (Seats: 15, Price: $79)</option>
                  <option value="Enterprise font-bold">Enterprise (Seats: 100, Price: $249)</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-4" id="modal_buttons">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 py-2.5 bg-[#1c1c1e] hover:bg-[#27272a] text-[#a1a1aa] hover:text-white text-xs font-bold rounded-xl transition-colors border border-[#27272a] cursor-pointer"
                >
                  {isRtl ? "إلغاء الأمر" : "Dismiss"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-505/10 transition-colors cursor-pointer"
                >
                  {isRtl ? "إنشاء وترخيص العميل" : "Save and Provision"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
