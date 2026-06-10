import { supabase } from "./supabaseClient";
import { 
  getOrders, saveOrders, getProducts, saveProducts, getSuppliers, saveSuppliers, 
  getWorkers, saveWorkers, getSalarySheets, saveSalarySheets, getFixedExpenses, 
  saveFixedExpenses, getVarExpenses, saveVarExpenses, getAdExpenses, saveAdExpenses,
  getBusinessProfile, saveBusinessProfile, saveUserSession
} from "./storageUtils";
import { 
  Order, Product, Supplier, Worker, WorkerSalarySheet, BusinessProfile, Expense 
} from "./types";

export interface SaasUserMeta {
  userId: string;
  companyId: string;
  hasCompletedOnboarding: boolean;
  email: string;
  username: string;
  role: string;
}

// Ensure safe conversion of values to standard types
const safeNum = (val: any, fallback = 0): number => {
  const parsed = Number(val);
  return isNaN(parsed) ? fallback : parsed;
};

/**
 * Checks, fetches, or provisions multi-tenant SaaS metadata for a User ID.
 * If the SaaS tables do not exist yet, we fallback gracefully to local keys.
 */
export async function fetchUserSaaSMeta(
  userId: string, 
  email: string, 
  fallbackName: string
): Promise<SaasUserMeta> {
  const cleanEmail = email.toLowerCase().trim();
  const defaultCompanyId = `cop_${userId.substring(0, 15)}`;
  
  // Decide if this email is a super admin
  const isSuperAdminEmail = 
    cleanEmail === "coreviadz@gmail.com" || 
    cleanEmail === "admin@corevia.com" ||
    ((import.meta as any).env?.VITE_SUPER_ADMIN_EMAIL === cleanEmail);

  const initialRole = isSuperAdminEmail ? "super_admin" : "admin";

  if (!supabase) {
    return {
      userId,
      companyId: `cop_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
      hasCompletedOnboarding: localStorage.getItem("corevia_completed_onboarding") === "true",
      email,
      username: fallbackName,
      role: initialRole
    };
  }

  try {
    // 1. Try fetching existing user meta from database
    const { data: userMeta, error: userError } = await supabase
      .from("corevia_saas_users")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (userMeta) {
      let activeRole = userMeta.role || "admin";
      // If of super admin email but has non-super-admin role in DB, auto-update it
      if (isSuperAdminEmail && activeRole !== "super_admin") {
        activeRole = "super_admin";
        await supabase
          .from("corevia_saas_users")
          .update({ role: "super_admin" })
          .eq("user_id", userId);
      }
      return {
        userId: userMeta.user_id,
        companyId: userMeta.company_id || defaultCompanyId,
        hasCompletedOnboarding: Boolean(userMeta.has_completed_onboarding),
        email: userMeta.email,
        username: userMeta.username || fallbackName,
        role: activeRole
      };
    }

    // 2. Provision new tenant elements (Company + SaaS User Record)
    const companyName = `${fallbackName || cleanEmail.split("@")[0]} Trading`;
    
    // Attempt Company Insert in corevia_companies
    await supabase.from("corevia_companies").upsert({
      id: defaultCompanyId,
      name: companyName,
      business_type: "تجارة إلكترونية",
      owner_name: fallbackName,
      email: cleanEmail
    });

    // Attempt Company Insert in companies table
    await supabase.from("companies").upsert({
      id: defaultCompanyId,
      owner_id: userId,
      company_name: companyName,
      main_store_name: "",
      email: cleanEmail,
      phone: "",
      address: ""
    });

    // Attempt SaaS User Record Insert
    const newUserData = {
      user_id: userId,
      company_id: defaultCompanyId,
      email: cleanEmail,
      username: fallbackName,
      has_completed_onboarding: false,
      role: initialRole
    };

    await supabase.from("corevia_saas_users").upsert(newUserData);

    return {
      userId,
      companyId: defaultCompanyId,
      hasCompletedOnboarding: false,
      email: cleanEmail,
      username: fallbackName,
      role: initialRole
    };
  } catch (err) {
    console.warn("SaaS multi-tenant metadata query skipped or table-not-found, using graceful fallback:", err);
    // Graceful fallback when tables are not yet setup
    const isCompletedLocal = localStorage.getItem(`onboarding_complete_${cleanEmail}`) === "true";
    return {
      userId,
      companyId: defaultCompanyId,
      hasCompletedOnboarding: isCompletedLocal,
      email: cleanEmail,
      username: fallbackName,
      role: initialRole
    };
  }
}

/**
 * Mark onboarding state as completed and synchronize with cloud DB.
 */
export async function saveOnboardingCompletionInCloud(
  userId: string,
  companyId: string,
  email: string,
  profile: BusinessProfile
): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  localStorage.setItem(`onboarding_complete_${cleanEmail}`, "true");
  localStorage.setItem("corevia_completed_onboarding", "true");

  if (!supabase) return;

  try {
    // Update SaaS meta safely
    await supabase
      .from("corevia_saas_users")
      .update({ has_completed_onboarding: true })
      .eq("user_id", userId);

    // Update companies table
    await supabase.from("companies").upsert({
      id: companyId,
      owner_id: userId,
      company_name: profile.businessName,
      main_store_name: "",
      email: profile.email || cleanEmail,
      phone: profile.phone || "",
      address: profile.address || ""
    });

    // Update corevia_companies table
    await supabase.from("corevia_companies").upsert({
      id: companyId,
      name: profile.businessName,
      business_type: profile.businessType,
      owner_name: profile.ownerName || "Owner",
      phone: profile.phone || "",
      email: profile.email || cleanEmail
    });

    // Upsert Business Profile bound to companyId
    await supabase.from("corevia_profile").upsert({
      id: companyId,
      company_id: companyId,
      business_name: profile.businessName,
      business_type: profile.businessType,
      currency: profile.currency,
      country: profile.country,
      owner_name: profile.ownerName || "Owner",
      phone: profile.phone || "",
      email: profile.email || cleanEmail,
      address: profile.address || "",
      website: profile.website || "",
      commercial_registry: profile.commercialRegistry || "",
      tax_number: profile.taxNumber || ""
    });
    console.log("Onboarding profile successfully persistent in standard database.");
  } catch (err) {
    console.error("Cloud onboarding save failed, local state active:", err);
  }
}

/**
 * Push single business dataset changes to Supabase in background (automatic sync).
 */
export async function pushSingleDatasetToCloud(
  companyId: string,
  type: "products" | "orders" | "suppliers" | "expenses" | "workers" | "salary_sheets",
  rawItems: any[]
): Promise<void> {
  if (!supabase) return;

  try {
    const tableName = `corevia_${type}`;
    let formattedItems: any[] = [];

    if (type === "products") {
      formattedItems = (rawItems as Product[]).map(p => ({
        id: p.id,
        company_id: companyId,
        name: p.name,
        wholesale_cost_price: p.wholesaleCostPrice,
        wholesale_percentage: p.wholesalePercentage,
        wholesale_price: p.wholesalePrice,
        retail_cost_price: p.retailCostPrice,
        retail_percentage: p.retailPercentage,
        retail_price: p.retailPrice,
        colors: p.colors || [],
        sizes: p.sizes || [],
        created_at: p.createdAt,
        created_by: p.createdBy || null,
        updated_by: p.updatedBy || null,
        created_date: p.createdDate || null,
        created_time: p.createdTime || null,
        updated_date: p.updatedDate || null,
        updated_time: p.updatedTime || null
      }));
    } else if (type === "orders") {
      formattedItems = (rawItems as Order[]).map(o => ({
        id: o.id,
        company_id: companyId,
        date: o.date,
        customer_name: o.customerName,
        phone: o.phone,
        wilaya: o.wilaya,
        commune: o.commune,
        delivery_location: o.deliveryLocation,
        delivery_company: o.deliveryCompany,
        delivery_type: o.deliveryType,
        delivery_price: o.deliveryPrice,
        items: o.items || [],
        total_price: o.totalPrice,
        paid_amount: o.paidAmount,
        discount: o.discount,
        customer_pays_delivery: o.customerPaysDelivery,
        is_exchange: o.isExchange,
        exchange_order_ref: o.exchangeOrderRef || null,
        agent_name: o.agentName,
        source: o.source,
        status: o.status,
        return_cost: o.returnCost || null,
        return_date: o.returnDate || null,
        notes: o.notes || null,
        deleted_at: o.deletedAt || null,
        created_by: o.createdBy || null,
        updated_by: o.updatedBy || null,
        created_date: o.createdDate || null,
        created_time: o.createdTime || null,
        updated_date: o.updatedDate || null,
        updated_time: o.updatedTime || null
      }));
    } else if (type === "suppliers") {
      formattedItems = (rawItems as Supplier[]).map(s => ({
        id: s.id,
        company_id: companyId,
        name: s.name,
        phone: s.phone,
        address: s.address,
        email: s.email,
        created_at: s.createdAt,
        created_by: s.createdBy || null,
        updated_by: s.updatedBy || null,
        created_date: s.createdDate || null,
        created_time: s.createdTime || null,
        updated_date: s.updatedDate || null,
        updated_time: s.updatedTime || null
      }));
    } else if (type === "expenses") {
      formattedItems = (rawItems as Expense[]).map(e => {
        const isFixed = e.type === "fixed";
        const isAd = e.type === "ads";
        const asAd = e as any;
        return {
          id: e.id,
          company_id: companyId,
          type: e.type,
          name: e.title || (e as any).name || null,
          amount: e.amount || null,
          date: e.date || null,
          month_year: (e as any).monthYear || null,
          platform: asAd.platform || null,
          amount_usd: asAd.amountUSD || null,
          exchange_rate: asAd.exchangeRate || null,
          amount_currency: asAd.amountCurrency || null,
          start_date: asAd.startDate || null,
          end_date: asAd.endDate || null,
          notes: (e as any).notes || null,
          created_by: e.createdBy || null,
          updated_by: e.updatedBy || null,
          created_date: e.createdDate || null,
          created_time: e.createdTime || null,
          updated_date: e.updatedDate || null,
          updated_time: e.updatedTime || null
        };
      });
    } else if (type === "workers") {
      formattedItems = (rawItems as Worker[]).map(w => ({
        id: w.id,
        company_id: companyId,
        name: w.name,
        code: w.code,
        phone: w.phone,
        base_salary: w.baseSalary,
        daily_hours: w.dailyHours,
        overtime_rate: w.overtimeRate,
        role: w.role,
        monthly_salary: w.monthlySalary,
        payrolls: w.payrolls || [],
        created_at: w.createdAt,
        created_by: w.createdBy || null,
        updated_by: w.updatedBy || null,
        created_date: w.createdDate || null,
        created_time: w.createdTime || null,
        updated_date: w.updatedDate || null,
        updated_time: w.updatedTime || null
      }));
    } else if (type === "salary_sheets") {
      formattedItems = (rawItems as WorkerSalarySheet[]).map(sh => ({
        id: sh.id,
        company_id: companyId,
        worker_id: sh.workerId,
        worker_name: sh.workerName,
        month_year: sh.monthYear,
        date_from: sh.dateFrom,
        date_to: sh.dateTo,
        overtime_hours: sh.overtimeHours,
        absence_days: sh.absenceDays,
        missing_hours: sh.missingHours,
        paid_vacation_days: sh.paidVacationDays,
        expenses: sh.expenses || [],
        pay_status: sh.payStatus,
        calculated_salary: sh.calculatedSalary,
        updated_at: sh.updatedAt,
        created_by: sh.createdBy || null,
        updated_by: sh.updatedBy || null,
        created_date: sh.createdDate || null,
        created_time: sh.createdTime || null,
        updated_date: sh.updatedDate || null,
        updated_time: sh.updatedTime || null
      }));
    }

    // Delete all current records for this company so that removed items (deletes) propagate
    try {
      await supabase.from(tableName).delete().eq("company_id", companyId);
    } catch (deleteErr) {
      console.warn(`[AutoSync] Could not clear table "${tableName}" (sync may be incomplete):`, deleteErr);
    }

    if (formattedItems.length > 0) {
      const { error } = await supabase.from(tableName).upsert(formattedItems);
      if (error) throw error;
      console.log(`Automatic background cloud sync success for table "${tableName}" (${formattedItems.length} items).`);
    } else {
      console.log(`Automatic background cloud sync success for table "${tableName}" (purged, 0 items left).`);
    }

  } catch (err) {
    console.warn(`[AutoSync] Background cloud sync for "${type}" was skipped or failed:`, err);
  }
}

/**
 * Pulls all synchronized records from Supabase isolated by company_id, 
 * writing them to the active tenant's localized localStorage state.
 */
export async function pullMultiTenantData(companyId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // 1. Fetch Profile
    const { data: profileData } = await supabase
      .from("corevia_profile")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (profileData) {
      const activeProf: BusinessProfile = {
        businessName: profileData.business_name || "",
        businessType: profileData.business_type || "",
        experienceYears: "سنة واحدة", // default fallback
        estimatedOrders: "0",
        estimatedWorkers: "0",
        currency: (profileData.currency === "DZD" || profileData.currency === "USD" || profileData.currency === "EUR") ? profileData.currency : "DZD",
        defaultLanguage: "ar",
        preferredTheme: "dark",
        country: profileData.country || "Algeria",
        ownerName: profileData.owner_name || "",
        phone: profileData.phone || "",
        email: profileData.email || "",
        address: profileData.address || "",
        website: profileData.website || "",
        commercialRegistry: profileData.commercial_registry || "",
        taxNumber: profileData.tax_number || ""
      };
      saveBusinessProfile(activeProf);
    }

    // 2. Fetch Products
    const { data: dbProducts } = await supabase
      .from("corevia_products")
      .select("*")
      .eq("company_id", companyId);

    if (dbProducts && dbProducts.length > 0) {
      const formatted = dbProducts.map(p => ({
        id: p.id,
        name: p.name,
        wholesaleCostPrice: safeNum(p.wholesale_cost_price),
        wholesalePercentage: safeNum(p.wholesale_percentage),
        wholesalePrice: safeNum(p.wholesale_price),
        retailCostPrice: safeNum(p.retail_cost_price),
        retailPercentage: safeNum(p.retail_percentage),
        retailPrice: safeNum(p.retail_price),
        colors: p.colors || [],
        sizes: p.sizes || [],
        createdAt: p.created_at || new Date().toISOString(),
        createdBy: p.created_by || undefined,
        updatedBy: p.updated_by || undefined,
        createdDate: p.created_date || undefined,
        createdTime: p.created_time || undefined,
        updatedDate: p.updated_date || undefined,
        updatedTime: p.updated_time || undefined
      }));
      saveProducts(formatted);
    }

    // 3. Fetch Orders
    const { data: dbOrders } = await supabase
      .from("corevia_orders")
      .select("*")
      .eq("company_id", companyId);

    if (dbOrders && dbOrders.length > 0) {
      const formatted = dbOrders.map(o => ({
        id: o.id,
        date: o.date,
        customerName: o.customer_name,
        phone: o.phone,
        wilaya: o.wilaya,
        commune: o.commune,
        deliveryLocation: o.delivery_location || "Home",
        deliveryCompany: o.delivery_company || "Yalidine Express",
        deliveryType: o.delivery_type || "Home",
        deliveryPrice: safeNum(o.delivery_price),
        items: o.items || [],
        totalPrice: safeNum(o.total_price),
        paidAmount: safeNum(o.paid_amount),
        discount: safeNum(o.discount),
        customerPaysDelivery: Boolean(o.customer_pays_delivery),
        isExchange: Boolean(o.is_exchange),
        exchangeOrderRef: o.exchange_order_ref || undefined,
        agentName: o.agent_name || "Owner",
        source: (o.source === "1" || o.source === "2" || o.source === "3") ? o.source : "1",
        status: o.status || "pending",
        returnCost: o.return_cost ? safeNum(o.return_cost) : undefined,
        returnDate: o.return_date || undefined,
        notes: o.notes || undefined,
        deletedAt: o.deleted_at || undefined,
        createdBy: o.created_by || undefined,
        updatedBy: o.updated_by || undefined,
        createdDate: o.created_date || undefined,
        createdTime: o.created_time || undefined,
        updatedDate: o.updated_date || undefined,
        updatedTime: o.updated_time || undefined
      }));
      saveOrders(formatted);
    }

    // 4. Fetch Suppliers
    const { data: dbSuppliers } = await supabase
      .from("corevia_suppliers")
      .select("*")
      .eq("company_id", companyId);

    if (dbSuppliers && dbSuppliers.length > 0) {
      const formatted = dbSuppliers.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone || "",
        address: s.address || "",
        email: s.email || "",
        createdAt: s.created_at || new Date().toISOString(),
        createdBy: s.created_by || undefined,
        updatedBy: s.updated_by || undefined,
        createdDate: s.created_date || undefined,
        createdTime: s.created_time || undefined,
        updatedDate: s.updated_date || undefined,
        updatedTime: s.updated_time || undefined
      }));
      saveSuppliers(formatted);
    }

    // 5. Fetch Expenses
    const { data: dbExpenses } = await supabase
      .from("corevia_expenses")
      .select("*")
      .eq("company_id", companyId);

    if (dbExpenses && dbExpenses.length > 0) {
      const unifiedExpenses: Expense[] = dbExpenses.map(e => {
        if (e.type === "fixed") {
          return {
            id: e.id,
            title: e.name || "Fixed Expense",
            type: "fixed",
            amount: safeNum(e.amount),
            date: e.date || new Date().toISOString().split("T")[0],
            createdAt: e.created_at || new Date().toISOString(),
            createdBy: e.created_by || undefined,
            updatedBy: e.updated_by || undefined,
            createdDate: e.created_date || undefined,
            createdTime: e.created_time || undefined,
            updatedDate: e.updated_date || undefined,
            updatedTime: e.updated_time || undefined
          };
        } else if (e.type === "variable") {
          return {
            id: e.id,
            title: e.name || "Variable Expense",
            type: "variable",
            amount: safeNum(e.amount),
            date: e.date || new Date().toISOString().split("T")[0],
            monthYear: e.month_year || new Date().toISOString().substring(0, 7),
            createdAt: e.created_at || new Date().toISOString(),
            createdBy: e.created_by || undefined,
            updatedBy: e.updated_by || undefined,
            createdDate: e.created_date || undefined,
            createdTime: e.created_time || undefined,
            updatedDate: e.updated_date || undefined,
            updatedTime: e.updated_time || undefined
          };
        } else {
          return {
            id: e.id,
            title: e.name || `Campaign: ${e.platform}`,
            type: "ads",
            amount: safeNum(e.amount_currency),
            date: e.start_date || new Date().toISOString().split("T")[0],
            isUSD: true,
            usdAmount: safeNum(e.amount_usd),
            exchangeRate: safeNum(e.exchange_rate),
            notes: e.notes || "",
            platform: e.platform || "Facebook",
            monthYear: e.month_year || new Date().toISOString().substring(0, 7),
            startDate: e.start_date,
            endDate: e.end_date,
            createdAt: e.created_at || new Date().toISOString(),
            createdBy: e.created_by || undefined,
            updatedBy: e.updated_by || undefined,
            createdDate: e.created_date || undefined,
            createdTime: e.created_time || undefined,
            updatedDate: e.updated_date || undefined,
            updatedTime: e.updated_time || undefined
          } as any;
        }
      });
      localStorage.setItem("corevia_unified_expenses_v1", JSON.stringify(unifiedExpenses));
    }

    // 6. Fetch Workers
    const { data: dbWorkers } = await supabase
      .from("corevia_workers")
      .select("*")
      .eq("company_id", companyId);

    if (dbWorkers && dbWorkers.length > 0) {
      const formatted = dbWorkers.map(w => ({
        id: w.id,
        name: w.name,
        code: w.code || "W-" + w.id.substring(0, 4),
        phone: w.phone || "",
        baseSalary: safeNum(w.base_salary),
        dailyHours: safeNum(w.daily_hours, 8),
        overtimeRate: safeNum(w.overtime_rate, 2),
        role: w.role || "Employee",
        monthlySalary: safeNum(w.monthly_salary),
        payrolls: w.payrolls || [],
        createdAt: w.created_at || new Date().toISOString(),
        createdBy: w.created_by || undefined,
        updatedBy: w.updated_by || undefined,
        createdDate: w.created_date || undefined,
        createdTime: w.created_time || undefined,
        updatedDate: w.updated_date || undefined,
        updatedTime: w.updated_time || undefined
      }));
      saveWorkers(formatted);
    }

    // 7. Fetch Salary Sheets
    const { data: dbSheets } = await supabase
      .from("corevia_salary_sheets")
      .select("*")
      .eq("company_id", companyId);

    if (dbSheets && dbSheets.length > 0) {
      const formatted = dbSheets.map(sh => ({
        id: sh.id,
        workerId: sh.worker_id,
        workerName: sh.worker_name || "",
        monthYear: sh.month_year,
        dateFrom: sh.date_from || "",
        dateTo: sh.date_to || "",
        overtimeHours: safeNum(sh.overtime_hours),
        absenceDays: safeNum(sh.absence_days),
        missingHours: safeNum(sh.missing_hours),
        paidVacationDays: safeNum(sh.paid_vacation_days),
        expenses: sh.expenses || [],
        payStatus: sh.pay_status || "unpaid",
        calculatedSalary: sh.calculated_salary || {
          baseSalary: 0,
          dailyRate: 0,
          hourlyRate: 0,
          overtimePay: 0,
          absenceDeduction: 0,
          expensesDeduction: 0,
          netSalary: 0
        },
        updatedAt: sh.updated_at || new Date().toISOString(),
        createdBy: sh.created_by || undefined,
        updatedBy: sh.updated_by || undefined,
        createdDate: sh.created_date || undefined,
        createdTime: sh.created_time || undefined,
        updatedDate: sh.updated_date || undefined,
        updatedTime: sh.updated_time || undefined
      }));
      saveSalarySheets(formatted);
    }

    console.log("Full ERP sync pulled clean and isolated successfully from Supabase.");
    return true;
  } catch (err) {
    console.error("Multi-tenant initial pull failed (tables might not be created):", err);
    return false;
  }
}

/**
 * Full bulk sync back to cloud.
 */
export async function pushFullTenantData(companyId: string, email: string): Promise<void> {
  const profile = getBusinessProfile();
  if (profile) {
    await saveOnboardingCompletionInCloud(companyId, companyId, email, profile);
  }
  await pushSingleDatasetToCloud(companyId, "products", getProducts());
  await pushSingleDatasetToCloud(companyId, "orders", getOrders());
  await pushSingleDatasetToCloud(companyId, "suppliers", getSuppliers());
  
  const expStr = localStorage.getItem("corevia_unified_expenses_v1");
  let listExp: Expense[] = [];
  try { if (expStr) listExp = JSON.parse(expStr); } catch(e){}
  await pushSingleDatasetToCloud(companyId, "expenses", listExp);
  await pushSingleDatasetToCloud(companyId, "workers", getWorkers());
  await pushSingleDatasetToCloud(companyId, "salary_sheets", getSalarySheets());
}

/**
 * Safely clears all SaaS client transactional datasets, resets onboarding markers,
 * and purges cloud tables for clean testing.
 */
export async function cleanSlateResetSandbox(
  userId: string,
  companyId: string,
  email: string
): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  
  // 1. Wipe local cache markers
  localStorage.removeItem(`onboarding_complete_${cleanEmail}`);
  localStorage.removeItem("corevia_completed_onboarding");
  localStorage.removeItem("corevia_profile_v1");
  localStorage.removeItem("corevia_session_v1");
  localStorage.removeItem("corevia_user_session_v1");
  localStorage.setItem("corevia_completed_onboarding", "false");
  
  // Clear other active storage collections
  const suffix = "_" + cleanEmail.replace(/[^a-z0-9]/g, "_");
  const keysToClear = [
    "corevia_orders",
    "corevia_products",
    "corevia_suppliers",
    "corevia_expenses",
    "corevia_workers",
    "corevia_salary_sheets",
    "corevia_inventory_basic",
    "corevia_inventory_sub",
    "corevia_inventory_return",
    "corevia_stock_movements",
    "corevia_profile"
  ];
  keysToClear.forEach(k => {
    localStorage.removeItem(`${k}${suffix}`);
    localStorage.removeItem(k);
  });

  if (!supabase) return;

  try {
    // 2. Clear cloud DB tables under this tenant company ID
    await supabase.from("corevia_orders").delete().eq("company_id", companyId);
    await supabase.from("corevia_products").delete().eq("company_id", companyId);
    await supabase.from("corevia_suppliers").delete().eq("company_id", companyId);
    await supabase.from("corevia_expenses").delete().eq("company_id", companyId);
    await supabase.from("corevia_workers").delete().eq("company_id", companyId);
    await supabase.from("corevia_salary_sheets").delete().eq("company_id", companyId);
    await supabase.from("corevia_profile").delete().eq("id", companyId);

    // 3. Mark onboarding false inside saas users table
    await supabase
      .from("corevia_saas_users")
      .update({ has_completed_onboarding: false })
      .eq("user_id", userId);

  } catch (err) {
    console.error("Clean slate cloud tables deletion warning:", err);
  }
}
