/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BusinessProfile, LanguageType } from "../types";
import { translations } from "../translations";
import { 
  Settings, ShieldAlert, BadgeCheck, Plus, X, Paintbrush, Upload, Image,
  Database, CloudLightning, CheckCircle2, Download, Key, AlertCircle
} from "lucide-react";
import SheetsSyncSettings from "./SheetsSyncSettings";
import { supabase, isSupabaseConfigured } from "../supabaseClient";
import { generateCompanyBackup } from "../lib/backupEngine";

interface SettingsViewProps {
  profile: BusinessProfile;
  onSaveProfile: (p: BusinessProfile) => void;
  lang: LanguageType;
  customColorsList: string[];
  onSaveCustomColors: (arr: string[]) => void;
  onTriggerNotification: (msg: string) => void;
  onTriggerRefreshOrders?: () => void;
  session?: any;
}

export default function SettingsView({
  profile,
  onSaveProfile,
  lang,
  customColorsList,
  onSaveCustomColors,
  onTriggerNotification,
  onTriggerRefreshOrders,
  session
}: SettingsViewProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";

  // State variables synchronized with user props
  const [bName, setBName] = useState(profile.businessName || "");
  const [bEmail, setBEmail] = useState(profile.email || "");
  const [bPhone, setBPhone] = useState(profile.phone || "");
  const [bCurrency, setBCurrency] = useState(profile.currency || "DZD");
  const [bCountry, setBCountry] = useState<"Algeria" | "France" | "Morocco" | "Other">(profile.country || "Algeria");
  const [bRegistry, setBRegistry] = useState(profile.commercialRegistry || "");
  const [bAddress, setBAddress] = useState(profile.address || "");
  const [bRC1, setBRC1] = useState(profile.rc1 || "");
  const [bRC2, setBRC2] = useState(profile.rc2 || "");
  const [bNIF, setBNIF] = useState(profile.nif || "");
  const [bLogoUrl, setBLogoUrl] = useState<string | undefined>(profile.logoUrl);

  // Load company data DIRECTLY from Supabase corevia_companies (Single Source of Truth)
  React.useEffect(() => {
    if (!session?.company_id || !supabase) return;
    const companyId = session.company_id;
    supabase.from("corevia_companies").select("*").eq("id", companyId).maybeSingle().then(({ data, error }) => {
      if (data && !error) {
        setBName(data.name || profile.businessName || "");
        setBEmail(data.owner_email || data.email || profile.email || "");
        setBPhone(data.phone || profile.phone || "");
      }
    });
    supabase.from("corevia_profile").select("*").eq("company_id", companyId).maybeSingle().then(({ data, error }) => {
      if (data && !error) {
        setBName(data.business_name || bName);
        setBCurrency(data.currency || "DZD");
        setBCountry((data.country as any) || "Algeria");
        setBAddress(data.address || "");
        setBRegistry(data.commercial_registry || "");
        setBRC1(data.rc1 || "");
        setBRC2(data.rc2 || "");
        setBNIF(data.nif || "");
        setBLogoUrl(data.logo_url || undefined);
      }
    });
  }, [session?.company_id]);

  // Synchronize local states when parent profile changes
  React.useEffect(() => {
    setBName(profile.businessName || "");
    setBEmail(profile.email || "");
    setBPhone(profile.phone || "");
    setBCurrency(profile.currency || "DZD");
    setBCountry(profile.country || "Algeria");
    setBRegistry(profile.commercialRegistry || "");
    setBAddress(profile.address || "");
    setBRC1(profile.rc1 || "");
    setBRC2(profile.rc2 || "");
    setBNIF(profile.nif || "");
    setBLogoUrl(profile.logoUrl);
    setPasscode(profile.passcode || "1234");
  }, [profile]);
  
  // Security
  const [passcode, setPasscode] = useState(profile.passcode || "1234");
  const [showPasscodeVal, setShowPasscodeVal] = useState(false);

  // New color adding block
  const [newColorEntry, setNewColorEntry] = useState("");

  // Page Lock Management state
  const [pageLockPassword, setPageLockPassword] = useState(() => localStorage.getItem("corevia_page_lock_password") || "");
  const [lockedPages, setLockedPages] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("corevia_locked_pages") || "[]"); }
    catch { return []; }
  });
  // Admin password change state
  const [currentAdminPw, setCurrentAdminPw] = useState("");
  const [newAdminPw, setNewAdminPw] = useState("");

  // Supabase Integration & Synchronization Modules
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Download compressed database backup (ZIP)
  const handleDownloadBackup = async () => {
    if (!supabase) {
      onTriggerNotification(lang === "ar" ? "❌ السحابة غير مهيأة." : "❌ Cloud not configured.");
      return;
    }
    const companyId = session?.company_id;
    if (!companyId) {
      onTriggerNotification(lang === "ar" ? "❌ لا يوجد معرف شركة." : "❌ No company ID.");
      return;
    }
    setIsBackingUp(true);
    try {
      onTriggerNotification(lang === "ar" ? "جاري تجميع وضغط قاعدة البيانات..." : "Packaging and compressing database...");
      const ok = await generateCompanyBackup(companyId, bName || "Company");
      if (ok) {
        onTriggerNotification(lang === "ar" ? "✅ تم تنزيل النسخة الاحتياطية (ZIP) بنجاح!" : "✅ Backup ZIP downloaded successfully!");
      } else {
        onTriggerNotification(lang === "ar" ? "❌ فشلت عملية النسخ الاحتياطي." : "❌ Backup failed.");
      }
    } catch (err: any) {
      console.error("Backup error:", err);
      onTriggerNotification(lang === "ar" ? "❌ خطأ في النسخ الاحتياطي." : "❌ Backup error.");
    } finally {
      setIsBackingUp(false);
    }
  };



  // Sub-tabs active page indicator
  const [activePage, setActivePage] = useState<"company" | "control" | "integrations">("company");

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultString = reader.result as string;
        setBLogoUrl(resultString);
        onTriggerNotification(
          lang === "ar"
            ? "تم تحميل الشعار بنجاح! يرجى الضغط على زر تطبيق وحفظ التعديلات في الأسفل لاعتماد التغييرات."
            : "Logo chargé avec succès ! Veuillez cliquer sur le bouton de sauvegarde pour appliquer."
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Localization Dictionary
  const localT = {
    ar: {
      desc: "تهيئة الهوية الميدانية، كلمات المرور، وربط السجلات التجارية",
      formHeader: "📂 إعدادات هوية ومكتب العلامة التجارية",
      labelBName: "اسم الشركة / المتجر الرئيسي *",
      labelBEmail: "البريد الإلكتروني المعتمد *",
      labelBPhone: "هاتف التواصل",
      labelBCurrency: "العملة الافتراضية للتقارير",
      labelBRegistry: "السجل التجاري أو الرقم الضريبي",
      securitySection: "شفرة المرور وحماية علامات التبويب المقيدة",
      passcodeDesc: "الرقم السري PIN المستخدم لحظر الدخول الغير مصرح به للتاب والملفات المالية أو الأجور للعمال (4 أرقام عددية).",
      btnSave: "تطبيق وحفظ التعديلات البنائية",
      colorsHeader: "لوحة الألوان المدعومة للملابس",
      colorsLabel: "أضف خيارات ألوان جديدة لتظهر مباشرة عند بناء مواصفات الملابس والموديلات:",
      colorPlaceholder: "مثال: أحمر فاقع (Bright Red)...",
      passcodePlaceholder: "1234",
    },
    fr: {
      desc: "Spécifications de la firme, mot de passe et registre commercial",
      formHeader: "📂 Identité d'entreprise & Espace de travail",
      labelBName: "Nom de l'entreprise / Boutique principale *",
      labelBEmail: "Adresse e-mail agréée *",
      labelBPhone: "Téléphone de contact",
      labelBCurrency: "Devise par défaut pour les rapports",
      labelBRegistry: "Registre de Commerce ou R.C. / ID Fiscal",
      securitySection: "Code d'accès & Restrictions des onglets financiers",
      passcodeDesc: "Le code PIN est requis pour restreindre l'accès non autorisé aux onglets financiers ou salaires (4 chiffres).",
      btnSave: "Appliquer et sauvegarder",
      colorsHeader: "Palettes de couleurs de vêtements",
      colorsLabel: "Ajoutez de nouvelles options de couleurs pour vos spécifications :",
      colorPlaceholder: "Ex: Rouge vif (Bright Red)...",
      passcodePlaceholder: "1234",
    },
    en: {
      desc: "Manage profile, passwords, and commercial registry details",
      formHeader: "📂 Business Identity & Workspace Settings",
      labelBName: "Business Name / Main Store *",
      labelBEmail: "Authorized Email *",
      labelBPhone: "Contact Phone",
      labelBCurrency: "Default Reporting Currency",
      labelBRegistry: "Commercial Registry / Tax ID",
      securitySection: "Passcode Shield & Tab Restrictions",
      passcodeDesc: "The PIN code restricts unauthorized access to protected financial sheets and payroll listings (4 digits).",
      btnSave: "Apply & Save Configurations",
      colorsHeader: "Supported Apparel Colors Palette",
      colorsLabel: "Define new color options to populate cloth/model forms instantly:",
      colorPlaceholder: "e.g., Bright Red...",
      passcodePlaceholder: "1234",
    }
  };

  const currentT = localT[lang] || localT.en;

  const handleUpdateBrandSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim()) return;

    const modified: BusinessProfile = {
      ...profile,
      businessName: bName,
      email: bEmail,
      phone: bPhone,
      currency: bCurrency,
      country: bCountry,
      commercialRegistry: bRegistry,
      passcode,
      address: bAddress,
      rc1: bRC1,
      rc2: bRC2,
      nif: bNIF,
      logoUrl: bLogoUrl
    };

    onSaveProfile(modified);

    // Also persist directly to Supabase corevia_companies (Single Source of Truth)
    if (supabase && session?.company_id) {
      supabase.from("corevia_companies").upsert({
        id: session.company_id,
        name: bName,
        owner_email: bEmail,
        phone: bPhone,
        country: bCountry
      }).then(() => {}, err => console.warn("Settings: corevia_companies upsert error", err));

      supabase.from("corevia_profile").upsert({
        id: session.company_id,
        company_id: session.company_id,
        business_name: bName,
        currency: bCurrency,
        country: bCountry,
        address: bAddress,
        phone: bPhone,
        email: bEmail,
        commercial_registry: bRegistry,
        rc1: bRC1,
        rc2: bRC2,
        nif: bNIF,
        logo_url: bLogoUrl || null,
        passcode: passcode
      }).then(() => {}, err => console.warn("Settings: corevia_profile upsert error", err));
    }

    onTriggerNotification(
      lang === "ar"
        ? "تم حفظ وتحديث الإعدادات المؤسسية بنجاح."
        : lang === "fr"
        ? "Paramètres de l'entreprise enregistrés avec succès."
        : "Workspace settings saved successfully."
    );
  };

  const handleAddNewColorOption = () => {
    if (!newColorEntry.trim()) return;
    if (customColorsList.some(x => x.toLowerCase() === newColorEntry.trim().toLowerCase())) {
      onTriggerNotification(
        lang === "ar"
          ? "هذا اللون مسجل مسبقاً في الدليل الإنشائي."
          : lang === "fr"
          ? "Cette couleur est déjà enregistrée."
          : "This color is already registered."
      );
      return;
    }

    const updated = [...customColorsList, newColorEntry.trim()];
    onSaveCustomColors(updated);
    onTriggerNotification(
      lang === "ar"
        ? `تمت إضافة اللون الجديد (${newColorEntry}) لقائمة التحديد.`
        : lang === "fr"
        ? `Nouvelle couleur (${newColorEntry}) ajoutée.`
        : `New color (${newColorEntry}) added.`
    );
    setNewColorEntry("");
  };

  const handleRemoveColorOption = (colorText: string) => {
    const updated = customColorsList.filter(c => c !== colorText);
    onSaveCustomColors(updated);
  };

  const tabNames = {
    ar: {
      company: "💼 إعدادات الشركة",
      control: "🎮 التحكم في المنصة",
      integrations: "🚀 التكاملات"
    },
    fr: {
      company: "💼 Établissement",
      control: "🎮 Contrôle Plateforme",
      integrations: "🚀 Intégrations"
    },
    en: {
      company: "💼 Company Profile",
      control: "🎮 Platform Control",
      integrations: "🚀 Integrations"
    }
  };
  const activeTabsText = tabNames[lang] || tabNames.en;

  return (
    <div className="space-y-4 pt-16 md:pt-4 text-right" id="settings_panel_view">
      
      {/* Visual branding header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#27272a] pb-3 ${isRtl ? "text-right" : "text-left"}`} id="settings_branding">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-1.5 justify-end">
            <span>{t.navSettings}</span>
            <span>⚙️</span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-0.5">{currentT.desc}</p>
        </div>
      </div>

      {/* Modern Sub-Navigation tabs */}
      <div 
        className="flex border-b border-[#27272a] gap-2 mb-4 scrollbar-none overflow-x-auto" 
        id="settings_sub_tabs"
        style={{ direction: isRtl ? "rtl" : "ltr" }}
      >
        <button
          onClick={() => setActivePage("company")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activePage === "company"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          {activeTabsText.company}
        </button>
        <button
          onClick={() => setActivePage("control")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activePage === "control"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          {activeTabsText.control}
        </button>
        <button
          onClick={() => setActivePage("integrations")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activePage === "integrations"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          {activeTabsText.integrations}
        </button>

      </div>

      {/* Tab 1: Company Profile Configuration */}
      {activePage === "company" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 bounce-in" id="settings_structural_grid_company_tab">
          
          {/* SECTION 1: CORE BRAND METADATA & LOCK CODE */}
          <div className={`lg:col-span-2 bg-[#09090b] p-4 rounded-xl border border-[#27272a] space-y-3.5 ${isRtl ? "text-right" : "text-left"}`} id="brand_metadata_settings_form_wrapper">
            <h2 className="text-xs font-bold text-white border-b border-[#27272a] pb-2">{currentT.formHeader}</h2>

            <form onSubmit={handleUpdateBrandSettings} className="space-y-3.5 text-xs font-sans">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Business Name */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBName}</label>
                  <input
                    type="text"
                    required
                    value={bName}
                    onChange={(e) => setBName(e.target.value)}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBEmail}</label>
                  <input
                    type="email"
                    required
                    value={bEmail}
                    onChange={(e) => setBEmail(e.target.value)}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 font-mono text-xs ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Phone */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBPhone}</label>
                  <input
                    type="text"
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                    placeholder="+213 550 12 34 56"
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none placeholder-slate-500 font-mono text-xs ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">
                    {lang === "ar" ? "بلد النشاط أو المقر" : lang === "fr" ? "Pays d'activité" : "Country of operation"}
                  </label>
                  <select
                    value={bCountry}
                    onChange={(e) => {
                      const selected = e.target.value as "Algeria" | "France" | "Morocco" | "Other";
                      setBCountry(selected);
                      if (selected === "Algeria") setBCurrency("DZD");
                      else if (selected === "France") setBCurrency("EUR");
                    }}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none font-semibold text-xs ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <option value="Algeria" className="bg-[#09090b]">{lang === "ar" ? "الجزائر 🇩🇿" : lang === "fr" ? "Algérie" : "Algeria"}</option>
                    <option value="France" className="bg-[#09090b]">{lang === "ar" ? "فرنسا 🇫🇷" : lang === "fr" ? "France" : "France"}</option>
                    <option value="Morocco" className="bg-[#09090b]">{lang === "ar" ? "المغرب 🇲🇦" : lang === "fr" ? "Maroc" : "Morocco"}</option>
                    <option value="Other" className="bg-[#09090b]">{lang === "ar" ? "أخرى 🌐" : lang === "fr" ? "Autre/Global" : "Other/Global"}</option>
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBCurrency}</label>
                  <select
                    value={bCurrency}
                    onChange={(e) => setBCurrency(e.target.value)}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none font-semibold text-xs ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <option value="DZD" className="bg-[#09090b]">DZD (الدينار الجزائري)</option>
                    <option value="USD" className="bg-[#09090b]">USD (الدولار الأمريكي)</option>
                    <option value="EUR" className="bg-[#09090b]">EUR (اليورو الأوروبي)</option>
                  </select>
                </div>

                {/* Fiscal Registry */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBRegistry}</label>
                  <input
                    type="text"
                    value={bRegistry}
                    onChange={(e) => setBRegistry(e.target.value)}
                    placeholder="16/00-0982736B20"
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-[#27272a] placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>
              </div>

              {/* SECTION: COMPANY INFORMATION (معلومات الشركة) */}
              <div className="p-3 bg-[#040406]/50 rounded-lg border border-[#27272a] space-y-2.5">
                <span className={`text-[10px] font-bold text-slate-450 uppercase tracking-widest block border-b border-[#27272a]/80 pb-1.5 flex items-center gap-1 ${isRtl ? "justify-end flex-row-reverse" : "justify-start flex-row"}`}>
                  <span>🏢 معلومات السجل والشركة (بيانات الفاتورة والتقارير)</span>
                </span>

                {/* Company Logo Upload Block */}
                <div className="p-3 bg-[#0d0d11]/80 rounded-lg border border-[#27272a] flex flex-col sm:flex-row items-center gap-3.5" style={{ direction: isRtl ? "rtl" : "ltr" }}>
                  <div className="w-16 h-16 rounded-lg bg-[#040406] border border-[#27272a] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {bLogoUrl ? (
                      <img src={bLogoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-[10px] text-slate-500 font-mono uppercase font-bold text-center">No Logo</div>
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-right" style={{ textAlign: isRtl ? "right" : "left" }}>
                    <span className="block text-slate-200 font-bold text-[11px] mb-1">شعار الشركة (Company Logo Setting)</span>
                    <p className="text-[10px] text-slate-400 mb-2">أضف شعار الشركة ليظهر تلقائياً في فواتير نظام ERP الخاص بك.</p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start" style={{ flexDirection: isRtl ? "row" : "row-reverse", justifyContent: isRtl ? "flex-start" : "flex-end" }}>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-slate-200 rounded-lg cursor-pointer text-[10px] font-bold transition-all">
                        <Upload className="w-3.5 h-3.5 text-rose-500" />
                        <span>{bLogoUrl ? "تغيير الشعار" : "تحميل شعار جديد"}</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      {bLogoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setBLogoUrl(undefined);
                            onTriggerNotification(lang === "ar" ? "تمت إزالة الشعار مؤقتاً. اضغط تطبيق وحفظ لاعتماده." : "Logo supprimé. Enregistrez pour appliquer.");
                          }}
                          className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-350 border border-rose-900/50 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          إزالة الشعار
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Company Phone */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">رقم هاتف الشركة (TEL) *</label>
                    <input
                      type="text"
                      required
                      value={bPhone}
                      onChange={(e) => setBPhone(e.target.value)}
                      placeholder="+213 550 12 34 56"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 font-mono text-xs placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* Company Address */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">مقر الشركة (العنوان الرسمي) *</label>
                    <input
                      type="text"
                      required
                      value={bAddress}
                      onChange={(e) => setBAddress(e.target.value)}
                      placeholder="Didouche Mourad, Alger"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* RC 1 */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">السجل التجاري (RC)</label>
                    <input
                      type="text"
                      value={bRC1}
                      onChange={(e) => setBRC1(e.target.value)}
                      placeholder="16/00-0987654B20"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* RC 2 */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">رقم التعريف الإحصائي (NIS)</label>
                    <input
                      type="text"
                      value={bRC2}
                      onChange={(e) => setBRC2(e.target.value)}
                      placeholder="20B0987654"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">الرقم التعريفي الجبائي (NIF)</label>
                    <input
                      type="text"
                      value={bNIF}
                      onChange={(e) => setBNIF(e.target.value)}
                      placeholder="002016098765432"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PIN PASSCODE SECURITY */}
              <div className="p-3 bg-[#040406]/50 rounded-lg border border-[#27272a] space-y-2.5">
                <span className={`text-[10px] font-bold text-slate-450 uppercase tracking-widest block border-b border-[#27272a]/80 pb-1.5 flex items-center gap-1 ${isRtl ? "justify-end flex-row-reverse" : "justify-start flex-row"}`}>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>{currentT.securitySection}</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3box">
                  <div className="relative">
                    <input
                      type={showPasscodeVal ? "text" : "password"}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-1.8 text-center font-mono text-base text-white tracking-widest focus:outline-none focus:border-rose-500"
                      placeholder={currentT.passcodePlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscodeVal(!showPasscodeVal)}
                      className={`absolute ${isRtl ? "left-3" : "right-3"} top-2.5 text-slate-450 font-bold text-[9px] hover:text-white cursor-pointer`}
                    >
                      {showPasscodeVal ? (lang === "ar" ? "إخفاء" : lang === "fr" ? "Cacher" : "Hide") : (lang === "ar" ? "إظهار" : lang === "fr" ? "Montrer" : "Show")}
                    </button>
                  </div>

                  <div className={`flex flex-col justify-center text-slate-400 text-[9.5px] ${isRtl ? "text-right" : "text-left"}`}>
                    <p>{currentT.passcodeDesc}</p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className={`pt-2 border-t border-[#27272a] flex ${isRtl ? "justify-end" : "justify-start"}`}>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-550 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md focus:outline-none cursor-pointer"
                >
                  {currentT.btnSave}
                </button>
              </div>

            </form>
          </div>

          {/* SECTION 2: CUSTOM COLORS PALETTES LIST */}
          <div className={`bg-[#09090b] p-4 rounded-xl border border-[#27272a] space-y-3 ${isRtl ? "text-right" : "text-left"}`} id="colors_custom_palette_console">
            <h3 className={`text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#27272a] pb-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <Paintbrush className="w-3.5 h-3.5 text-rose-500" />
              <span>{currentT.colorsHeader}</span>
            </h3>

            <p className="text-[10px] text-slate-400 leading-normal">{currentT.colorsLabel}</p>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={newColorEntry}
                onChange={(e) => setNewColorEntry(e.target.value)}
                placeholder={currentT.colorPlaceholder}
                className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white text-xs rounded-lg focus:outline-none focus:border-rose-500 ${isRtl ? "text-right" : "text-left"}`}
              />
              <button
                onClick={handleAddNewColorOption}
                className="bg-[#27272a] hover:bg-[#3f3f46] text-white p-2 rounded-lg text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className={`flex flex-wrap gap-1.5 pt-1.5 ${isRtl ? "justify-start sm:justify-end flex-row-reverse" : "justify-start flex-row"}`} id="custom_colors_index">
              {customColorsList.map((col, idx) => (
                <span key={idx} className={`bg-[#040406] border border-[#27272a] text-[9.5px] py-0.5 px-2 rounded font-medium text-slate-350 flex items-center gap-1 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                  <span>{col}</span>
                  <button
                    onClick={() => handleRemoveColorOption(col)}
                    className="text-rose-450 hover:text-rose-400 font-bold text-xs cursor-pointer ml-1"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Supabase Relational Database Integration & Synchronization Console */}
      {activePage === "control" && (
        <div className="space-y-6 bounce-in text-right" id="supabase_connector_console">
          
          {/* Main Status Header Card */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isSupabaseConfigured ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                }`}>
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {isRtl ? "ربط قاعدة بيانات Supabase (PostgreSQL)" : "Supabase PostgreSQL Database Connector"}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {isRtl 
                      ? "إدارة الدخول، وحفظ الطلبيات، والمخزن، والعمال في سحابة مؤمنة."
                      : "Cloud-hosted relational replication for orders, warehouse stocks and active staff."}
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div>
                {isSupabaseConfigured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full text-[10px] font-black">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isRtl ? "متصل كودياً بالسحابة" : "Connected in code"}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/25 rounded-full text-[10px] font-black animate-pulse">
                    <CloudLightning className="w-3.5 h-3.5" />
                    <span>{isRtl ? "غير متصل (يعمل محلياً)" : "Disconnected (Local Sandbox)"}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Instruction block based on configure status */}
            {!isSupabaseConfigured ? (
              <div className="space-y-4">
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-xs text-zinc-350 leading-relaxed text-right space-y-2">
                  <p className="font-bold text-white flex items-center gap-1.5 justify-end">
                    <span>{isRtl ? "مطلوب إعداد مفاتيح البيئة (Environment Variables)" : "Environment Keys Required!"}</span>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </p>
                  <p>
                    {isRtl 
                      ? "لتفعيل الدخول السحابي وحسابات الأدمن الحقيقية والمزامنة عبر Vercel أو الخادم المحلي، يرجى تسجيل الدخول في Supabase.com وإنشاء مشروع جديد، ثم إضافة المتغيرات التالية في الإعدادات الخاصة بموقعك:"
                      : "To enable live cloud admin accounts, login sessions and multi-device persistence in Vercel or locally, please register at Supabase.com, create a project, and add these environmental variables:"}
                  </p>
                  <div className="bg-[#040406]/85 p-3 rounded-lg border border-zinc-800 font-mono text-[10px] text-left text-zinc-400 space-y-1" dir="ltr">
                    <div>VITE_SUPABASE_URL=<span className="text-zinc-500">_YOUR_SUPABASE_PROJECT_URL_</span></div>
                    <div>VITE_SUPABASE_ANON_KEY=<span className="text-zinc-500">_YOUR_SUPABASE_ANON_PUBLIC_KEY_</span></div>
                  </div>
                </div>

                <div className="text-zinc-400 text-xs">
                  {isRtl 
                    ? "💡 بمجرد وضع هذه المتغيرات في لوحة تحكم Vercel أو ملف .env محلياً، سيقوم الموقع تلقائياً بالتحويل من التخزين المحلي المؤقت (LocalStorage) إلى السحاب اللامتناهي للطلبيات والمخازن!"
                    : "💡 Once configured on Vercel or locally inside your environment variables, Corevia ERP will seamlessly upgrade from local Web storage to persistent Postgres Cloud Synchronization!"}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-zinc-350 leading-relaxed space-y-2">
                  <p className="font-black text-white flex items-center gap-1.5 justify-end">
                    <span>{isRtl ? "سحابة المزامنة نشطة! 🚀" : "Cloud Connection is Enabled! 🚀"}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </p>
                  <p>
                    {isRtl 
                      ? "لقد قمنا بتثبيت مكتبة Supabase JS بنجاح. يمكنك الآن اختبار الاتصال المباشر وقراءة/كتابة البيانات السحابية، ورفع النسخ المحلية الاحتياطية وتنزيلها من السحاب فورياً."
                      : "Your application is successfully linked to your PostgreSQL database. You can test your connection, upload current local browser database backups, and recover data anytime."}
                  </p>
                </div>

                {/* Download Backup + Reminder Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={handleDownloadBackup}
                    disabled={isBackingUp}
                    className="bg-[#18181b] hover:bg-zinc-800 border border-amber-500/15 text-amber-400 hover:text-amber-300 rounded-xl p-3 text-xs font-bold flex flex-col items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-55"
                  >
                    <Download className={`w-5 h-5 text-amber-500 ${isBackingUp ? "animate-bounce" : ""}`} />
                    <span>{isRtl ? "تنزيل نسخة احتياطية 📦" : "Download Backup 📦"}</span>
                  </button>
                  <button
                    onClick={() => {
                      const current = localStorage.getItem("corevia_backup_reminder_days") || "7";
                      const days = prompt(isRtl ? "كم يوماً بين تذكيرات النسخ الاحتياطي؟" : "Days between backup reminders?", current);
                      if (days && !isNaN(parseInt(days))) {
                        localStorage.setItem("corevia_backup_reminder_days", days);
                        onTriggerNotification(isRtl ? `✅ تم تعيين التذكير كل ${days} يوم` : `✅ Reminder set every ${days} days`);
                      }
                    }}
                    className="bg-[#18181b] hover:bg-zinc-800 border border-indigo-500/15 text-indigo-400 hover:text-indigo-300 rounded-xl p-3 text-xs font-bold flex flex-col items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{isRtl ? "تعديل وقت التذكير" : "Edit Reminder Time"}</span>
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* Page Lock Management */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#27272a] pb-3">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>{isRtl ? "إدارة قفل الصفحات" : "Page Lock Management"}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-bold text-[10.5px] mb-1">
                  {isRtl ? "كلمة مرور قفل الصفحات" : "Page Lock Password"}
                </label>
                <input
                  type="text"
                  value={pageLockPassword}
                  onChange={(e) => setPageLockPassword(e.target.value)}
                  className="w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg text-xs"
                />
              </div>
              <div className="flex items-end pb-1">
                <button
                  onClick={() => {
                    if (!pageLockPassword.trim()) return;
                    localStorage.setItem("corevia_page_lock_password", pageLockPassword);
                    onTriggerNotification(isRtl ? "✅ تم حفظ كلمة مرور قفل الصفحات" : "✅ Page lock password saved");
                  }}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  {isRtl ? "حفظ كلمة القفل" : "Save Lock Password"}
                </button>
              </div>
            </div>
            <div>
              <p className="text-slate-400 font-bold text-[10.5px] mb-2">
                {isRtl ? "الصفحات المقفلة:" : "Locked Pages:"}
              </p>
              <div className="flex flex-wrap gap-3">
                {["workers", "expenses", "suppliers", "profit", "yearly"].map(page => (
                  <label key={page} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockedPages.includes(page)}
                      onChange={() => {
                        setLockedPages(prev =>
                          prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
                        );
                      }}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-xs text-slate-300 capitalize">{page}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => {
                  localStorage.setItem("corevia_locked_pages", JSON.stringify(lockedPages));
                  onTriggerNotification(isRtl ? "✅ تم حفظ الصفحات المقفلة" : "✅ Locked pages saved");
                }}
                className="mt-3 py-1.5 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                {isRtl ? "حفظ الصفحات المقفلة" : "Save Locked Pages"}
              </button>
            </div>
          </div>

          {/* Change Admin Password */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-[#27272a] pb-3">
              <Key className="w-5 h-5 text-rose-500" />
              <span>{isRtl ? "تغيير كلمة مرور المدير" : "Change Admin Password"}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-bold text-[10.5px] mb-1">
                  {isRtl ? "كلمة المرور الحالية" : "Current Password"}
                </label>
                <input
                  type="password"
                  value={currentAdminPw}
                  onChange={(e) => setCurrentAdminPw(e.target.value)}
                  className="w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold text-[10.5px] mb-1">
                  {isRtl ? "كلمة المرور الجديدة" : "New Password"}
                </label>
                <input
                  type="password"
                  value={newAdminPw}
                  onChange={(e) => setNewAdminPw(e.target.value)}
                  className="w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg text-xs"
                />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!newAdminPw || newAdminPw.length < 6) {
                  onTriggerNotification(isRtl ? "❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "❌ Password must be at least 6 characters");
                  return;
                }
                try {
                  const { error } = await supabase.auth.updateUser({ password: newAdminPw });
                  if (error) throw error;
                  onTriggerNotification(isRtl ? "✅ تم تغيير كلمة المرور بنجاح" : "✅ Password changed successfully");
                  setCurrentAdminPw("");
                  setNewAdminPw("");
                } catch (err: any) {
                  onTriggerNotification(isRtl ? "❌ فشل تغيير كلمة المرور: " + (err?.message || "") : "❌ Failed: " + (err?.message || ""));
                }
              }}
              className="py-2.5 px-6 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              {isRtl ? "تغيير كلمة المرور" : "Change Password"}
            </button>
          </div>

        </div>
      )}

      {/* Tab 3: Workspace integrations & Pipelines */}
      {activePage === "integrations" && (
        <div className="space-y-5 bounce-in" id="settings_integrations_page_viewport">
          
          <div className={`p-4 bg-[#09090b] rounded-xl border border-[#27272a] ${isRtl ? "text-right" : "text-left"}`}>
            <h3 className="text-xs font-bold text-white mb-2">⭐ {isRtl ? "مزامنة Google Sheets الحية" : "Live Google Sheets Connector Pipeline"}</h3>
            <p className="text-[10px] text-zinc-400 mb-4 leading-relaxed">
              {isRtl 
                ? "قم بربط حساب Google الخاص بك لبث وتحديث جميع طلبيات الكوريفيا والمنتجات في مستندات Google Sheets فوراً ومزامنة المبيعات وحركات المخزون الثنائية بشكل حي وتلقائي."
                : "Bind your secure Google Account profile to stream, record and map order details live inside Google Sheets spreadsheets automatically."}
            </p>
          </div>

          <SheetsSyncSettings 
            lang={lang} 
            onTriggerNotification={onTriggerNotification} 
            onTriggerRefreshOrders={onTriggerRefreshOrders} 
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Yalidine Express integration placeholder */}
            <div className="p-4 bg-zinc-900/10 border border-[#27272a] rounded-xl text-right space-y-2 opacity-65">
              <div className="flex items-center justify-between border-b border-[#27272a]/60 pb-2">
                <span className="text-[9px] bg-rose-550/15 text-rose-400 px-2 py-0.5 rounded font-bold border border-rose-500/20">{isRtl ? "قريباً جداً" : "Soon"}</span>
                <h4 className="text-xs font-bold text-white">Yalidine Express يالدين</h4>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                مزامنة تلقائية للطلبيات مع منصة يالدين، استخراج وتحديث أرقام التتبع وبطاقات الشحن بضغطة زر واحدة.
              </p>
            </div>

            {/* SMS Gateway integration placeholder */}
            <div className="p-4 bg-zinc-900/10 border border-[#27272a] rounded-xl text-right space-y-2 opacity-65">
              <div className="flex items-center justify-between border-b border-[#27272a]/60 pb-2">
                <span className="text-[9px] bg-rose-550/15 text-rose-400 px-2 py-0.5 rounded font-bold border border-rose-500/20">{isRtl ? "قريباً جداً" : "Soon"}</span>
                <h4 className="text-xs font-bold text-white">بوابة الرسائل SMS Gateway</h4>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                إرسال رسائل تأكيد نصية تلقائية للعملاء وتنبيهات بمواعيد تسليم الطرود والدفع عند الاستلام.
              </p>
            </div>

            {/* Algérie Poste integration placeholder */}
            <div className="p-4 bg-zinc-900/10 border border-[#27272a] rounded-xl text-right space-y-2 opacity-65">
              <div className="flex items-center justify-between border-b border-[#27272a]/60 pb-2">
                <span className="text-[9px] bg-rose-550/15 text-rose-400 px-2 py-0.5 rounded font-bold border border-rose-500/20">{isRtl ? "قريباً جداً" : "Soon"}</span>
                <h4 className="text-xs font-bold text-white">بريد الجزائر (ECCP / ECC)</h4>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                متابعة الطرود البريدية، واستيراد تقارير الدفع وإشعارات استلام المبالغ المالية لحسابك الجاري ECC.
              </p>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
