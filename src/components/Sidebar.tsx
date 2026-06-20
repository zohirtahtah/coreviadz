/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { 
  LayoutDashboard, ShoppingCart, Package, ShoppingBag, Users, 
  Receipt, Landmark, LandmarkIcon, TrendingUp, Trash2, Settings,
  Globe, Sun, Moon, Bell, Lock, Unlock, KeyRound, Eye, EyeOff, LogOut, Check,
  Shield, History, Menu, X, MessageSquare, UserCheck
} from "lucide-react";
import { LanguageType, ThemeType, BusinessProfile } from "../types";
import { translations } from "../translations";
import { Flag } from "./Flag";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: LanguageType;
  setLang: (l: LanguageType) => void;
  theme: ThemeType;
  toggleTheme: () => void;
  profile: BusinessProfile;
  passcode: string;
  isLocked: boolean;
  unlockedTabs: string[];
  onUnlockTab: (tab: string) => void;
  onLockTab?: (tab: string) => void;
  onLogout: () => void;
  notifications: string[];
  clearNotifications: () => void;
  session?: any;
  isServerSuperAdmin?: boolean | null;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  theme,
  toggleTheme,
  profile,
  passcode,
  isLocked,
  unlockedTabs,
  onUnlockTab,
  onLockTab,
  onLogout,
  notifications,
  clearNotifications,
  session,
  isServerSuperAdmin
}: SidebarProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";
  
  // Local Passcode Modal State
  const [showLockScreen, setShowLockScreen] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [deniedTabModal, setDeniedTabModal] = useState<{ id: string; label: string } | null>(null);

  // Dynamic Chat messages unread badge counter
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Track seen notifications content to prevent red badge on old/read alerts
  const [seenNotifications, setSeenNotifications] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("corevia_seen_notifications_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const checkUnreadMessages = async () => {
      try {
        let companyId = "";
        const stored = localStorage.getItem("corevia_session_v1") || localStorage.getItem("corevia_user_session_v1");
        if (stored) {
          companyId = JSON.parse(stored).company_id || "";
        }
        if (companyId) {
          const raw = localStorage.getItem("corevia_chat_messages_v1");
          const msgs = raw ? JSON.parse(raw) : [];
          const companyMsgs = msgs.filter((m: any) => m.companyId === companyId);
          
          if (activeTab === "communication") {
            localStorage.setItem(`corevia_last_read_chat_${companyId}`, String(companyMsgs.length));
            setUnreadChatCount(0);
          } else {
            const lastReadRaw = localStorage.getItem(`corevia_last_read_chat_${companyId}`);
            const lastReadCount = lastReadRaw ? Number(lastReadRaw) : 0;
            
            if (companyMsgs.length > lastReadCount) {
              setUnreadChatCount(companyMsgs.length - lastReadCount);
            } else {
              setUnreadChatCount(0);
            }
          }
        }
      } catch (e) {}
    };

    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (showNotifications && notifications.length > 0) {
      setSeenNotifications(prev => {
        const updated = Array.from(new Set([...prev, ...notifications]));
        localStorage.setItem("corevia_seen_notifications_v1", JSON.stringify(updated));
        return updated;
      });
    }
  }, [showNotifications, notifications]);

  const handleClearAllLocal = () => {
    setSeenNotifications(prev => {
      const updated = Array.from(new Set([...prev, ...notifications]));
      localStorage.setItem("corevia_seen_notifications_v1", JSON.stringify(updated));
      return updated;
    });
    clearNotifications();
  };

  // Locked pages registry
  const lockedPages = ["workers", "expenses", "suppliers", "profit", "yearly"];

  // Read local storage/prop to check for Super Admin session
  let isSuperAdmin = false;
  if (isServerSuperAdmin !== undefined && isServerSuperAdmin !== null) {
    isSuperAdmin = isServerSuperAdmin === true;
  } else {
    const currentEmail = session?.email || "";
    if (
      session?.role === "super_admin" || 
      currentEmail.toLowerCase().trim() === "coreviadz@gmail.com" || 
      currentEmail.toLowerCase().trim() === "admin@corevia.com"
    ) {
      isSuperAdmin = true;
    } else {
      try {
        const sessionStored = localStorage.getItem("corevia_session_v1") || localStorage.getItem("corevia_user_session_v1");
        if (sessionStored) {
          const parsed = JSON.parse(sessionStored);
          if (
            parsed.role === "super_admin" || 
            parsed.email?.toLowerCase().trim() === "coreviadz@gmail.com" || 
            parsed.email?.toLowerCase().trim() === "admin@corevia.com"
          ) {
            isSuperAdmin = true;
          }
        }
      } catch (e) {
        console.warn("Sidebar parse session status:", e);
      }
    }
  }

  const baseNavItems = [
    { id: "dashboard", label: t.navDashboard, icon: LayoutDashboard, isRestricted: false },
    { id: "orders", label: t.navOrders, icon: ShoppingCart, isRestricted: false },
    { id: "inventory", label: t.navInventory, icon: Package, isRestricted: false },
    { id: "products", label: t.navProducts, icon: ShoppingBag, isRestricted: false },
    { id: "workers", label: t.navWorkers, icon: Users, isRestricted: true },
    { id: "expenses", label: t.navExpenses, icon: Receipt, isRestricted: true },
    { id: "suppliers", label: t.navSuppliers, icon: Landmark, isRestricted: true },
    { id: "profit", label: t.navProfitSummary, icon: LandmarkIcon, isRestricted: true },
    { id: "yearly", label: t.navYearly, icon: TrendingUp, isRestricted: true },
    { id: "communication", label: lang === "ar" ? "التواصل الداخلي" : lang === "fr" ? "Communication" : "Team Chat", icon: MessageSquare, isRestricted: false },
    { id: "activity-log", label: lang === "ar" ? "سجل العمليات" : lang === "fr" ? "Journal d'Activité" : "Activity Log", icon: History, isRestricted: false },
    { id: "users-permissions", label: lang === "ar" ? "المستخدمون والصلاحيات" : lang === "fr" ? "Utilisateurs & Permissions" : "Users & Permissions", icon: Shield, isRestricted: false },
    { id: "trash", label: t.navTrash, icon: Trash2, isRestricted: false },
    { id: "settings", label: t.navSettings, icon: Settings, isRestricted: false },
  ];

  // Dynamically insert Super Admin dashboard tab if logged-in user is platform manager
  const navItems = isSuperAdmin
    ? [
        { id: "super-admin", label: lang === "ar" ? "لوحة الإداري (Super Admin)" : "Super Admin Panel", icon: Shield, isRestricted: false },
        ...baseNavItems
      ]
    : baseNavItems;

  const isAllowed = (tabId: string) => {
    if (isSuperAdmin) return true;
    if (session?.role === "employee") {
      // My Profile and Team communication are always allowed and available for employees
      if (tabId === "my-profile" || tabId === "communication") return true;
      return !!session.allowedPages?.includes(tabId);
    }
    return true;
  };

  const isEmployee = session?.role === "employee";
  const navItemsFiltered = isEmployee
    ? [
        { 
          id: "my-profile", 
          label: lang === "ar" ? "ملفي التعاقدي" : lang === "fr" ? "Mon Profil Contrat" : "My Profile / Employment Info", 
          icon: UserCheck, 
          isRestricted: false 
        },
        ...navItems.filter(item => 
          item.id !== "settings" && 
          item.id !== "users-permissions" && 
          item.id !== "super-admin" && 
          item.id !== "trash"
        )
      ]
    : navItems;

  const handleNavClick = (tabId: string, isRestricted: boolean) => {
    setIsMobileOpen(false);
    
    // Dynamic Employee Permission Guard
    if (!isAllowed(tabId)) {
      setDeniedTabModal({
        id: tabId,
        label: navItems.find(n => n.id === tabId)?.label || tabId
      });
      return;
    }

    if (isRestricted && isLocked && !unlockedTabs.includes(tabId)) {
      setShowLockScreen(tabId);
      setEnteredCode("");
      setErrorMsg("");
    } else {
      setActiveTab(tabId);
    }
  };

  const verifyPasscode = () => {
    if (enteredCode === passcode) {
      onUnlockTab(showLockScreen!);
      setActiveTab(showLockScreen!);
      setShowLockScreen(null);
      setEnteredCode("");
      setErrorMsg("");
    } else {
      setErrorMsg(lang === "ar" ? "كلمة المرور خاطئة" : "Incorrect Passcode");
      setEnteredCode("");
    }
  };

  const handleCellClick = (num: string) => {
    if (enteredCode.length < 4) {
      setEnteredCode(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setEnteredCode(prev => prev.slice(0, -1));
  };

  // Add Keyboard input listener for physical keyboard support
  useEffect(() => {
    if (!showLockScreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow numerical entries
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleCellClick(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        verifyPasscode();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowLockScreen(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLockScreen, enteredCode, passcode]);

  // Auto-verify when 4 characters are entered
  useEffect(() => {
    if (showLockScreen && enteredCode.length === 4) {
      verifyPasscode();
    }
  }, [enteredCode, showLockScreen]);

  return (
    <>
      {/* Backdrop overlay for mobile screen drawer */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-35 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR MAINCONTAINER */}
      <aside className={`w-64 max-h-screen bg-[#09090b] border-[#27272a] flex flex-col justify-between p-4 z-40 fixed top-0 bottom-0 transition-transform duration-300 ease-in-out ${
        isRtl 
          ? `right-0 border-l ${isMobileOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}` 
          : `left-0 border-r ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`
      }`} id="desktop_sidebar">
        <div className="space-y-6 flex flex-col" id="sidebar_main_section">
          
          {/* Brand Info with Profile Avatar & Logo */}
          <div className="flex items-center gap-3 border-b border-[#27272a] pb-4" id="sidebar_brand_card">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center overflow-hidden shadow-md flex-shrink-0">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold font-mono text-white text-center">
                  {profile.businessName ? profile.businessName.charAt(0).toUpperCase() : "C"}
                </span>
              )}
            </div>
            <div className="min-w-0" id="sidebar_brand_meta">
              <h1 className="text-sm font-bold text-white truncate">{profile.businessName || "Corevia ERP"}</h1>
              <span className="text-[10px] font-mono text-indigo-400 tracking-tight block truncate">● {profile.businessType || "Core Workspace"}</span>
            </div>
          </div>

          {/* Employee Identity Widget */}
          {session?.role === "employee" && (
            <div className={`bg-[#18181b]/60 border border-zinc-805 rounded-xl p-3 space-y-1.5 select-none ${isRtl ? "text-right" : "text-left"}`} id="employee_identity_sidebar">
              <span className="text-[9.5px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                {lang === "ar" ? "حساب موظف" : lang === "fr" ? "Compte Employé" : "Employee Account"}
              </span>
              <p className="text-xs font-black text-white truncate">{session.username}</p>
              <div className="inline-flex items-center gap-1 bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded-md text-[10px] text-indigo-300 font-bold">
                <span>{session.jobTitle || (lang === "ar" ? "موظف" : "Employee")}</span>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1 flex-1 overflow-y-auto max-h-[calc(100vh-220px)] pr-1" id="sidebar_navigation_links">
            {navItemsFiltered.map((item) => {
              const IconComp = item.icon;
              const isItemUnlocked = !item.isRestricted || !isLocked || unlockedTabs.includes(item.id);
              const isActive = activeTab === item.id;
              const allowed = isAllowed(item.id);
              
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id, item.isRestricted)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-lg transition-all outline-none group text-right ${
                    !allowed
                      ? "text-slate-600 dark:text-slate-600 hover:text-slate-500 cursor-not-allowed opacity-55"
                      : isActive 
                        ? "bg-indigo-600/10 text-indigo-400"
                        : "text-slate-450 hover:bg-[#18181b] hover:text-slate-200"
                  }`}
                  style={!allowed ? { color: "#52525b" } : undefined}
                >
                  <div className="flex items-center gap-3">
                    <IconComp className={`w-4 h-4 transition-colors ${!allowed ? "text-slate-600" : isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"}`} />
                    <span>{item.label}</span>
                  </div>
                  {!allowed ? (
                    <Shield className="w-3.5 h-3.5 text-slate-600" />
                  ) : item.id === "communication" && unreadChatCount > 0 && activeTab !== "communication" ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white select-none shadow animate-bounce">
                      {unreadChatCount}
                    </span>
                  ) : item.isRestricted && !isItemUnlocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400" />
                  ) : item.isRestricted && isLocked && isItemUnlocked ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onLockTab) onLockTab(item.id);
                      }}
                      className="p-1 hover:bg-rose-950/40 rounded text-emerald-400 hover:text-rose-500 transition-colors cursor-pointer select-none inline-flex items-center justify-center"
                      title={isRtl ? "إعادة إقفال هذه الصفحة" : "Re-lock this page"}
                    >
                      <Unlock className="w-3.5 h-3.5" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer with Session actions */}
        <div className="border-t border-[#27272a] pt-3 space-y-3" id="sidebar_footer_section">
          
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-2" id="sidebar_metainfo">
            <span>Corevia Pro</span>
            <span>2026 UTC</span>
          </div>

          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all outline-none cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === "ar" ? "تسجيل الخروج" : lang === "fr" ? "Se déconnecter" : "Log Out"}</span>
          </button>
        </div>
      </aside>

      {/* HEADER & TOPBAR WITH RESPONSIVE ALIGNMENT */}
      <header className={`h-16 bg-[#09090b]/80 backdrop-blur-md border-b border-[#27272a] flex items-center justify-between px-4 z-30 fixed top-0 transition-all duration-300 ${
        isRtl 
          ? "right-0 md:right-64 left-0 w-full md:w-[calc(100%-16rem)] flex-row-reverse" 
          : "left-0 md:left-64 right-0 w-full md:w-[calc(100%-16rem)] flex-row"
      }`} id="global_topbar">
        {/* Brand visual (on left for LTR, right for RTL) */}
        <div className="flex items-center gap-3" id="topbar_left">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 md:hidden bg-[#18181b] hover:bg-[#27272a] text-slate-300 hover:text-white rounded-xl border border-[#27272a] cursor-pointer focus:outline-none flex items-center justify-center transition-all"
            title={lang === "ar" ? "القائمة" : "Menu"}
          >
            {isMobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white md:hidden animate-pulse">
            {profile.businessName ? profile.businessName.charAt(0).toUpperCase() : "C"}
          </div>
          <span className="text-white text-sm font-bold truncate max-w-[120px] sm:max-w-[200px]">{profile.businessName || "Corevia"}</span>
        </div>

        {/* Global Floating Header Employee Identity Banner */}
        {session?.role === "employee" && (
          <div className="hidden sm:flex items-center gap-3 bg-indigo-950/45 border border-indigo-900/40 p-1.5 px-3 rounded-2xl select-none" id="header_employee_indicator">
            <span className="text-[9.5px] text-indigo-300 font-black uppercase bg-indigo-950/60 border border-indigo-900/50 px-2 py-0.5 rounded-lg shrink-0">
              {lang === "ar" ? "حساب موظف" : lang === "fr" ? "Compte Employé" : "Employee Account"}
            </span>
            <div className={`flex flex-col text-xs font-bold leading-none ${isRtl ? "text-right" : "text-left"}`}>
              <span className="text-white text-[11px] truncate">{session.username}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 truncate">{session.jobTitle || (lang === "ar" ? "موظف" : "Employee")}</span>
            </div>
          </div>
        )}

        {/* Right side options: language switchers, alerts and visuals */}
        <div className="flex items-center gap-2 sm:gap-2.5" id="topbar_right_instruments">
          
          {/* Quick Config Pills Deck (Side-by-side theme + language selector) */}
          <div className="flex items-center bg-[#18181b] dark:bg-[#121214] border border-[#27272a] rounded-xl p-0.5 gap-1.2" id="header_control_dock">
            
            {/* Light/Dark Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-1.5 px-2.5 hover:bg-[#27272a] dark:hover:bg-[#1c1c1e] text-slate-300 hover:text-white rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] hidden sm:inline">{lang === "ar" ? "ليلي" : lang === "fr" ? "Nuit" : "Dark"}</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] hidden sm:inline">{lang === "ar" ? "نهاري" : lang === "fr" ? "Jour" : "Light"}</span>
                </>
              )}
            </button>

            {/* Visual Divider */}
            <span className="h-4 w-[1px] bg-[#27272a]" />

            {/* Languages Dropdown Trigger (Algeria flag, France flag, US Flag) */}
            <div className="relative" id="lang_dropdown_menu">
              <button 
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-1.5 p-1.5 px-2.5 hover:bg-[#27272a] dark:hover:bg-[#1c1c1e] text-slate-200 text-xs rounded-lg transition-all font-bold cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] flex items-center gap-1.5 font-bold">
                  <Flag lang={lang} />
                  <span>{lang === "ar" ? "العربية" : lang === "fr" ? "Français" : "English"}</span>
                </span>
              </button>
              
              {showLangDropdown && (
                <>
                  {/* Invisible backdrop to capture clicks outside and close the dropdown */}
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowLangDropdown(false)} />
                  <div className={`absolute ${isRtl ? "left-0" : "right-0"} top-9 bg-[#09090b] border border-[#27272a] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-1 w-32 text-right transition-all animate-fade-in`}>
                    <button 
                      onClick={() => {
                        setLang("ar");
                        setShowLangDropdown(false);
                      }} 
                      className="flex items-center justify-between p-2 text-xs text-slate-300 hover:bg-[#18181b] rounded-lg cursor-pointer w-full text-right"
                    >
                      <span className="flex items-center gap-1.5"><Flag lang="ar" /> <span>العربية</span></span>
                      {lang === "ar" && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                    <button 
                      onClick={() => {
                        setLang("fr");
                        setShowLangDropdown(false);
                      }} 
                      className="flex items-center justify-between p-2 text-xs text-slate-300 hover:bg-[#18181b] rounded-lg cursor-pointer w-full text-left ltr"
                    >
                      <span className="flex items-center gap-1.5"><Flag lang="fr" /> <span>Français</span></span>
                      {lang === "fr" && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                    <button 
                      onClick={() => {
                        setLang("en");
                        setShowLangDropdown(false);
                      }} 
                      className="flex items-center justify-between p-2 text-xs text-slate-300 hover:bg-[#18181b] rounded-lg cursor-pointer w-full text-left ltr"
                    >
                      <span className="flex items-center gap-1.5"><Flag lang="en" /> <span>English</span></span>
                      {lang === "en" && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Alarm Bell Notifications Panel */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl transition-all border border-slate-700/20 relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {notifications.some(notif => !seenNotifications.includes(notif)) && !showNotifications && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              )}
            </button>

            {showNotifications && (
              <div className={`absolute ${isRtl ? "left-0" : "right-0"} top-11 w-80 bg-[#09090b] border border-[#27272a] shadow-2xl rounded-2xl p-4 z-50 max-h-96 overflow-y-auto`} id="notifications_popover">
                <div className="flex justify-between items-center pb-2 border-b border-[#27272a] mb-2">
                  <h3 className="text-xs font-bold text-white">{t.notifTitle}</h3>
                  {notifications.length > 0 && (
                    <button onClick={handleClearAllLocal} className="text-[10px] text-indigo-400 hover:underline">
                      {isRtl ? "تفريغ الكل" : "Clear All"}
                    </button>
                  )}
                </div>
                
                {notifications.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-4">{t.notifEmpty}</p>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notif, index) => (
                      <div key={index} className="p-2.5 bg-slate-900 border border-slate-850 rounded-xl text-[11px] text-slate-300 leading-relaxed text-right">
                        {notif}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Exit/Logout button visible on both mobile & desktop */}
          <button 
            onClick={onLogout}
            className="p-2 bg-rose-550/10 hover:bg-rose-550/20 text-rose-400 rounded-xl transition-all border border-rose-500/20 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            title={lang === "ar" ? "تسجيل الخروج" : "Log Out"}
            id="topbar_logout_action"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[10px] font-black hidden sm:inline">{lang === "ar" ? "خروج" : "Exit"}</span>
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[#09090b]/90 backdrop-blur-md border-t border-[#27272a] flex items-center justify-around px-2 z-40 md:hidden" id="mobile_subnavigation">
        {(() => {
          const renderBottomButton = (tabId: string, icon: any, labelAr: string, labelEn: string, isRestricted: boolean) => {
            const allowed = isAllowed(tabId);
            const IconComponent = icon;
            const label = lang === "ar" ? labelAr : labelEn;
            const isActive = activeTab === tabId;
            
            return (
              <button 
                key={tabId}
                onClick={() => {
                  if (!allowed) {
                    setDeniedTabModal({ id: tabId, label });
                  } else {
                    handleNavClick(tabId, isRestricted);
                  }
                }}
                className={`flex flex-col items-center gap-1 text-[10px] ${
                  !allowed 
                    ? "text-slate-600 opacity-50 cursor-not-allowed" 
                    : isActive 
                      ? "text-indigo-400 font-bold" 
                      : "text-slate-400"
                }`}
                style={!allowed ? { color: "#52525b" } : undefined}
              >
                <IconComponent className="w-4 h-4" />
                <span>{label}</span>
              </button>
            );
          };

          return (
            <>
              {renderBottomButton("dashboard", LayoutDashboard, "الرئيسية", "Home", false)}
              {renderBottomButton("orders", ShoppingCart, "الطلبيات", "Orders", false)}
              {renderBottomButton("inventory", Package, "المخزون", "Stock", false)}
              {renderBottomButton("profit", LandmarkIcon, "الأرباح", "Finance", true)}
              {renderBottomButton("settings", Settings, "الإعدادات", "Settings", false)}
            </>
          );
        })()}
      </nav>

      {/* OVERLAY CUSTOM PASSCODE PAD */}
      {showLockScreen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="passcode_overlay_modal">
          <div className="w-full max-w-sm bg-[#09090b] border border-[#27272a] shadow-2xl rounded-2xl p-6 relative overflow-hidden text-center" id="pascode_card_container">
            <div className="absolute top-3 right-3">
              <button onClick={() => setShowLockScreen(null)} className="text-slate-400 hover:text-white text-sm font-semibold p-1">✕</button>
            </div>

            <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5 text-indigo-400" />
            </div>

            <h2 className="text-lg font-bold text-white mb-2">{t.navLocked}</h2>
            <p className="text-xs text-slate-400 mb-6 px-4">{t.enterPasscode}</p>

            {/* Code Dots Indicator */}
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((dotIndex) => (
                <div 
                  key={dotIndex}
                  className={`w-3.5 h-3.5 rounded-full border transition-all ${
                    enteredCode.length > dotIndex 
                      ? "bg-indigo-550 border-indigo-550 scale-110 shadow-lg shadow-indigo-500/20" 
                      : "border-[#27272a] bg-[#040406]"
                  }`}
                />
              ))}
            </div>

            {errorMsg && <p className="text-xs text-rose-400 font-medium mb-4">{errorMsg}</p>}

            {/* Custom Interactive Grid Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto mb-6 font-mono" id="keypad_interaction_grid">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((numVal) => (
                <button
                  key={numVal}
                  onClick={() => handleCellClick(numVal)}
                  className="w-14 h-14 rounded-full bg-[#1c1c1e] hover:bg-[#27272a] active:bg-[#27272a]/70 text-lg font-bold text-slate-200 transition-all flex items-center justify-center mx-auto shadow-sm border border-[#27272a]"
                >
                  {numVal}
                </button>
              ))}
              <button 
                onClick={handleBackspace} 
                className="w-14 h-14 rounded-full bg-[#1c1c1e]/40 hover:bg-[#27272a] text-xs font-semibold text-slate-400 transition-all flex items-center justify-center mx-auto border border-[#27272a]/30"
              >
                {isRtl ? "حذف" : "DEL"}
              </button>
              <button
                onClick={() => handleCellClick("0")}
                className="w-14 h-14 rounded-full bg-[#1c1c1e] hover:bg-[#27272a] text-lg font-bold text-slate-250 transition-all flex items-center justify-center mx-auto border border-[#27272a]"
              >
                0
              </button>
              <button 
                onClick={verifyPasscode} 
                className="w-14 h-14 rounded-full bg-indigo-650 hover:bg-indigo-600 text-xs font-bold text-white transition-all flex items-center justify-center mx-auto shadow-md"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCESS DENIED ALERT MODAL */}
      {deniedTabModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="restricted_page_denied_modal">
          <div className="w-full max-w-sm bg-[#09090b] border border-[#27272a] shadow-2xl rounded-2xl p-6 relative overflow-hidden text-center" id="denied_card_container">
            <div className="absolute top-3 right-3">
              <button onClick={() => setDeniedTabModal(null)} className="text-slate-400 hover:text-white text-sm font-semibold p-1 cursor-pointer">✕</button>
            </div>

            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-rose-500 animate-pulse" />
            </div>

            <h2 className="text-base font-bold text-white mb-2">
              {lang === "ar" ? "الصفحة غير متاحة" : lang === "fr" ? "Page non disponible" : "Page Unavailable"}
            </h2>
            
            <p className="text-slate-300 text-xs my-4 leading-relaxed px-2 text-right dir-rtl">
              {lang === "ar" ? (
                <>
                  لا يمكن الدخول إلى هذه الصفحة <strong>({deniedTabModal.label})</strong>. هذه الصفحة غير متاحة في هذا الحساب، يرجى التواصل مع المدير لمنحك الوصول إليها.
                </>
              ) : lang === "fr" ? (
                <>
                  Vous ne pouvez pas accéder à cette page <strong>({deniedTabModal.label})</strong>. Cette page n'est pas disponible pour ce compte. Veuillez contacter le responsable pour obtenir l'accès.
                </>
              ) : (
                <>
                  You cannot access this page <strong>({deniedTabModal.label})</strong>. This page is not available for this account. Please contact the manager to grant you access.
                </>
              )}
            </p>

            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setDeniedTabModal(null)}
                className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
              >
                {lang === "ar" ? "حسناً، فهمت" : lang === "fr" ? "D'accord" : "Okay, Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
