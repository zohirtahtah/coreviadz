import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Building2, User, Mail, KeyRound, Globe, Phone, 
  ArrowLeft, ArrowRight, Check, Upload, RefreshCw, 
  Users, Briefcase, Eye, EyeOff, ShieldAlert, CheckCircle2
} from "lucide-react";
import { supabase } from "../supabaseClient";

interface OnboardingWizardProps {
  onAuthSuccess: (session: any) => void;
  onTriggerNotification: (message: string, type?: "success" | "info") => void;
  isRtl: boolean;
  t: any;
  setAuthMode: (mode: "login" | "register" | "forgot") => void;
}

interface OnboardingState {
  companyName: string;
  ownerName: string;
  email: string;
  phone: string;
  password?: string;
  country: string;
  numEmployees: string;
  businessActivity: string;
  logoUrl?: string;
  companyId?: string;
  userId?: string;
}

export default function OnboardingWizard({ 
  onAuthSuccess, 
  onTriggerNotification, 
  isRtl, 
  t, 
  setAuthMode 
}: OnboardingWizardProps) {
  
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Form State
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("Algeria");
  
  // Step 2 Questionnaire State
  const [numEmployees, setNumEmployees] = useState("1 - 5");
  const [businessActivity, setBusinessActivity] = useState("E-commerce Only");
  
  // Step 3 Confirmation & Logo State
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [uploadedLogoUrl, setUploadedLogoUrl] = useState<string>("");
  
  // Step 4 OTP State
  const [otpCode, setOtpCode] = useState<string[]>(Array(6).fill(""));
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Load state from sessionStorage on mount
  useEffect(() => {
    try {
      const savedStateStr = sessionStorage.getItem("corevia_onboarding_wizard_state");
      if (savedStateStr) {
        const savedState: OnboardingState = JSON.parse(savedStateStr);
        if (savedState.companyName) setCompanyName(savedState.companyName);
        if (savedState.ownerName) setOwnerName(savedState.ownerName);
        if (savedState.email) setEmail(savedState.email);
        if (savedState.phone) setPhone(savedState.phone);
        if (savedState.country) setCountry(savedState.country);
        if (savedState.numEmployees) setNumEmployees(savedState.numEmployees);
        if (savedState.businessActivity) setBusinessActivity(savedState.businessActivity);
        if (savedState.logoUrl) {
          setUploadedLogoUrl(savedState.logoUrl);
          setLogoPreview(savedState.logoUrl);
        }
        
        // Restore step if they are past step 1 and have a userId
        if (savedState.userId) {
          const savedStep = sessionStorage.getItem("corevia_onboarding_wizard_step");
          if (savedStep) {
            setStep(parseInt(savedStep));
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load onboarding state:", e);
    }
  }, []);

  // Save state helper
  const saveStateToSession = (updates: Partial<OnboardingState>, nextStep?: number) => {
    try {
      const savedStateStr = sessionStorage.getItem("corevia_onboarding_wizard_state");
      const currentState: OnboardingState = savedStateStr ? JSON.parse(savedStateStr) : {
        companyName, ownerName, email, phone, country, numEmployees, businessActivity, logoUrl: uploadedLogoUrl
      };
      
      const updatedState = { ...currentState, ...updates };
      sessionStorage.setItem("corevia_onboarding_wizard_state", JSON.stringify(updatedState));
      
      if (nextStep) {
        setStep(nextStep);
        sessionStorage.setItem("corevia_onboarding_wizard_step", nextStep.toString());
      }
    } catch (e) {
      console.error("Failed to save state:", e);
    }
  };

  // Resend Timer Countdown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Step 1: Submit Company / Admin Credentials
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !ownerName || !email || !phone || !password) {
      onTriggerNotification(
        isRtl ? "يرجى ملء كافة البيانات لإنشاء الحساب" : "Please fill in all details to create your account",
        "info"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          name: ownerName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: password,
          country: country
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(isRtl ? (data.error_ar || data.error_en) : (data.error_en || "Registration failed"));
      }

      // Save credentials and backend IDs
      saveStateToSession({
        companyName,
        ownerName,
        email,
        phone,
        country,
        userId: data.userId,
        companyId: data.companyId
      }, 2);

      onTriggerNotification(
        isRtl ? "تم تسجيل حسابك الأولي بنجاح! ننتقل للخطوة التالية." : "Initial account registered successfully! Moving to next step.",
        "success"
      );
    } catch (err: any) {
      console.error("Step 1 Error:", err);
      onTriggerNotification(err.message || "Registration failed", "info");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Questionnaire Confirmation
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    saveStateToSession({ numEmployees, businessActivity }, 3);
    onTriggerNotification(
      isRtl ? "تم حفظ التفضيلات والنشاط بنجاح!" : "Preferences saved successfully!",
      "success"
    );
  };

  // Logo file upload helper
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload directly to Supabase storage 'logos' bucket
    setLogoUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `tenant_logos/${fileName}`;

      if (!supabase) throw new Error("Supabase client is not initialized.");

      // Upload file to 'logos' bucket
      const { data, error } = await supabase.storage
        .from("logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true
        });

      if (error) {
        console.warn("Storage upload error (falling back to temporary asset URL):", error);
        // Fallback using base64 preview URL
        setUploadedLogoUrl(reader.result as string);
        saveStateToSession({ logoUrl: reader.result as string });
      } else if (data) {
        // Get public URL
        const { data: publicData } = supabase.storage
          .from("logos")
          .getPublicUrl(filePath);
          
        setUploadedLogoUrl(publicData.publicUrl);
        saveStateToSession({ logoUrl: publicData.publicUrl });
        onTriggerNotification(
          isRtl ? "تم تحميل شعار الشركة بنجاح!" : "Company logo uploaded successfully!",
          "success"
        );
      }
    } catch (uploadErr: any) {
      console.error("Logo upload exception:", uploadErr);
      setUploadedLogoUrl(reader.result as string); // safe fallback
      saveStateToSession({ logoUrl: reader.result as string });
    } finally {
      setLogoUploading(false);
    }
  };

  // Step 3: Confirmation and triggering OTP Send
  const handleStep3StartNow = async () => {
    setIsSubmitting(true);
    try {
      const savedStateStr = sessionStorage.getItem("corevia_onboarding_wizard_state");
      if (!savedStateStr) throw new Error("Onboarding state is missing. Please restart.");
      const state: OnboardingState = JSON.parse(savedStateStr);

      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: state.companyId,
          companyName: companyName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          country: country,
          logoUrl: uploadedLogoUrl,
          numEmployees: numEmployees,
          businessActivity: businessActivity
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_en || "Failed to update workspace profile");
      }

      // Move to Step 4 OTP modal
      saveStateToSession({
        companyName,
        ownerName,
        email,
        phone,
        country,
        logoUrl: uploadedLogoUrl,
        numEmployees,
        businessActivity
      }, 4);

      setResendCooldown(60);
      onTriggerNotification(
        isRtl ? "تم إرسال رمز التحقق OTP المكون من 6 أرقام إلى بريدك الإلكتروني!" : "6-digit verification OTP sent to your email!",
        "success"
      );
    } catch (err: any) {
      console.error("Profile complete failed:", err);
      onTriggerNotification(err.message || "Failed to finalize profile setup", "info");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend OTP trigger
  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    try {
      const savedStateStr = sessionStorage.getItem("corevia_onboarding_wizard_state");
      const state: OnboardingState = savedStateStr ? JSON.parse(savedStateStr) : { email, companyId: "" };
      
      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: state.companyId,
          companyName: companyName,
          ownerName: ownerName,
          email: email,
          phone: phone,
          country: country,
          logoUrl: uploadedLogoUrl,
          numEmployees,
          businessActivity
        })
      });

      if (!response.ok) throw new Error("Resend OTP failed");

      setResendCooldown(60);
      onTriggerNotification(
        isRtl ? "تم إعادة إرسال الرمز المكون من 6 أرقام بنجاح!" : "A new 6-digit code has been sent successfully!",
        "success"
      );
    } catch (err: any) {
      onTriggerNotification(isRtl ? "فشل إعادة إرسال رمز التحقق" : "Failed to resend verification code", "info");
    }
  };

  // Handle individual digit entries inside OTP Boxes
  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = element.value;
    setOtpCode(newOtp);

    // Focus next input box
    if (element.value !== "" && element.nextSibling) {
      (element.nextSibling as HTMLInputElement).focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      const newOtp = [...otpCode];
      newOtp[index] = "";
      setOtpCode(newOtp);

      // Focus previous input box
      const target = e.target as HTMLInputElement;
      if (target.previousSibling) {
        (target.previousSibling as HTMLInputElement).focus();
      }
    }
  };

  // Step 4: OTP Form Submission & Auto-Login
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const joinedCode = otpCode.join("");
    if (joinedCode.length < 6) {
      setOtpError(isRtl ? "الرجاء إدخال الرمز المكون من 6 أرقام بالكامل" : "Please enter the complete 6-digit code");
      return;
    }

    setOtpError("");
    setIsSubmitting(true);
    try {
      const savedStateStr = sessionStorage.getItem("corevia_onboarding_wizard_state");
      const state: OnboardingState = savedStateStr ? JSON.parse(savedStateStr) : { email };

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.email.trim().toLowerCase(),
          otpCode: joinedCode
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(isRtl ? (data.error_ar || data.error_en) : (data.error_en || "Incorrect activation code"));
      }

      // Success activation & auto login!
      sessionStorage.removeItem("corevia_onboarding_wizard_state");
      sessionStorage.removeItem("corevia_onboarding_wizard_step");

      onTriggerNotification(
        isRtl ? "تم التحقق وتنشيط مساحة عملك بنجاح! جاري دخولك..." : "Workspace activated successfully! Logging you in...",
        "success"
      );

      // Transition session to React App context
      onAuthSuccess({
        ...data.session,
        token: data.token
      });
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setOtpError(err.message || "Verification code is incorrect");
    } finally {
      setIsSubmitting(false);
    }
  };

  const businessActivityOptions = [
    { key: "E-commerce Only", label: isRtl ? "تجارة إلكترونية فقط" : "E-commerce Only", icon: "🌐" },
    { key: "Physical Retail", label: isRtl ? "متجر بيع بالتجزئة" : "Physical Retail", icon: "🏪" },
    { key: "Wholesale", label: isRtl ? "تجارة الجملة والتوزيع" : "Wholesale & Distribution", icon: "🚚" },
    { key: "Manufacturing", label: isRtl ? "التصنيع والمصانع" : "Manufacturing & Factories", icon: "🏭" },
    { key: "Services", label: isRtl ? "شركات الخدمات والاستشارات" : "Professional Services", icon: "💼" },
    { key: "General", label: isRtl ? "نشاط عام آخر" : "General / Other Activity", icon: "⚙️" }
  ];

  const employeeRanges = [
    { key: "1 - 5", label: "1 - 5" },
    { key: "6 - 20", label: "6 - 20" },
    { key: "21 - 50", label: "21 - 50" },
    { key: "50+", label: "50+" }
  ];

  return (
    <div className="w-full text-zinc-100" id="onboarding_wizard_main_card">
      {/* Wizard Progress Header */}
      <div className="mb-6" id="wizard_stepper_indicator">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
          <span>Corevia multi-tenant ERP setup</span>
          <span>
            {isRtl ? `الخطوة ${step} من 4` : `Step ${step} of 4`}
          </span>
        </div>
        <div className="w-full bg-[#1e1e1f] h-1.5 rounded-full overflow-hidden flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i}
              className={`flex-1 h-full rounded-full transition-all duration-300 ${
                step >= i 
                  ? "bg-gradient-to-r from-emerald-500 to-indigo-500" 
                  : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
          id={`wizard_step_view_${step}`}
        >
          {/* STEP 1: INITIAL COMPANY & OWNER SIGN UP */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4" id="wizard_form_step_1">
              <div className="space-y-1 text-center">
                <h2 className="text-base font-black text-white">
                  {isRtl ? "إنشاء حساب ومساحة عمل جديدة" : "Register Enterprise Workspace"}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {isRtl ? "ابدأ تجربتك المجانية لمدة 15 يوماً دون الحاجة لبطاقة ائتمان." : "Deploy a secure multi-tenant cloud ERP workspace instantly."}
                </p>
              </div>

              {/* Company Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-300">
                  {isRtl ? "اسم المؤسسة / الشركة *" : "Company Name *"}
                </label>
                <div className="relative">
                  <span className="absolute top-1/2 -translate-y-1/2 left-3 text-sm">🏢</span>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={isRtl ? "شركة كوريڤيا للتجارة" : "Corevia Tech LLC"}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl py-2 pl-9 pr-3 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Owner Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-300">
                  {isRtl ? "الاسم الكامل للمالك / المدير *" : "Owner Full Name *"}
                </label>
                <div className="relative">
                  <User className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Benali Abderrahmane"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl py-2 pl-9 pr-3 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">
                    {isRtl ? "البريد الإلكتروني *" : "Email Address *"}
                  </label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@corevia.com"
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl py-2 pl-9 pr-3 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">
                    {isRtl ? "رقم الهاتف *" : "Phone Number *"}
                  </label>
                  <div className="relative">
                    <Phone className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+213 550 12 34 56"
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl py-2 pl-9 pr-3 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Password */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">
                    {isRtl ? "كلمة المرور *" : "Password *"}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl py-2 pl-9 pr-12 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 right-2 p-1 text-zinc-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">
                    {isRtl ? "الدولة والمركز الرئيسي" : "Country headquarters"}
                  </label>
                  <div className="relative">
                    <Globe className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl py-2 pl-9 pr-3 text-zinc-250 text-xs focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                    >
                      <option value="Algeria">{isRtl ? "الجزائر 🇩🇿" : "Algeria 🇩🇿"}</option>
                      <option value="France">{isRtl ? "فرنسا 🇫🇷" : "France 🇫🇷"}</option>
                      <option value="Morocco">{isRtl ? "المغرب 🇲🇦" : "Morocco 🇲🇦"}</option>
                      <option value="Other">{isRtl ? "دولة أخرى 🌐" : "Other / Global 🌐"}</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white rounded-xl py-2.5 text-xs font-black shadow-lg shadow-emerald-500/10 active:scale-[0.99] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isRtl ? "جاري إنشاء السجل المتكامل..." : "Provisioning ERP tenancy..."}</span>
                  </>
                ) : (
                  <>
                    <span>{isRtl ? "التالي: تخصيص النشاط" : "Continue to Tenancy Questionnaire"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-zinc-400 pt-1">
                {isRtl ? "لديك حساب بالفعل؟" : "Already registered tenant?"}{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="font-black text-emerald-400 hover:underline"
                >
                  {isRtl ? "سجل الدخول" : "Access Tenant Portal"}
                </button>
              </p>
            </form>
          )}

          {/* STEP 2: QUESTIONNAIRE (ACTIVITY SECTOR & EMPLOYEES) */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-5" id="wizard_form_step_2">
              <div className="space-y-1 text-center">
                <h2 className="text-base font-black text-white">
                  {isRtl ? "تخصيص هيكل ERP للشركة" : "Customize Tenant Structure"}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {isRtl ? "ساعدنا على فهم حجم وهيكل شركتك لتخصيص لوحة الإدارة." : "Help us adapt modules, calculations, and tables for your workspace."}
                </p>
              </div>

              {/* Business Type / Sector Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300">
                  {isRtl ? "قطاع الأعمال أو النشاط الرئيسي *" : "Business Sector / Activity *"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {businessActivityOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setBusinessActivity(opt.key)}
                      className={`p-3 rounded-xl border text-left transition-all outline-none flex items-center gap-2.5 ${
                        businessActivity === opt.key
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold"
                          : "border-[#27272a] bg-[#09090b] hover:bg-zinc-900 text-zinc-300 text-xs"
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="text-[11px]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee Counts */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300">
                  {isRtl ? "عدد الموظفين أو العمال الحاليين *" : "Number of Employees *"}
                </label>
                <div className="flex gap-2">
                  {employeeRanges.map((range) => (
                    <button
                      key={range.key}
                      type="button"
                      onClick={() => setNumEmployees(range.key)}
                      className={`flex-1 p-2.5 rounded-xl border text-center transition-all ${
                        numEmployees === range.key
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold text-xs"
                          : "border-[#27272a] bg-[#09090b] hover:bg-zinc-900 text-zinc-400 text-xs"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 p-2.5 border border-[#27272a] rounded-xl hover:bg-zinc-900 text-xs text-zinc-400 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isRtl ? "السابق" : "Back"}</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 p-2.5 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{isRtl ? "التالي" : "Next"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: DATA CONFIRMATION & LOGO UPLOAD */}
          {step === 3 && (
            <div className="space-y-5 text-right" id="wizard_step_3_confirmation">
              <div className="space-y-1 text-center">
                <h2 className="text-base font-black text-white">
                  {isRtl ? "مراجعة وتأكيد بيانات الشركة" : "Confirm Enterprise Credentials"}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {isRtl ? "قم بتحميل شعار شركتك ومراجعة البيانات قبل تفعيل مساحة العمل الخاصة بك." : "Upload your official company brand logo and confirm setup values."}
                </p>
              </div>

              {/* Logo Upload Component */}
              <div className="border border-[#27272a]/80 bg-[#09090b]/40 rounded-xl p-4 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden relative">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-emerald-400 font-mono">
                      {companyName ? companyName.charAt(0).toUpperCase() : "C"}
                    </span>
                  )}
                  {logoUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg cursor-pointer text-[10px] font-bold transition-all">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isRtl ? "تحميل شعار الشركة" : "Choose Brand Logo"}</span>
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                  <p className="text-[9px] text-zinc-500 mt-1">
                    {isRtl ? "اختياري. يدعم ملفات PNG أو JPG بحد أقصى 5 ميجا بايت" : "Optional. Recommended transparent background file."}
                  </p>
                </div>
              </div>

              {/* Confirmation Fields Form (Editable and Prefilled) */}
              <div className="space-y-2 bg-[#09090b] border border-[#27272a] rounded-xl p-4 text-xs">
                <div className="grid grid-cols-2 gap-4 border-b border-zinc-800/80 pb-2">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{isRtl ? "اسم المؤسسة" : "Company Name"}</span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="bg-transparent border-none text-white text-xs font-bold p-0 focus:ring-0 focus:outline-none w-full"
                    />
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{isRtl ? "اسم المالك" : "Owner Name"}</span>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="bg-transparent border-none text-white text-xs font-bold p-0 focus:ring-0 focus:outline-none w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-zinc-800/80 pb-2">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{isRtl ? "البريد الإلكتروني" : "Email Address"}</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-transparent border-none text-zinc-300 text-xs p-0 focus:ring-0 focus:outline-none w-full cursor-not-allowed"
                      disabled
                    />
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{isRtl ? "رقم الهاتف" : "Phone"}</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-transparent border-none text-white text-xs p-0 focus:ring-0 focus:outline-none w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{isRtl ? "قطاع النشاط" : "Sector"}</span>
                    <select
                      value={businessActivity}
                      onChange={(e) => setBusinessActivity(e.target.value)}
                      className="bg-transparent border-none text-white text-xs p-0 focus:ring-0 focus:outline-none w-full cursor-pointer"
                    >
                      {businessActivityOptions.map(opt => (
                        <option key={opt.key} value={opt.key} className="bg-zinc-900">{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{isRtl ? "عدد العمال" : "Employees"}</span>
                    <select
                      value={numEmployees}
                      onChange={(e) => setNumEmployees(e.target.value)}
                      className="bg-transparent border-none text-white text-xs p-0 focus:ring-0 focus:outline-none w-full cursor-pointer"
                    >
                      {employeeRanges.map(range => (
                        <option key={range.key} value={range.key} className="bg-zinc-900">{range.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 p-2.5 border border-[#27272a] rounded-xl hover:bg-zinc-900 text-xs text-zinc-400 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isRtl ? "السابق" : "Back"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStep3StartNow}
                  disabled={isSubmitting || logoUploading}
                  className="flex-1 p-2.5 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isRtl ? "جاري التجهيز..." : "Provisioning..."}</span>
                    </>
                  ) : (
                    <>
                      <span>{isRtl ? "ابدأ الآن 🚀" : "Start Now 🚀"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: OTP MODAL OVERLAY */}
          {step === 4 && (
            <form onSubmit={handleVerifyOTP} className="space-y-5" id="wizard_otp_form">
              <div className="space-y-1.5 text-center">
                <div className="inline-flex w-12 h-12 rounded-full bg-emerald-500/10 items-center justify-center text-emerald-400 mb-1">
                  <CheckCircle2 className="w-6 h-6 animate-pulse" />
                </div>
                <h2 className="text-base font-black text-white">
                  {isRtl ? "أدخل رمز التحقق (OTP)" : "Enter Verification OTP"}
                </h2>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isRtl 
                    ? `لقد أرسلنا رمز التحقق المكون من 6 أرقام إلى البريد الإلكتروني ${email}. الرجاء إدخاله لتفعيل النظام ومساحة العمل.`
                    : `Enter the 6-digit activation code sent to your inbox: ${email}.`}
                </p>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-center gap-2 direction-ltr" style={{ direction: "ltr" }}>
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target, index)}
                    onKeyDown={(e) => handleOtpKeyDown(e, index)}
                    className="w-10 h-12 bg-[#09090b] border border-[#27272a] rounded-xl text-center text-white font-extrabold text-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                ))}
              </div>

              {otpError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-xl text-[10px] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white rounded-xl py-2.5 text-xs font-black shadow-lg shadow-emerald-500/10 active:scale-[0.99] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isRtl ? "جاري تفعيل الحساب والولوج..." : "Activating ERP space..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isRtl ? "تأكيد الرمز والتفعيل" : "Verify & Activate Workspace"}</span>
                  </>
                )}
              </button>

              <div className="text-center text-[10px]">
                <span className="text-zinc-500">
                  {isRtl ? "لم يصلك الرمز؟" : "Didn't receive the code?"}{" "}
                </span>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendCooldown > 0}
                  className={`font-bold transition-all ${
                    resendCooldown > 0 ? "text-zinc-600 cursor-not-allowed" : "text-emerald-400 hover:underline"
                  }`}
                >
                  {resendCooldown > 0 
                    ? (isRtl ? `إعادة الإرسال خلال (${resendCooldown}ث)` : `Resend in (${resendCooldown}s)`)
                    : (isRtl ? "إعادة إرسال الرمز" : "Resend code")}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
