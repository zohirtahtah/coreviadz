import React, { useState } from "react";
import { 
  ShieldCheck, ShieldAlert, KeyRound, Smartphone, LogOut, RefreshCw, 
  Trash, Play, HelpCircle, Lock, Power, UserCheck, AlertTriangle
} from "lucide-react";

interface SecurityTabProps {
  isRtl: boolean;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
}

export default function SecurityTab({ isRtl, onTriggerNotification }: SecurityTabProps) {
  const [global2FA, setGlobal2FA] = useState(true);
  const [activeSessions, setActiveSessions] = useState<any[]>([
    { id: "sess-1", company: "Amet Trading", username: "Adel Boutarfa", ip: "197.200.44.11", browser: "Chrome 124", os: "Windows 11", last_active: "Active now" },
    { id: "sess-2", company: "El-Bahi Logistic", username: "Yasser Karim", ip: "105.101.92.48", browser: "Safari Mobile", os: "iOS 17.4", last_active: "Active now" },
    { id: "sess-3", company: "Amet Trading", username: "Sarah Benali", ip: "197.200.12.82", browser: "Firefox Dev Edition", os: "Linux Ubuntu", last_active: "2 minutes ago" }
  ]);

  const [threatLogs, setThreatLogs] = useState<any[]>([
    { id: "threat-1", ip: "45.143.201.12", action: "Brute Force Attempt", detail: "5 failed admin credentials checks in 30s", severity: "High", time: "2026-06-27 10:14:02" },
    { id: "threat-2", ip: "197.200.44.11", action: "Locked Account Reset", detail: "Adel Boutarfa account unlocked by Super Admin", severity: "Medium", time: "2026-06-27 09:12:44" }
  ]);

  const handleForceLogoutAll = () => {
    if (!window.confirm(isRtl ? "🚨 تحذير أمني هام!\n\nهل أنت متأكد من رغبتك في تسجيل خروج إجباري لجميع المشرفين والشركات المتصلة حالياً بالمنصة؟" : "🚨 WARNING!\n\nTerminate all active platform user sessions immediately?")) return;
    
    onTriggerNotification(isRtl ? "جاري فسخ جلسات المستخدمين وإنهاء التراخيص..." : "Revoking session tokens and terminating connections...", "info");
    setTimeout(() => {
      setActiveSessions([]);
      onTriggerNotification(isRtl ? "✅ تم تسجيل خروج كافة المستخدمين وإنهاء الجلسات!" : "✅ Revoked all active user session tokens successfully!", "success");
    }, 1500);
  };

  const handleTerminateSession = (id: string, username: string) => {
    setActiveSessions(prev => prev.filter(s => s.id !== id));
    onTriggerNotification(isRtl ? `تم طرد وجلسة تسجيل خروج المستخدم ${username}!` : `Revoked active token for user ${username}.`, "success");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="super_admin_security_panel">
      
      {/* 1. SECURITY GENERAL CONTROLS */}
      <div className="bg-[#121214] border border-[#27272a] rounded-xl p-5 space-y-5 h-fit text-right shadow-sm">
        <h3 className="text-xs font-extrabold text-white pb-2 border-b border-zinc-800 flex items-center gap-2 justify-end">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>{isRtl ? "أمان بوابة الدخول (SaaS Firewall)" : "Platform Security Gateway"}</span>
        </h3>

        <div className="space-y-4 text-xs font-bold text-zinc-400">
          
          {/* Global 2FA Switch */}
          <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg flex justify-between items-center">
            <button 
              onClick={() => {
                setGlobal2FA(!global2FA);
                onTriggerNotification(isRtl ? "تم تحديث فرض التحقق الثنائي للمنصة!" : "2FA policy adjusted!", "success");
              }}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold rounded text-[10px] cursor-pointer"
            >
              {global2FA ? (isRtl ? "تعطيل الفرض" : "Disable") : (isRtl ? "تفعيل الفرض" : "Enforce")}
            </button>
            <div className="space-y-0.5">
              <span className="text-white block">{isRtl ? "فرض التحقق بخطوتين (2FA)" : "Strict 2FA Enforcement"}</span>
              <span className="text-[10px] text-zinc-500 font-normal block">{isRtl ? "إجبار كافة ملاك الحسابات على إدخال كود OTP." : "Force OTP validation for all administrative logins."}</span>
            </div>
          </div>

          {/* Force Terminate All Button */}
          <div className="p-4 bg-rose-950/10 border border-rose-900/20 rounded-lg space-y-3">
            <div className="flex items-start gap-2.5 justify-end text-rose-400">
              <div className="space-y-1">
                <span className="text-white block text-right">{isRtl ? "إنهاء كافة جلسات المنصة فوراً" : "Emergency Sessions Killswitch"}</span>
                <p className="text-[10px] text-zinc-400 font-normal leading-normal">{isRtl ? "يقوم هذا الإجراء الأمني بتسجيل خروج إجباري لكافة المدراء المتصلين فوراً لحماية المنصة." : "Emergency termination. Revokes credentials tokens instantly for all accounts."}</p>
              </div>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
            </div>
            
            <button
              onClick={handleForceLogoutAll}
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-md shadow transition cursor-pointer"
            >
              {isRtl ? "تنفيذ طرد وتسجيل خروج الكل" : "Execute Force Logout of All sessions"}
            </button>
          </div>

        </div>
      </div>

      {/* 2. LOGGED-IN SESSIONS & THREATS COLUMN */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Active sessions list */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden shadow-sm flex flex-col h-[280px]">
          <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>{isRtl ? `الجلسات النشطة المتصلة بالمنصة حالياً (${activeSessions.length})` : `Online Administrative Sessions (${activeSessions.length})`}</span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeSessions.length === 0 ? (
              <p className="text-zinc-500 text-center py-12 font-bold">{isRtl ? "لا توجد جلسات نشطة متصلة حالياً." : "No active online sessions."}</p>
            ) : (
              activeSessions.map((s) => (
                <div key={s.id} className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                  <button 
                    onClick={() => handleTerminateSession(s.id, s.username)}
                    className="flex items-center gap-1 text-[10px] font-black text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 px-2 py-1 rounded cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>{isRtl ? "طرد" : "Terminate"}</span>
                  </button>

                  <div className={`${isRtl ? "text-right" : "text-left"} space-y-0.5`}>
                    <span className="font-bold text-white block">{s.username} ({s.company})</span>
                    <div className="flex items-center gap-2 justify-end text-[10px] text-zinc-500 font-mono">
                      <span>IP: {s.ip}</span>
                      <span>|</span>
                      <span>{s.browser} ({s.os})</span>
                      <span>|</span>
                      <span className="text-emerald-400 font-bold">{s.last_active}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Threat monitoring system logs */}
        <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden shadow-sm flex flex-col h-[280px]">
          <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>{isRtl ? `تنبيهات جدار الحماية وسجل محاولات الهجوم (${threatLogs.length})` : `Firewall Intrusion & Security Alert Logs (${threatLogs.length})`}</span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threatLogs.map((t) => (
              <div key={t.id} className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl flex items-start justify-between text-xs text-right">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                  t.severity === "High" ? "bg-rose-500/10 text-rose-400 animate-pulse" : "bg-amber-500/10 text-amber-400"
                }`}>{t.severity}</span>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-white font-bold">{t.action}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({t.ip})</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal">{t.detail}</p>
                  <span className="text-[9px] text-zinc-600 font-mono block">{t.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
