import React, { useState } from "react";
import { 
  CreditCard, 
  HelpCircle, 
  MessageSquare, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Building2, 
  Mail, 
  Phone, 
  ArrowRight,
  ChevronRight,
  Loader2
} from "lucide-react";

interface SubscriptionPaywallProps {
  isRtl: boolean;
  companyId: string;
  companyName: string;
  ownerEmail: string;
  onPaymentSuccess: (plan: string, durationMonths: number) => Promise<void>;
  onTriggerNotification: (msg: string, type: "success" | "info" | "warning") => void;
  onLogout: () => void;
  supportEmail?: string;
  phone?: string;
}

export function SubscriptionPaywall({
  isRtl,
  companyId,
  companyName,
  ownerEmail,
  onPaymentSuccess,
  onTriggerNotification,
  onLogout,
  supportEmail,
  phone
}: SubscriptionPaywallProps) {
  const [selectedPlan, setSelectedPlan] = useState<"Starter" | "Professional" | "Enterprise">("Professional");
  const [duration, setDuration] = useState<"monthly" | "annual">("monthly");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Payment card state
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");

  // Support form state
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSuccess, setSupportSuccess] = useState(false);

  const plans = {
    Starter: {
      name: isRtl ? "الباقة الأساسية (مبتدئ)" : "Starter Plan",
      price: duration === "monthly" ? 29 : 290,
      seats: 5,
      features: isRtl ? [
        "إدارة المبيعات والمنتجات",
        "مستودع مخزن واحد",
        "حد أقصى 5 موظفين نشطين",
        "تقارير محاسبية مبسطة",
        "دعم فني عبر البريد الإلكتروني"
      ] : [
        "Sales & Products Management",
        "1 Active Inventory Storehouse",
        "Up to 5 Active Employees",
        "Simplified Accounting Reports",
        "Email Support Response"
      ]
    },
    Professional: {
      name: isRtl ? "الباقة الاحترافية" : "Professional Plan",
      price: duration === "monthly" ? 79 : 790,
      seats: 15,
      popular: true,
      features: isRtl ? [
        "كل ميزات الباقة الأساسية",
        "مستودعات وفروع متعددة غير محدودة",
        "حد أقصى 15 موظف نشط",
        "إدارة الموردين والفواتير والمشتريات",
        "نظام الرواتب والمصاريف المتقدم",
        "تحليلات لوحة قيادة المدراء المباشرة",
        "دعم فني سريع 24/7"
      ] : [
        "All Starter Plan features",
        "Unlimited Multi-Storehouses & Branches",
        "Up to 15 Active Employees",
        "Suppliers, Invoices & Purchases Engine",
        "Advanced Payroll & Expenses Systems",
        "Real-Time Executive Analytics",
        "Priority Support 24/7"
      ]
    },
    Enterprise: {
      name: isRtl ? "باقة الشركات الكبرى" : "Enterprise Suite",
      price: duration === "monthly" ? 199 : 1990,
      seats: 99,
      features: isRtl ? [
        "كل ميزات الباقة الاحترافية",
        "أجهزة ومستخدمين غير محدودين (حتى 99 مقعد)",
        "تأمين الباك اب الفوري والتلقائي",
        "صلاحيات أمان ومستويات حماية إضافية",
        "مدير حساب مخصص للمؤسسة",
        "تكامل مباشر مع الواجهات البرمجية API",
        "اتفاقية مستوى الخدمة SLA المعتمدة"
      ] : [
        "All Professional features",
        "Unlimited Devices & Users (Up to 99 Seats)",
        "Instant Automating Backup Archiver",
        "Advanced Enterprise Security Guard",
        "Dedicated Customer Success Specialist",
        "Direct API Integration Gateway",
        "Guaranteed SLA Certification"
      ]
    }
  };

  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
      onTriggerNotification(
        isRtl ? "يرجى تعبئة كافة بيانات بطاقة الدفع المباشر" : "Please fill in all credit card details",
        "warning"
      );
      return;
    }
    setCheckoutLoading(true);
    try {
      const months = duration === "monthly" ? 1 : 12;
      await onPaymentSuccess(selectedPlan, months);
      onTriggerNotification(
        isRtl ? `تمت عملية الدفع وتفعيل ${plans[selectedPlan].name} بنجاح!` : `Payment processed and ${plans[selectedPlan].name} activated!`,
        "success"
      );
      setIsCheckingOut(false);
    } catch (err: any) {
      onTriggerNotification(err.message || "Payment processing failed", "info");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject || !supportMessage) {
      onTriggerNotification(
        isRtl ? "يرجى كتابة موضوع ونص الرسالة" : "Please provide subject and message content",
        "warning"
      );
      return;
    }
    setIsSubmittingSupport(true);
    try {
      // Mock ticket sent directly as an activity log for Super Admin review
      await new Promise(resolve => setTimeout(resolve, 800));
      setSupportSuccess(true);
      setSupportSubject("");
      setSupportMessage("");
      onTriggerNotification(
        isRtl ? "تم إرسال تذكرة الدعم بنجاح! سيتصل بكم مهندسونا قريباً." : "Support ticket sent successfully! Our team will contact you shortly.",
        "success"
      );
    } catch (err) {
      onTriggerNotification("Failed to submit support ticket", "info");
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#09090b] text-white z-50 flex flex-col overflow-y-auto" id="saas_license_paywall">
      {/* Background decoration elements */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />
      <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Dynamic Header */}
      <header className="border-b border-zinc-850 px-6 py-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center font-black text-white text-base shadow-lg">
            C
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wider text-zinc-400 uppercase">COREVIA ERP</h1>
            <p className="text-sm font-bold text-white leading-none">{companyName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onLogout}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            {isRtl ? "تسجيل الخروج" : "Logout Session"}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        
        {/* Left 2 columns: Warning & Pricing Selection */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-3 text-rose-400">
              <Clock className="w-6 h-6 shrink-0 animate-pulse" />
              <h2 className="text-lg font-black">{isRtl ? "انتهت فترة صلاحية الاشتراك التجريبي" : "SaaS License Has Expired"}</h2>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {isRtl 
                ? `مرحباً بك في نظام كوريڤيا. لقد انتهت فترة التجربة المجانية (15 يوماً) المخصصة لشركة (${companyName}). لمتابعة الاستفادة من وحدات النظام المتكاملة وعمليات الفروع والأرصدة، يرجى اختيار إحدى الباقات الاحترافية المعتمدة وتفعيل الاشتراك الآن.`
                : `Thank you for choosing Corevia ERP. The 15-day free trial period for your workspace (${companyName}) has completed. To unlock your dashboard and access active ERP modules, please activate a paid subscription below.`}
            </p>
          </div>

          {/* Plan Selector Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black">{isRtl ? "اختر باقة التفعيل المناسبة لمؤسستك" : "Select Your Activation Plan"}</h3>
              <p className="text-xs text-zinc-400 mt-1">{isRtl ? "احصل على ترخيص تشغيلي آمن وخدمة تخزين سحابية كاملة" : "Secure premium cloud storage & dedicated business modules"}</p>
            </div>

            {/* Billing Toggle */}
            <div className="bg-zinc-900 border border-zinc-800 p-1 rounded-xl flex items-center self-start md:self-auto">
              <button
                onClick={() => setDuration("monthly")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${duration === "monthly" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                {isRtl ? "شهري" : "Monthly Billing"}
              </button>
              <button
                onClick={() => setDuration("annual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition relative ${duration === "annual" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                {isRtl ? "سنوي" : "Annual Billing"}
                <span className="absolute -top-2 -right-1 bg-emerald-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full animate-bounce">
                  -17%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(Object.keys(plans) as Array<keyof typeof plans>).map((planKey) => {
              const p = plans[planKey];
              const isSelected = selectedPlan === planKey;
              return (
                <div 
                  key={planKey}
                  onClick={() => setSelectedPlan(planKey)}
                  className={`border rounded-2xl p-6 transition-all duration-300 relative flex flex-col cursor-pointer ${
                    isSelected 
                      ? "bg-indigo-950/40 border-indigo-500 shadow-xl shadow-indigo-500/5 ring-1 ring-indigo-500" 
                      : "bg-zinc-950 border-zinc-850 hover:border-zinc-700"
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-md uppercase">
                      <Sparkles className="w-3 h-3" />
                      {isRtl ? "الأكثر طلباً" : "Most Popular"}
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider">{planKey}</span>
                    <h4 className="text-base font-black text-white">{p.name}</h4>
                  </div>

                  <div className="my-5 flex items-baseline gap-1">
                    <span className="text-3xl font-black">${p.price}</span>
                    <span className="text-xs text-zinc-400">/{duration === "monthly" ? (isRtl ? "شهرياً" : "mo") : (isRtl ? "سنوياً" : "yr")}</span>
                  </div>

                  <p className="text-[11px] text-zinc-400 mb-5 pb-5 border-b border-zinc-850">
                    {isRtl 
                      ? `يتضمن ما يصل إلى ${p.seats} موظفين ومقاعد مستخدمين متزامنة.`
                      : `Includes up to ${p.seats} active employee user seats.`}
                  </p>

                  <ul className="space-y-2.5 flex-1 mb-6">
                    {p.features.map((f, idx) => (
                      <li key={idx} className="flex gap-2 text-xs text-zinc-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(planKey);
                      setIsCheckingOut(true);
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-black transition-all ${
                      isSelected
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/10 cursor-pointer active:scale-95"
                        : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                    }`}
                  >
                    {isRtl ? "اشترك الآن" : "Subscribe Now"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 column: Checkout panel or Support portal */}
        <div className="space-y-6">
          
          {/* Active Checkout Gateway */}
          {isCheckingOut ? (
            <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-850">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-black text-white">{isRtl ? "بوابة الدفع الآمنة" : "Secure Checkout"}</h3>
                </div>
                <button 
                  onClick={() => setIsCheckingOut(false)}
                  className="text-xs text-zinc-500 hover:text-white font-bold"
                >
                  ✕ {isRtl ? "إلغاء" : "Cancel"}
                </button>
              </div>

              {/* Order Summary */}
              <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-900 space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{isRtl ? "الخطة المحددة" : "Selected Plan"}:</span>
                  <span className="font-bold text-white">{plans[selectedPlan].name}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{isRtl ? "مدة الفوترة" : "Billing Cycle"}:</span>
                  <span className="font-mono text-white capitalize">{duration}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-indigo-400 pt-2 border-t border-dashed border-zinc-850">
                  <span>{isRtl ? "الإجمالي المستحق" : "Total Due"}:</span>
                  <span>${plans[selectedPlan].price}.00</span>
                </div>
              </div>

              {/* Visa/MasterCard Form */}
              <form onSubmit={handleProcessCheckout} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold block uppercase">{isRtl ? "اسم حامل البطاقة" : "Cardholder Name"}</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Mohamed Benhalilou"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold block uppercase">{isRtl ? "رقم بطاقة الائتمان" : "Card Number"}</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={19}
                      placeholder="4000 1234 5678 9010"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                      className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-lg pl-3 pr-8 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <CreditCard className="w-4 h-4 text-zinc-500 absolute right-2.5 top-3" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold block uppercase">{isRtl ? "تاريخ الانتهاء" : "Expiry"}</label>
                    <input
                      type="text"
                      required
                      placeholder="MM/YY"
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500 text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold block uppercase">CVV</label>
                    <input
                      type="password"
                      required
                      placeholder="123"
                      maxLength={3}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500 text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isRtl ? "تشفير مشدد معتمد 256-bit SSL" : "256-bit highly secured SSL validation"}</span>
                </div>

                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isRtl ? "جاري تفعيل الاشتراك السحابي..." : "Activating ERP Suite..."}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {isRtl ? `ادفع وتنشط (${plans[selectedPlan].price}$)` : `Commit Activation Payment ($${plans[selectedPlan].price})`}
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-4 border-b border-zinc-850">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black text-white">{isRtl ? "ملخص الطلب النشط" : "Subscription Status"}</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{isRtl ? "معرف الشركة" : "Tenant ID"}:</span>
                  <span className="font-mono text-white text-[10px]">{companyId.substring(0, 15)}...</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{isRtl ? "الحالة السحابية" : "Cloud Status"}:</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase">
                    {isRtl ? "مجمد (مؤقت)" : "Suspended"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{isRtl ? "الباقة الحالية" : "Current Plan"}:</span>
                  <span className="font-bold text-white">Trial (Expired)</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-xl space-y-1">
                <p className="text-[11px] text-indigo-400 font-bold">{isRtl ? "💡 تلميح الدعم الفني" : "💡 Activation Tip"}</p>
                <p className="text-[10px] text-zinc-300 leading-relaxed">
                  {isRtl 
                    ? "بمجرد تفعيل الاشتراك، سيقوم النظام تلقائياً بفتح كامل الفروع وعقود الموظفين وحسابات الأرصدة والباك اب على السحاب دون أي فقد للبيانات."
                    : "Choosing a paid package will immediately reactive all user accounts, warehouses, and previous data records without any platform downtime."}
                </p>
              </div>
            </div>
          )}

          {/* Contact Support Form */}
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-4 border-b border-zinc-850">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-black text-white">{isRtl ? "تواصل مع الدعم الفني" : "Contact ERP Support"}</h3>
            </div>

            {supportSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center space-y-2 animate-fade-in">
                <Check className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-bold text-white">{isRtl ? "تم إرسال تذكرة الدعم بنجاح" : "Ticket Submitted Successfully"}</h4>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  {isRtl 
                    ? "تم تسجيل تذكرتكم لدى لوحة مهندسي السحاب، سيتواصل معكم أحد فنيينا على بريدكم الإلكتروني قريباً."
                    : "Your support request has been cataloged. Our systems engineer will reach out to your registered email shortly."}
                </p>
                <button
                  onClick={() => setSupportSuccess(false)}
                  className="text-[10px] text-indigo-400 font-bold underline cursor-pointer"
                >
                  {isRtl ? "إرسال رسالة أخرى" : "Send another message"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendSupport} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold block uppercase">{isRtl ? "الموضوع" : "Subject"}</label>
                  <input
                    type="text"
                    required
                    placeholder={isRtl ? "مثال: استفسار عن فوترة الباقة الاحترافية" : "E.g., Upgrade issue or billing query"}
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold block uppercase">{isRtl ? "الرسالة" : "Message text"}</label>
                  <textarea
                    required
                    rows={3}
                    placeholder={isRtl ? "اكتب هنا تفاصيل استفسارك أو مشكلتك بالتفصيل..." : "Write down details of your request..."}
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSupport}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingSupport ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5" />
                      {isRtl ? "إرسال التذكرة الآن" : "Submit Support Request"}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Quick contact credentials */}
          <div className="text-[10px] text-zinc-500 space-y-1 px-2">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-zinc-600" />
              <span>{supportEmail || "support@corevia-erp.com"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-zinc-600" />
              <span>{phone || "+213 (0) 550 00 00 10"}</span>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
