import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../supabaseClient";
import type { LanguageType } from "../types";

interface CompanyGuardProps {
  children: ReactNode;
  lang: LanguageType;
  status?: string;
}

const UNVERIFIED_STATUSES = ["Pending Verification", "unverified"];
const READ_ONLY_STATUSES = ["Read Only", "read-only", "read only", "Suspended", "suspended"];

export default function CompanyGuard({ children, lang, status: propStatus }: CompanyGuardProps) {
  const isRtl = lang === "ar";
  const [companyStatus, setCompanyStatus] = useState<string | undefined>(propStatus);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCompanyStatus(propStatus);
  }, [propStatus]);

  const isUnverified = companyStatus ? UNVERIFIED_STATUSES.includes(companyStatus) : false;
  const isReadOnly = companyStatus ? READ_ONLY_STATUSES.includes(companyStatus) : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>{isRtl ? "جاري فحص صلاحية النظام..." : "Checking system status..."}</span>
        </div>
      </div>
    );
  }

  if (isUnverified) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-[#121214] border border-red-500/30 rounded-2xl p-8 space-y-5 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-500">
            {isRtl ? "يرجى تأكيد البريد الإلكتروني" : "Please Verify Your Email"}
          </h2>
          <p className="text-sm text-slate-400">
            {isRtl
              ? "لقد تم حفظ معلومات شركتك بنجاح. يرجى إدخال رمز التحقق الرقمي المرسل إلى بريدك الإلكتروني لتتمكن من فتح ميزات النظام."
              : "Your company info has been saved. Please enter the OTP verification code sent to your email to activate the system."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium text-sm transition-colors cursor-pointer"
          >
            {isRtl ? "الذهاب لصفحة التأكيد" : "Go to Verification"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={isReadOnly ? "read-only-mode" : ""}>
      {isReadOnly && (
        <div className="fixed top-0 inset-x-0 h-10 bg-amber-600 text-white flex items-center justify-center font-bold px-4 text-xs z-50 shadow-md gap-2">
          <svg className="w-4 h-4 text-yellow-200 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>
            {isRtl
              ? "الحساب في وضع القراءة فقط لانتهاء الاشتراك. يرجى التواصل مع الإدارة لتفعيل النظام."
              : "Account is in read-only mode due to subscription expiry. Please contact support to reactivate."}
          </span>
          <a
            href="mailto:support@corevia.local"
            className="underline text-yellow-200 hover:text-white transition-colors shrink-0"
          >
            {isRtl ? "تواصل مع الدعم الفني" : "Contact Support"}
          </a>
        </div>
      )}
      {children}
    </div>
  );
}
