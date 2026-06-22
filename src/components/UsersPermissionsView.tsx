import React, { useState, useEffect } from "react";
import { 
  Users, UserPlus, Shield, Eye, EyeOff, Lock, Edit3, Trash2, Check, X, 
  HelpCircle, AlertTriangle, KeyRound, Key, RefreshCw, FileText, CheckCircle2, UserCheck
} from "lucide-react";
import { LanguageType } from "../types";
import { translations } from "../translations";
import { Employee, getEmployees, saveEmployee, deleteEmployee, generateEmployeeLoginEmail } from "../employeeService";
import { logActivity } from "../activityLogService";
import { getWorkers, getOrders, saveOrders, deleteEntireWorkerProfileSoft } from "../storageUtils";
import { pushSingleDatasetToCloud } from "../supabaseSync";
import { supabase, createSecondaryClient } from "../supabaseClient";

// Name & Phone smart normalizations for bulletproof Algerian/Arabic de-duplication
export function cleanArabicName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064b-\u0652\u0670]/g, "") // remove symbols
    .replace(/[^a-zA-Z0-9\u0621-\u064a]/g, ""); // strip all other characters & spaces
}

export function cleanPhoneDigits(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

interface UsersPermissionsViewProps {
  lang: LanguageType;
  session: any;
  onTriggerNotification: (msg: string) => void;
  seatsLimit?: number;
  onDeleteEntireWorkerProfile?: (code: string) => void;
  workers?: any[];
  companyName?: string;
}

export default function UsersPermissionsView({
  lang,
  session,
  onTriggerNotification,
  seatsLimit = 5,
  onDeleteEntireWorkerProfile,
  workers = [],
  companyName = ""
}: UsersPermissionsViewProps) {
  const isRtl = lang === "ar";
  const companyId = session?.company_id || "cop_default";
  const allWorkers = (workers && workers.length > 0) ? workers : getWorkers();

  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"Active" | "Read Only" | "Suspended">("Active");
  const [assignedResponsibilities, setAssignedResponsibilities] = useState("");
  const [selectedPages, setSelectedPages] = useState<string[]>(["dashboard"]);
  
  // Contract / Worker Profile Sync Fields
  const [baseSalary, setBaseSalary] = useState<number>(35000);
  const [monthlySalary, setMonthlySalary] = useState<number>(35000);
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState<number>(8);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState<number>(22);
  const [overtimeHourRate, setOvertimeHourRate] = useState<number>(1.5);
  const [absenceDeductionRate, setAbsenceDeductionRate] = useState<number>(1.0);
  const [notes, setNotes] = useState<string>("");
  
  const [username, setUsername] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [createdCredentials, setCreatedCredentials] = useState<{
    fullName: string;
    email?: string;
    username: string;
    password?: string;
    loginUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!editingEmployee && fullName) {
      const toSlug = (name: string) => {
        return name.toLowerCase().trim()
          .replace(/\s+/g, "")
          .replace(/[أإآا]/g, "a")
          .replace(/[ب]/g, "b")
          .replace(/[ت]/g, "t")
          .replace(/[ث]/g, "th")
          .replace(/[ج]/g, "j")
          .replace(/[حخ]/g, "kh")
          .replace(/[دذ]/g, "d")
          .replace(/[ر]/g, "r")
          .replace(/[ز]/g, "z")
          .replace(/[سش]/g, "s")
          .replace(/[صض]/g, "sh")
          .replace(/[طظ]/g, "t")
          .replace(/[عغ]/g, "g")
          .replace(/[ف]/g, "f")
          .replace(/[قك]/g, "k")
          .replace(/[ل]/g, "l")
          .replace(/[من]/g, "n")
          .replace(/[ه]/g, "h")
          .replace(/[وي]/g, "y")
          .replace(/[^a-z0-9]/g, "");
      };

      let employeeSlug = toSlug(fullName);
      if (!employeeSlug) employeeSlug = "user";

      let companySlug = toSlug(companyName);
      if (!companySlug) companySlug = "";

      let baseSlug = employeeSlug + companySlug;
      if (!baseSlug) baseSlug = "user";

      let counter = 1;
      let uniqueSlug = `${baseSlug}.${String(counter).padStart(3, "0")}`;
      while (employees.some(emp => emp.username?.toLowerCase() === uniqueSlug)) {
        counter++;
        uniqueSlug = `${baseSlug}.${String(counter).padStart(3, "0")}`;
      }

      setUsername(uniqueSlug);
      setEmail(`${employeeSlug}+${companySlug}@corevia.local`);
    }
  }, [fullName, editingEmployee, employees, companyName]);

  // UI States
  const [showPasswordRaw, setShowPasswordRaw] = useState(false);
  const [passRevealId, setPassRevealId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // States for custom delete with option to retain/delete worker profile
  const [userToDeleteRecord, setUserToDeleteRecord] = useState<Employee | null>(null);
  const [linkedWorkerFound, setLinkedWorkerFound] = useState<any | null>(null);
  const [subTab, setSubTab] = useState<"accounts" | "salary_profiles">("accounts");

  const handleCreateAccountForWorker = (worker: any) => {
    setEditingEmployee(null);
    setSelectedWorkerId(worker.id);
    setFullName(worker.name);
    setPhone(worker.phone || "");
    setEmail("");
    
    // Auto generate clean username from phone or code
    const cleanNum = worker.phone ? worker.phone.replace(/\D/g, "") : "";
    const suffix = cleanNum.length >= 6 ? cleanNum.slice(-6) : Math.floor(1000 + Math.random() * 9000).toString();
    setUsername(`worker_${suffix}`);
    
    setJobTitle(worker.role || "موظف");
    setPassword(Math.floor(100000 + Math.random() * 900000).toString());
    setStatus("Active");
    setAssignedResponsibilities("");
    setSelectedPages(["dashboard"]);
    setShowPasswordRaw(true);
    
    // Set financial parameters
    setBaseSalary(worker.baseSalary || 35000);
    setMonthlySalary(worker.monthlySalary || worker.baseSalary || 35000);
    setWorkingHoursPerDay(worker.dailyHours || 8);
    setWorkingDaysPerMonth(22);
    setOvertimeHourRate(worker.overtimeRate || 1.5);
    setAbsenceDeductionRate(1.0);
    setNotes(worker.notes || "");
    
    setIsModalOpen(true);
  };

  const handleCopyLink = async (emp: Employee) => {
    try {
      let tokenToUse = emp.invitation_token;
      let expiresToUse = emp.invitation_expires;

      if (!tokenToUse) {
        // Generate expiring (7 days) secure invitation link on the fly and sync
        tokenToUse = "inv-" + Math.floor(10000000 + Math.random() * 90000000).toString() + "-" + Date.now().toString(36);
        expiresToUse = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const updatedEmp = {
          ...emp,
          invitation_token: tokenToUse,
          invitation_expires: expiresToUse,
          invitation_used: false
        };
        await saveEmployee(updatedEmp);
      }

      const url = `${window.location.origin}/?invite_token=${tokenToUse}`;

      navigator.clipboard.writeText(url);
      setCopiedId(emp.id);
      onTriggerNotification(
        isRtl 
          ? `📋 تم نسخ رابط الدخول المباشر الآمن الخاص بـ (${emp.fullName})! يمكنك إرساله له الآن.` 
          : `📋 Secure pre-filled login link for (${emp.fullName}) copied to clipboard!`
      );
      setTimeout(() => {
        setCopiedId(null);
      }, 3000);
    } catch (err) {
      console.warn("Failed to copy link:", err);
    }
  };

  // Available Pages list (all 13 specified in product specification)
  const availablePagesList = [
    { id: "dashboard", labelEn: "Dashboard", labelAr: "لوحة التحكم الرئيسية" },
    { id: "orders", labelEn: "Orders", labelAr: "الطلبيات والمبيعات" },
    { id: "suppliers", labelEn: "Customers", labelAr: "الموردين والزبائن (العملاء)" },
    { id: "inventory", labelEn: "Inventory", labelAr: "إدارة المخزون الذكية" },
    { id: "products", labelEn: "Products", labelAr: "إدارة المنتجات والموديلات" },
    { id: "returns", labelEn: "Returns", labelAr: "مخزون المرتجعات والإرجاع" },
    { id: "invoices", labelEn: "Invoices", labelAr: "الفواتير والمشتريات" },
    { id: "expenses", labelEn: "Expenses", labelAr: "سجل المصاريف والإعلانات" },
    { id: "workers", labelEn: "Workers & Payrolls", labelAr: "الموظفين والعمال والرواتب" },
    { id: "profit", labelEn: "Reports (Profit)", labelAr: "ملخص الأرباح والمالية" },
    { id: "activity-log", labelEn: "Activity Log", labelAr: "سجل عمليات الشركة" },
    { id: "settings", labelEn: "Settings", labelAr: "إعدادات النظام وعلامة الألوان" },
    { id: "users-permissions", labelEn: "Users & Permissions", labelAr: "إدارة المستخدمين والصلاحيات" },
  ];

  // Load Employees on Mount and Session changes
  const loadEmployeesData = async () => {
    setIsLoading(true);
    try {
      const data = await getEmployees(companyId);
      // Ensure we exclude owner or super admin accounts from the seats count list if not created as employees
      setEmployees(data);
    } catch (e) {
      console.error("Error loading employees", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeesData();
  }, [companyId]);

  // Total seats counted: 1 Owner + number of created employee accounts
  const totalSeatsCountUsed = 1 + employees.length;

  const handleOpenCreateModal = () => {
    if (totalSeatsCountUsed >= seatsLimit) {
      onTriggerNotification(
        isRtl 
          ? "⚠️ لقد وصلت إلى الحد الأقصى لعدد المستخدمين المسموح به في اشتراكك."
          : "⚠️ You have reached the maximum number of users allowed in your subscription."
      );
      return;
    }
    
    setEditingEmployee(null);
    setSelectedWorkerId("");
    setFullName("");
    setPhone("");
    setEmail("");
    setUsername("");
    setJobTitle("");
    setPassword(Math.floor(100000 + Math.random() * 900000).toString()); // Pre-fill with clean random password
    setStatus("Active");
    setAssignedResponsibilities("");
    setSelectedPages(["dashboard"]);
    setShowPasswordRaw(true);
    setBaseSalary(35000);
    setMonthlySalary(35000);
    setWorkingHoursPerDay(8);
    setWorkingDaysPerMonth(22);
    setOvertimeHourRate(1.5);
    setAbsenceDeductionRate(1.0);
    setNotes("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setSelectedWorkerId(emp.id);
    setFullName(emp.fullName);
    setPhone(emp.phone);
    setEmail(emp.email || "");
    setUsername(emp.username || "");
    setJobTitle(emp.jobTitle);
    setPassword(emp.password || "");
    setStatus(emp.status);
    setAssignedResponsibilities(emp.assignedResponsibilities || "");
    setSelectedPages(emp.allowedPages || ["dashboard"]);
    setShowPasswordRaw(false);

    const match = allWorkers.find(
      w => w.id === emp.id || 
           (w.phone && emp.phone && cleanPhoneDigits(w.phone) === cleanPhoneDigits(emp.phone)) ||
           cleanArabicName(w.name) === cleanArabicName(emp.fullName)
    );
    if (match) {
      setBaseSalary(match.baseSalary || 35000);
      setMonthlySalary(match.monthlySalary || match.baseSalary || 35000);
      setWorkingHoursPerDay(match.dailyHours || 8);
      setWorkingDaysPerMonth(match.workingDaysPerMonth || 22);
      setOvertimeHourRate(match.overtimeRate || 1.5);
      setAbsenceDeductionRate(match.absenceDeductionRate || 1.0);
      setNotes(match.notes || "");
    } else {
      setBaseSalary(35000);
      setMonthlySalary(35000);
      setWorkingHoursPerDay(8);
      setWorkingDaysPerMonth(22);
      setOvertimeHourRate(1.5);
      setAbsenceDeductionRate(1.0);
      setNotes("");
    }
    setIsModalOpen(true);
  };

  const togglePageSelection = (pid: string) => {
    if (selectedPages.includes(pid)) {
      setSelectedPages(selectedPages.filter(x => x !== pid));
    } else {
      setSelectedPages([...selectedPages, pid]);
    }
  };

  const handleResendInvite = async (emp: Employee) => {
    if (!emp.email) {
      onTriggerNotification(isRtl ? "⚠️ لا يوجد بريد إلكتروني لإرسال الدعوة إليه." : "⚠️ No email address to send invitation to.");
      return;
    }
    try {
      const res = await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emp.email, employeeId: emp.id })
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        if (data.inviteQueued) {
          onTriggerNotification(
            isRtl
              ? `⏳ لا يزال نظام البريد محدود الإرسال. سيتم إرسال دعوة (${emp.fullName}) لاحقاً.`
              : `⏳ Email system still rate limited. Invitation for (${emp.fullName}) will be sent later.`
          );
        } else {
          await saveEmployee({ ...emp, invitation_status: "sent", invitation_sent: true, last_invite_error: undefined, auth_user_id: data.auth_user_id || emp.auth_user_id });
          loadEmployeesData();
          onTriggerNotification(
            isRtl
              ? `✅ تم إرسال دعوة البريد الإلكتروني لـ (${emp.fullName}) بنجاح.`
              : `✅ Invitation email re-sent to (${emp.fullName}) successfully.`
          );
        }
      } else {
        onTriggerNotification(
          isRtl
            ? `❌ فشل إرسال الدعوة: ${data.error || "خطأ غير معروف"}`
            : `❌ Failed to resend invitation: ${data.error || "Unknown error"}`
        );
      }
    } catch (err: any) {
      onTriggerNotification(
        isRtl
          ? `❌ خطأ في الشبكة: ${err.message}`
          : `❌ Network error: ${err.message}`
      );
    }
  };

  const handleDeleteEmployeeItem = (emp: Employee) => {
    const match = allWorkers.find(
      w => w.id === emp.id || 
           (w.phone && emp.phone && cleanPhoneDigits(w.phone) === cleanPhoneDigits(emp.phone)) ||
           cleanArabicName(w.name) === cleanArabicName(emp.fullName)
    );
    setUserToDeleteRecord(emp);
    setLinkedWorkerFound(match || null);
  };

  const handleExecuteDelete = async (deleteWorkerProfile: boolean) => {
    if (!userToDeleteRecord) return;
    const emp = userToDeleteRecord;

    setIsLoading(true);
    const success = await deleteEmployee(emp.id, companyId);
    if (success) {
      onTriggerNotification(
        isRtl 
          ? `✅ تم حذف حساب الموظف (${emp.fullName}) بنجاح.`
          : `✅ Successfully deleted employee (${emp.fullName})`
      );

      // Keep order history intact but update creator label
      try {
        const currentOrders = getOrders();
        let changed = false;
        const updatedOrders = currentOrders.map(order => {
          if (order.agentName === emp.fullName) {
            changed = true;
            return { ...order, agentName: `${emp.fullName} (Deleted User)` };
          }
          return order;
        });
        if (changed) {
          saveOrders(updatedOrders);
          if (companyId) {
            await pushSingleDatasetToCloud(companyId, "orders", updatedOrders);
          }
        }
      } catch (err) {
        console.error("Order history update error:", err);
      }

      // If user selected to delete the entire worker file, do it too!
      if (deleteWorkerProfile && linkedWorkerFound) {
        if (onDeleteEntireWorkerProfile) {
          onDeleteEntireWorkerProfile(linkedWorkerFound.code);
        } else {
          deleteEntireWorkerProfileSoft(linkedWorkerFound.code);
        }
        onTriggerNotification(
          isRtl
            ? `✅ تم شطب وحذف ملف العامل (${linkedWorkerFound.name}) وسجلاته المالية بالكامل.`
            : `✅ Successfully deleted linked worker profile and payroll sheets.`
        );
      } else if (linkedWorkerFound) {
        onTriggerNotification(
          isRtl
            ? `ℹ️ تم الحفاظ على ملف العامل وسجل رواتبه لدقة الحسابات.`
            : `ℹ️ Kept the worker financial profile intact.`
        );
      }

      // Log delete activity
      await logActivity({
        companyId,
        userName: session?.username || "Owner",
        userId: session?.user_id || "owner_id",
        jobTitle: session?.role === "admin" ? "Company Owner" : session?.jobTitle || "Employee",
        actionType: deleteWorkerProfile ? "Delete User & Worker" : "Delete User Only",
        pageName: "Users & Permissions",
        affectedRecord: `User: ${emp.fullName} (${emp.jobTitle})${deleteWorkerProfile ? ' + Linked Worker Profile' : ''}`,
        previousValue: JSON.stringify(emp),
        newValue: ""
      });

      loadEmployeesData();
    } else {
      onTriggerNotification(isRtl ? "❌ فشل حذف الموظف من قاعدة البيانات" : "❌ Failed to delete employee");
    }

    setIsLoading(false);
    setUserToDeleteRecord(null);
    setLinkedWorkerFound(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !password.trim() || !username.trim()) {
      onTriggerNotification(isRtl ? "⚠️ يرجى ملء جميع الحقول الإلزامية." : "⚠️ Please fill all required fields.");
      return;
    }

    setIsLoading(true);
    
    const isNew = !editingEmployee;
    const employeeId = editingEmployee ? editingEmployee.id : (selectedWorkerId || `emp-${Date.now()}`);

    // Seat capacity limitation enforcement
    if (isNew && totalSeatsCountUsed >= seatsLimit) {
      onTriggerNotification(
        isRtl 
          ? "❌ تم تجاوز الطاقة الاستيعابية لعدد المقاعد في اشتراك موظفي هذا الحساب السحابي! يرجى ترقية اشتراك السحاب (User seat capacity exceeded for this company. Please upgrade your subscription.)"
          : "❌ User seat capacity exceeded for this company. Please upgrade your subscription."
      );
      setIsLoading(false);
      return;
    }
    
    // Check if phone, email, or username already registered by another employee in the company
    const duplicate = employees.find(
      x => x.id !== employeeId && 
      (
        (x.phone && phone && cleanPhoneDigits(x.phone) === cleanPhoneDigits(phone)) || 
        (email && x.email && x.email.toLowerCase().trim() === email.toLowerCase().trim()) ||
        (username && x.username && x.username.toLowerCase().trim() === username.toLowerCase().trim())
      )
    );

    if (duplicate) {
      onTriggerNotification(
        isRtl 
          ? "❌ رقم الهاتف أو البريد الإلكتروني أو اسم المستخدم مسجل بالفعل لموظف آخر."
          : "❌ The phone, email, or username is already registered to another employee."
      );
      setIsLoading(false);
      return;
    }

    let authUserId = editingEmployee?.auth_user_id;
    let invitationToken = editingEmployee?.invitation_token;
    let invitationExpires = editingEmployee?.invitation_expires;
    let invitationUsed = editingEmployee?.invitation_used ?? false;
    let invitationStatus: "sent" | "pending" | undefined;
    let invitationSent: boolean | undefined;
    let inviteError: string | undefined;
    let inviteQueued = false;

    // Create a real Supabase Auth account for the new employee via server-side invite endpoint
    if (isNew) {
      const companySlug = companyName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
      const employeeSlug = (fullName || "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
      const userEmail = email.trim() || `${employeeSlug}+${companySlug}@corevia.local`;

      try {
        const inviteRes = await fetch("/api/auth/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: userEmail,
            fullName: fullName.trim(),
            username: username.trim().toLowerCase(),
            employeeId: employeeId,
            allowedPages: selectedPages
          })
        });

        const inviteData = await inviteRes.json();

        if (inviteRes.ok && inviteData.success !== false) {
          authUserId = inviteData.auth_user_id || undefined;
          inviteQueued = inviteData.inviteQueued || false;
          inviteError = inviteData.last_invite_error;

          if (inviteQueued) {
            onTriggerNotification(
              isRtl
                ? `⏳ تم حفظ حساب الموظف (${fullName}) بنجاح. سيتم إرسال دعوة البريد الإلكتروني لاحقاً بسبب قيود الإرسال.`
                : `⏳ Employee (${fullName}) saved. Email invitation queued due to rate limits — will be sent later.`
            );
          }
          invitationStatus = inviteQueued ? "pending" : "sent";
          invitationSent = !inviteQueued;
        } else {
          console.error("Invite API error:", inviteData);
          onTriggerNotification(
            isRtl
              ? `❌ فشل إنشاء حساب الموظف: ${inviteData.error || "خطأ غير معروف"}`
              : `❌ Failed to create employee account: ${inviteData.error || "Unknown error"}`
          );
          setIsLoading(false);
          return;
        }
      } catch (fetchErr: any) {
        console.error("Invite API fetch error:", fetchErr);
        onTriggerNotification(
          isRtl
            ? `❌ فشل الاتصال بالخادم لإنشاء حساب الموظف: ${fetchErr.message}`
            : `❌ Network error contacting server for employee account: ${fetchErr.message}`
        );
        setIsLoading(false);
        return;
      }

      // Generate expiring (7 days) secure invitation link
      invitationToken = "inv-" + Math.floor(10000000 + Math.random() * 90000000).toString() + "-" + Date.now().toString(36);
      invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      invitationUsed = false;

      // If editing employee and password changed, sync password back to Supabase Auth
      if (editingEmployee && editingEmployee.password !== password.trim()) {
        const userEmail = email.trim() || editingEmployee.email || `${editingEmployee.username?.trim().toLowerCase()}@corevia.local`;
        const signUpSecondary = createSecondaryClient();
        if (signUpSecondary) {
          try {
            const { error: signInErr } = await signUpSecondary.auth.signInWithPassword({
              email: userEmail,
              password: editingEmployee.password || ""
            });
            if (!signInErr) {
              await signUpSecondary.auth.updateUser({ password: password.trim() });
              await signUpSecondary.auth.signOut();
            }
          } catch (err) {
            console.warn("Could not sync updated password to Supabase Auth:", err);
          }
        }
      }
    }

    const finalEmail = email.trim() || generateEmployeeLoginEmail(fullName.trim(), companyName);
    if (!finalEmail || !finalEmail.includes("@")) {
      onTriggerNotification(
        isRtl ? "❌ تعذر إنشاء البريد الإلكتروني للموظف. يرجى التحقق من البيانات." : "❌ Unable to generate employee login email."
      );
      setIsLoading(false);
      return;
    }

    const payload: Employee = {
      id: employeeId,
      companyId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: finalEmail,
      username: username.trim().toLowerCase(),
      jobTitle: jobTitle.trim() || "موظف",
      password: password.trim(),
      allowedPages: selectedPages,
      assignedResponsibilities: assignedResponsibilities.trim() || undefined,
      status,
      lastActivity: editingEmployee?.lastActivity,
      createdAt: editingEmployee?.createdAt || new Date().toISOString(),
      auth_user_id: authUserId,
      invitation_token: invitationToken,
      invitation_expires: invitationExpires,
      invitation_used: invitationUsed,
      invitation_status: isNew ? invitationStatus : editingEmployee?.invitation_status,
      invitation_sent: isNew ? invitationSent : editingEmployee?.invitation_sent,
      last_invite_error: isNew ? inviteError : editingEmployee?.last_invite_error
    };

    const success = await saveEmployee(payload);
    if (success) {
      onTriggerNotification(
        isRtl
          ? `✅ تم ${isNew ? "إنشاء" : "تحديث"} حساب الموظف (${fullName}) بنجاح`
          : `✅ Successfully ${isNew ? "created" : "updated"} employee account (${fullName})`
      );

      // Workers and Login Accounts are completely separate entities.
      // NEVER auto-create/update worker profiles when creating employee accounts.
      // Workers are managed exclusively from the Workers page.

      // Log specific activities
      const actionType = isNew ? "Create User" : "Update User";
      const affectedRecord = `User: ${fullName} (${jobTitle})`;
      
      let logAction = actionType;
      if (!isNew && editingEmployee.status !== status) {
        logAction = status === "Suspended" ? "Suspend User" : "Reactivate User";
      }

      await logActivity({
        companyId,
        userName: session?.username || "Owner",
        userId: session?.user_id || "owner_id",
        jobTitle: session?.role === "admin" ? "Company Owner" : session?.jobTitle || "Employee",
        actionType: logAction,
        pageName: "Users & Permissions",
        affectedRecord,
        previousValue: editingEmployee ? JSON.stringify(editingEmployee) : "",
        newValue: JSON.stringify(payload)
      });

      if (isNew) {
        const credCompanySlug = companyName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
        const credEmployeeSlug = fullName.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
        setCreatedCredentials({
          fullName: fullName.trim(),
          email: email.trim() || `${credEmployeeSlug}+${credCompanySlug}@corevia.local`,
          username: username.trim().toLowerCase(),
          password: password.trim(),
          loginUrl: `${window.location.origin}/?invite_token=${invitationToken}`
        });
      } else {
        setIsModalOpen(false);
        loadEmployeesData();
      }
    } else {
      onTriggerNotification(isRtl ? "❌ فشل حفظ تفاصيل الحساب" : "❌ Failed to save account details");
    }
    
    setIsLoading(false);
  };

  if (session?.role === "employee") {
    return (
      <div className="text-center py-24 bg-[#09090b] rounded-2xl border border-zinc-800 p-8 max-w-lg mx-auto my-12" id="unauthorized_access_view">
        <div className="w-16 h-16 bg-red-950/40 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">
          {isRtl ? "غير مصرح به - وصول مرفوض" : "Unauthorized Access - Entry Denied"}
        </h3>
        <p className="text-xs text-slate-450 leading-relaxed">
          {isRtl 
            ? "عذراً، هذه الصفحة مخصصة لمالكي وإداريي الشركة فقط. لا تمتلك صلاحيات كافية لاستعراض وإدارة حسابات الموظفين."
            : "Sorry, this page is restricted to Company Owners and Admins only. You do not possess authorized privileges to manage corporate user accounts."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="users_and_permissions_section">
      
      {/* Top action layout */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0c0c0e] p-4 rounded-xl border border-[#1f1f23]">
        <div className={isRtl ? "text-right" : "text-left"}>
          <h2 className="text-sm font-bold text-white flex items-center gap-2 justify-end">
            <span>👥 {isRtl ? "إدارة شؤون الموظفين والصلاحيات" : "Employee Workspace & Access Gates"}</span>
          </h2>
          <p className="text-[10px] text-slate-400 mt-1">
            {isRtl 
              ? "تفويض صلاحيات معينة لكل موظف، تتبع نشاطاتهم الأخيرة، وإدارة ملفاتهم السرية."
              : "Delegate secure per-page authorization grids, track live sessions, and manage background data details."}
          </p>
        </div>

        {/* Seat Tracker Display Widget */}
        <div className="flex items-center gap-3 bg-[#121214] border border-[#27272a] px-3.5 py-2 rounded-xl">
          <div className="text-right">
            <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">
              {isRtl ? "مؤشر مقاعد الاشتراك" : "SUBSCRIPTION SEATS TRACKER"}
            </span>
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`h-2 w-2 rounded-full ${totalSeatsCountUsed >= seatsLimit ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-xs font-black text-white">
                {totalSeatsCountUsed} / {seatsLimit} {isRtl ? "حسابات مستخدمة" : "seats occupied"}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleOpenCreateModal}
            className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all active:scale-[0.98] cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isRtl ? "إضافة موظف جديد" : "Create New User"}</span>
          </button>
        </div>
      </div>

      {/* Sub tabs selector */}
      <div className="flex border-b border-[#27272a] gap-2 p-1 bg-[#09090b] rounded-lg">
        <button
          onClick={() => setSubTab("accounts")}
          className={`flex-1 py-1.5 px-3 text-center rounded-md font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === "accounts"
              ? "bg-[#18181b] text-white border border-[#27272a] shadow font-black"
              : "text-slate-450 hover:text-slate-200 hover:bg-[#121214]/50"
          }`}
        >
          <span>👤</span>
          <span>{isRtl ? "حسابات دخول ERP وصلاحيات الموظفين" : "ERP System User Accounts"}</span>
        </button>
        <button
          onClick={() => setSubTab("salary_profiles")}
          className={`flex-1 py-1.5 px-3 text-center rounded-md font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === "salary_profiles"
              ? "bg-[#18181b] text-white border border-[#27272a] shadow font-black"
              : "text-slate-450 hover:text-slate-200 hover:bg-[#121214]/50"
          }`}
        >
          <span>💼</span>
          <span>{isRtl ? "الملفات المالية للموظفين والرواتب" : "Company Workers & Salary Profiles"}</span>
        </button>
      </div>

      {/* Employees Table Grid */}
      {subTab === "accounts" && (
        isLoading && employees.length === 0 ? (
          <div className="text-center py-12 bg-[#09090b] rounded-xl border border-[#27272a]">
            <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">{isRtl ? "جاري تحميل وتزامن قائمة الموظفين..." : "Loading employee accounts roster..."}</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16 bg-[#09090b] rounded-xl border border-[#27272a] p-6 space-y-3">
            <Users className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">{isRtl ? "لا يوجد موظفون مقيدون حالياً" : "No employee accounts declared"}</h3>
            <p className="text-xs text-slate-450 max-w-sm mx-auto">
              {isRtl 
                ? "لم تقم بتسجيل أي موظف لشركتك بعد. اضغط على الزر بالأعلى لمنحهم تراخيص ERP للعمل."
                : "Your corporate account does not have any employees listed. Create one above to grant customized secure login gateways."}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mx-auto px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {isRtl ? "إضافة أول موظف الآن" : "Add Your First Employee"}
            </button>
          </div>
        ) : (
          <div className="bg-[#09090b] rounded-xl border border-[#27272a] overflow-hidden">
            <div className="p-3 border-b border-[#27272a] bg-[#0c0c0e] flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold">
                {employees.length} {isRtl ? "موظفين نشطين / مسجلين" : "Active employees listed"}
              </span>

              {/* Quick reload */}
              <button 
                onClick={loadEmployeesData} 
                className="p-1 hover:bg-[#1a1a1e] rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse" style={{ direction: isRtl ? "rtl" : "ltr" }}>
                <thead>
                  <tr className="border-b border-[#27272a] text-slate-400 bg-slate-950/40">
                    <th className="p-3 font-semibold text-center">{isRtl ? "الموظف" : "Employee"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "المنصب / اللقب" : "Job Title"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "بيانات الدخول" : "Auth Credentials"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "الحالة" : "Status"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "الصفحات المرخصة" : "Pages Allowed"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "النشاط الأخير" : "Last Active Time"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "التحكم" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const hasEmail = !!emp.email;
                    return (
                      <tr key={emp.id} className="border-b border-[#1f1f23] hover:bg-white/[0.01] transition-colors">
                        {/* Name Card */}
                        <td className="p-3 font-bold text-white text-center">
                          <div className="flex flex-col items-center">
                            <span>{emp.fullName}</span>
                            <span className="text-[9px] text-slate-400 font-normal">Created: {new Date(emp.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>

                        {/* Job Title */}
                        <td className="p-3 text-slate-200 text-center">
                          <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-900/30 rounded-full font-semibold text-[10px]">
                            {emp.jobTitle}
                          </span>
                        </td>

                        {/* Credentials */}
                        <td className="p-3 text-center space-y-1">
                          <div className="text-slate-300 font-mono text-[11px]">
                            📱 {emp.phone}
                          </div>
                          {hasEmail && (
                            <div className="text-slate-400 text-[10px] font-mono">
                              ✉️ {emp.email}
                            </div>
                          )}
                          {emp.username && (
                            <div className="text-emerald-400 font-mono text-[10px] bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 inline-block my-1 font-bold">
                              👤 {emp.username}
                            </div>
                          )}
                          
                          {/* Reveal Password Hook */}
                          <div className="flex items-center justify-center gap-1 text-[10px]">
                            <span className="text-slate-500">{isRtl ? "كلمة المرور:" : "Password:"}</span>
                            <span className="font-mono text-slate-200 font-bold bg-[#141416] px-1.5 py-0.5 rounded border border-[#27272a]">
                              {passRevealId === emp.id ? emp.password : "••••••"}
                            </span>
                            <button
                              onClick={() => setPassRevealId(passRevealId === emp.id ? null : emp.id)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              {passRevealId === emp.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>

                          {/* Invitation Status Badge */}
                          {emp.invitation_status === "pending" && (
                            <div className="pt-1 flex items-center justify-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-950/60 border border-amber-500/30 text-amber-400 rounded-full text-[9px] font-bold">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                <span>{isRtl ? "دعوة معلقة" : "Pending Invitation"}</span>
                              </span>
                              <button
                                onClick={() => handleResendInvite(emp)}
                                className="px-1.5 py-0.5 bg-[#1c1c1e] hover:bg-amber-950/40 border border-[#27272a] hover:border-amber-500/40 text-amber-400 hover:text-amber-300 rounded text-[9px] font-bold transition-all cursor-pointer"
                                title={isRtl ? "إعادة إرسال الدعوة" : "Resend invitation email"}
                              >
                                <RefreshCw className="w-2.5 h-2.5 inline-block" />
                                <span className="mr-0.5">{isRtl ? "إعادة إرسال" : "Resend"}</span>
                              </button>
                            </div>
                          )}
                          {emp.invitation_status === "sent" && (
                            <div className="pt-1 flex items-center justify-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400/70 rounded-full text-[9px] font-bold">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>{isRtl ? "تم إرسال الدعوة" : "Invitation Sent"}</span>
                              </span>
                            </div>
                          )}

                          {/* Direct shareable login link button */}
                          <div className="pt-1 select-none">
                            <button
                              onClick={() => handleCopyLink(emp)}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-all border cursor-pointer inline-flex items-center gap-1 ${
                                copiedId === emp.id 
                                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-450" 
                                  : "bg-[#161618] hover:bg-indigo-950/40 border-[#27272a] hover:border-indigo-500/40 text-indigo-400 hover:text-indigo-300"
                              }`}
                              title={isRtl ? "نسخ رابط تسجيل دخول تلقائي ببيانات الموظف" : "Copy pre-filled login URL"}
                            >
                              <span>{copiedId === emp.id ? (isRtl ? "✓ تم نسخ الرابط" : "✓ Copied URL") : (isRtl ? "📋 نسخ رابط الدخول" : "📋 Copy Login Link")}</span>
                            </button>
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="p-3 text-center">
                          {emp.status === "Active" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900/40 rounded-full text-[10px] font-bold">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{isRtl ? "نشط" : "Active"}</span>
                            </span>
                          ) : emp.status === "Read Only" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-900/40 rounded-full text-[10px] font-bold">
                              <span>{isRtl ? "عرض وقراءة فقط" : "Read Only"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-950 text-rose-400 border border-rose-900/40 rounded-full text-[10px] font-bold animate-pulse">
                              <span>{isRtl ? "موقوف" : "Suspended"}</span>
                            </span>
                          )}
                        </td>

                        {/* Permissions List counts */}
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-lg font-mono">
                            {emp.allowedPages?.length || 0} / 13 {isRtl ? "صفحات" : "pages"}
                          </span>
                        </td>

                        {/* Last seen */}
                        <td className="p-3 text-center text-slate-400 font-semibold font-mono text-[10px]">
                          {emp.lastActivity ? (
                            <div className="flex flex-col items-center">
                              <span className="text-white">⏱️ {emp.lastActivity}</span>
                            </div>
                          ) : (
                            <span>{isRtl ? "-- لم ينشط بعد --" : "-- Haven't logged in yet --"}</span>
                          )}
                        </td>

                        {/* Controls */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(emp)}
                              className="p-1.5 bg-[#141416] hover:bg-slate-800 border border-[#27272a] text-amber-500 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
                              title={isRtl ? "تعديل الصلاحيات وكلمة المرور" : "Edit Permissions & Settings"}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleDeleteEmployeeItem(emp)}
                              className="p-1.5 bg-[#141416] hover:bg-rose-950/40 border border-[#27272a] text-rose-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title={isRtl ? "حذف الموظف نهائياً" : "Delete Roster Account"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Salary Profiles of Company Workers Tab */}
      {subTab === "salary_profiles" && (
        allWorkers.length === 0 ? (
          <div className="text-center py-16 bg-[#09090b] rounded-xl border border-[#27272a] p-6 space-y-3">
            <Users className="w-12 h-12 text-slate-605 mx-auto" />
            <h3 className="text-sm font-bold text-white">{isRtl ? "لا يوجد عمال مسجلين في كشوفات الرواتب بعد" : "No staff payroll profiles logged yet"}</h3>
            <p className="text-xs text-slate-450 max-w-sm mx-auto">
              {isRtl 
                ? "انتقل إلى صفحة 'الموظفين والعمال والرواتب' من القائمة الجانبية لتسجيل أول عامل بالشركة، أو أنشئ له حساب دخول ERP من هنا مباشرة."
                : "Your payroll files are empty. Visit the 'Workers & Payrolls' section in the sidebar to add workers."}
            </p>
          </div>
        ) : (
          <div className="bg-[#09090b] rounded-xl border border-[#27272a] overflow-hidden animate-fade-in">
            <div className="p-3.5 border-b border-[#27272a] bg-[#0c0c0e] flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold font-mono">
                {allWorkers.length} {isRtl ? "بطاقة عامل مسجل ومقيد مالياً بالشركة" : "Registered staff records"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse" style={{ direction: isRtl ? "rtl" : "ltr" }}>
                <thead>
                  <tr className="border-b border-[#27272a] text-slate-400 bg-slate-950/40">
                    <th className="p-3 font-semibold text-center">{isRtl ? "العامل / الموظف" : "Worker / Employee"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "كود التعريف" : "Worker Code"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "المنصب الوظيفي" : "Corporate Role"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "الراتب المالي الأساسي" : "Base Salary"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "ساعات يومياً" : "Daily Hours"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "معدل الإضافي" : "Overtime Rate"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "الارتباط بحساب ERP" : "ERP Login Gate link"}</th>
                    <th className="p-3 font-semibold text-center">{isRtl ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {allWorkers.map((w: any) => {
                    const linkedAccount = employees.find(
                      emp => emp.id === w.id ||
                             (emp.phone && w.phone && cleanPhoneDigits(emp.phone) === cleanPhoneDigits(w.phone)) ||
                             (emp.fullName && w.name && cleanArabicName(emp.fullName) === cleanArabicName(w.name))
                    );

                    return (
                      <tr key={w.id} className="border-b border-[#1f1f23] hover:bg-white/[0.01] transition-colors">
                        {/* Name & Phone */}
                        <td className="p-3 text-center font-bold text-white">
                          <div className="flex flex-col items-center">
                            <span>{w.name}</span>
                            {w.phone && <span className="text-[9.5px] text-slate-400 font-mono font-normal">📞 {w.phone}</span>}
                          </div>
                        </td>

                        {/* ID Code */}
                        <td className="p-3 text-center">
                          <span className="font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-bold">
                            {w.code}
                          </span>
                        </td>

                        {/* Role */}
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-slate-300 border border-slate-800 rounded-full font-semibold text-[10px]">
                            {w.role || (isRtl ? "موظف" : "Worker")}
                          </span>
                        </td>

                        {/* Base Salary */}
                        <td className="p-3 text-center text-emerald-400 font-bold font-mono">
                          {w.baseSalary?.toLocaleString() || w.monthlySalary?.toLocaleString() || w.base_salary?.toLocaleString() || "0"} <span className="text-[10px] text-slate-400 font-normal">{isRtl ? "دج" : "DZD"}</span>
                        </td>

                        {/* Hours */}
                        <td className="p-3 text-center text-slate-350 font-mono">
                          {w.dailyHours || w.daily_hours || 8} {isRtl ? "ساعات" : "hours"}
                        </td>

                        {/* Overtime Rate */}
                        <td className="p-3 text-center text-slate-350 font-mono">
                          {w.overtimeRate || w.overtime_rate || 250} {isRtl ? "دج/ساعة" : "DZD/hr"}
                        </td>

                        {/* Linked ERP Acc status */}
                        <td className="p-3 text-center">
                          {linkedAccount ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 border rounded-full text-[10px] font-bold ${
                                linkedAccount.status === "Active" 
                                  ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-400" 
                                  : "bg-amber-950/60 border-amber-500/30 text-amber-400"
                              }`}>
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>{isRtl ? `✓ مرتبط بالحساب: ${linkedAccount.username}` : `✓ Linked as: ${linkedAccount.username}`}</span>
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1b1214] border border-[#3b1c1e] text-amber-500 rounded-md text-[9.5px] font-bold">
                              <span>⚠️ {isRtl ? "كشف مالي فقط - بدون حساب دخول" : "Offline billing - No login"}</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          {linkedAccount ? (
                            <button
                              onClick={() => handleOpenEditModal(linkedAccount)}
                              className="px-2 py-1 bg-[#1a1c1e] hover:bg-slate-850 border border-[#27272a] hover:border-indigo-500/45 text-indigo-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                            >
                              {isRtl ? "⚙️ ضبط الصلاحيات" : "⚙️ Edit Permissions"}
                            </button>
                      ) : (
                            <button
                              onClick={() => handleCreateAccountForWorker(w)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-sm shadow-amber-600/10 transition-all flex items-center gap-1 mx-auto"
                            >
                              <span>🔑</span>
                              <span>{isRtl ? "إنشاء حساب دخول فوري" : "Activate ERP Login"}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* CONFIDENTIAL RESPONSIBILITIES OWNER EXPANSE */}
      <div className="bg-[#09090b] border border-indigo-500/10 p-5 rounded-xl space-y-3">
        <h4 className="text-xs font-black text-white flex items-center gap-2 justify-end">
          <span className="text-amber-500">🔒</span>
          <span>{isRtl ? "التزامات ومهام الموظفين (خاص بالمالك فقط)" : "Confidential Employee Duties & Responsibilities"}</span>
        </h4>
        <p className="text-[10px] text-slate-450 mt-1 lines-relaxed">
          {isRtl 
            ? "المهام والتعليمات التي تكتبها لكل موظف عند تعديل حسابه هي سرية تماماً، ومخزنة سحابياً بشكل مؤمن، ولا تظهر مطلقاً في واجهة الموظفين عند تسجيل دخولهم."
            : "Any custom operational instructions or private responsibilities written inside employee forms are stored securely with end-to-end owner isolation. They are completely invisible to employees."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {employees.map(emp => (
            <div key={emp.id} className="p-3.5 bg-[#121214] rounded-lg border border-[#27272a] text-right space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10.5px] font-bold text-white">{emp.fullName}</span>
                <span className="text-[9px] text-indigo-400 font-semibold px-2 py-0.5 bg-indigo-950 rounded border border-indigo-900/30">{emp.jobTitle}</span>
              </div>
              <p className="text-[10.5px] text-slate-400 italic bg-[#09090b] p-2 rounded border border-[#1f1f23] max-h-24 overflow-y-auto whitespace-pre-line text-right">
                {emp.assignedResponsibilities || (isRtl ? "لا توجد التزامات مسجلة لهذا الموظف بعد." : "No explicit duties logged.")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL WINDOW FOR CREATE / EDIT EMPLOYEE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in text-right">
          <div className="w-full max-w-lg bg-[#121214] border border-[#27272a] shadow-2xl rounded-2xl p-6 relative overflow-hidden" id="employee_modal_wrapper">
            
            {/* Elegant gradient accent */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 to-indigo-600" />
            
            {createdCredentials ? (
              <div className="space-y-4 py-2" dir="rtl">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                </div>
                
                <h3 className="text-base font-black text-slate-100 text-center mb-1">
                  {isRtl ? "🎉 تم إنشاء حساب الموظف بنجاح!" : "🎉 Account Created Successfully!"}
                </h3>
                <p className="text-slate-400 text-xs text-center mb-4 leading-relaxed">
                  {isRtl 
                    ? "تم إعداد الحساب وربطه بنجاح بالشركة سحابياً. انسخ بيانات الدخول وأرسلها للموظف."
                    : "The account was created and securely synchronized to the cloud. Share these credentials with the employee."}
                </p>

                <div className="space-y-3 bg-slate-950/65 border border-[#27272a] p-4 rounded-xl text-xs selection:bg-emerald-900 text-right">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5 text-right">
                      {isRtl ? "اسم الموظف" : "Employee Name"}
                    </span>
                    <span className="text-slate-200 font-bold block text-right">{createdCredentials.fullName}</span>
                  </div>

                  {createdCredentials.email && (
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5 text-right">
                        {isRtl ? "البريد الإلكتروني" : "Email Address"}
                      </span>
                      <span className="text-slate-200 font-mono font-medium block text-right">{createdCredentials.email}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5 text-right">
                      {isRtl ? "اسم المستخدم (Username)" : "Username"}
                    </span>
                    <span className="text-emerald-400 font-mono font-bold block text-right">{createdCredentials.username}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5 text-right">
                      {isRtl ? "رقم المرور" : "Password"}
                    </span>
                    <span className="text-rose-400 font-mono font-bold block select-all bg-slate-900 border border-slate-800/60 p-1 px-2 rounded-md inline-block mr-auto" dir="ltr">
                      {createdCredentials.password}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5 text-right">
                      {isRtl ? "رابط تسجيل الدخول" : "Login URL"}
                    </span>
                    <span className="text-blue-400 font-mono text-[10.5px] block select-all break-all bg-slate-900 border border-slate-800/60 p-1 px-2 rounded-md" dir="ltr">
                      {createdCredentials.loginUrl}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      const copyText = `
اسم الموظف: ${createdCredentials.fullName}
${createdCredentials.email ? `البريد الإلكتروني: ${createdCredentials.email}` : ""}
اسم المستخدم: ${createdCredentials.username}
كلمة المرور: ${createdCredentials.password}
رابط الدخول: ${createdCredentials.loginUrl}
                      `.trim();
                      navigator.clipboard.writeText(copyText);
                      onTriggerNotification(isRtl ? "📋 تم نسخ بيانات الاعتماد كلياً!" : "📋 All login credentials copied to clipboard!");
                    }}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>📋</span>
                    <span>{isRtl ? "نسخ البيانات الفورية" : "Copy Credentials"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCreatedCredentials(null);
                      setIsModalOpen(false);
                      loadEmployeesData();
                    }}
                    className="py-1.5 px-4 bg-[#1c1c1e] hover:bg-[#27272a] border border-[#27272a] text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {isRtl ? "إغلاق" : "Close"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center border-b border-[#27272a] pb-4 mb-4">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-1 hover:bg-[#1c1c1e] text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5 justify-end">
                    <span>{editingEmployee ? (isRtl ? `تعديل صلاحيات: ${fullName}` : `Edit Account: ${fullName}`) : (isRtl ? "إنشاء حساب موظف جديد" : "Create New Employee Account")}</span>
                    <span>👤</span>
                  </h3>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              
              {/* Link to existing Worker Dropdown */}
              {!editingEmployee && (
                <div className="bg-[#121214] p-3 rounded-lg border border-[#27272a] text-xs">
                  <label className="block text-rose-400 font-extrabold mb-1">
                    {isRtl ? "🔗 ربط مع عامل مسجل مسبقاً في قائمة العمال (اختياري):" : "🔗 Link with a pre-registered worker profile (Optional):"}
                  </label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => {
                      const wId = e.target.value;
                      setSelectedWorkerId(wId);
                      if (wId) {
                        const allW = allWorkers;
                        const chosen = allW.find(w => w.id === wId);
                        if (chosen) {
                          setFullName(chosen.name);
                          setPhone(chosen.phone || "");
                          setJobTitle(chosen.role || "موظف");
                          setBaseSalary(chosen.baseSalary || 35000);
                          setMonthlySalary(chosen.monthlySalary || chosen.baseSalary || 35000);
                          setWorkingHoursPerDay(chosen.dailyHours || 8);
                          setWorkingDaysPerMonth(chosen.workingDaysPerMonth || 22);
                          setOvertimeHourRate(chosen.overtimeRate || 1.5);
                          setAbsenceDeductionRate(chosen.absenceDeductionRate || 1.0);
                          setNotes(chosen.notes || "");
                          
                          const workerSlug = chosen.name.toLowerCase().trim()
                            .replace(/\s+/g, "")
                            .replace(/[^a-z0-9]/g, "");
                          const compSlug = companyName.toLowerCase().trim()
                            .replace(/\s+/g, "")
                            .replace(/[^a-z0-9]/g, "");
                          setUsername(workerSlug);
                          setEmail(`${workerSlug}+${compSlug}@corevia.local`);
                        }
                      } else {
                        setFullName("");
                        setPhone("");
                        setJobTitle("");
                        setBaseSalary(35000);
                        setMonthlySalary(35000);
                        setWorkingHoursPerDay(8);
                        setWorkingDaysPerMonth(22);
                        setOvertimeHourRate(1.5);
                        setAbsenceDeductionRate(1.0);
                        setNotes("");
                        setUsername("");
                        setEmail("");
                      }
                    }}
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs pr-7 text-right"
                  >
                    <option value="">{isRtl ? "-- اطلب من قائمة العمال المسجلين مسبقاً --" : "-- Select from existing worker list --"}</option>
                    {(() => {
                      const allW = allWorkers;
                      const seen = new Set<string>();
                      const unique: typeof allW = [];
                      allW.forEach(x => {
                        if (!seen.has(x.code)) {
                          seen.add(x.code);
                          unique.push(x);
                        }
                      });
                      return unique.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code} - {w.role})
                        </option>
                      ));
                    })()}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed text-right">
                    {isRtl 
                      ? "💡 ربط الحساب بموظف مسجل يمنع تكرار الموظفين ويقوم بجلب الراتب المسمى والبيانات تلقائياً لضمان سلامة الحسابات." 
                      : "💡 Linking with an existing worker profile prevents duplicate profiles and auto-fills historical salary rates to ensure consistency."}
                  </p>
                </div>
              )}
              
              {/* Basic input fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                
                {/* Full Name */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{isRtl ? "الاسم الكامل للموظف *" : "Full Name *"}</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isRtl ? "توفيق العلمي..." : "e.g., John Doe..."}
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650"
                  />
                </div>

                {/* Job Title */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{isRtl ? "المنصب أو المسمى الوظيفي *" : "Job Title *"}</label>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={isRtl ? "مدير مبيعات، مسؤول دليفري..." : "e.g., Sales Manager..."}
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{isRtl ? "رقم الهاتف للاتصال والولوج *" : "Phone Number (Login Key) *"}</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0540000000"
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{isRtl ? "اسم المستخدم للولوج (Username) *" : "Username (Login Key) *"}</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
                      setUsername(val);
                      if (!editingEmployee && val) {
                        const compSlug = companyName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
                        setEmail(`${val}+${compSlug}@corevia.local`);
                      }
                    }}
                    placeholder="mohamed.orders"
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-emerald-400 font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650"
                  />
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{isRtl ? "البريد الإلكتروني (اختياري)" : "Email (Optional Login Key)"}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name+company@corevia.local"
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650"
                  />
                </div>

                {/* Password input */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordRaw(!showPasswordRaw)}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      {showPasswordRaw ? (isRtl ? "إخفاء" : "Hide") : (isRtl ? "إظهار" : "Show")}
                    </button>
                    <label className="block text-slate-400 font-bold">{isRtl ? "رمز المرور للولوج *" : "Secret Password *"}</label>
                  </div>
                  <input
                    type={showPasswordRaw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650"
                  />
                </div>

                {/* Account Status Selection */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{isRtl ? "حالة الحساب الميداني *" : "Account Status *"}</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full p-2 bg-[#09090b] border border-[#27272a] text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs pr-7 text-right"
                  >
                    <option value="Active">{isRtl ? "نشط - Active" : "Active"}</option>
                    <option value="Read Only">{isRtl ? "عرض وقراءة فقط - Read Only" : "Read Only"}</option>
                    <option value="Suspended">{isRtl ? "موقف وتجميد - Suspended" : "Suspended"}</option>
                  </select>
                </div>
              </div>

              {/* Workforce Contract & Salary Regulations */}
              <div className="space-y-3 border-t border-[#27272a] pt-3 text-xs">
                <span className="block text-indigo-400 font-extrabold text-[11px] uppercase tracking-wider">
                  💼 {isRtl ? "محددات الراتب وعقد العمل والدقة والامتيازات:" : "Salary Regulations & Contractual Details:"}
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0a0a0c] p-3 rounded-xl border border-[#1f1f23]">
                  {/* Base Salary */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      {isRtl ? "الراتب الأساسي (DZD) *" : "Base Salary (DZD) *"}
                    </label>
                    <input
                      type="number"
                      required
                      value={baseSalary || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBaseSalary(val);
                        // By default sync monthly salary
                        setMonthlySalary(val);
                      }}
                      className="w-full p-2 bg-[#121214] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right"
                    />
                  </div>

                  {/* Monthly Salary */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      {isRtl ? "الراتب الإجمالي المتفق عليه *" : "Contracted Monthly Salary *"}
                    </label>
                    <input
                      type="number"
                      required
                      value={monthlySalary || ""}
                      onChange={(e) => setMonthlySalary(Number(e.target.value))}
                      className="w-full p-2 bg-[#121214] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right"
                    />
                  </div>

                  {/* Daily hours */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      {isRtl ? "ساعات العمل اليومية *" : "Daily Working Hours *"}
                    </label>
                    <input
                      type="number"
                      required
                      value={workingHoursPerDay || ""}
                      onChange={(e) => setWorkingHoursPerDay(Number(e.target.value))}
                      className="w-full p-2 bg-[#121214] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right"
                    />
                  </div>

                  {/* Working days per month */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      {isRtl ? "أيام العمل الشهرية المتوقعة *" : "Expected Working Days/Month *"}
                    </label>
                    <input
                      type="number"
                      required
                      value={workingDaysPerMonth || ""}
                      onChange={(e) => setWorkingDaysPerMonth(Number(e.target.value))}
                      className="w-full p-2 bg-[#121214] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right"
                    />
                  </div>

                  {/* Overtime rate multiplier */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      {isRtl ? "معدل الراتب الإضافي لكل ساعة *" : "Overtime Hour Multiplier *"}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={overtimeHourRate || ""}
                      onChange={(e) => setOvertimeHourRate(Number(e.target.value))}
                      className="w-full p-2 bg-[#121214] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right"
                    />
                  </div>

                  {/* Daily penalty rate */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      {isRtl ? "مضاعف خصم الغياب اليومي *" : "Daily Absence Penalty Multiplier *"}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={absenceDeductionRate || ""}
                      onChange={(e) => setAbsenceDeductionRate(Number(e.target.value))}
                      className="w-full p-2 bg-[#121214] border border-[#27272a] text-white font-mono rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right"
                    />
                  </div>
                </div>

                {/* Internal Contract Notes */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRtl ? "شروط أو ملاحظات العقد الخاصة:" : "Special Contractual/Compensation Notes:"}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isRtl ? "مثال: مبيعات الهاتف + 1% عمولة أرباح، حوافز دقة الحضور الموصى بها..." : "e.g. Phone support agent + 1% revenue share, quarterly arrival incentives..."}
                    rows={2}
                    className="w-full p-2 bg-[#0a0a0c] border border-[#27272a] text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650 resize-none"
                  />
                </div>
              </div>

              {/* Shareable login URL generator inside the Modal */}
              <div className="bg-slate-950/60 border border-[#27272a] p-3 rounded-xl flex items-center justify-between gap-3 text-xs my-2">
                <button
                  type="button"
                  onClick={() => {
                    const loginKey = email.trim() || phone.trim();
                    if (!password.trim()) {
                      onTriggerNotification(
                        isRtl 
                          ? "⚠️ يرجى ملء كلمة المرور أولاً." 
                          : "⚠️ Please fill in a password first."
                      );
                      return;
                    }
                    if (!phone.trim()) {
                      onTriggerNotification(
                        isRtl 
                          ? "⚠️ يرجى كتابة الهاتف أولاً (كمفتاح دخول الأساسي)." 
                          : "⚠️ Please enter the phone number first."
                      );
                      return;
                    }
                    try {
                      const url = `${window.location.origin}/?email=${encodeURIComponent(loginKey)}&pass=${encodeURIComponent(password.trim())}`;
                      navigator.clipboard.writeText(url);
                      setCopiedId("modal-copied");
                      onTriggerNotification(
                        isRtl 
                          ? `📋 تم نسخ رابط الولوج المباشر الخاص بـ (${fullName || "الموظف"}) بنجاح!` 
                          : `📋 Shareable login link for (${fullName || "Employee"}) copied to clipboard!`
                      );
                      setTimeout(() => {
                        setCopiedId(null);
                      }, 3000);
                    } catch (err) {
                      console.warn("Failed to copy modal link:", err);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer select-none shrink-0 ${
                    copiedId === "modal-copied" 
                      ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400" 
                      : "bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-indigo-400 hover:text-indigo-300"
                  }`}
                >
                  {copiedId === "modal-copied" ? (isRtl ? "✓ تم نسخ الرابط" : "✓ Copied Link") : (isRtl ? "📋 نسخ الرابط" : "📋 Copy Link")}
                </button>
                <div className="text-right flex-1 select-none">
                  <span className="block font-bold text-white text-[11px]">
                    {isRtl ? "رابط تسجيل دخول مباشر للموظف" : "Pre-filled Login Link"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                    {isRtl 
                      ? "رابط دخول سريع ومملوء مسبقاً ببيانات الموظف ليرسله له المالك لتخطي كتابة البيانات." 
                      : "Pre-filled convenience URL that auto-fills email and password fields on click."}
                  </span>
                </div>
              </div>

              {/* Page Licensing Checklist (13 checkboxes grid layout) */}
              <div className="space-y-2 border-t border-[#27272a] pt-3 text-xs">
                <span className="block text-slate-350 font-bold mb-1">
                  🔒 {isRtl ? "منح تراخيص تصفح الصفحات (الصلاحيات المخصصة):" : "Assign Page Authorization Licences:"}
                </span>
                <p className="text-[10px] text-slate-450 leading-relaxed mb-2">
                  {isRtl 
                    ? "اختر الصفحات المحددة التي يحق لهذا الحساب دخولها والتعديل فيها. أي صفحة غير محددة سيتم إخفاؤها وحظرها تماماً."
                    : "Tick specific pages this credential profile can access. Pages not checked are stripped from their layout."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#09090b] p-3 rounded-xl border border-[#27272a] max-h-48 overflow-y-auto">
                  {availablePagesList.map((tab) => {
                    const isChecked = selectedPages.includes(tab.id);
                    return (
                      <label 
                        key={tab.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                          isChecked 
                            ? "bg-rose-500/5 border-rose-500/40 text-rose-300" 
                            : "bg-[#040406] border-[#1d1d20] text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePageSelection(tab.id)}
                          className="w-3.5 h-3.5 accent-rose-500 cursor-pointer hidden"
                        />
                        <span className="text-[10.5px]">
                          {isChecked ? "🟢" : "⚫"}
                        </span>
                        <span className="font-semibold text-right text-[11px]">
                          {isRtl ? tab.labelAr : tab.labelEn}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Private owner instructions area */}
              <div className="space-y-1.5 border-t border-[#27272a] pt-3 text-xs">
                <label className="block text-slate-400 font-bold">
                  📝 {isRtl ? "التعليمات والتزامات هذا الموظف (خاص بالمالك فقط):" : "Confidential Employee Duties & Instructions (Owner Only):"}
                </label>
                <textarea
                  value={assignedResponsibilities}
                  onChange={(e) => setAssignedResponsibilities(e.target.value)}
                  placeholder={isRtl ? "اكتب هنا مهام هذا الحساب، السقف الأقصى للتخفيض المسموح به، أو أي ملاحظات داخلية سرية تخص المالك..." : "Describe private duties, maximum discounts authorized, or confidentiality guidelines associated with this employee..."}
                  rows={2}
                  className="w-full bg-[#09090b] border border-[#27272a] p-2 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs text-right placeholder-slate-650 resize-y"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 border-t border-[#27272a] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-[#1c1c1e] hover:bg-[#27272a] border border-[#27272a] text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {isRtl ? "إلغاء وتراجع" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-rose-600/10 transition-all active:scale-[0.99] cursor-pointer"
                >
                  {isLoading ? (isRtl ? "جاري الحفظ..." : "Saving...") : (isRtl ? "تأكيد واستصدار الحساب" : "Confirm and Deploy Roster")}
                </button>
              </div>

            </form>
          </>
        )}
          </div>
        </div>
      )}

      {/* CUSTOM DELETION MODAL WITH WORKER RETENTION CHOICE */}
      {userToDeleteRecord && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[1000] text-right animate-fade-in" dir="rtl">
          <div className="w-full max-w-md bg-[#121214] border border-rose-950/40 shadow-2xl rounded-2xl p-6 relative overflow-hidden" id="custom-delete-decision-dialog">
            
            {/* Top warning ribbon */}
            <div className="absolute top-0 inset-x-0 h-1 bg-rose-600" />
            
            <div className="flex items-start gap-3.5 mb-4 justify-end">
              <div className="text-right flex-1">
                <h3 className="text-sm font-black text-white">
                  {isRtl ? `حذف حساب الموظف: ${userToDeleteRecord.fullName}` : `Delete Employee: ${userToDeleteRecord.fullName}`}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {isRtl 
                    ? "أنت على وشك إلغاء صلاحيات دخول هذا الموظف. يرجى اختيار الإجراء المطلوب للتعامل مع ملفه المالي في قسم العمال والرواتب:" 
                    : "You are about to cancel this employee's access credentials. Please choose how to handle their financial payroll files:"}
                </p>
              </div>
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* Warning about linked worker if found */}
            {linkedWorkerFound ? (
              <div className="bg-[#18181b] border border-indigo-500/10 p-3.5 rounded-xl mb-4 space-y-1 text-right">
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-400 justify-end">
                  <span>💡 تم العثور على ملف عامل مسجل في كشوفات الرواتب:</span>
                </div>
                <div className="text-[10px] text-slate-300">
                  • الاسم: <strong className="text-white">{linkedWorkerFound.name}</strong> ({linkedWorkerFound.code})
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  هذا العامل لديه تاريخ دفع رواتب وسلف مسجل مسبقاً في النظام.
                </div>
              </div>
            ) : (
              <div className="bg-[#18181b] border border-[#27272a] p-3 rounded-xl mb-4 text-[10.5px] text-slate-400 leading-snug">
                {isRtl 
                  ? "لا يوجد ملف مالي أو كشفي رواتب مرتبط بهذا الموظف في مسرد العمال." 
                  : "No linked financial worker profile was found in payroll for this employee."}
              </div>
            )}

            {/* Dual action buttons verticalstack for clarity */}
            <div className="space-y-2.5">
              
              {/* Option A: Delete Account ONLY (Preserve worker) */}
              {linkedWorkerFound && (
                <button
                  type="button"
                  onClick={() => handleExecuteDelete(false)}
                  className="w-full text-right p-3 bg-[#111114] hover:bg-indigo-950/30 border border-indigo-900/40 hover:border-indigo-500/40 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-indigo-400 group-hover:-translate-x-0.5 transition-transform text-xs shrink-0 pl-2">📥</span>
                    <div className="text-right">
                      <span className="block font-bold text-xs text-white group-hover:text-indigo-350 transition-colors">
                        {isRtl ? "١. حذف الحساب والولوج فقط (الاحتفاظ بملف العامل)" : "1. Delete Account Only (Retain worker details)"}
                      </span>
                      <span className="block text-[10px] text-slate-450 mt-1 leading-snug">
                        {isRtl 
                          ? "سيتم تجميد وحذف إمكانية تسجيل دخول الموظف، مع الإبقاء على ملفه بصفحة الموظفين والرواتب دون حذف تاريخ المبيعات/الرواتب." 
                          : "Deletes credentials only. Keeps payroll logs and financial files untouched."}
                      </span>
                    </div>
                  </div>
                </button>
              )}

              {/* Option B: Delete Account & Worker Profile fully */}
              <button
                type="button"
                onClick={() => handleExecuteDelete(!!linkedWorkerFound)}
                className="w-full text-right p-3 bg-[#1c0d0f] hover:bg-rose-950/40 border border-rose-950/40 hover:border-rose-500/40 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <span className="text-rose-400 group-hover:-translate-x-0.5 transition-transform text-xs shrink-0 pl-2">☠️</span>
                  <div className="text-right col-span-11">
                    <span className="block font-bold text-xs text-rose-400 group-hover:text-rose-300 transition-colors">
                      {linkedWorkerFound 
                        ? (isRtl ? "٢. شطب نهائي كلي (حذف الحساب + حذف ملف العامل المالي)" : "2. Complete Purge (Purge credentials + Delete payroll files)")
                        : (isRtl ? "حذف حساب وصلاحيات الموظف نهائياً" : "Confirm Permanent Deletion")}
                    </span>
                    <span className="block text-[10px] text-slate-450 mt-1 leading-snug">
                      {isRtl 
                        ? "سيتم شطب حساب تسجيل دخول المستخدم ومحو ملفه بكشوف الرواتب وسلفياته تماماً من النظام (غير قابل للتراجع)." 
                        : "Purges both credentials and completely sweeps their worker payroll database records."}
                    </span>
                  </div>
                </div>
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => {
                  setUserToDeleteRecord(null);
                  setLinkedWorkerFound(null);
                }}
                className="w-full py-2 bg-[#1c1c1e] hover:bg-[#27272a] border border-[#27272a] text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                {isRtl ? "تراجع وإلغاء الأمر" : "Dismiss / Cancel"}
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
