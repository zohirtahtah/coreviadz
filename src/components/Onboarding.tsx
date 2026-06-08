/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, Briefcase, Calendar, Users, 
  Coins, Globe2, Sun, Moon, Check, Upload, ArrowLeft, ArrowRight
} from "lucide-react";
import { BusinessProfile, LanguageType, ThemeType } from "../types";
import { translations } from "../translations";
import { Flag } from "./Flag";

interface OnboardingProps {
  onComplete: (profile: BusinessProfile) => void;
  lang: LanguageType;
  setLang: (l: LanguageType) => void;
  theme: ThemeType;
  setTheme: (t: ThemeType) => void;
  session?: any;
}

export default function Onboarding({ onComplete, lang, setLang, theme, setTheme, session }: OnboardingProps) {
  const t = translations[lang];
  const [step, setStep] = useState(1);
  
  // State Fields
  const [businessType, setBusinessType] = useState("متجر فعلي + تجارة إلكترونية");
  const [experienceYears, setExperienceYears] = useState("من سنة إلى 3 سنوات");
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [estimatedOrders, setEstimatedOrders] = useState("50 - 200");
  const [estimatedWorkers, setEstimatedWorkers] = useState("1 - 5");
  const [currency, setCurrency] = useState<"DZD" | "USD" | "EUR">("DZD");
  const [country, setCountry] = useState<"Algeria" | "France" | "Morocco" | "Other">("Algeria");
  
  // Custom Identity Details
  const [ownerName, setOwnerName] = useState(session?.username || "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(session?.email || "");
  const [address, setAddress] = useState("");

  // Keep synced if session loads asynchronously
  React.useEffect(() => {
    if (session) {
      if (!ownerName && session.username) setOwnerName(session.username);
      if (!email && session.email) setEmail(session.email);
    }
  }, [session]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultString = reader.result as string;
        setLogoPreview(resultString);
        setLogoUrl(resultString);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      // Complete Onboarding
      const finalProfile: BusinessProfile = {
        businessName: businessName || "Corevia Enterprise",
        businessType,
        experienceYears,
        logoUrl,
        estimatedOrders,
        estimatedWorkers,
        currency,
        defaultLanguage: lang,
        preferredTheme: theme,
        country,
        ownerName,
        phone,
        email,
        address
      };
      onComplete(finalProfile);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Quick lists
  const businessTypes = [
    { key: "ecommerce", val: lang === "ar" ? "تجارة إلكترونية فقط" : lang === "fr" ? "E-commerce uniquement" : "E-commerce Only" },
    { key: "physical", val: lang === "ar" ? "متجر فعلي فقط" : lang === "fr" ? "Boutique physique uniquement" : "Physical Store Only" },
    { key: "both", val: lang === "ar" ? "متجر فعلي + تجارة إلكترونية" : lang === "fr" ? "Boutique + E-commerce" : "Physical + E-commerce" },
    { key: "distributor", val: lang === "ar" ? "شركة توزيع" : lang === "fr" ? "Société de distribution" : "Distribution Company" },
    { key: "services", val: lang === "ar" ? "شركة خدمات" : lang === "fr" ? "Société de services" : "Services Company" },
    { key: "factory", val: lang === "ar" ? "مصنع" : lang === "fr" ? "Usine" : "Factory" },
    { key: "other", val: lang === "ar" ? "نشاط آخر" : lang === "fr" ? "Autre activité" : "Other Activity" }
  ];

  const experienceList = [
    { key: "less1", val: lang === "ar" ? "أقل من سنة" : lang === "fr" ? "Moins d'un an" : "Less than 1 Year" },
    { key: "1and3", val: lang === "ar" ? "من سنة إلى 3 سنوات" : lang === "fr" ? "1 à 3 ans" : "1 to 3 Years" },
    { key: "3and5", val: lang === "ar" ? "من 3 إلى 5 سنوات" : lang === "fr" ? "3 à 5 ans" : "3 to 5 Years" },
    { key: "more5", val: lang === "ar" ? "أكثر من 5 سنوات" : lang === "fr" ? "Plus de 5 ans5" : "More than 5 Years" }
  ];

  const ordersList = [
    { key: "less50", val: lang === "ar" ? "أقل من 50" : "Less than 50" },
    { key: "50-200", val: "50 - 200" },
    { key: "200-500", val: "200 - 500" },
    { key: "more500", val: lang === "ar" ? "أكثر من 500" : "More than 500" }
  ];

  const workersList = [
    { key: "alone", val: lang === "ar" ? "أعمل وحدي" : lang === "fr" ? "Je travaille seul" : "I Work Alone" },
    { key: "1-5", val: "1 - 5" },
    { key: "6-20", val: "6 - 20" },
    { key: "more20", val: lang === "ar" ? "أكثر من 20" : "More than 20" }
  ];

  const isRtl = lang === "ar";

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 bg-slate-900 text-slate-100 ${isRtl ? "rtl" : "ltr"}`} id="onboarding_root_container">

      <div className="w-full max-w-2xl bg-slate-800 rounded-2xl border border-slate-700/60 shadow-2xl p-6 md:p-8 relative overflow-hidden" id="onboarding_card">
        {/* Background glow effects */}
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        {/* Header Progress */}
        <div className="mb-8" id="onboarding_header_flow">
          <div className="flex justify-between items-center text-xs text-slate-400 font-mono tracking-wider uppercase mb-2">
            <span>{t.appName} ERP Setup</span>
            <span>{t.stepProgress.replace("{step}", step.toString())}</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
            <motion.div 
              className="bg-gradient-to-r from-emerald-500 to-blue-500 h-full rounded-full"
              initial={{ width: "25%" }}
              animate={{ width: `${step * 25}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
            id={`onboarding_step_${step}`}
          >
            {step === 1 && (
              <div className="space-y-6" id="step_1_container">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">{t.onboardingStep1Title}</h2>
                  <p className="text-sm text-slate-400">{t.onboardingDesc}</p>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-300">{t.onboardingActivityType}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {businessTypes.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setBusinessType(item.val)}
                        className={`flex items-center gap-3 p-3 text-sm rounded-xl border text-right transition-all outline-none ${
                          businessType === item.val
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold"
                            : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        <Building2 className="w-5 h-5 flex-shrink-0" />
                        <span>{item.val}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="block text-sm font-medium text-slate-300">{t.onboardingExperience}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {experienceList.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setExperienceYears(item.val)}
                        className={`flex items-center gap-2 p-3 text-sm rounded-xl border transition-all ${
                          experienceYears === item.val
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold"
                            : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <span>{item.val}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5" id="step_2_container">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">{t.onboardingStep2Title}</h2>
                  <p className="text-sm text-slate-400">ساعدنا على معرفة علامتك التجارية لتفصيل الفواتير والرواتب تلقائياً.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.onboardingCompanyName} *</label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={t.onboardingCompanyNamePlaceholder}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 antialiased"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{isRtl ? "اسم المالك" : "Owner Full Name"}</label>
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="Benali Abderrahmane"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{isRtl ? "رقم الهاتف" : "Phone"}</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0770 12 34 56"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{isRtl ? "البريد الإلكتروني" : "Email"}</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contact@company.dz"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">{isRtl ? "العنوان" : "Physical Address"}</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Didouche Mourad, Alger"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-700/60 pt-4">
                    <label className="block text-sm font-medium text-slate-300 mb-3">{t.onboardingLogoLabel}</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold font-mono text-emerald-500">
                            {businessName ? businessName.charAt(0).toUpperCase() : "C"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-xl cursor-pointer text-xs font-semibold transition-all">
                          <Upload className="w-4 h-4" />
                          <span>{t.onboardingUploadLogo}</span>
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1">{t.onboardingSkipLogo}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6" id="step_3_container">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">{t.onboardingStep3Title}</h2>
                  <p className="text-sm text-slate-400">تساعدنا هذه البيانات على هيكلة لوحات التحكم والإحصائيات وتحديد نقاط الأقلمة.</p>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-300">{t.onboardingMonthlyOrders}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {ordersList.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setEstimatedOrders(item.val)}
                        className={`flex items-center gap-3 p-3 text-sm rounded-xl border text-right transition-all outline-none ${
                          estimatedOrders === item.val
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold"
                            : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        <span>{item.val}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="block text-sm font-medium text-slate-300">{t.onboardingWorkersCount}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {workersList.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setEstimatedWorkers(item.val)}
                        className={`flex items-center gap-3 p-3 text-sm rounded-xl border transition-all ${
                          estimatedWorkers === item.val
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold"
                            : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        <Users className="w-4 h-4 text-blue-400" />
                        <span>{item.val}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6" id="step_4_container">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">{t.onboardingStep4Title}</h2>
                  <p className="text-sm text-slate-400">اختر تفضيلات تجربة الاستخدام الافتراضية للغة والوضع المالي والواجهة.</p>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-300">
                    {lang === "ar" ? "بلد النشاط أو المقر الرئيسي *" : lang === "fr" ? "Pays d'activité ou siège principal *" : "Country of operation or main headquarters *"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: "Algeria", label: lang === "ar" ? "الجزائر 🇩🇿" : lang === "fr" ? "Algérie 🇩🇿" : "Algeria 🇩🇿" },
                      { key: "France", label: lang === "ar" ? "فرنسا 🇫🇷" : lang === "fr" ? "France 🇫🇷" : "France 🇫🇷" },
                      { key: "Morocco", label: lang === "ar" ? "المغرب 🇲🇦" : lang === "fr" ? "Maroc 🇲🇦" : "Morocco 🇲🇦" },
                      { key: "Other", label: lang === "ar" ? "دول أخرى 🌐" : lang === "fr" ? "Autre pays 🌐" : "Other / Global 🌐" }
                    ] as const).map((cnt) => (
                      <button
                        type="button"
                        key={cnt.key}
                        onClick={() => {
                          setCountry(cnt.key);
                          if (cnt.key === "Algeria") setCurrency("DZD");
                          else if (cnt.key === "France") setCurrency("EUR");
                        }}
                        className={`flex-1 min-w-[124px] p-2.5 text-xs rounded-xl border flex items-center justify-center gap-2 transition-all ${
                          country === cnt.key
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold"
                            : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        <span>{cnt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-300">{t.onboardingCurrency}</label>
                  <div className="flex gap-2">
                    {(["DZD", "USD", "EUR"] as const).map((curr) => (
                      <button
                        key={curr}
                        onClick={() => setCurrency(curr)}
                        className={`flex-1 p-3 text-sm rounded-xl border flex items-center justify-center gap-2 transition-all ${
                          currency === curr
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold"
                            : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        <Coins className="w-4 h-4" />
                        <span>{curr === "DZD" ? (isRtl ? "دج (DZD)" : "DZD") : curr}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-300">{t.onboardingLang}</label>
                  <div className="flex gap-2">
                    {(["ar", "fr", "en"] as const).map((lValue) => (
                      <button
                        key={lValue}
                        onClick={() => setLang(lValue)}
                        className={`flex-1 p-3 text-xs rounded-xl border flex items-center justify-center gap-2 transition-all ${
                          lang === lValue
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold"
                            : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                        }`}
                      >
                        <Flag lang={lValue} className="w-4 h-3 rounded-sm shadow-sm" />
                        <span>
                          {lValue === "ar" ? "العربية" : lValue === "fr" ? "Français" : "English"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-300">{t.onboardingTheme}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex-1 p-3 text-sm rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        theme === "light"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold"
                          : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>{t.lightMode}</span>
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex-1 p-3 text-sm rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        theme === "dark"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold"
                          : "border-slate-700 bg-slate-850 hover:bg-slate-700/50 text-slate-300"
                      }`}
                    >
                      <Moon className="w-4 h-4 text-blue-400" />
                      <span>{t.darkMode}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Buttons Nav */}
        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-700/60" id="onboarding_actions">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-100/10 text-slate-250 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
            >
              {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              <span>السابق</span>
            </button>
          ) : (
            <button
              onClick={() => {
                const defaultProfile: BusinessProfile = {
                  businessName: "Corevia Enterprise",
                  businessType: "متجر فعلي + تجارة إلكترونية",
                  experienceYears: "من سنة إلى 3 سنوات",
                  logoUrl: undefined,
                  estimatedOrders: "50 - 200",
                  estimatedWorkers: "1 - 5",
                  currency: "DZD",
                  defaultLanguage: lang,
                  preferredTheme: theme,
                  country: "Algeria",
                  ownerName: session?.username || "Owner",
                  phone: "",
                  email: session?.email || "owner@corevia.com",
                  address: ""
                };
                onComplete(defaultProfile);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 border border-slate-700/40 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>{isRtl ? "تخطي / إلغاء" : "Skip / Cancel"}</span>
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={step === 2 && !businessName.trim()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              step === 2 && !businessName.trim()
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white shadow-lg hover:scale-[1.02] shadow-emerald-500/10"
            }`}
          >
            <span>{step === 4 ? t.completeOnboarding : "التالي"}</span>
            {step === 4 ? (
              <Check className="w-4 h-4" />
            ) : isRtl ? (
              <ArrowLeft className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
