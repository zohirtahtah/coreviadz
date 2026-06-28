import React, { useState } from "react";
import { 
  Settings, Mail, Phone, Globe, Lock, Power, RefreshCw, FileText, 
  HelpCircle, CheckCircle, Save, Sliders, Server, MessageSquare
} from "lucide-react";

interface SettingsTabProps {
  isRtl: boolean;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
}

export default function SettingsTab({ isRtl, onTriggerNotification }: SettingsTabProps) {
  // Form coordinates
  const [platformName, setPlatformName] = useState("Corevia ERP");
  const [supportEmail, setSupportEmail] = useState("support@corevia.com");
  const [phone, setPhone] = useState("+213 555 12 34 56");
  const [whatsapp, setWhatsapp] = useState("+213 555 12 34 56");
  const [telegram, setTelegram] = useState("@corevia_support");
  const [website, setWebsite] = useState("https://corevia.com");
  const [docsUrl, setDocsUrl] = useState("https://docs.corevia.com");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("DZD");
  const [smtpServer, setSmtpServer] = useState("smtp.corevia.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("no-reply@corevia.com");

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onTriggerNotification(isRtl ? "تم حفظ إعدادات المنصة السحابية وبوابات الدعم بنجاح!" : "Platform metadata and SMTP config successfully synchronized!", "success");
  };

  return (
    <form onSubmit={handleSaveSettings} className="space-y-6" id="super_admin_settings_tab">
      
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card I: Platform Branding & Support coordinates */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm text-right">
          <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? "إعدادات الهوية والدعم الفني" : "Platform Branding & Coordinates"}</span>
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
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-bold block">{isRtl ? "بريد الدعم الرسمي" : "Support Inbox"}</label>
                <input 
                  type="email" 
                  value={supportEmail} 
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full p-2 bg-zinc-900 border border-zinc-800 text-xs text-white rounded outline-none focus:border-indigo-600 ltr text-left"
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

        {/* Card II: System & SMTP Gateway Configuration */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-sm text-right">
          <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>{isRtl ? "إعدادات خادم SMTP وجهاز الأمان" : "SMTP Server & Platform Settings"}</span>
          </h3>

          <div className="space-y-4 text-right">
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
                  onChange={(e) => setSmtpPort(parseInt(e.target.value))}
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
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-black rounded-lg shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <Save className="w-4 h-4" />
          <span>{isRtl ? "حفظ وتفعيل كافة الإعدادات" : "Save Platform Configurations"}</span>
        </button>
      </div>

    </form>
  );
}
