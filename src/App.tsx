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
import { 
  getSyncSettings, pushRealOrdersToGoogleSheet, saveSimulationSheetData, 
  serializeOrderToRow, getDynamicOrderColumns, logSyncAudit 
} from "./googleSyncUtils";
import { AlertCircle, RotateCcw, X, BadgeAlert, Globe, Sun, Moon, Bell, Check } from "lucide-react";

export default function App() {
  // Core Business Configurations
  const [profile, setProfile] = useState<BusinessProfile | null>(getBusinessProfile());
  const [session, setSession] = useState<UserSession | null>(getUserSession());
  const [activeTab, setActiveTab] = useState<string>("dashboard");
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

  // Auto load configurations on start
  useEffect(() => {
    const profObj = getBusinessProfile();
    if (profObj && profObj.businessName) {
      setProfile(profObj);
      setLang(profObj.defaultLanguage || "ar");
      setTheme(profObj.preferredTheme || "dark");
      
      // Load tables
      setOrders(getOrders());
      setProducts(getProducts());
      setBasicInventory(getBasicInventory());
      setSubInventory(getSubInventory());
      setReturnInventory(getReturnInventory());
      setSuppliers(getSuppliers());
      setInvoices(getSupplierInvoices());
      setWorkers(getWorkers());
      setTrashItems(getTrashItems());

      // Load Unified Expenses with robust parsing safety
      const storedExp = localStorage.getItem("corevia_unified_expenses_v1");
      let parsedExpenses: Expense[] | null = null;
      if (storedExp) {
        try {
          parsedExpenses = JSON.parse(storedExp);
        } catch (e) {
          console.error("Failed to parse stored expenses:", e);
        }
      }
      if (parsedExpenses && Array.isArray(parsedExpenses)) {
        setExpenses(parsedExpenses);
      } else {
        const seededExpenses: Expense[] = [
          {
            id: "exp-1",
            title: "إيجار المحل الورشة",
            type: "fixed",
            amount: 25000,
            date: "2026-05-01",
            createdAt: "2026-05-01T10:00:00Z"
          },
          {
            id: "exp-2",
            title: "اشتراك إنترنت فايبر",
            type: "fixed",
            amount: 4000,
            date: "2026-05-05",
            createdAt: "2026-05-05T12:00:00Z"
          },
          {
            id: "exp-3",
            title: "أكياس تغليف الطلبات شحن",
            type: "variable",
            amount: 8500,
            date: "2026-05-12",
            createdAt: "2026-05-12T14:00:00Z"
          },
          {
            id: "exp-4",
            title: "Facebook Winter Sponsor",
            type: "ads",
            amount: 33000,
            date: "2026-05-10",
            isUSD: true,
            usdAmount: 150,
            exchangeRate: 220,
            notes: "حملة فيس بوك لملابس الشتاء",
            createdAt: "2026-05-10T16:00:00Z"
          }
        ];
        localStorage.setItem("corevia_unified_expenses_v1", JSON.stringify(seededExpenses));
        setExpenses(seededExpenses);
      }

      // Load custom colors with robust parsing safety
      const storedColors = localStorage.getItem("corevia_custom_colors_v1");
      let parsedColors: string[] | null = null;
      if (storedColors) {
        try {
          parsedColors = JSON.parse(storedColors);
        } catch (e) {
          console.error("Failed to parse stored colors:", e);
        }
      }
      if (parsedColors && Array.isArray(parsedColors)) {
        setCustomColorsList(parsedColors);
      } else {
        const defaults = [
          "Black (أسود)", "White (أبيض)", "Navy Blue (كحلي)", "Sage Green (أخضر زيتي)", 
          "Ruby Red (أحمر جوري)", "Carbon Gray (رمادي فاحم)", "Beige (بيج الرمل)", "Olive (زيتوني)"
        ];
        localStorage.setItem("corevia_custom_colors_v1", JSON.stringify(defaults));
        setCustomColorsList(defaults);
      }
    }
  }, []);

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
  const handleOnboardingComplete = (newProfile: BusinessProfile) => {
    localStorage.setItem("corevia_profile_v1", JSON.stringify(newProfile));
    initializeDatabase(true); // Seeding realistic Algeria ERP data
    
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

    triggerToast("مرحباً بك في Corevia! تم إشعال المنصة وتلقيم الحساب التجريبية بنجاح.");
  };

  // Safe logout
  const handleLogout = () => {
    localStorage.removeItem("corevia_user_session_v1"); // KEYS.SESSION
    setSession({
      username: "",
      email: "",
      isRegistered: false,
      isApproved: false,
      isSuspended: false
    });
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

  // MUTATIONS SAVE CALLS IN UPPER APP ORCHESTRATOR
  const saveOrdersAndPersist = (newOrders: Order[]) => {
    setOrders(newOrders);
    saveOrders(newOrders);

    // Sync physical inventory immediately after order edits
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
    setReturnInventory(getReturnInventory());

    // Instant Google Sheets Bidirectional Outbound Push
    try {
      const syncSett = getSyncSettings();
      if (!syncSett.isPaused) {
        if (syncSett.isSimulation) {
          const colSchema = getDynamicOrderColumns(newOrders);
          const blockRows = [colSchema];
          newOrders.forEach(ord => {
            blockRows.push(serializeOrderToRow(ord, colSchema));
          });
          saveSimulationSheetData(blockRows);
          logSyncAudit("Pushed order updates immediately to simulated Sheet.", "success", "Corevia App");
        } else if (syncSett.accessToken && syncSett.sheetId) {
          pushRealOrdersToGoogleSheet(syncSett.accessToken, syncSett.sheetId, newOrders)
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
    setProducts(newProducts);
    saveProducts(newProducts);
    // Automatic stockpiles feedback
    setBasicInventory(getBasicInventory());
  };

  const saveSuppliersAndPersist = (newSuppliers: Supplier[]) => {
    setSuppliers(newSuppliers);
    saveSuppliers(newSuppliers);
  };

  const saveInvoicesAndPersist = (newInvoices: SupplierInvoice[]) => {
    setInvoices(newInvoices);
    saveSupplierInvoices(newInvoices);
    
    // Sync stocks
    setBasicInventory(getBasicInventory());
    setSubInventory(getSubInventory());
  };

  const saveWorkersAndPersist = (newWorkers: Worker[]) => {
    setWorkers(newWorkers);
    saveWorkers(newWorkers);
  };

  const saveExpensesAndPersist = (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    localStorage.setItem("corevia_unified_expenses_v1", JSON.stringify(newExpenses));
  };

  const saveProfileAndPersist = (newProf: BusinessProfile) => {
    setProfile(newProf);
    saveBusinessProfile(newProf);
  };

  const saveCustomColorsAndPersist = (newColors: string[]) => {
    setCustomColorsList(newColors);
    localStorage.setItem("corevia_custom_colors_v1", JSON.stringify(newColors));
  };

  // SOFT DELETION WRAPPING FOR 5-SECOND UNDO IMPLEMENTATION
  const handleSoftDeleteOrder = (orderId: string) => {
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
        }}
        onTriggerNotification={triggerToast}
      />
    );
  }

  // If onboarding is not completed, we display Onboarding screen with the global topbar controls
  if (!profile || !profile.businessName) {
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
        />
      </div>
    );
  }

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
        profile={profile}
        passcode={profile.passcode || "1234"}
        isLocked={isLocked}
        unlockedTabs={unlockedTabs}
        onUnlockTab={(tab) => setUnlockedTabs(prev => [...prev, tab])}
        onLogout={handleLogout}
        notifications={dynamicAlerts}
        clearNotifications={handleClearNotifications}
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
            businessName={profile.businessName}
            profile={profile}
            onSoftDelete={handleSoftDeleteOrder}
            onTriggerNotification={triggerToast}
          />
        )}

        {activeTab === "inventory" && (
          <InventoryView
            basicInventory={basicInventory}
            subInventory={subInventory}
            returnInventory={returnInventory}
            onSaveBasic={(arr) => { setBasicInventory(arr); saveBasicInventory(arr); }}
            onSaveSub={(arr) => { setSubInventory(arr); saveSubInventory(arr); }}
            onSaveReturn={(arr) => { setReturnInventory(arr); saveReturnInventory(arr); }}
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
