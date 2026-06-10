/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  getBusinessProfile, saveBusinessProfile, getUserSession, saveUserSession,
  getOrders, saveOrders, getProducts, saveProducts, getBasicInventory, saveBasicInventory,
  getSubInventory, saveSubInventory, getReturnInventory, saveReturnInventory,
  getSuppliers, saveSuppliers, getSupplierInvoices, saveSupplierInvoices,
  getWorkers, saveWorkers, getTrashItems, saveTrashItems, initializeDatabase,
  deleteOrderSoft, deleteInvoiceSoft, deleteWorkerSoft, deleteProductSoft,
  restoreOrderSoft, restoreInvoiceSoft, restoreWorkerSoft, restoreProductSoft
} from "./storageUtils";
import { 
  BusinessProfile, Order, Product, BasicInventoryItem, SubInventoryItem, 
  ReturnInventoryItem, Supplier, SupplierInvoice, Worker, Expense, TrashItem 
} from "./types";
import { LanguageType, ThemeType, UserSession } from "./types";
import Auth from "./components/Auth";
import Onboarding from "./components/Onboarding";
import Sidebar from "./components/Sidebar";
import { Flag } from "./components/Flag";
import DashboardView from "./components/DashboardView";
import OrdersView from "./components/OrdersView";
import InventoryView from "./components/InventoryView";
import ProductsView from "./components/ProductsView";
import SuppliersView from "./components/SuppliersView";
import WorkersView from "./components/WorkersView";
import ExpensesView from "./components/ExpensesView";
import ProfitView from "./components/ProfitView";
import YearlyView from "./components/YearlyView";
import TrashView from "./components/TrashView";
import SettingsView from "./components/SettingsView";
import SuperAdminView from "./components/SuperAdminView";
import UsersPermissionsView from "./components/UsersPermissionsView";
import ActivityLogView from "./components/ActivityLogView";
import MyProfileView from "./components/MyProfileView";
import { CommunicationView } from "./components/CommunicationView";
import { logActivity } from "./activityLogService";
import { SaaSCompany } from "./types";
import { 
  getSyncSettings, pushRealOrdersToGoogleSheet, saveSimulationSheetData, 
  serializeOrderToRow, getDynamicOrderColumns, logSyncAudit 
} from "./googleSyncUtils";
import { AlertCircle, RotateCcw, X, BadgeAlert, Globe, Sun, Moon, Bell, Check, KeyRound, Shield, Loader2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { 
  fetchUserSaaSMeta, 
  saveOnboardingCompletionInCloud, 
  pushSingleDatasetToCloud, 
  pullMultiTenantData, 
  pushFullTenantData,
  cleanSlateResetSandbox
} from "./supabaseSync";

// =========================================================================
// AUTOMATIC SaaS TENANCY BINDING & SIGNUP ROUTING AGENT
// =========================================================================
export const registerSaaSCompanyOnLoginAndSignUp = (email: string, fullName: string) => {
  const stored = localStorage.getItem("corevia_saas_companies_v1");
  let list: SaaSCompany[] = [];
  try {
    if (stored) list = JSON.parse(stored);
  } catch (e) {
    list = [];
  }

  const exists = list.some(c => c.email.toLowerCase() === email.toLowerCase().trim());
  if (!exists) {
    // Generate a fresh 6-digit verification code OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const newCompany: SaaSCompany = {
      id: `cop-${Date.now()}`,
      companyName: `${fullName || email.split("@")[0]} Trading`,
      ownerName: fullName || email.split("@")[0],
      email: email.toLowerCase().trim(),
      phone: "+213 550 00 00 00",
      country: "Algeria",
      registrationDate: new Date().toISOString().split("T")[0],
      lastLogin: new Date().toISOString().replace("T", " ").substr(0, 16),
      emailVerified: false,
      subscriptionPlan: "Basic",
      seatsLimit: 5,
      seatsUsed: 1,
      accountStatus: "Pending Verification",
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      otpCode: otp,
      activeDevices: [
        { id: `dev-${Date.now()}-1`, browser: "Chrome", os: "Windows", activityType: "Desktop Session", lastActive: new Date().toISOString().replace("T", " ").substr(0, 16) }
      ]
    };
    list.push(newCompany);
    localStorage.setItem("corevia_saas_companies_v1", JSON.stringify(list));
    
    // Seed system registration log
    const storedLogs = localStorage.getItem("corevia_saas_activity_logs_v1");
    let logsList: any[] = [];
    try { if (storedLogs) logsList = JSON.parse(storedLogs); } catch (e) {}
    logsList.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      companyName: newCompany.companyName,
      email: email.toLowerCase().trim(),
      operation: "إنشاء حساب",
      details: `تم توفير ترخيص سحابي تلقائي لمدير جديد وبانتظار التحقق بكود OTP ذو 6 أرقام: ${otp}`,
      ipAddress: "197.200." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255)
    });
    localStorage.setItem("corevia_saas_activity_logs_v1", JSON.stringify(logsList));
  } else {
    // Sync login audit entry
    const matched = list.find(c => c.email.toLowerCase() === email.toLowerCase().trim());
    if (matched) {
      matched.lastLogin = new Date().toISOString().replace("T", " ").substr(0, 16);
      localStorage.setItem("corevia_saas_companies_v1", JSON.stringify(list));

      const storedLogs = localStorage.getItem("corevia_saas_activity_logs_v1");
      let logsList: any[] = [];
      try { if (storedLogs) logsList = JSON.parse(storedLogs); } catch (e) {}
      logsList.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        companyName: matched.companyName,
        email: email.toLowerCase().trim(),
        operation: "تسجيل دخول",
        details: `تسجيل دخول ناجح لنظام الإدارة السحابي`,
        ipAddress: "197.220." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255)
      });
      localStorage.setItem("corevia_saas_activity_logs_v1", JSON.stringify(logsList));
    }
  }
};

export default function App() {
  // Core Business Configurations
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isSyncingOnAuth, setIsSyncingOnAuth] = useState<boolean>(false);

  // ==========================================
  // MULTI-TENANT SaaS COMPLETED INTEGRATION
  // ==========================================
  const getSaaSAccountForSession = () => {
    if (!session || !session.email) return null;
    const stored = localStorage.getItem("corevia_saas_companies_v1");
    if (!stored) return null;
    try {
      const parsed: SaaSCompany[] = JSON.parse(stored);
      return parsed.find(c => c.email.toLowerCase() === session.email.toLowerCase()) || null;
    } catch (e) {
      return null;
    }
  };

  const saasAccount = getSaaSAccountForSession();
  const isReadOnly = saasAccount ? saasAccount.accountStatus === "Read Only" : false;
  const isSuspended = saasAccount ? saasAccount.accountStatus === "Suspended" : false;
  const isDisabled = saasAccount ? saasAccount.accountStatus === "Disabled" : false;
  const isPendingVerification = saasAccount ? saasAccount.accountStatus === "Pending Verification" : false;
  const seatsLimit = saasAccount ? saasAccount.seatsLimit : 9999;

  // OTP Validation code entry state
  const [typedOtpCode, setTypedOtpCode] = useState("");
  const [lang, setLangState] = useState<LanguageType>("ar");

  const setLang = (newLang: LanguageType) => {
    setLangState(newLang);
    const profObj = getBusinessProfile();
    if (profObj && profObj.businessName) {
      const updatedProfile = { ...profObj, defaultLanguage: newLang };
      setProfile(updatedProfile);
      saveBusinessProfile(updatedProfile);
    }
  };
  const [theme, setTheme] = useState<ThemeType>("dark");

  // State collections
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [basicInventory, setBasicInventory] = useState<BasicInventoryItem[]>([]);
  const [subInventory, setSubInventory] = useState<SubInventoryItem[]>([]);
  const [returnInventory, setReturnInventory] = useState<ReturnInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  // Custom visual colors choices
  const [customColorsList, setCustomColorsList] = useState<string[]>([]);

  // Security credentials challenges
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [unlockedTabs, setUnlockedTabs] = useState<string[]>([]);

  // Instant notification toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info">("success");

  // 5-second Undo state container
  const [undoTarget, setUndoTarget] = useState<{ trashId: string; title: string; type: string } | null>(null);

  // Custom styled confirmation dialog (replaces iframe-blocked window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null>(null);

  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // Unified Handler when Supabase session changes (Syncs, Caches, Seeds)
  const handleAuthSessionChange = async (supabaseSession: any) => {
    if (!supabaseSession?.user) return;
    const user = supabaseSession.user;
    setIsSyncingOnAuth(true);

    try {
      const userMeta = await fetchUserSaaSMeta(
        user.id,
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0] || "User"
      );

      const activeSession: UserSession = {
        username: userMeta.username,
        email: userMeta.email,
        isRegistered: true,
        isApproved: true,
        isSuspended: false,
        user_id: userMeta.userId,
        company_id: userMeta.companyId,
        role: userMeta.role
      };

      // Auto provision company details in local tenant log (skip for employees)
      if (userMeta.role !== "employee") {
        registerSaaSCompanyOnLoginAndSignUp(userMeta.email, userMeta.username);
      }

      // Save user session locally which patches the activeLocalStorage Multi-Tenant key immediately
      saveUserSession(activeSession);
      setSession(activeSession);

      if (userMeta.hasCompletedOnboarding) {
        // Download all cloud records instantly
        const pullSuccess = await pullMultiTenantData(userMeta.companyId);
        
        // Load the pulled values to memory
        const currentProfile = getBusinessProfile();
        setProfile(currentProfile);
        if (currentProfile) {
          setLangState(currentProfile.defaultLanguage || "ar");
          setTheme(currentProfile.preferredTheme || "dark");
        }
        setOrders(getOrders());
        setProducts(getProducts());
        setBasicInventory(getBasicInventory());
        setSubInventory(getSubInventory());
        setReturnInventory(getReturnInventory());
        setSuppliers(getSuppliers());
        setInvoices(getSupplierInvoices());
        setWorkers(getWorkers());
        
        const storedExp = localStorage.getItem("corevia_unified_expenses_v1");
        let parsedExpenses = [];
        try { if (storedExp) parsedExpenses = JSON.parse(storedExp); } catch(e){}
        setExpenses(parsedExpenses);
      } else {
        // Workspace onboarding questions required
        setProfile(null);
      }
    } catch (err) {
      console.error("Multi-tenant auth sync hook error:", err);
    } finally {
      setIsSyncingOnAuth(false);
    }
  };

  // 1. Core Supabase Session persistence and automatic session restoration
  useEffect(() => {
    if (supabase) {
      // Restore initial session in background safely
      supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
        if (currentSession) {
          handleAuthSessionChange(currentSession);
        } else {
          // If no cloud session, check cached storage
          const localSess = getUserSession();
          if (localSess && localSess.isRegistered && localSess.email) {
            setSession(localSess);
          }
        }
      });

      // Standard RLS/Auth channel listening
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (currentSession) {
            await handleAuthSessionChange(currentSession);
          }
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setProfile(null);
          localStorage.removeItem("corevia_session_v1");
          localStorage.removeItem("corevia_user_session_v1");
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Local Sandbox Fallback
      const localSess = getUserSession();
      if (localSess && localSess.isRegistered) {
        setSession(localSess);
      }
    }
  }, []);

  // Helper to load localized database and configuration records from local cache
  const loadStateFromLocal = () => {
    const profObj = getBusinessProfile();
    if (profObj && profObj.businessName) {
      setProfile(profObj);
      setLangState(profObj.defaultLanguage || "ar");
      setTheme(profObj.preferredTheme || "dark");
    }
    
    setOrders(getOrders());
    setProducts(getProducts());
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
    setReturnInventory(getReturnInventory());
    setSuppliers(getSuppliers());
    setInvoices(getSupplierInvoices());
    setWorkers(getWorkers());
    setTrashItems(getTrashItems());

    const storedExp = localStorage.getItem("corevia_unified_expenses_v1");
    let parsedExpenses = [];
    try { if (storedExp) parsedExpenses = JSON.parse(storedExp); } catch(e){}
    setExpenses(parsedExpenses);

    const storedColors = localStorage.getItem("corevia_custom_colors_v1");
    let parsedColors = [];
    try { if (storedColors) parsedColors = JSON.parse(storedColors); } catch(e){}
    setCustomColorsList(parsedColors.length ? parsedColors : [
      "Black (أسود)", "White (أبيض)", "Navy Blue (كحلي)", "Sage Green (أخضر زيتي)", 
      "Ruby Red (أحمر جوري)", "Carbon Gray (رمادي فاحم)"
    ]);
  };

  // 2. Local database loader triggered whenever active tenant session resolves
  useEffect(() => {
    // 1. Instantly load offline database cache so the app is immediately interactive for the user
    loadStateFromLocal();

    // 2. Hydrate from Cloud in background if there's an active SaaS company session
    if (session?.company_id && supabase) {
      const profObj = getBusinessProfile();
      const hasPreExistingData = !!(profObj && profObj.businessName);
      
      // Only show full screen loader if we have no local cache at all
      if (!hasPreExistingData) {
        setIsSyncingOnAuth(true);
      }

      pullMultiTenantData(session.company_id)
        .then((success) => {
          if (success) {
            console.log("Successfully hydrated multi-tenant workspace from the cloud.");
            // Hot reload the active records to React state
            loadStateFromLocal();
          }
        })
        .catch((e) => {
          console.warn("Could not sync cloud records on login:", e);
        })
        .finally(() => {
          setIsSyncingOnAuth(false);
        });
    }
  }, [session]);

  // Automated safety check: If an employee is logged in, and their activeTab is NOT in their allowedPages,
  // automatically redirect them to the first allowed page in their list.
  // This also prevents URL-based access bypass.
  useEffect(() => {
    if (session?.role === "employee") {
      if (!session.allowedPages || session.allowedPages.length === 0) {
        // No pages allowed at all - send to my-profile as minimum
        setActiveTab("my-profile");
        return;
      }
      // Always allow my-profile and communication for employees
      const alwaysAllowed = ["my-profile", "communication"];
      const effectiveAllowed = [...new Set([...session.allowedPages, ...alwaysAllowed])];
      
      if (!effectiveAllowed.includes(activeTab)) {
        const firstAllowed = effectiveAllowed[0];
        if (firstAllowed) {
          setActiveTab(firstAllowed);
        }
      }
      
      // Log access attempt to restricted page
      if (activeTab !== "dashboard" && activeTab !== "my-profile" && !session.allowedPages.includes(activeTab)) {
        console.warn(`[ACCESS GUARD] Employee tried to access restricted page: ${activeTab}`);
      }
    }
  }, [session, activeTab]);

  // Real-time Subscriptions for Multi-User Collaboration
  useEffect(() => {
    if (!supabase || !session?.company_id) return;

    let channels: any[] = [];

    const setupRealtime = () => {
      // Subscribe to orders changes
      const ordersChannel = supabase
        .channel(`orders-${session.company_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "corevia_orders",
            filter: `company_id=eq.${session.company_id}`
          },
          async () => {
            console.log("[REALTIME] Orders updated, refreshing...");
            const updatedOrders = getOrders();
            setOrders([...updatedOrders]);
          }
        )
        .subscribe();

      // Subscribe to products changes
      const productsChannel = supabase
        .channel(`products-${session.company_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "corevia_products",
            filter: `company_id=eq.${session.company_id}`
          },
          async () => {
            console.log("[REALTIME] Products updated, refreshing...");
            setProducts([...getProducts()]);
          }
        )
        .subscribe();

      // Subscribe to workers changes
      const workersChannel = supabase
        .channel(`workers-${session.company_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "corevia_workers",
            filter: `company_id=eq.${session.company_id}`
          },
          async () => {
            console.log("[REALTIME] Workers updated, refreshing...");
            setWorkers([...getWorkers()]);
          }
        )
        .subscribe();

      // Subscribe to company users changes (employees)
      const employeesChannel = supabase
        .channel(`employees-${session.company_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "corevia_company_users",
            filter: `company_id=eq.${session.company_id}`
          },
          async () => {
            console.log("[REALTIME] Employees updated, refreshing...");
          }
        )
        .subscribe();

      // Subscribe to employee submissions changes
      const submissionsChannel = supabase
        .channel(`submissions-${session.company_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "corevia_employee_submissions",
            filter: `company_id=eq.${session.company_id}`
          },
          async () => {
            console.log("[REALTIME] Employee submissions updated, refreshing...");
          }
        )
        .subscribe();

      channels = [ordersChannel, productsChannel, workersChannel, employeesChannel, submissionsChannel];
    };

    setupRealtime();

    return () => {
      channels.forEach(ch => {
        supabase.removeChannel(ch);
      });
    };
  }, [session?.company_id, supabase]);

  // Sync theme to root classList representation for elegant styling overlays
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.backgroundColor = "#09090b"; // Clean deep-slate/zinc dark backdrop
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = "#f4f4f5"; // Elegant soft warm-white backdrop for light mode
    }
  }, [theme]);

  const triggerToast = (msg: string, type: "success" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Onboarding Complete Callback
  const handleOnboardingComplete = async (newProfile: BusinessProfile) => {
    if (session && session.user_id && session.company_id) {
      await saveOnboardingCompletionInCloud(session.user_id, session.company_id, session.email, newProfile);
    }

    localStorage.setItem("corevia_profile_v1", JSON.stringify(newProfile));
    initializeDatabase(true, newProfile); // Initializing clean ERP workspace with user-provided settings
    
    // Sync states
    setProfile(newProfile);
    setLang(newProfile.defaultLanguage);
    setTheme(newProfile.preferredTheme);
    setOrders(getOrders());
    setProducts(getProducts());
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
    setReturnInventory(getReturnInventory());
    setSuppliers(getSuppliers());
    setInvoices(getSupplierInvoices());
    setWorkers(getWorkers());
    setTrashItems(getTrashItems());

    const defaults = [
      "Black (أسود)", "White (أبيض)", "Navy Blue (كحلي)", "Sage Green (أخضر زيتي)", 
      "Ruby Red (أحمر جوري)", "Carbon Gray (رمادي فاحم)"
    ];
    localStorage.setItem("corevia_custom_colors_v1", JSON.stringify(defaults));
    setCustomColorsList(defaults);

    // Initial silent synchronization of the empty tables structure to the tenant's database partition
    if (session && session.company_id) {
      pushFullTenantData(session.company_id, session.email).catch(err => {
        console.warn("Initial multi-tenant sync warning (ignorable if tables not present yet):", err);
      });
    }

    triggerToast(
      newProfile.defaultLanguage === "ar" 
        ? "مرحباً بك في Corevia! تم تهيئة مساحة العمل وحفظها سحابياً بنجاح." 
        : "Welcome to Corevia! Workspace initialized and backed up to cloud successfully.",
      "success"
    );
  };

  // Safe logout
  const handleLogout = async () => {
    if (session) {
      try {
        await logActivity({
          companyId: session.company_id,
          userName: session.username,
          userId: session.user_id,
          jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
          actionType: "Logout",
          pageName: "Authentication",
          affectedRecord: `User logged out`
        });
      } catch (err) {
        // ignore
      }
    }
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Supabase signOut error:", err);
      }
    }
    localStorage.removeItem("corevia_session_v1");
    localStorage.removeItem("corevia_user_session_v1"); // KEYS.SESSION
    setSession(null);
    setProfile(null);
    setActiveTab("dashboard");
    triggerToast(lang === "ar" ? "تم تسجيل الخروج بنجاح." : "Logged out successfully.", "success");
  };

  // Dynamic low stock alerts calculated live
  const dynamicAlerts = useMemo(() => {
    const alertsList: string[] = [];
    basicInventory.forEach(item => {
      if (item.quantity < 5) {
        alertsList.push(
          lang === "ar" 
            ? `مخزون أساسي ضعيف للموديل ${item.productName} (${item.color}) - الكمية: ${item.quantity} قطع`
            : `Low Basic stock: ${item.productName} (${item.color}) - Qty: ${item.quantity}`
        );
      }
    });

    subInventory.forEach(item => {
      if (item.quantity < 3) {
        alertsList.push(
          lang === "ar"
            ? `مخزون فرعي حرج: ${item.productName} / لون ${item.color} / مقاس ${item.size} (${item.quantity} قطع فقط!)`
            : `Sub stock warning: ${item.productName} [${item.color}-${item.size}] only ${item.quantity} available`
        );
      }
    });

    products.forEach(p => {
      const basicSum = basicInventory.filter(item => item.productId === p.id).reduce((sum, item) => sum + item.quantity, 0);
      const subSum = subInventory.filter(item => item.productId === p.id).reduce((sum, item) => sum + item.quantity, 0);
      const returnSum = returnInventory.filter(item => item.productName === p.name).reduce((sum, item) => sum + item.quantity, 0);
      const totalCombined = basicSum + subSum + returnSum;
      if (totalCombined < 10) {
        alertsList.push(
          lang === "ar"
            ? `⚠️ مخزون موحد حرج للموديل (${p.name})! الكمية المتبقية عبر كل الجداول: ${totalCombined} قطعة فقط`
            : `⚠️ Combined stock warning: Model (${p.name}) is low! Total remaining across all stores: ${totalCombined} units`
        );
      }
    });

    return alertsList;
  }, [basicInventory, subInventory, returnInventory, products, lang]);

  // AUTOMATIC OWNERSHIP AUDIT TRAILING FOR REAL WORKSPACE COLLABORATION
  const decorateWithAudit = <T extends { id: string, createdBy?: string, createdDate?: string, createdTime?: string, updatedBy?: string, updatedDate?: string, updatedTime?: string }>(
    newItems: T[],
    oldItems: T[]
  ): T[] => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const dateStr = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const currentDate = `${year}-${month}-${dateStr}`;
    const currentTime = `${hours}:${minutes}:${seconds}`;
    const currentUser = session 
      ? `${session.username} (${session.jobTitle || (session.role === "admin" ? "Owner" : "Employee")})`
      : (lang === "ar" ? "مالك الشركة (المالك)" : "Company Owner (Owner)");

    return newItems.map(item => {
      const oldItem = oldItems.find(o => o.id === item.id);
      if (!oldItem) {
        // Is newly created
        return {
          ...item,
          createdBy: item.createdBy || currentUser,
          createdDate: item.createdDate || currentDate,
          createdTime: item.createdTime || currentTime,
          updatedBy: currentUser,
          updatedDate: currentDate,
          updatedTime: currentTime
        };
      } else {
        // Is existing. Check if fields were actually modified
        const copyOld = { ...oldItem, updatedBy: undefined, updatedDate: undefined, updatedTime: undefined };
        const copyNew = { ...item, updatedBy: undefined, updatedDate: undefined, updatedTime: undefined };
        const hasChanged = JSON.stringify(copyOld) !== JSON.stringify(copyNew);
        if (hasChanged) {
          return {
            ...item,
            createdBy: oldItem.createdBy || item.createdBy || currentUser,
            createdDate: oldItem.createdDate || item.createdDate || currentDate,
            createdTime: oldItem.createdTime || item.createdTime || currentTime,
            updatedBy: currentUser,
            updatedDate: currentDate,
            updatedTime: currentTime
          };
        } else {
          return {
            ...oldItem,
            ...item,
            createdBy: oldItem.createdBy || item.createdBy || currentUser,
            createdDate: oldItem.createdDate || item.createdDate || currentDate,
            createdTime: oldItem.createdTime || item.createdTime || currentTime
          };
        }
      }
    });
  };

  // MUTATIONS SAVE CALLS IN UPPER APP ORCHESTRATOR
  const saveOrdersAndPersist = (newOrders: Order[]) => {
    if (isReadOnly) {
      triggerToast(lang === "ar" ? "عذراً، هذا الحساب في وضع القراءة فقط. يرجى تجديد أو ترقية باقة اشتراكك." : "Sorry, this account is Read-Only. Please upgrade or renew your subscription.", "info");
      return;
    }

    const oldOrders = getOrders();
    const audited = decorateWithAudit(newOrders, oldOrders);

    // Log Activity for Orders modification
    try {
      if (audited.length > oldOrders.length) {
        const added = audited.find(n => !oldOrders.some(o => o.id === n.id));
        if (session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Create Order",
            pageName: "Orders",
            affectedRecord: `Order ID: ${added?.id || "Bulk"}`
          });
        }
      } else if (audited.length === oldOrders.length) {
        const changed = audited.find(n => {
          const old = oldOrders.find(o => o.id === n.id);
          return old && JSON.stringify(old) !== JSON.stringify(n);
        });
        if (changed && session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Update Order",
            pageName: "Orders",
            affectedRecord: `Order ID: ${changed.id}, Customer: ${changed.customerName}`,
            previousValue: JSON.stringify(oldOrders.find(o => o.id === changed.id)),
            newValue: JSON.stringify(changed)
          });
        }
      }
    } catch(err) {
      console.warn("Activity log order modification error:", err);
    }

    setOrders(audited);
    saveOrders(audited);

    // Sync physical inventory immediately after order edits
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
    setReturnInventory(getReturnInventory());

    // Auto synchronise order edits directly to the Supabase cloud partition
    if (session && session.company_id) {
      pushSingleDatasetToCloud(session.company_id, "orders", audited);
    }

    // Instant Google Sheets Bidirectional Outbound Push
    try {
      const syncSett = getSyncSettings();
      if (!syncSett.isPaused) {
        if (syncSett.isSimulation) {
          const colSchema = getDynamicOrderColumns(audited);
          const blockRows = [colSchema];
          audited.forEach(ord => {
            blockRows.push(serializeOrderToRow(ord, colSchema));
          });
          saveSimulationSheetData(blockRows);
          logSyncAudit("Pushed order updates immediately to simulated Sheet.", "success", "Corevia App");
        } else if (syncSett.accessToken && syncSett.sheetId) {
          pushRealOrdersToGoogleSheet(syncSett.accessToken, syncSett.sheetId, audited)
            .then(() => {
              logSyncAudit("Pushed order mutations successfully to Google Sheets.", "success", "Corevia App");
            })
            .catch(err => {
              logSyncAudit(`Outbound sync failed: ${err.message}`, "error", "Corevia App");
            });
        }
      }
    } catch (err: any) {
      console.error("Outbound sync pipeline crashed", err);
    }
  };

  const saveProductsAndPersist = (newProducts: Product[]) => {
    if (isReadOnly) {
      triggerToast(lang === "ar" ? "عذراً، هذا الحساب في وضع القراءة فقط." : "Sorry, this account is in Read-Only mode.", "info");
      return;
    }

    const oldProducts = getProducts();
    const audited = decorateWithAudit(newProducts, oldProducts);

    // Log Activity for products modifications
    try {
      if (audited.length > oldProducts.length) {
        const added = audited.find(n => !oldProducts.some(p => p.id === n.id));
        if (session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Create Product",
            pageName: "Products",
            affectedRecord: `Product Name: ${added?.name || "Bulk"}`
          });
        }
      } else if (audited.length === oldProducts.length) {
        const changed = audited.find(n => {
          const old = oldProducts.find(p => p.id === n.id);
          return old && JSON.stringify(old) !== JSON.stringify(n);
        });
        if (changed && session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Update Product",
            pageName: "Products",
            affectedRecord: `Product Name: ${changed.name}`,
            previousValue: JSON.stringify(oldProducts.find(p => p.id === changed.id)),
            newValue: JSON.stringify(changed)
          });
        }
      }
    } catch(err) {
      console.warn("Product activity logging warning:", err);
    }

    setProducts(audited);
    saveProducts(audited);
    // Automatic stockpiles feedback
    setBasicInventory(getBasicInventory());

    if (session && session.company_id) {
      pushSingleDatasetToCloud(session.company_id, "products", audited);
    }
  };

  const saveSuppliersAndPersist = (newSuppliers: Supplier[]) => {
    if (isReadOnly) {
      triggerToast(lang === "ar" ? "عذراً، هذا الحساب في وضع القراءة فقط." : "Sorry, this account is in Read-Only mode.", "info");
      return;
    }
    const oldSuppliers = getSuppliers();
    const audited = decorateWithAudit(newSuppliers, oldSuppliers);

    setSuppliers(audited);
    saveSuppliers(audited);

    if (session && session.company_id) {
      pushSingleDatasetToCloud(session.company_id, "suppliers", audited);
    }
  };

  const saveInvoicesAndPersist = (newInvoices: SupplierInvoice[]) => {
    if (isReadOnly) {
      triggerToast(lang === "ar" ? "عذراً، هذا الحساب في وضع القراءة فقط." : "Sorry, this account is in Read-Only mode.", "info");
      return;
    }

    const oldInvoices = getSupplierInvoices();
    const audited = decorateWithAudit(newInvoices, oldInvoices);

    // Log Activity for Invoice uploads/mutations
    try {
      if (audited.length > oldInvoices.length) {
        const added = audited.find(n => !oldInvoices.some(i => i.id === n.id));
        if (session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Create Invoice",
            pageName: "Suppliers",
            affectedRecord: `Invoice Ref: ${added?.id || "Bulk"}`
          });
        }
      } else if (audited.length === oldInvoices.length) {
        const changed = audited.find(n => {
          const old = oldInvoices.find(i => i.id === n.id);
          return old && JSON.stringify(old) !== JSON.stringify(n);
        });
        if (changed && session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Update Invoice",
            pageName: "Suppliers",
            affectedRecord: `Invoice ID: ${changed.id}, Supplier: ${changed.supplierName}`,
            previousValue: JSON.stringify(oldInvoices.find(i => i.id === changed.id)),
            newValue: JSON.stringify(changed)
          });
        }
      }
    } catch(err) {
      console.warn("Invoice activity logging warning:", err);
    }

    setInvoices(audited);
    saveSupplierInvoices(audited);
    
    // Sync stocks
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
  };

  const saveWorkersAndPersist = (newWorkers: Worker[]) => {
    if (isReadOnly) {
      triggerToast(lang === "ar" ? "عذراً، هذا الحساب في وضع القراءة فقط." : "Sorry, this account is in Read-Only mode.", "info");
      return;
    }

    // enforces Seat Limits constraints
    const uniqueWorkerCodes = new Set(newWorkers.map(w => w.code));
    const currentUniqueCodes = new Set(workers.map(w => w.code));
    if (uniqueWorkerCodes.size > currentUniqueCodes.size && uniqueWorkerCodes.size > seatsLimit) {
      triggerToast(
        lang === "ar" 
          ? `عذراً! تم الوصول للحد الأقصى للمقاعد المسموحة مسبقاً (${seatsLimit} مقعد) الموظفين.` 
          : `Sorry! Maximum seats limit (${seatsLimit}) reached for your subscription.`, 
        "info"
      );
      return;
    }

    const oldWorkers = getWorkers();
    const audited = decorateWithAudit(newWorkers, oldWorkers);

    setWorkers(audited);
    saveWorkers(audited);

    if (session && session.company_id) {
      pushSingleDatasetToCloud(session.company_id, "workers", audited);
    }
  };

  const saveExpensesAndPersist = (newExpenses: Expense[]) => {
    if (isReadOnly) {
      triggerToast(lang === "ar" ? "عذراً، هذا الحساب في وضع القراءة فقط." : "Sorry, this account is in Read-Only mode.", "info");
      return;
    }

    const oldExpenses = expenses;
    const audited = decorateWithAudit(newExpenses, oldExpenses);

    // Log Activity for Expense creation/modification
    try {
      if (audited.length > oldExpenses.length) {
        const added = audited.find(n => !oldExpenses.some(x => x.id === n.id));
        if (session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Create Expense",
            pageName: "Expenses",
            affectedRecord: `Expense: ${added?.title || added?.type || "Unknown"}`
          });
        }
      } else if (audited.length === oldExpenses.length) {
        const changed = audited.find(n => {
          const old = oldExpenses.find(x => x.id === n.id);
          return old && JSON.stringify(old) !== JSON.stringify(n);
        });
        if (changed && session) {
          logActivity({
            companyId: session.company_id,
            userName: session.username,
            userId: session.user_id,
            jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
            actionType: "Update Expense",
            pageName: "Expenses",
            affectedRecord: `Expense: ${changed.title || changed.type}`,
            previousValue: JSON.stringify(oldExpenses.find(x => x.id === changed.id)),
            newValue: JSON.stringify(changed)
          });
        }
      }
    } catch(err) {
      console.warn("Expense activity logging warning:", err);
    }

    setExpenses(audited);
    localStorage.setItem("corevia_unified_expenses_v1", JSON.stringify(audited));

    if (session && session.company_id) {
      pushSingleDatasetToCloud(session.company_id, "expenses", audited);
    }
  };

  const saveProfileAndPersist = (newProf: BusinessProfile) => {
    setProfile(newProf);
    saveBusinessProfile(newProf);

    if (session && session.user_id && session.company_id) {
      saveOnboardingCompletionInCloud(session.user_id, session.company_id, session.email, newProf);
    }
  };

  const saveCustomColorsAndPersist = (newColors: string[]) => {
    setCustomColorsList(newColors);
    localStorage.setItem("corevia_custom_colors_v1", JSON.stringify(newColors));
  };

  // SOFT DELETION WRAPPING FOR 5-SECOND UNDO IMPLEMENTATION
  const handleSoftDeleteOrder = (orderId: string) => {
    if (session) {
      logActivity({
        companyId: session.company_id,
        userName: session.username,
        userId: session.user_id,
        jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
        actionType: "Delete Order",
        pageName: "Orders",
        affectedRecord: `Order ID: ${orderId}`
      }).catch(() => {});
    }

    deleteOrderSoft(orderId);
    setOrders(getOrders());
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
    setReturnInventory(getReturnInventory());
    
    const updatedTrash = getTrashItems();
    setTrashItems(updatedTrash);

    // Push to undo target
    const addedTrash = updatedTrash[updatedTrash.length - 1];
    if (addedTrash) {
      setUndoTarget({ trashId: addedTrash.id, title: addedTrash.title, type: "order" });
      setTimeout(() => {
        setUndoTarget(current => current?.trashId === addedTrash.id ? null : current);
      }, 5000);
    }
    triggerToast("تم نقل الطلبية بنجاح لسلة الحذف.", "info");
  };

  const handleSoftDeleteProduct = (pid: string) => {
    if (session) {
      logActivity({
        companyId: session.company_id,
        userName: session.username,
        userId: session.user_id,
        jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
        actionType: "Delete Product",
        pageName: "Products",
        affectedRecord: `Product ID: ${pid}`
      }).catch(() => {});
    }

    deleteProductSoft(pid);
    setProducts(getProducts());
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
    
    const updatedTrash = getTrashItems();
    setTrashItems(updatedTrash);

    const addedTrash = updatedTrash[updatedTrash.length - 1];
    if (addedTrash) {
      setUndoTarget({ trashId: addedTrash.id, title: addedTrash.title, type: "product" });
      setTimeout(() => {
        setUndoTarget(current => current?.trashId === addedTrash.id ? null : current);
      }, 5000);
    }
    triggerToast("تم نقل المنتج من الدليل لسلة الحذف.", "info");
  };

  const handleSoftDeleteInvoice = (invId: string) => {
    if (session) {
      logActivity({
        companyId: session.company_id,
        userName: session.username,
        userId: session.user_id,
        jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
        actionType: "Delete Invoice",
        pageName: "Suppliers",
        affectedRecord: `Invoice ID: ${invId}`
      }).catch(() => {});
    }

    deleteInvoiceSoft(invId);
    setInvoices(getSupplierInvoices());
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
    
    const updatedTrash = getTrashItems();
    setTrashItems(updatedTrash);

    const addedTrash = updatedTrash[updatedTrash.length - 1];
    if (addedTrash) {
      setUndoTarget({ trashId: addedTrash.id, title: addedTrash.title, type: "invoice" });
      setTimeout(() => {
        setUndoTarget(current => current?.trashId === addedTrash.id ? null : current);
      }, 5000);
    }
    triggerToast("تم نقل الفاتورة وإلغاء أرصدة تمديد مخزونها.", "info");
  };

  const handleSoftDeleteWorker = (wId: string) => {
    if (session) {
      logActivity({
        companyId: session.company_id,
        userName: session.username,
        userId: session.user_id,
        jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
        actionType: "Delete User",
        pageName: "Workers",
        affectedRecord: `Worker ID: ${wId}`
      }).catch(() => {});
    }

    deleteWorkerSoft(wId);
    setWorkers(getWorkers());
    
    const updatedTrash = getTrashItems();
    setTrashItems(updatedTrash);

    const addedTrash = updatedTrash[updatedTrash.length - 1];
    if (addedTrash) {
      setUndoTarget({ trashId: addedTrash.id, title: addedTrash.title, type: "worker" });
      setTimeout(() => {
        setUndoTarget(current => current?.trashId === addedTrash.id ? null : current);
      }, 5000);
    }
    triggerToast("تم نقل ملف الموظف وأجور رواتبه لسلة الحذف.", "info");
  };

  const handleSoftDeleteExpense = (expId: string) => {
    if (session) {
      logActivity({
        companyId: session.company_id,
        userName: session.username,
        userId: session.user_id,
        jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
        actionType: "Delete Expense",
        pageName: "Expenses",
        affectedRecord: `Expense ID: ${expId}`
      }).catch(() => {});
    }

    const updated = expenses.filter(x => x.id !== expId);
    saveExpensesAndPersist(updated);
    triggerToast("تم إلغاء بند الصرف المالي بنجاح.", "info");
  };

  // RESTORATION TRIGGERS
  const handleRestoreItem = (trashId: string) => {
    const trash = getTrashItems();
    const item = trash.find(x => x.id === trashId);
    if (!item) return;

    if (item.type === "order") {
      restoreOrderSoft(item.originalData);
      setOrders(getOrders());
      setBasicInventory(getBasicInventory());
      setSubInventory(getSubInventory());
      setReturnInventory(getReturnInventory());
    } else if (item.type === "product") {
      restoreProductSoft(item.originalData);
      setProducts(getProducts());
      setBasicInventory(getBasicInventory());
    } else if (item.type === "invoice") {
      restoreInvoiceSoft(item.originalData);
      setInvoices(getSupplierInvoices());
      setBasicInventory(getBasicInventory());
      setSubInventory(getSubInventory());
    } else if (item.type === "worker") {
      restoreWorkerSoft(item.originalData);
      setWorkers(getWorkers());
    }

    const filtered = trash.filter(x => x.id !== trashId);
    saveTrashItems(filtered);
    setTrashItems(filtered);
    
    triggerToast("تم إرجاع واسترجاع العنصر الملغى كلياً وإدراج أرصدته.", "success");
  };

  const handleClearTrashAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: lang === "ar" ? "تفريغ سلة المحذوفات" : lang === "fr" ? "Vider la corbeille" : "Clear Trash",
      description: lang === "ar"
        ? "هل أنت متأكد من تفريغ سلة المحذوفات بالكامل وبشكل قطعي نهائي؟ لا يمكن استرجاع هذه البيانات."
        : lang === "fr"
          ? "Êtes-vous sûr de vouloir vider l'intégralité de la corbeille définitivement ?"
          : "Are you sure you want to permanently empty the trash bin? This cannot be undone.",
      confirmText: lang === "ar" ? "تفريغ الآن" : lang === "fr" ? "Vider" : "Purge Now",
      cancelText: lang === "ar" ? "إلغاء الأمر" : lang === "fr" ? "Annuler" : "Cancel",
      onConfirm: () => {
        saveTrashItems([]);
        setTrashItems([]);
        setConfirmDialog(null);
        triggerToast(lang === "ar" ? "تم تفريغ سلة المحذوفات بالكامل." : "Trash cleared successfully.", "success");
      }
    });
  };

  // Toggle theme callback
  const handleToggleTheme = () => {
    setTheme(current => current === "light" ? "dark" : "light");
  };

  // Clear unread alerts
  const handleClearNotifications = () => {
    // For demo simplicity, clear them temporarily
    triggerToast("تم تحييد الإشعارات السريعة الميدانية.");
  };

  // Render premium cloud sync indicator during authentication and tenant pull cycles
  if (isSyncingOnAuth) {
    const isRtl = lang === "ar";
    return (
      <div className="fixed inset-0 bg-[#09090b] flex flex-col items-center justify-center z-[9999] p-4 transition-colors" id="cloud_sync_overlay">
        <div className="flex flex-col items-center max-w-sm text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center shadow-2xl animate-spin">
            <Loader2 className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white text-lg font-bold tracking-tight font-sans">
              {isRtl ? "تأصيل حساب الإدارة السحابية" : "Synchronizing Cloud SaaS Workspace"}
            </h3>
            <p className="text-slate-400 text-xs font-sans max-w-xs leading-normal">
              {isRtl 
                ? "جاري تحضير واستيراد البيانات المعزولة وتأكيد الهوية..."
                : "Downloading and parsing secure multi-tenant datasets..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is not logged in / approved / or is suspended, render the Auth gateway
  if (!session || !session.isRegistered || !session.isApproved || session.isSuspended) {
    return (
      <Auth
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        onAuthSuccess={(newSession) => {
          setSession(newSession);
          saveUserSession(newSession);
          
          // Auto sync tenant list on login or sign-up (skip for employees)
          if (newSession && newSession.email && newSession.role !== "employee") {
            registerSaaSCompanyOnLoginAndSignUp(newSession.email, newSession.username || newSession.email.split("@")[0]);
          }
          
          // Cleanup: remove any accidental SaaS entries created for employees
          if (newSession && newSession.role === "employee" && newSession.email) {
            try {
              const stored = localStorage.getItem("corevia_saas_companies_v1");
              if (stored) {
                const list = JSON.parse(stored);
                const filtered = list.filter((c: any) => c.email?.toLowerCase() !== newSession.email?.toLowerCase());
                if (filtered.length !== list.length) {
                  localStorage.setItem("corevia_saas_companies_v1", JSON.stringify(filtered));
                }
              }
            } catch (e) {}
          }
        }}
        onTriggerNotification={triggerToast}
      />
    );
  }

  // If onboarding is not completed, we display Onboarding screen with the global topbar controls (employees bypass this setup completely)
  if ((!profile || !profile.businessName) && session?.role !== "employee") {
    const isRtl = lang === "ar";
    return (
      <div className="min-h-screen pt-20 flex flex-col items-center justify-center p-4 bg-slate-950 dark:bg-slate-950 font-sans leading-relaxed text-right transition-colors" id="onboarding_wrapper_layout">
        
        {/* GLOBAL HEADER & TOPBAR FOR ONBOARDING VIEW */}
        <header className={`h-16 bg-[#09090b]/80 backdrop-blur-md border-b border-[#27272a] flex items-center justify-between px-4 z-30 fixed top-0 left-0 right-0 w-full ${
          isRtl ? "flex-row-reverse" : "flex-row"
        }`} id="global_topbar">
          {/* Left/Right side Brand visual */}
          <div className="flex items-center gap-3" id="topbar_left">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white animate-pulse">
              C
            </div>
            <span className="text-white text-sm font-bold truncate">Corevia ERP</span>
          </div>

          {/* Right/Left side options: language switchers, alerts and theme */}
          <div className="flex items-center gap-2 sm:gap-2.5" id="topbar_right_instruments">
            
            {/* Quick Config Pills Deck (Side-by-side theme + language selector) */}
            <div className="flex items-center bg-[#18181b] dark:bg-[#121214] border border-[#27272a] rounded-xl p-0.5 gap-1.2" id="header_control_dock">
              
              {/* Light/Dark Toggle */}
              <button 
                onClick={handleToggleTheme}
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
                  <span className="text-[11px] flex items-center gap-1.5">
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

            {/* Alarm Bell Notifications Panel (Simple interactive setup for Onboarding) */}
            <div className="relative">
              <button 
                onClick={() => triggerToast(lang === "ar" ? "مرحباً بك في Corevia! يرجى إتمام إعداد الحساب أولاً." : "Welcome to Corevia! Please configure company details first.")}
                className="p-2 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl transition-all border border-slate-700/20 relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              </button>
            </div>
          </div>
        </header>

        <Onboarding 
          onComplete={handleOnboardingComplete} 
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          session={session}
        />
      </div>
    );
  }

  // ==========================================
  // LANDING GATES: SaaS SUBSCRIPTION STATUSES
  // ==========================================

  // GATE I: DISABLED TENANT BLOCKADE (skip for employees)
  if (isDisabled && session?.role !== "employee") {
    const isRtl = lang === "ar";
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-right font-sans animate-fade-in" id="saas_gate_disabled">
        <div className="w-full max-w-md bg-[#121214] border border-rose-500/20 rounded-2xl p-6 space-y-4 shadow-xl">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
          <h2 className="text-xl font-black text-white">{isRtl ? "الحساب معطل بالكامل" : "Account Suspended / Disabled"}</h2>
          <p className="text-xs text-slate-400">
            {isRtl 
              ? "تم إيقاف صلاحية هذا الحساب بالكامل من قبل إدارة المنصة لإخلال بشروط الخدمة أو فواتير مستحقة. يرجى التواصل مع فريق الدعم الفني."
              : "This account has been fully deactivated by the system administrator due to billing issues or compliance flags. Please contact support."}
          </p>
          <div className="pt-4 flex gap-2">
            <button
              onClick={() => {
                setSession(null);
                saveUserSession(null as any);
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-xs font-bold text-slate-200 rounded-xl cursor-pointer"
            >
              {isRtl ? "خروج وحساب آخر" : "Switch Account"}
            </button>
            <a
              href="mailto:support@corevia.dz"
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl block cursor-pointer text-center"
            >
              {isRtl ? "مراسلة الدعم" : "Contact Support"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // GATE II: SUSPENDED/FROZEN TENANT BLOCKADE (skip for employees)
  if (isSuspended && session?.role !== "employee") {
    const isRtl = lang === "ar";
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-right font-sans animate-fade-in" id="saas_gate_suspended">
        <div className="w-full max-w-md bg-[#121214] border border-rose-500/20 rounded-2xl p-6 space-y-4 shadow-xl">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
          <h2 className="text-xl font-black text-white">{isRtl ? "عذراً! الحساب مجمد مؤقتاً" : "Subscription Locked"}</h2>
          <p className="text-xs text-slate-400">
            {isRtl 
              ? "تم تجميد اشتراك هذه المؤسسة مؤقتاً لعدم دفع الفاتورة الشهرية. يرجى مراجعة إدارة وهران أو تفعيل كود سداد لتنشيط النظام فوراً."
              : "Your company subscription has been frozen due to a recurring payment failure. Access has been temporarily restricted."}
          </p>
          <div className="pt-4 flex gap-2">
            <button
              onClick={() => {
                setSession(null);
                saveUserSession(null as any);
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-xs font-bold text-slate-200 rounded-xl cursor-pointer"
            >
              {isRtl ? "تسجيل الخروج" : "Switch Account"}
            </button>
            <a
              href="mailto:billing@corevia.dz"
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl block cursor-pointer text-center"
            >
              {isRtl ? "تفاصيل الفوترة" : "Billing Details"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // GATE III: PENDING EMAIL VERIFICATION (OTP SCREEN) (skip for employees)
  if (isPendingVerification && saasAccount && session?.role !== "employee") {
    const isRtl = lang === "ar";
    
    const handleVerifyOtpSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (typedOtpCode.trim() === saasAccount.otpCode) {
        const stored = localStorage.getItem("corevia_saas_companies_v1");
        if (stored) {
          try {
            const list: SaaSCompany[] = JSON.parse(stored);
            const idx = list.findIndex(c => c.id === saasAccount.id);
            if (idx !== -1) {
              list[idx].accountStatus = "Active";
              list[idx].emailVerified = true;
              localStorage.setItem("corevia_saas_companies_v1", JSON.stringify(list));
              
              // Log otp success activation
              const storedLogs = localStorage.getItem("corevia_saas_activity_logs_v1");
              let logsList: any[] = [];
              try { if (storedLogs) logsList = JSON.parse(storedLogs); } catch (e) {}
              logsList.unshift({
                id: `log-${Date.now()}`,
                timestamp: new Date().toISOString(),
                companyName: saasAccount.companyName,
                email: saasAccount.email,
                operation: "تفعيل بريد",
                details: `تم تفعيل وتوثيق الحساب بنجاح من المالك بإدخال رمز OTP الصحيح الميداني: ${saasAccount.otpCode}`,
                ipAddress: "197.200." + Math.floor(Math.random() * 255) + "." + Math.floor(Math.random() * 255)
              });
              localStorage.setItem("corevia_saas_activity_logs_v1", JSON.stringify(logsList));
            }
          } catch (e) {}
        }
        triggerToast(isRtl ? "تم تفويض وتفعيل حسابك بنجاح!" : "Authorized and activated successfully!", "success");
        setTypedOtpCode("");
        // Force session refresh
        setSession({ ...session!, isApproved: true });
      } else {
        triggerToast(isRtl ? "رمز التحقق OTP خاطئ، يرجى المحاولة مرة أخرى." : "Invalid OTP verification code.", "info");
      }
    };

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-right font-sans animate-fade-in" id="saas_gate_verification">
        
        {/* Cheat indicator for preview convenience */}
        <div className="absolute top-4 inset-x-4 max-w-sm mx-auto p-3 bg-indigo-950 border border-indigo-900 rounded-xl text-center space-y-1">
          <span className="text-[10px] text-indigo-400 font-bold block">🔐 SIMULATED OTP MAILBOX HINT</span>
          <span className="text-xs text-white">Your OTP verification code: <strong className="text-amber-450 px-1.5 py-0.5 bg-black rounded font-mono text-sm">{saasAccount.otpCode}</strong></span>
        </div>

        <div className="w-full max-w-md bg-[#121214] border border-indigo-500/20 rounded-2xl p-6 space-y-5 shadow-xl">
          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8 animate-pulse" />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">{isRtl ? "تفعيل حسابك بالبريد الإلكتروني" : "Verify Corporate Account"}</h2>
            <p className="text-xs text-slate-400">
              {isRtl 
                ? "لقد أرسلنا رمز تحقق (OTP) مكوناً من 6 أرقام إلى بريدك المعتمد. يرجى كتابته بالأسفل للتفعيل وتلقي رخصة ERP للعمل."
                : "Enter the simulated 6-digit confirmation key deployed to your mailbox credentials to activate your subscription ledger."}
            </p>
          </div>

          <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
            <input
              type="text"
              required
              maxLength={6}
              placeholder="0 0 0 0 0 0"
              value={typedOtpCode}
              onChange={(e) => setTypedOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-full p-3 bg-slate-900 border border-slate-800 text-center tracking-[0.5em] font-mono text-lg text-white rounded-xl placeholder-slate-750 outline-none focus:border-indigo-600 transition-colors"
            />
            
            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 text-xs font-extrabold text-white rounded-xl shadow-lg shadow-indigo-505/10 transition-colors cursor-pointer"
            >
              {isRtl ? "تفعيل وتأكيد الحساب" : "Confirm and Activate"}
            </button>
          </form>

          <div className="pt-2">
            <button
              onClick={() => {
                setSession(null);
                saveUserSession(null as any);
              }}
              className="text-xs text-slate-500 hover:text-white underline cursor-pointer"
            >
              {isRtl ? "تسجيل الخروج وحساب آخر" : "Log out and switch tenant"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const logInventoryAdjustment = (type: string) => {
    if (session) {
      logActivity({
        companyId: session.company_id,
        userName: session.username,
        userId: session.user_id,
        jobTitle: session.jobTitle || (session.role === "admin" ? "Admin" : "Employee"),
        actionType: "Inventory Adjustments",
        pageName: "Inventory",
        affectedRecord: `Stock adjusted: ${type}`
      }).catch((e) => console.warn("Log stock error:", e));
    }
  };

  const activeProfile = profile || {
    businessName: "Corevia",
    businessType: "تجارة إلكترونية",
    currency: "DZD",
    country: "Algeria",
    passcode: "1234",
    ownerName: "",
    phone: "",
    email: "",
    address: ""
  };

  return (
    <div className={`min-h-screen text-slate-100 transition-colors flex ${lang === "ar" ? "flex-row-reverse" : "flex-row"}`} id="applet_main_scaffold">
      
      {/* SIDEBAR NAVIGATION DOCK */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
        theme={theme}
        toggleTheme={handleToggleTheme}
        profile={activeProfile}
        passcode={activeProfile.passcode || "1234"}
        isLocked={isLocked}
        unlockedTabs={unlockedTabs}
        onUnlockTab={(tab) => setUnlockedTabs(prev => [...prev, tab])}
        onLogout={handleLogout}
        notifications={dynamicAlerts}
        clearNotifications={handleClearNotifications}
        session={session}
      />

      {/* CORE WORKSPACE VIEWPORT */}
      <main className={`flex-1 min-h-screen p-4 sm:p-6 md:p-8 pt-20 md:pt-24 overflow-y-auto pb-24 md:pb-12 text-right  ${
        lang === "ar" ? "md:mr-64 md:ml-0" : "md:ml-64 md:mr-0"
      }`} id="primary_view_canvas">
        
        {/* Render Tab Screens */}
        {activeTab === "dashboard" && (
          <DashboardView 
            orders={orders} 
            products={products} 
            lang={lang} 
          />
        )}

        {activeTab === "orders" && (
          <OrdersView
            orders={orders}
            onSaveOrders={saveOrdersAndPersist}
            products={products}
            basicInventory={basicInventory}
            subInventory={subInventory}
            returnInventory={returnInventory}
            lang={lang}
            businessName={activeProfile.businessName}
            profile={activeProfile}
            onSoftDelete={handleSoftDeleteOrder}
            onTriggerNotification={triggerToast}
          />
        )}

        {activeTab === "inventory" && (
          <InventoryView
            basicInventory={basicInventory}
            subInventory={subInventory}
            returnInventory={returnInventory}
            onSaveBasic={(arr) => { setBasicInventory(arr); saveBasicInventory(arr); logInventoryAdjustment("Basic Stock"); }}
            onSaveSub={(arr) => { setSubInventory(arr); saveSubInventory(arr); logInventoryAdjustment("Sub Stock"); }}
            onSaveReturn={(arr) => { setReturnInventory(arr); saveReturnInventory(arr); logInventoryAdjustment("Returned Stock"); }}
            products={products}
            lang={lang}
            onSoftDeleteProduct={handleSoftDeleteProduct}
          />
        )}

        {activeTab === "products" && (
          <ProductsView
            products={products}
            onSaveProducts={saveProductsAndPersist}
            lang={lang}
            customColorsList={customColorsList}
            onSoftDeleteProduct={handleSoftDeleteProduct}
            onTriggerNotification={triggerToast}
            suppliers={suppliers}
            onSaveSuppliers={saveSuppliersAndPersist}
            invoices={invoices}
            onSaveInvoices={saveInvoicesAndPersist}
            basicInventory={basicInventory}
            onSaveBasic={(arr) => { setBasicInventory(arr); saveBasicInventory(arr); }}
            subInventory={subInventory}
            onSaveSub={(arr) => { setSubInventory(arr); saveSubInventory(arr); }}
            onSoftDeleteInvoice={handleSoftDeleteInvoice}
          />
        )}

        {activeTab === "suppliers" && (
          <SuppliersView
            suppliers={suppliers}
            onSaveSuppliers={saveSuppliersAndPersist}
            invoices={invoices}
            onSaveInvoices={saveInvoicesAndPersist}
            products={products}
            lang={lang}
            onSoftDeleteInvoice={handleSoftDeleteInvoice}
            onTriggerNotification={triggerToast}
          />
        )}

        {activeTab === "workers" && (
          <WorkersView
            workers={workers}
            onSaveWorkers={saveWorkersAndPersist}
            lang={lang}
            onSoftDeleteWorker={handleSoftDeleteWorker}
            onTriggerNotification={triggerToast}
            orders={orders}
            onSectionChange={setActiveTab}
            session={session}
          />
        )}

        {activeTab === "expenses" && (
          <ExpensesView
            expenses={expenses}
            onSaveExpenses={saveExpensesAndPersist}
            lang={lang}
            onSoftDeleteExpense={handleSoftDeleteExpense}
            onTriggerNotification={triggerToast}
            onSectionChange={setActiveTab}
          />
        )}

        {activeTab === "profit" && (
          <ProfitView
            orders={orders}
            expenses={expenses}
            workers={workers}
            lang={lang}
            products={products}
            basicInventory={basicInventory}
            subInventory={subInventory}
            returnInventory={returnInventory}
          />
        )}

        {activeTab === "yearly" && (
          <YearlyView
            orders={orders}
            expenses={expenses}
            workers={workers}
            lang={lang}
          />
        )}

        {activeTab === "trash" && (
          <TrashView
            trashItems={trashItems}
            onRestoreItem={handleRestoreItem}
            onClearTrashAll={handleClearTrashAll}
            lang={lang}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            profile={profile}
            onSaveProfile={saveProfileAndPersist}
            lang={lang}
            customColorsList={customColorsList}
            onSaveCustomColors={saveCustomColorsAndPersist}
            onTriggerNotification={triggerToast}
            onTriggerRefreshOrders={() => setOrders(getOrders())}
            session={session}
            seatsLimit={seatsLimit}
          />
        )}

        {activeTab === "users-permissions" && (
          <UsersPermissionsView
            lang={lang}
            session={session}
            onTriggerNotification={triggerToast}
            seatsLimit={seatsLimit}
          />
        )}

        {activeTab === "activity-log" && (
          <ActivityLogView
            lang={lang}
            session={session}
            onTriggerNotification={triggerToast}
          />
        )}

        {activeTab === "communication" && (
          <CommunicationView
            session={session}
            lang={lang}
            onTriggerNotification={triggerToast}
          />
        )}

        {activeTab === "my-profile" && (
          <MyProfileView
            session={session}
            lang={lang}
            onTriggerNotification={triggerToast}
            companyInfo={{
              name: activeProfile.businessName,
              phone: activeProfile.phone,
              email: activeProfile.email,
              address: activeProfile.address
            }}
          />
        )}

        {activeTab === "super-admin" && (
          <SuperAdminView
            lang={lang}
            onTriggerNotification={triggerToast}
            onLogout={handleLogout}
            session={session}
            profile={profile}
            onCleanSlate={async () => {
              if (session && session.user_id && session.company_id) {
                await cleanSlateResetSandbox(session.user_id, session.company_id, session.email);
              }
            }}
          />
        )}

      </main>

      {/* FLOATING ACTION INTERACTIVE UNDO BAR (5-SECOND EXPIRATION TIME) */}
      {undoTarget && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 p-1 px-4 bg-slate-900 border-2 border-emerald-500/50 shadow-2xl rounded-2xl flex items-center gap-3 text-right max-w-sm w-[90%] ltr animate-bounce" id="floating_undo_banner">
          <div className="flex-1 text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-bold text-center">أمن التراجع الخطأ (5 ثوانٍ)</span>
            <span className="text-xs font-bold text-slate-200 block truncate text-center">{undoTarget.title}</span>
          </div>
          <button
            onClick={triggerUndoAction}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تراجع الآن (Undo)</span>
          </button>
        </div>
      )}

      {/* STATIC TOAST ALERTS OVERLAYS */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 p-3 bg-slate-900 border border-slate-755 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-down ltr">
          <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-slate-200">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* CUSTOM STYLE-D HIGH-CONTRAST CONFIRMATION PORTAL (IFRAME PROOF) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in" id="custom_confirm_modal">
          <div className="w-full max-w-sm bg-[#121214] border border-[#27272a] shadow-2xl rounded-2xl p-6 relative overflow-hidden text-center" id="custom_confirm_card">
            
            {/* Visual gradient accent */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 to-indigo-600" />
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4 text-rose-400">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>

            <h3 className="text-base font-black text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6 px-2">{confirmDialog.description}</p>

            <div className={`flex items-center gap-3 ${lang === "ar" ? "flex-row-reverse" : "flex-row"}`} id="confirm_modal_buttons">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 bg-[#1c1c1e] hover:bg-[#27272a] text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-[#27272a] cursor-pointer"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-450 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-rose-500/10 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // Trigger undo restore
  function triggerUndoAction() {
    if (!undoTarget) return;
    handleRestoreItem(undoTarget.trashId);
    setUndoTarget(null);
  }
}
