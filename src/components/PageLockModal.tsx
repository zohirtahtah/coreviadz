import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";

interface PageLockModalProps {
  pageName: string;
  defaultPassword?: string;
  masterPassword?: string;
  children: ReactNode;
  lang?: "ar" | "en" | "fr";
}

const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour

function getLockKey(pageName: string): string {
  return `corevia_unlock_${pageName}`;
}

export default function PageLockModal({
  pageName,
  defaultPassword = "1234",
  masterPassword,
  children,
  lang = "ar"
}: PageLockModalProps) {
  const isRtl = lang === "ar";
  const [currentPassword, setCurrentPassword] = useState(defaultPassword);
  const [inputPassword, setInputPassword] = useState("");
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [masterInput, setMasterInput] = useState("");

  const lockKey = useMemo(() => getLockKey(pageName), [pageName]);

  useEffect(() => {
    const savedTime = localStorage.getItem(lockKey);
    if (savedTime) {
      const elapsed = Date.now() - parseInt(savedTime, 10);
      if (elapsed < LOCK_DURATION_MS) {
        setUnlocked(true);
      } else {
        localStorage.removeItem(lockKey);
      }
    }
  }, [lockKey]);

  const handleVerify = useCallback(() => {
    if (inputPassword === currentPassword) {
      localStorage.setItem(lockKey, Date.now().toString());
      setUnlocked(true);
      setError("");
      setInputPassword("");
    } else {
      setError(isRtl ? "كلمة مرور قفل الصفحات غير صحيحة!" : "Incorrect page lock password!");
    }
  }, [inputPassword, currentPassword, lockKey, isRtl]);

  const handleResetPassword = useCallback(() => {
    if (masterPassword && masterInput === masterPassword) {
      setCurrentPassword("1234");
      setShowReset(false);
      setMasterInput("");
      setError(isRtl ? "تم تصفير كلمة المرور إلى 1234" : "Password reset to 1234");
      setTimeout(() => setError(""), 3000);
    } else {
      setError(isRtl ? "كلمة مرور الحساب الأساسي غير صحيحة!" : "Master account password incorrect!");
    }
  }, [masterPassword, masterInput, isRtl]);

  return (
    <div className="relative">
      <div className={unlocked ? "" : "pointer-events-none select-none blur-sm"}>
        {children}
      </div>
      {!unlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-[#121214] border border-[#27272a] rounded-2xl p-8 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <h3 className="text-lg font-bold text-white">
          {isRtl ? "هذه الصفحة مقفلة" : "Page Locked"}
        </h3>
        <p className="text-sm text-slate-400">
          {isRtl
            ? "يرجى كتابة كلمة مرور قفل الصفحات للمتابعة."
            : "Enter the page lock password to continue."}
        </p>

        <input
          type="password"
          value={inputPassword}
          onChange={(e) => setInputPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
          className="w-full p-3 bg-slate-900 border border-slate-800 text-center text-white rounded-xl outline-none focus:border-amber-600 transition-colors"
          placeholder={isRtl ? "أدخل كلمة مرور القفل" : "Enter lock password"}
          autoFocus
        />

        {error && (
          <p className={`text-xs ${error.includes("1234") ? "text-emerald-400" : "text-red-400"}`}>{error}</p>
        )}

        <button
          onClick={handleVerify}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
        >
          {isRtl ? "فتح الصفحة" : "Unlock Page"}
        </button>

        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="text-xs text-blue-500 hover:text-blue-400 underline cursor-pointer"
          >
            {isRtl ? "نسيت كلمة سر قفل الصفحات؟" : "Forgot lock password?"}
          </button>
        ) : (
          <div className="space-y-3 pt-2 border-t border-[#27272a]">
            <p className="text-xs text-slate-400">
              {isRtl
                ? "أدخل كلمة مرور حسابك الأساسي لإعادة تعيين قفل الصفحات إلى 1234"
                : "Enter your master account password to reset page lock to 1234"}
            </p>
            <input
              type="password"
              value={masterInput}
              onChange={(e) => setMasterInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
              className="w-full p-3 bg-slate-900 border border-slate-800 text-center text-white rounded-xl outline-none focus:border-indigo-600 transition-colors"
              placeholder={isRtl ? "كلمة مرور الحساب الأساسي" : "Master password"}
            />
            <button
              onClick={handleResetPassword}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
            >
              {isRtl ? "إعادة تعيين كلمة القفل" : "Reset Lock Password"}
            </button>
            <button
              onClick={() => { setShowReset(false); setMasterInput(""); }}
              className="text-xs text-slate-500 hover:text-white underline cursor-pointer"
            >
              {isRtl ? "رجوع" : "Back"}
            </button>
          </div>
        )}
          </div>
        </div>
      )}
    </div>
  );
}
