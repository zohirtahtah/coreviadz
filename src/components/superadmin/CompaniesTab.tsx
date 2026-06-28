import React, { useState } from "react";
import { 
  Building2, Users, Search, Filter, Ban, ShieldCheck, KeyRound, 
  Calendar, Phone, Mail, Globe, Eye, Trash, Edit, ChevronDown, 
  Download, Play, HelpCircle, Key, Lock, Power, RefreshCw
} from "lucide-react";
import { SaaSCompany } from "../../types";

interface CompaniesTabProps {
  isRtl: boolean;
  companies: SaaSCompany[];
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
  onSelectCompany: (company: SaaSCompany) => void;
  onRefresh: () => void;
  onUpdateCompany: (companyId: string, updatedFields: Partial<SaaSCompany>) => Promise<void>;
  onSoftDeleteCompany: (companyId: string) => Promise<void>;
}

export default function CompaniesTab({ 
  isRtl, 
  companies, 
  onTriggerNotification, 
  onSelectCompany,
  onRefresh,
  onUpdateCompany,
  onSoftDeleteCompany
}: CompaniesTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");

  // Admin action modals state
  const [editingCompany, setEditingCompany] = useState<SaaSCompany | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPlan, setEditPlan] = useState<"Free" | "Basic" | "Pro" | "Enterprise">("Basic");
  const [editSeats, setEditSeats] = useState(5);
  const [editExpiry, setEditExpiry] = useState("");

  // Password reset modal state
  const [resetCompany, setResetCompany] = useState<SaaSCompany | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Filters calculation
  const filteredCompanies = companies.filter(c => {
    const matchSearch = 
      c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === "ALL" || c.accountStatus === statusFilter;
    const matchPlan = planFilter === "ALL" || c.subscriptionPlan === planFilter;

    return matchSearch && matchStatus && matchPlan;
  });

  const openEditModal = (c: SaaSCompany) => {
    setEditingCompany(c);
    setEditName(c.companyName);
    setEditOwner(c.ownerName);
    setEditEmail(c.email);
    setEditPhone(c.phone);
    setEditPlan(c.subscriptionPlan);
    setEditSeats(c.seatsLimit);
    setEditExpiry(c.expirationDate);
    setShowEditModal(true);
  };

  const handleSaveParameters = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    try {
      await onUpdateCompany(editingCompany.id, {
        companyName: editName,
        ownerName: editOwner,
        email: editEmail,
        phone: editPhone,
        subscriptionPlan: editPlan,
        seatsLimit: editSeats,
        expirationDate: editExpiry
      });
      setShowEditModal(false);
      onTriggerNotification(isRtl ? "تم تعديل بارامترات الشركة وحفظها بنجاح!" : "Tenant parameters successfully updated!", "success");
    } catch (err: any) {
      onTriggerNotification(`Error: ${err.message}`, "info");
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCompany || !newPassword) return;
    try {
      // In production we update the coreauth session or user metadata, locally we mock completion
      onTriggerNotification(isRtl ? `تم إعادة تعيين كلمة مرور العميل ${resetCompany.ownerName} بنجاح!` : `Credentials for ${resetCompany.ownerName} reset successfully!`, "success");
      setShowResetModal(false);
      setNewPassword("");
    } catch (err: any) {
      onTriggerNotification(err.message, "info");
    }
  };

  const toggleSuspension = async (c: SaaSCompany) => {
    const isSuspended = c.accountStatus === "Suspended";
    const newStatus = isSuspended ? "Active" : "Suspended";
    const confirmMsg = isRtl
      ? `هل أنت متأكد من رغبتك في ${isSuspended ? "تنشيط" : "تجميد"} حساب الشركة: ${c.companyName}؟`
      : `Are you sure you want to ${isSuspended ? "activate" : "suspend"} tenant: ${c.companyName}?`;

    if (window.confirm(confirmMsg)) {
      try {
        await onUpdateCompany(c.id, { accountStatus: newStatus });
        onTriggerNotification(isRtl ? "تم تحديث حالة الشركة بنجاح!" : "Tenant status changed!", "success");
      } catch (err: any) {
        onTriggerNotification(err.message, "info");
      }
    }
  };

  const triggerExport = (c: SaaSCompany) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(c, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `corevia-tenant-${c.id}.json`);
    dlAnchorElem.click();
    onTriggerNotification(isRtl ? "تم تصدير ملف إعدادات العميل بصيغة JSON!" : "Exported tenant configs to JSON!", "success");
  };

  return (
    <div className="space-y-4" id="saas_companies_ledger_panel">
      
      {/* Filtering Header bar */}
      <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        
        {/* Left Side: Searches & Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute top-2.5 right-3" />
            <input
              type="text"
              placeholder={isRtl ? "البحث بالاسم، كود المؤسسة..." : "Search by name, ID..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 pr-9 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg placeholder-zinc-500 outline-none focus:border-indigo-600 transition-all text-right"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 select-box cursor-pointer text-xs font-bold bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white outline-none focus:border-indigo-600 transition-colors"
          >
            <option value="ALL">{isRtl ? "جميع الحالات" : "All Status"}</option>
            <option value="Active">{isRtl ? "نشط (Active)" : "Active"}</option>
            <option value="Pending Verification">{isRtl ? "بانتظار التحقق" : "Pending Verification"}</option>
            <option value="Read Only">{isRtl ? "للقراءة فقط" : "Read Only"}</option>
            <option value="Suspended">{isRtl ? "مجمد (Suspended)" : "Suspended"}</option>
            <option value="Disabled">{isRtl ? "معطل بالكامل" : "Disabled"}</option>
          </select>

          {/* Plan filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="p-2 select-box cursor-pointer text-xs font-bold bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white outline-none focus:border-indigo-600 transition-colors"
          >
            <option value="ALL">{isRtl ? "جميع الباقات" : "All Plans"}</option>
            <option value="Free">{isRtl ? "مجانية (Free)" : "Free"}</option>
            <option value="Basic">{isRtl ? "أساسية (Basic)" : "Basic"}</option>
            <option value="Pro">{isRtl ? "احترافية (Pro)" : "Pro"}</option>
            <option value="Enterprise">{isRtl ? "مؤسسات (Enterprise)" : "Enterprise"}</option>
          </select>
        </div>

        {/* Right Side: Quick statistics */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
          <span>{isRtl ? "مطابقة الفلتر:" : "Filtered:"}</span>
          <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-black">{filteredCompanies.length}</span>
          <span>/</span>
          <span>{companies.length}</span>
          <button 
            onClick={onRefresh}
            className="p-1.5 hover:bg-zinc-850 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition-all ml-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Main Companies Table */}
      <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-300 text-right">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-800/80">
              <tr>
                <th className="p-3 text-center">{isRtl ? "الشركة" : "Company"}</th>
                <th className="p-3">{isRtl ? "المعرف الفريد" : "ID"}</th>
                <th className="p-3">{isRtl ? "المدير الأساسي" : "Owner Details"}</th>
                <th className="p-3 text-center">{isRtl ? "بلد الاشتراك" : "Country"}</th>
                <th className="p-3 text-center">{isRtl ? "الباقة الحالية" : "Active Plan"}</th>
                <th className="p-3 text-center">{isRtl ? "المقاعد" : "Seats"}</th>
                <th className="p-3 text-center">{isRtl ? "حالة الحساب" : "Status"}</th>
                <th className="p-3 text-center">{isRtl ? "انتهاء الصلاحية" : "Expires"}</th>
                <th className="p-3 text-center">{isRtl ? "آخر تسجيل دخول" : "Last Activity"}</th>
                <th className="p-3 text-center">{isRtl ? "إجراءات إدارية" : "Control Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-zinc-500 font-bold">
                    {isRtl ? "⚠️ لا توجد شركات مطابقة للبحث أو الفلتر المختار." : "No matching tenant registrations found."}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((c) => {
                  const initial = c.companyName ? c.companyName.charAt(0).toUpperCase() : "C";
                  return (
                    <tr key={c.id} className="hover:bg-zinc-900/30 transition-colors">
                      {/* Company Name & Avatar */}
                      <td className="p-3">
                        <div className="flex items-center gap-3 justify-end">
                          <div className="text-right">
                            <span className="font-extrabold text-white block hover:text-indigo-400 transition-colors cursor-pointer" onClick={() => onSelectCompany(c)}>
                              {c.companyName}
                            </span>
                            <span className="text-[10px] text-zinc-500 block">{isRtl ? "تاريخ التسجيل: " : "Registered: "} {c.registrationDate}</span>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="p-3 font-mono text-[10px] text-zinc-400 select-all">{c.id}</td>

                      {/* Owner Details */}
                      <td className="p-3">
                        <div className="space-y-0.5 text-right">
                          <span className="font-bold text-white block">{c.ownerName}</span>
                          <span className="text-[10px] text-zinc-400 block">{c.email}</span>
                          <span className="text-[10px] text-zinc-500 block">{c.phone}</span>
                        </div>
                      </td>

                      {/* Country */}
                      <td className="p-3 text-center font-bold text-zinc-400">{c.country || "Algeria"}</td>

                      {/* Plan */}
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full font-black text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {c.subscriptionPlan}
                        </span>
                      </td>

                      {/* Seats */}
                      <td className="p-3 text-center font-mono">
                        <span className="font-extrabold text-white">{c.seatsUsed}</span>
                        <span className="text-zinc-500"> / {c.seatsLimit}</span>
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.accountStatus === "Active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" :
                          c.accountStatus === "Suspended" ? "bg-rose-500/15 text-rose-400 border border-rose-500/25" :
                          "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                        }`}>
                          {c.accountStatus}
                        </span>
                      </td>

                      {/* Expires */}
                      <td className="p-3 text-center font-mono text-[11px] font-semibold text-zinc-400">
                        {c.expirationDate || "Unlimited"}
                      </td>

                      {/* Last Activity */}
                      <td className="p-3 text-center text-zinc-500 font-mono text-[10px]">
                        {c.lastLogin || "N/A"}
                      </td>

                      {/* Action buttons */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 justify-center">
                          {/* Drilldown view */}
                          <button 
                            onClick={() => onSelectCompany(c)}
                            title={isRtl ? "لوحة تفاصيل العميل" : "View Details Dashboard"}
                            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit params */}
                          <button 
                            onClick={() => openEditModal(c)}
                            title={isRtl ? "تعديل إعدادات الترخيص" : "Modify License Settings"}
                            className="p-1.5 hover:bg-zinc-800 rounded text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button 
                            onClick={() => { setResetCompany(c); setShowResetModal(true); }}
                            title={isRtl ? "إعادة تعيين كلمة المرور" : "Reset Credentials"}
                            className="p-1.5 hover:bg-zinc-800 rounded text-amber-400 hover:text-amber-300 transition cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend/Activate */}
                          <button 
                            onClick={() => toggleSuspension(c)}
                            title={c.accountStatus === "Suspended" ? (isRtl ? "تنشيط العميل" : "Activate Tenant") : (isRtl ? "تجميد الحساب" : "Suspend Tenant")}
                            className={`p-1.5 hover:bg-zinc-800 rounded transition cursor-pointer ${
                              c.accountStatus === "Suspended" ? "text-emerald-400 hover:text-emerald-300" : "text-rose-400 hover:text-rose-350"
                            }`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>

                          {/* JSON Config Export */}
                          <button 
                            onClick={() => triggerExport(c)}
                            title={isRtl ? "تصدير الإعدادات" : "Export Configurations"}
                            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Soft Delete */}
                          <button 
                            onClick={async () => {
                              const confirmMsg = isRtl
                                ? `⚠️ خطر أمني!\n\nهل أنت متأكد من رغبتك في نقل العميل ${c.companyName} إلى سلة المحذوفات السحابية كحذف مؤقت؟ سيتم إيقاف دخول العميل فوراً.`
                                : `⚠️ Security Alert!\n\nMove tenant ${c.companyName} to Cloud Archive Recycler? Workspace logins will suspend.`;
                              if (window.confirm(confirmMsg)) {
                                try {
                                  await onSoftDeleteCompany(c.id);
                                  onTriggerNotification(isRtl ? "تم نقل الشركة للمهملات المؤرشفة بنجاح!" : "Workspace archived to recyclers successfully!", "success");
                                } catch (err: any) {
                                  onTriggerNotification(err.message, "info");
                                }
                              }
                            }}
                            title={isRtl ? "حذف مؤقت" : "Soft Delete / Archive"}
                            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-600 hover:text-red-500 transition cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL I: EDIT PARAMETERS & LICENSE */}
      {showEditModal && editingCompany && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-[#121214] border border-[#27272a] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-amber-500" />
            
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800/80 mb-4 text-right">
              <button onClick={() => setShowEditModal(false)} className="text-zinc-400 hover:text-white p-1 text-sm font-bold">✕</button>
              <h3 className="text-base font-black text-white">{isRtl ? `تعديل بارامترات الترخيص: ${editingCompany.companyName}` : "Adjust License Parameters"}</h3>
            </div>

            <form onSubmit={handleSaveParameters} className="space-y-4 text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "اسم المؤسسة" : "Company Title"}</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "اسم المدير" : "Owner Fullname"}</label>
                  <input
                    type="text"
                    required
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "البريد الإلكتروني" : "Authorized Email"}</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 ltr text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "رقم الهاتف" : "Phone line"}</label>
                  <input
                    type="text"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 ltr text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "باقة الاشتراك" : "Subscription Plan"}</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value as any)}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-indigo-400 font-extrabold rounded-lg outline-none focus:border-indigo-600 text-right"
                  >
                    <option value="Free">Free / Trial</option>
                    <option value="Basic">Basic Plan</option>
                    <option value="Pro">Pro Professional Plan</option>
                    <option value="Enterprise">Enterprise Elite</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "حد المقاعد المستخدمة" : "User Seats Limit"}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editSeats}
                    onChange={(e) => setEditSeats(parseInt(e.target.value))}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 text-right"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "تاريخ انتهاء الترخيص" : "Subscription Expiration"}</label>
                  <input
                    type="date"
                    required
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 ltr text-left"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white text-xs font-bold rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-extrabold rounded-lg shadow-lg cursor-pointer transition-colors"
                >
                  {isRtl ? "حفظ وتفعيل التعديلات" : "Commit License Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL II: PASSWORD RESET */}
      {showResetModal && resetCompany && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-[#121214] border border-[#27272a] rounded-2xl shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
            
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800/80 mb-4 text-right">
              <button onClick={() => setShowResetModal(false)} className="text-zinc-400 hover:text-white p-1 text-sm font-bold">✕</button>
              <h3 className="text-base font-black text-white">{isRtl ? "تغيير بيانات الدخول للعميل" : "Reset Owner Password"}</h3>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-right">
              <div className="space-y-2 text-zinc-400 text-xs">
                <p>{isRtl ? `تحديث كلمة مرور المشرف الأساسي للمؤسسة: ` : `Reset secure credentials for tenant principal owner:`}</p>
                <p className="font-extrabold text-white text-center p-2 bg-zinc-900 border border-zinc-800 rounded font-sans">{resetCompany.ownerName} ({resetCompany.email})</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-bold block">{isRtl ? "كلمة المرور الجديدة" : "New Secure Password"}</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-white rounded-lg outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white text-xs font-bold rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-550 hover:bg-amber-500 text-zinc-900 text-xs font-extrabold rounded-lg shadow-lg cursor-pointer transition-colors"
                >
                  {isRtl ? "حفظ وتفعيل الجديدة" : "Save Credentials"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
