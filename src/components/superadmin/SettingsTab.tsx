import React, { useState, useEffect } from "react";
import { 
  Settings, Mail, Phone, Globe, Lock, Power, RefreshCw, FileText, 
  HelpCircle, CheckCircle, Save, Sliders, Server, MessageSquare,
  Activity, Award, Layers, ShieldCheck
} from "lucide-react";
import { fetchPlatformConfig, savePlatformConfig, PlatformConfig } from "../../platformConfigService";

interface SettingsTabProps {
  isRtl: boolean;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
}

export default function SettingsTab({ isRtl, onTriggerNotification }: SettingsTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Core configuration states
  const [platformName, setPlatformName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("DZD");
  const [smtpServer, setSmtpServer] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");

  // Platform Version System states
  const [currentVersion, setCurrentVersion] = useState("v2.5.0");
  const [releaseDate, setReleaseDate] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [minDbVersion, setMinDbVersion] = useState("");
  const [migrationStatus, setMigrationStatus] = useState("");

  // Subscription Pricing tiers states
  const [starterPrice, setStarterPrice] = useState(29);
  const [starterSeats, setStarterSeats] = useState(5);
  const [professionalPrice, setProfessionalPrice] = useState(79);
  const [professionalSeats, setProfessionalSeats] = useState(15);
  const [enterprisePrice, setEnterprisePrice] = useState(199);
  const [enterpriseSeats, setEnterpriseSeats] = useState(99);

  // New ERP Modules states (comma separated)
  const [erpModulesText, setErpModulesText] = useState("");

  // Load configuration from Supabase
  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = await fetchPlatformConfig();
      setPlatformName(config.platformName);
      setSupportEmail(config.supportEmail);
      setPhone(config.phone);
      setWhatsapp(config.whatsapp);
      setTelegram(config.telegram);
      setWebsite(config.website);
      setDocsUrl(config.docsUrl);
      setMaintenanceMode(config.maintenanceMode);
      setDefaultCurrency(config.defaultCurrency);
      setSmtpServer(config.smtpServer);
      setSmtpPort(config.smtpPort);
      setSmtpUser(config.smtpUser);

      // Version states
      setCurrentVersion(config.currentVersion);
      setReleaseDate(config.releaseDate);
      setReleaseNotes(config.releaseNotes);
      setMinDbVersion(config.minDbVersion);
      setMigrationStatus(config.migrationStatus);

      // Plans
      const plans = config.subscriptionPlans || {};
      setStarterPrice(plans.Starter?.price ?? 29);
      setStarterSeats(plans.Starter?.seats ?? 5);
      setProfessionalPrice(plans.Professional?.price ?? 79);
      setProfessionalSeats(plans.Professional?.seats ?? 15);
      setEnterprisePrice(plans.Enterprise?.price ?? 199);
      setEnterpriseSeats(plans.Enterprise?.seats ?? 99);

      // Modules
      setErpModulesText((config.newErpModules || []).join(", "));
    } catch (err: any) {
      console.error("Failed to load platform settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedConfig: PlatformConfig = {
        platformName,
        supportEmail,
        phone,
        whatsapp,
        telegram,
        website,
        docsUrl,
        maintenanceMode,
        defaultCurrency,
        smtpServer,
        smtpPort,
        smtpUser,
        currentVersion,
        releaseDate,
        releaseNotes,
        minDbVersion,
        migrationStatus,
        subscriptionPlans: {
          Starter: { price: Number(starterPrice), seats: Number(starterSeats) },
          Professional: { price: Number(professionalPrice), seats: Number(professionalSeats) },
          Enterprise: { price: Number(enterprisePrice), seats: Number(enterpriseSeats) }
        },
        newErpModules: erpModulesText
          .split(",")
          .map(m => m.trim())
          .filter(m => m.length > 0)
      };

      await savePlatformConfig(updatedConfig);
      onTriggerNotification(
        isRtl 
          ? "تم حفظ وتوزيع إعدادات المنصة السحابية وبوابات الدعم بنجاح لجميع العملاء والمستأجرين!" 
          : "Global platform settings synchronized and rolled out immediately!", 
        "success"
      );
    } catch (err: any) {
      onTriggerNotification(
        isRtl ? `فشل الحفظ: ${err.message}` : `Save failed: ${err.message}`, 
        "info"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs text-zinc-400 font-bold">
          {isRtl ? "جاري تحميل إعدادات المنصة والتحقق من الإصدار..." : "Fetching platform configurations & checking build metadata..."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveSettings} className="space-y-6" id="super_admin_settings_tab">
      
      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card I: Platform Branding & Support coordinates */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm text-right">
          <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? "إعدادات الهوية والدعم الفني (توزيع فوري)" : "Platform Identity & Support (Instant Sync)"}</span>
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "اسم المنصة" : "Platform Name"}</label>
                <input 
                  type="text" 
                  value={platformName} 
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 text-right"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "بريد الدعم الرسمي" : "Support Inbox"}</label>
                <input 
                  type="email" 
                  value={supportEmail} 
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "رقم الهاتف" : "Support Hotline"}</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "رقم الواتساب" : "WhatsApp Handle"}</label>
                <input 
                  type="text" 
                  value={whatsapp} 
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "حساب التليجرام" : "Telegram Username"}</label>
                <input 
                  type="text" 
                  value={telegram} 
                  onChange={(e) => setTelegram(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "الموقع الرسمي" : "Marketing Website"}</label>
                <input 
                  type="text" 
                  value={website} 
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "رابط التوثيق التقني (Docs)" : "Documentation URL"}</label>
              <input 
                type="text" 
                value={docsUrl} 
                onChange={(e) => setDocsUrl(e.target.value)}
                className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
              />
            </div>
          </div>
        </div>

        {/* Card II: Enterprise Platform Versioning System */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm text-right">
          <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>{isRtl ? "نظام إصدار المنصة (تتبع التحديث السلس)" : "Platform Versioning System"}</span>
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "رقم الإصدار الحالي" : "Current Build Version"}</label>
                <input 
                  type="text" 
                  value={currentVersion} 
                  onChange={(e) => setCurrentVersion(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-emerald-400 font-mono rounded outline-none focus:border-indigo-600 text-right"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "تاريخ الإصدار" : "Release Date"}</label>
                <input 
                  type="date" 
                  value={releaseDate} 
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "الحد الأدنى لقاعدة البيانات" : "Minimum Database Version"}</label>
                <input 
                  type="text" 
                  value={minDbVersion} 
                  onChange={(e) => setMinDbVersion(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 text-right"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "حالة الهجرة للمستأجرين" : "Global Migration Status"}</label>
                <select 
                  value={migrationStatus} 
                  onChange={(e) => setMigrationStatus(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-indigo-400 font-extrabold rounded outline-none focus:border-indigo-600 text-right"
                >
                  <option value="Completed">🟢 Completed (Safe & Enforced)</option>
                  <option value="In Progress">🟡 Processing Additions</option>
                  <option value="Idle">⚪ No Active Database Migrations</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "ملاحظات الإصدار ومستند التحديث" : "Release Notes Summary"}</label>
              <textarea 
                rows={2}
                value={releaseNotes} 
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="e.g. Added multi-tenant RLS guards and additive platform config updates."
                className="w-full p-2.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded outline-none focus:border-indigo-600 text-right resize-none"
              />
            </div>
          </div>
        </div>

        {/* Card III: Global Subscription Packages & Seats Editor */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm text-right">
          <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
            <Award className="w-4 h-4 text-amber-400" />
            <span>{isRtl ? "أسعار وتراخيص باقات الاشتراك (منع الهاردكود)" : "Global Subscription Packages & Licensing"}</span>
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {/* Starter */}
              <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl space-y-2 text-right">
                <span className="text-[10px] font-black text-zinc-400 uppercase block">{isRtl ? "الباقة الأساسية" : "Starter"}</span>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 font-bold block">{isRtl ? "السعر ($)" : "Price ($)"}</label>
                  <input 
                    type="number" 
                    value={starterPrice} 
                    onChange={(e) => setStarterPrice(Number(e.target.value))}
                    className="w-full p-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white rounded text-center"
                  />
                  <label className="text-[9px] text-zinc-500 font-bold block">{isRtl ? "المقاعد" : "Seats Limit"}</label>
                  <input 
                    type="number" 
                    value={starterSeats} 
                    onChange={(e) => setStarterSeats(Number(e.target.value))}
                    className="w-full p-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white rounded text-center"
                  />
                </div>
              </div>

              {/* Professional */}
              <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl space-y-2 text-right">
                <span className="text-[10px] font-black text-indigo-400 uppercase block">{isRtl ? "الباقة الاحترافية" : "Professional"}</span>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 font-bold block">{isRtl ? "السعر ($)" : "Price ($)"}</label>
                  <input 
                    type="number" 
                    value={professionalPrice} 
                    onChange={(e) => setProfessionalPrice(Number(e.target.value))}
                    className="w-full p-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white rounded text-center"
                  />
                  <label className="text-[9px] text-zinc-500 font-bold block">{isRtl ? "المقاعد" : "Seats Limit"}</label>
                  <input 
                    type="number" 
                    value={professionalSeats} 
                    onChange={(e) => setProfessionalSeats(Number(e.target.value))}
                    className="w-full p-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white rounded text-center"
                  />
                </div>
              </div>

              {/* Enterprise */}
              <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl space-y-2 text-right">
                <span className="text-[10px] font-black text-amber-400 uppercase block">{isRtl ? "باقة المؤسسات" : "Enterprise"}</span>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-zinc-500 font-bold block">{isRtl ? "السعر ($)" : "Price ($)"}</label>
                  <input 
                    type="number" 
                    value={enterprisePrice} 
                    onChange={(e) => setEnterprisePrice(Number(e.target.value))}
                    className="w-full p-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white rounded text-center"
                  />
                  <label className="text-[9px] text-zinc-500 font-bold block">{isRtl ? "المقاعد" : "Seats Limit"}</label>
                  <input 
                    type="number" 
                    value={enterpriseSeats} 
                    onChange={(e) => setEnterpriseSeats(Number(e.target.value))}
                    className="w-full p-1.5 bg-zinc-950 border border-zinc-800 text-xs text-white rounded text-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card IV: System Modules & Global SMTP configuration */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm text-right">
          <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? "بوابات الربط وتوزيع ميزات المنصة" : "Gateways & ERP Application Modules"}</span>
          </h3>

          <div className="space-y-4 text-right">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "ميزات وخرائط الـ ERP المفعلة تلقائياً (مفصولة بفواصل)" : "Active ERP Application Modules (Comma-separated)"}</label>
              <input 
                type="text" 
                value={erpModulesText} 
                onChange={(e) => setErpModulesText(e.target.value)}
                placeholder="Sales & CRM, Inventory, Workers Payroll, Analytics..."
                className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 text-right"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "خادم SMTP Host" : "SMTP Host"}</label>
                <input 
                  type="text" 
                  value={smtpServer} 
                  onChange={(e) => setSmtpServer(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "منفذ خادم البريد Port" : "SMTP Port"}</label>
                <input 
                  type="number" 
                  value={smtpPort} 
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 text-right"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "بريد الإرسال الرسمي" : "SMTP Sender User"}</label>
                <input 
                  type="text" 
                  value={smtpUser} 
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
                />
              </div>
            </div>

            {/* Maintenance Mode Switch */}
            <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  setMaintenanceMode(!maintenanceMode);
                  onTriggerNotification(isRtl ? "تم تغيير وضع الصيانة بنجاح!" : "Maintenance state changed!", "success");
                }}
                className={`px-3 py-1 font-extrabold rounded text-[10px] cursor-pointer ${
                  maintenanceMode ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {maintenanceMode ? (isRtl ? "نشط" : "ONLINE") : (isRtl ? "معطل" : "DISABLED")}
              </button>
              <div className="space-y-0.5">
                <span className="text-white block">{isRtl ? "وضع صيانة المنصة" : "Global Maintenance Mode"}</span>
                <span className="text-[10px] text-zinc-500 font-normal block">{isRtl ? "يحظر كافة ملاك الحسابات والشركات من الدخول لمساحات العمل." : "Suspends workspace access to display platform update placeholder."}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Form Submission Anchor */}
      <div className="flex justify-end pt-2">
        <button 
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-black rounded-lg shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isRtl ? (saving ? "جاري توزيع الإعدادات..." : "حفظ وتفعيل كافة الإعدادات") : (saving ? "Deploying..." : "Save Platform Configurations")}</span>
        </button>
      </div>

    </form>
  );
}
