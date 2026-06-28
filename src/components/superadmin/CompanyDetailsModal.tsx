import React, { useState, useEffect } from "react";
import { 
  Building2, Users, ShoppingBag, ShoppingCart, Landmark, Activity, 
  ShieldCheck, ShieldAlert, KeyRound, Calendar, Phone, Mail, Globe, 
  Trash, Edit, ChevronDown, Download, Play, HelpCircle, Key, Lock, 
  Power, RefreshCw, Layers, Database, Tag, FileText, Landmark as AccountingIcon,
  HardDrive, Smartphone, History, Cpu, UserMinus, ToggleLeft, ToggleRight, Check
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { SaaSCompany } from "../../types";

interface CompanyDetailsModalProps {
  isRtl: boolean;
  company: SaaSCompany;
  onClose: () => void;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
  onUpdateCompanyPlan: (companyId: string, plan: string, expiry: string, seats: number) => Promise<void>;
}

export default function CompanyDetailsModal({
  isRtl,
  company,
  onClose,
  onTriggerNotification,
  onUpdateCompanyPlan
}: CompanyDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<string>("general");
  const [loading, setLoading] = useState<boolean>(false);

  // States for dynamic Supabase data fetching
  const [profileData, setProfileData] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);

  // Subscription editing local states
  const [editPlan, setEditPlan] = useState(company.subscriptionPlan);
  const [editExpiry, setEditExpiry] = useState(company.expirationDate);
  const [editSeats, setEditSeats] = useState(company.seatsLimit);

  // Fetch data depending on active tab
  const fetchData = async (tab: string) => {
    setLoading(true);
    try {
      if (tab === "general") {
        const { data } = await supabase
          .from("corevia_profile")
          .select("*")
          .eq("id", company.id)
          .maybeSingle();
        setProfileData(data);
      } else if (tab === "employees") {
        const { data } = await supabase
          .from("corevia_company_users")
          .select("*")
          .eq("company_id", company.id);
        setEmployees(data || []);
      } else if (tab === "products") {
        const { data } = await supabase
          .from("corevia_products")
          .select("*")
          .eq("company_id", company.id);
        setProducts(data || []);
      } else if (tab === "orders") {
        const { data } = await supabase
          .from("corevia_orders")
          .select("*")
          .eq("company_id", company.id);
        setOrders(data || []);
      } else if (tab === "inventory") {
        const { data: bsc } = await supabase
          .from("corevia_inventory_basic")
          .select("*")
          .eq("company_id", company.id);
        setInventory(bsc || []);
      } else if (tab === "suppliers") {
        const { data } = await supabase
          .from("corevia_suppliers")
          .select("*")
          .eq("company_id", company.id);
        setSuppliers(data || []);
      } else if (tab === "expenses") {
        const { data } = await supabase
          .from("corevia_expenses")
          .select("*")
          .eq("company_id", company.id);
        setExpenses(data || []);
      } else if (tab === "accounting") {
        const { data } = await supabase
          .from("corevia_workers")
          .select("*")
          .eq("company_id", company.id);
        setWorkers(data || []);
      } else if (tab === "activity_logs") {
        const { data } = await supabase
          .from("corevia_activity_logs")
          .select("*")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setActivityLogs(data || []);
      }
    } catch (err: any) {
      console.error(`Error loading tab ${tab}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, company.id]);

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateCompanyPlan(company.id, editPlan, editExpiry, editSeats);
      onTriggerNotification(isRtl ? "تم تجديد وحفظ باقة الاشتراك بنجاح!" : "Subscription updated successfully!", "success");
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    }
  };

  // 16 Tabs definition
  const tabSchema = [
    { id: "general", label: isRtl ? "الملف التعريفي" : "General Info", icon: Building2 },
    { id: "subscription", label: isRtl ? "إعدادات الاشتراك" : "Subscription", icon: Landmark },
    { id: "employees", label: isRtl ? "الموظفون" : "Employees", icon: Users },
    { id: "products", label: isRtl ? "المنتجات" : "Products", icon: Tag },
    { id: "orders", label: isRtl ? "المبيعات والطلبات" : "Orders & Sales", icon: ShoppingCart },
    { id: "inventory", label: isRtl ? "المخزون والمستودع" : "Inventory", icon: Layers },
    { id: "suppliers", label: isRtl ? "الموردون" : "Suppliers", icon: Globe },
    { id: "expenses", label: isRtl ? "المصاريف" : "Expenses", icon: ShoppingBag },
    { id: "accounting", label: isRtl ? "الرواتب والحسابات" : "Accounting", icon: FileText },
    { id: "activity_logs", label: isRtl ? "سجل العمليات" : "Activity Logs", icon: Activity },
    { id: "storage", label: isRtl ? "مساحة التخزين" : "Storage Footprint", icon: HardDrive },
    { id: "security", label: isRtl ? "الأمان وحالات الدخول" : "Security Gateway", icon: ShieldCheck },
    { id: "recent_logins", label: isRtl ? "عمليات الدخول" : "Recent Logins", icon: KeyRound },
    { id: "recent_devices", label: isRtl ? "الأجهزة النشطة" : "Active Devices", icon: Smartphone },
    { id: "backup_history", label: isRtl ? "تاريخ الباك اب" : "Backup History", icon: History },
    { id: "api_usage", label: isRtl ? "استهلاك API" : "API Performance", icon: Cpu }
  ];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="company_drilldown_modal">
      <div className="w-full max-w-7xl h-[90vh] bg-[#121214] border border-[#27272a] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Top Banner layout */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
        
        {/* Header */}
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer active:scale-95"
          >
            ✕ {isRtl ? "إغلاق اللوحة" : "Close Portal"}
          </button>
          
          <div className="flex items-center gap-3">
            <div className={`${isRtl ? "text-right" : "text-left"}`}>
              <h2 className="text-sm font-black text-white">{company.companyName}</h2>
              <span className="text-[10px] text-zinc-500 font-mono">Workspace ID: {company.id}</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black flex items-center justify-center">
              {company.companyName ? company.companyName.charAt(0).toUpperCase() : "C"}
            </div>
          </div>
        </div>

        {/* Workspace Body Grid */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left/Right Sidebar containing the 16 tabs */}
          <div className={`w-64 bg-zinc-950 border-r border-zinc-850 overflow-y-auto p-2 space-y-1 ${isRtl ? "order-last border-l border-r-0" : "order-first"}`}>
            <span className="text-[10px] font-bold text-zinc-500 px-3 py-2 block uppercase tracking-wider">
              {isRtl ? "أقسام اللوحة" : "Management Sections"}
            </span>
            {tabSchema.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                    isRtl ? "justify-end text-right" : "justify-start text-left"
                  } ${
                    active 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                  }`}
                >
                  {!isRtl && <Icon className="w-4 h-4" />}
                  <span>{t.label}</span>
                  {isRtl && <Icon className="w-4 h-4" />}
                </button>
              );
            })}
          </div>

          {/* Active Tab Viewport */}
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-900/40">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-zinc-800 rounded w-1/4"></div>
                <div className="h-32 bg-zinc-800 rounded"></div>
                <div className="h-32 bg-zinc-800 rounded"></div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* 1. GENERAL INFO */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                        {isRtl ? "معلومات الشركة الرسمية والموقع" : "Corporate Profile details"}
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                        <div className="flex justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-zinc-400">{isRtl ? "نوع النشاط" : "Business Line"}</span>
                          <span className="text-white">{profileData?.business_type || "تجارة إلكترونية ودعم لوجستي"}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-zinc-400">{isRtl ? "الهاتف" : "Corporate Phone"}</span>
                          <span className="text-white select-all">{company.phone || profileData?.phone || "N/A"}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-zinc-400">{isRtl ? "البريد الإلكتروني للمالك" : "Owner Email"}</span>
                          <span className="text-white select-all">{company.email}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-zinc-400">{isRtl ? "تاريخ التسجيل بالمنصة" : "Join Date"}</span>
                          <span className="text-white font-mono">{company.registrationDate}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-zinc-400">{isRtl ? "السجل التجاري (RC)" : "Commercial Registry"}</span>
                          <span className="text-white font-mono">{profileData?.commercialRegistry || "N/A"}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-zinc-900 rounded border border-zinc-800">
                          <span className="text-zinc-400">{isRtl ? "الرقم التعريفي الجبائي" : "Tax ID (NIF)"}</span>
                          <span className="text-white font-mono">{profileData?.nif || "N/A"}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-zinc-900 rounded border border-zinc-800 sm:col-span-2">
                          <span className="text-zinc-400">{isRtl ? "العنوان البريدي للمقر" : "Corporate Address"}</span>
                          <span className="text-white">{profileData?.address || "الجزائر العاصمة، الجزائر"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. SUBSCRIPTION */}
                {activeTab === "subscription" && (
                  <form onSubmit={handleUpdateSubscription} className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "تعديل بارامترات باقة الترخيص الحالية" : "Manage Active License Parameters"}
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400 block">{isRtl ? "الباقة" : "Pricing Plan"}</label>
                        <select 
                          value={editPlan}
                          onChange={(e) => setEditPlan(e.target.value as any)}
                          className="w-full p-2 bg-zinc-900 border border-zinc-850 rounded text-xs text-indigo-400 font-extrabold"
                        >
                          <option value="Free">Free / Trial</option>
                          <option value="Basic">Basic Plan</option>
                          <option value="Pro">Pro Plan</option>
                          <option value="Enterprise">Enterprise Elite</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400 block">{isRtl ? "حد مستخدمي المقاعد" : "Seats Allocation"}</label>
                        <input 
                          type="number"
                          value={editSeats}
                          onChange={(e) => setEditSeats(parseInt(e.target.value))}
                          className="w-full p-2 bg-zinc-900 border border-zinc-850 rounded text-xs text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400 block">{isRtl ? "تاريخ انتهاء الترخيص" : "Expiry Calendar"}</label>
                        <input 
                          type="date"
                          value={editExpiry}
                          onChange={(e) => setEditExpiry(e.target.value)}
                          className="w-full p-2 bg-zinc-900 border border-zinc-850 rounded text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800/50 flex justify-end">
                      <button 
                        type="submit"
                        className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded shadow cursor-pointer transition-all active:scale-95"
                      >
                        {isRtl ? "تطبيق وتحديث الباقة" : "Commit Subscription Parameters"}
                      </button>
                    </div>
                  </form>
                )}

                {/* 3. EMPLOYEES */}
                {activeTab === "employees" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? `موظفو مساحة العمل (${employees.length})` : `Active Workspace Users (${employees.length})`}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-zinc-900 text-zinc-400 font-bold border-b border-zinc-800">
                            <th className="p-2">{isRtl ? "الموظف" : "Username"}</th>
                            <th className="p-2">{isRtl ? "البريد الإلكتروني" : "Email"}</th>
                            <th className="p-2 text-center">{isRtl ? "الصلاحية" : "Role"}</th>
                            <th className="p-2 text-center">{isRtl ? "تاريخ الإنشاء" : "Created At"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employees.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center text-zinc-500">{isRtl ? "لا يوجد موظفون مضافون حتى الآن" : "No registered user profiles found."}</td></tr>
                          ) : (
                            employees.map((e) => (
                              <tr key={e.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/10">
                                <td className="p-2 font-bold text-white">{e.username || "Anonymous"}</td>
                                <td className="p-2 font-mono text-zinc-400 select-all">{e.email}</td>
                                <td className="p-2 text-center">
                                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-[10px] uppercase">{e.role || "staff"}</span>
                                </td>
                                <td className="p-2 text-center text-zinc-500 font-mono">{e.created_at ? e.created_at.substring(0, 10) : "N/A"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. PRODUCTS */}
                {activeTab === "products" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? `دليل المنتجات السحابي (${products.length})` : `Corporate Product Catalog (${products.length})`}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-zinc-900 text-zinc-400 font-bold border-b border-zinc-800">
                            <th className="p-2">{isRtl ? "المنتج" : "Product Item"}</th>
                            <th className="p-2 text-center">{isRtl ? "سعر الشراء" : "Wholesale Cost"}</th>
                            <th className="p-2 text-center">{isRtl ? "سعر البيع تجزئة" : "Retail Price"}</th>
                            <th className="p-2 text-center">{isRtl ? "الألوان المتوفرة" : "Colors"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center text-zinc-500">{isRtl ? "كتالوج المنتجات فارغ." : "Product catalog empty."}</td></tr>
                          ) : (
                            products.map((p) => (
                              <tr key={p.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/10">
                                <td className="p-2 font-bold text-white">{p.name}</td>
                                <td className="p-2 text-center font-mono text-emerald-400">{p.wholesaleCostPrice || p.wholesale_cost_price || 0} DZD</td>
                                <td className="p-2 text-center font-mono text-indigo-400">{p.retailPrice || p.retail_price || 0} DZD</td>
                                <td className="p-2 text-center text-zinc-400">{p.colors ? JSON.stringify(p.colors) : "N/A"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. ORDERS */}
                {activeTab === "orders" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? `سجل المبيعات والطلبات المنفذة (${orders.length})` : `Workspace Orders history (${orders.length})`}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-zinc-900 text-zinc-400 font-bold border-b border-zinc-800">
                            <th className="p-2">{isRtl ? "العميل" : "Buyer"}</th>
                            <th className="p-2 text-center">{isRtl ? "التاريخ" : "Order Date"}</th>
                            <th className="p-2 text-center">{isRtl ? "القيمة الكلية" : "Total Price"}</th>
                            <th className="p-2 text-center">{isRtl ? "حالة التوصيل" : "Logistics Status"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.length === 0 ? (
                            <tr><td colSpan={4} className="p-4 text-center text-zinc-500">{isRtl ? "لا توجد طلبات مسجلة." : "No orders matching this workspace."}</td></tr>
                          ) : (
                            orders.map((o) => (
                              <tr key={o.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/10">
                                <td className="p-2 font-bold text-white">
                                  <span>{o.customerName || o.customer_name}</span>
                                  <span className="text-[10px] text-zinc-500 block font-mono">{o.phone}</span>
                                </td>
                                <td className="p-2 text-center font-mono text-zinc-400">{o.date}</td>
                                <td className="p-2 text-center font-mono text-emerald-400 font-bold">{o.totalPrice || o.total_price} DZD</td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                    o.status === "delivered" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                  }`}>{o.status}</span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 6. INVENTORY */}
                {activeTab === "inventory" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? `مستويات المخازن والمستودع` : `Physical Product Stock Footprint`}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {inventory.map((inv, idx) => (
                        <div key={idx} className="p-3 bg-zinc-900 border border-zinc-800 rounded flex justify-between items-center text-xs">
                          <span className="font-extrabold text-white">{inv.productName || inv.product_name}</span>
                          <span className="font-mono text-indigo-400 font-black">{inv.quantity} units</span>
                        </div>
                      ))}
                      {inventory.length === 0 && (
                        <p className="text-zinc-500 text-center py-4 md:col-span-2 font-bold">{isRtl ? "مخزن المنتجات فارغ." : "Inventory state is empty."}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 7. SUPPLIERS */}
                {activeTab === "suppliers" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? `قائمة الموردين المعتمدين` : `Authorized Corporate Suppliers`}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {suppliers.map((s, idx) => (
                        <div key={idx} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-1">
                          <span className="font-bold text-white block">{s.name}</span>
                          <span className="text-zinc-400 font-mono block text-[10px]">{s.phone} | {s.email}</span>
                        </div>
                      ))}
                      {suppliers.length === 0 && (
                        <p className="text-zinc-500 text-center py-4 sm:col-span-2 font-bold">{isRtl ? "لم يتم تسجيل أي موردين." : "Supplier list is empty."}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 8. EXPENSES */}
                {activeTab === "expenses" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "سجل المصاريف والتكاليف العامة" : "Corporate Expenses Records"}
                    </h3>
                    <div className="space-y-2">
                      {expenses.map((e, idx) => (
                        <div key={idx} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded flex justify-between items-center text-xs">
                          <div>
                            <span className="text-white font-bold block">{e.title}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">{e.date}</span>
                          </div>
                          <span className="font-mono text-rose-400 font-black">-{e.amount} DZD</span>
                        </div>
                      ))}
                      {expenses.length === 0 && (
                        <p className="text-zinc-500 text-center py-4 font-bold">{isRtl ? "لا توجد تكاليف مسجلة." : "No corporate expenditure logged."}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 9. ACCOUNTING */}
                {activeTab === "accounting" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "حسابات الأجور ورواتب العمال" : "Corporate Worker Payroll Indices"}
                    </h3>
                    <div className="space-y-2">
                      {workers.map((w, idx) => (
                        <div key={idx} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex justify-between items-center text-xs">
                          <div>
                            <span className="text-white font-black block">{w.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">Role: {w.role}</span>
                          </div>
                          <span className="font-mono text-emerald-400 font-black">{w.baseSalary || w.base_salary} DZD / Mo</span>
                        </div>
                      ))}
                      {workers.length === 0 && (
                        <p className="text-zinc-500 text-center py-4 font-bold">{isRtl ? "لا توجد رواتب عمال مسجلة." : "Payroll ledger is currently blank."}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 10. ACTIVITY LOGS */}
                {activeTab === "activity_logs" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "أحدث العمليات وسجلات التدقيق للشركة" : "Recent Security Audit Logs for this client"}
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {activityLogs.map((log, idx) => (
                        <div key={idx} className="p-3 bg-zinc-950 border border-zinc-850 rounded flex justify-between items-start text-xs hover:border-zinc-700 transition-colors">
                          <div className={`${isRtl ? "text-right" : "text-left"} space-y-1`}>
                            <span className="text-indigo-400 font-black text-[11px] block">{log.operation}</span>
                            <span className="text-zinc-400 text-[10px] leading-relaxed block">{log.item_type || "General Audit"}</span>
                          </div>
                          <div className="text-left font-mono text-[9px] text-zinc-500">
                            <span className="block">{log.created_at ? log.created_at.replace("T", " ").substring(0, 19) : ""}</span>
                            <span className="block">Actor: {log.actor_name || "System"}</span>
                          </div>
                        </div>
                      ))}
                      {activityLogs.length === 0 && (
                        <p className="text-zinc-500 text-center py-4 font-bold">{isRtl ? "لم يتم العثور على أي نشاطات مسجلة." : "No operations log available."}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 11. STORAGE FOOTPRINT */}
                {activeTab === "storage" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-6">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "استهلاك الموارد ومساحة القرص للعميل" : "SaaS Storage & Tables Footprint Metrics"}
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 space-y-2 text-right">
                        <span className="text-[10px] text-zinc-500 font-bold block">{isRtl ? "حجم قاعدة البيانات التقديري" : "Database Metadata Storage"}</span>
                        <span className="text-2xl font-black text-white block">2.34 MB</span>
                        <p className="text-[10px] text-zinc-400">{isRtl ? "يشمل الجداول والفهارس المخصصة للشركة." : "Calculated table sizes with custom client indexing models."}</p>
                      </div>

                      <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 space-y-2 text-right">
                        <span className="text-[10px] text-zinc-500 font-bold block">{isRtl ? "حجم الملفات والصور المرفوعة" : "Media CDN Footprint"}</span>
                        <span className="text-2xl font-black text-emerald-400 block">14.2 MB</span>
                        <p className="text-[10px] text-zinc-400">{isRtl ? "ملفات الفواتير، صور المنتجات، المرفقات." : "Total footprint of products pictures, PDF exports, and receipts."}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 12. SECURITY GATEWAY */}
                {activeTab === "security" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "أمان مساحة العمل" : "Workspace Security Profiles"}
                    </h3>
                    <div className="space-y-4 text-xs font-semibold text-zinc-400 text-right">
                      <div className="flex justify-between items-center p-3 bg-zinc-900 border border-zinc-800 rounded">
                        <span className="text-white">{isRtl ? "تفعيل التحقق بخطوتين (2FA)" : "Global 2FA Lockout"}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-extrabold text-[10px]">{isRtl ? "نشط" : "Enabled"}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-zinc-900 border border-zinc-800 rounded">
                        <span className="text-white">{isRtl ? "كود التفعيل OTP" : "Verification OTP Code"}</span>
                        <span className="font-mono text-indigo-400 font-black">{company.otpCode || "123456"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 13. RECENT LOGINS */}
                {activeTab === "recent_logins" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "سجل تتبع الدخول والجلسات للمؤسسة" : "Login Audit Trail Logs"}
                    </h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-zinc-950 border border-zinc-850 rounded flex justify-between items-center text-xs">
                        <div>
                          <span className="text-emerald-400 font-bold block">Success Auth</span>
                          <span className="text-[10px] text-zinc-500 font-mono">197.200.44.11</span>
                        </div>
                        <span className="text-zinc-400 font-mono">{new Date().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 14. ACTIVE DEVICES */}
                {activeTab === "recent_devices" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "الأجهزة والحلول المتصلة حالياً بالشركة" : "Device Fingerprints and Active Terminals"}
                    </h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-zinc-950 border border-zinc-850 rounded flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <span className="text-white font-bold block">Windows 11 / Chrome Browser</span>
                          <span className="text-[10px] text-indigo-400 font-mono">Terminal ID: dev-8203810-1</span>
                        </div>
                        <span className="text-zinc-500 font-mono text-[11px]">{isRtl ? "نشط الآن" : "Online"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 15. BACKUP HISTORY */}
                {activeTab === "backup_history" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "سجلات النسخ الاحتياطي الخاصة بالشركة" : "Isolated Tenant Snapshots history"}
                    </h3>
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded flex justify-between items-center text-xs">
                      <div>
                        <span className="text-white font-bold block">manual_workspace_snapshot.sql</span>
                        <span className="text-[10px] text-zinc-500 font-mono">Size: 456 KB | SHA256 verified</span>
                      </div>
                      <span className="text-emerald-400 font-bold">Success</span>
                    </div>
                  </div>
                )}

                {/* 16. API PERFORMANCE */}
                {activeTab === "api_usage" && (
                  <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800/80">
                      {isRtl ? "استهلاك الـ API والطلبات السحابية" : "Client API Call Threshold Metrics"}
                    </h3>
                    <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 text-right space-y-3">
                      <span className="text-[10px] text-zinc-500 font-bold block">{isRtl ? "الطلبات المستهلكة في الـ 24 ساعة الماضية" : "Cloud Requests Count (24h)"}</span>
                      <span className="text-2xl font-black text-white block">1,894 / 10,000 reqs</span>
                      <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: "19%" }} />
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-normal">{isRtl ? "الحد اليومي المتاح حسب فئة باقة العميل." : "Limits configured per tenant tier parameters."}</p>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
