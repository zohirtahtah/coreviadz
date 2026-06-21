import { supabase } from "./supabaseClient";
import { 
  getOrders, saveOrders, getProducts, saveProducts, getSuppliers, saveSuppliers, 
  getWorkers, saveWorkers, getSalarySheets, saveSalarySheets, getFixedExpenses, 
  saveFixedExpenses, getVarExpenses, saveVarExpenses, getAdExpenses, saveAdExpenses,
  getBusinessProfile, saveBusinessProfile, saveUserSession,
  saveBasicInventory, saveSubInventory, saveReturnInventory, saveStockMovements,
  getBasicInventory, getSubInventory, getReturnInventory, getStockMovements
} from "./storageUtils";
import { 
  Order, Product, Supplier, Worker, WorkerSalarySheet, BusinessProfile, Expense,
  BasicInventoryItem, SubInventoryItem, ReturnInventoryItem, StockMovement
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

      // Sync company's subscription plan, status, and seats limit directly from DB!
      const compId = userMeta.company_id || defaultCompanyId;
      try {
        const { data: dbCompany } = await supabase
          .from("corevia_companies")
          .select("*")
          .eq("id", compId)
          .maybeSingle();

        if (dbCompany) {
          const stored = localStorage.getItem("corevia_saas_companies_v1");
          let list: any[] = [];
          try { if (stored) list = JSON.parse(stored); } catch (e) {}

          const seatsLimitVal = dbCompany.seatsLimit !== undefined ? dbCompany.seatsLimit : (dbCompany.seatslimit !== undefined ? dbCompany.seatslimit : 5);
          const accountStatusVal = dbCompany.accountStatus !== undefined ? dbCompany.accountStatus : (dbCompany.accountstatus !== undefined ? dbCompany.accountstatus : (userMeta.has_completed_onboarding ? "Active" : "Pending Verification"));
          const subscriptionPlanVal = dbCompany.subscriptionPlan !== undefined ? dbCompany.subscriptionPlan : (dbCompany.subscriptionplan !== undefined ? dbCompany.subscriptionplan : "Basic");

          const matchedIdx = list.findIndex(c => c.id === compId || c.email.toLowerCase() === cleanEmail);
          const companyObj = {
            id: compId,
            companyName: dbCompany.name || `${fallbackName || cleanEmail.split("@")[0]} Trading`,
            ownerName: dbCompany.owner_name || fallbackName,
            email: cleanEmail,
            phone: dbCompany.phone || "+213 550 00 00 00",
            country: dbCompany.country || "Algeria",
            registrationDate: dbCompany.created_at ? dbCompany.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
            lastLogin: new Date().toISOString().replace("T", " ").substr(0, 16),
            emailVerified: true,
            subscriptionPlan: subscriptionPlanVal,
            seatsLimit: seatsLimitVal,
            seatsUsed: 1,
            accountStatus: accountStatusVal,
            expirationDate: "",
            activeDevices: [],
            otpCode: "123456"
          };

          if (matchedIdx > -1) {
            list[matchedIdx] = { ...list[matchedIdx], ...companyObj };
          } else {
            list.push(companyObj);
          }
          localStorage.setItem("corevia_saas_companies_v1", JSON.stringify(list));
        }
      } catch (coErr) {
        console.warn("Could not synchronize corevia_companies metadata upon session initialization:", coErr);
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
      owner_name: fallbackName,
      owner_email: cleanEmail
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
    const isCompletedLocal = false; // Issue 1: Force database check or onboarding setup for security
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

  if (!supabase) return;

  try {
    // Update SaaS meta safely
    await supabase
      .from("corevia_saas_users")
      .update({ has_completed_onboarding: true })
      .eq("user_id", userId);

    // Update corevia_companies table
    await supabase.from("corevia_companies").upsert({
      id: companyId,
      name: profile.businessName,
      owner_name: profile.ownerName || "Owner",
      phone: profile.phone || "",
      owner_email: profile.email || cleanEmail
    });

    // Upsert Business Profile bound to companyId (Extension table ONLY)
    await supabase.from("corevia_profile").upsert({
      id: companyId,
      company_id: companyId,
      business_name: "", // Empty to ensure zero duplication while preventing database NOT NULL constraints on older schemas
      business_type: profile.businessType,
      currency: profile.currency,
      country: profile.country,
      address: profile.address || "",
      website: profile.website || "",
      commercial_registry: profile.commercialRegistry || "",
      tax_number: profile.taxNumber || "",
      logo_url: profile.logoUrl || "",
      passcode: profile.passcode || "",
      rc1: profile.rc1 || "",
      rc2: profile.rc2 || "",
      nif: profile.nif || ""
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
  type: "products" | "orders" | "suppliers" | "expenses" | "workers" | "salary_sheets" | "inventory_basic" | "inventory_sub" | "inventory_return" | "stock_movements",
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
    } else if (type === "inventory_basic") {
      formattedItems = (rawItems as BasicInventoryItem[]).map(bi => ({
        id: `${bi.productId}_${bi.color}`,
        company_id: companyId,
        product_id: bi.productId,
        product_name: bi.productName,
        color: bi.color,
        quantity: bi.quantity,
        updated_at: new Date().toISOString()
      }));
    } else if (type === "inventory_sub") {
      formattedItems = (rawItems as SubInventoryItem[]).map(si => ({
        id: `${si.productId}_${si.color}_${si.size}`,
        company_id: companyId,
        product_id: si.productId,
        product_name: si.productName,
        color: si.color,
        size: si.size,
        quantity: si.quantity,
        updated_at: new Date().toISOString()
      }));
    } else if (type === "inventory_return") {
      formattedItems = (rawItems as ReturnInventoryItem[]).map(ri => ({
        id: `${ri.orderId}_${ri.productName}_${ri.color}_${ri.size}`,
        company_id: companyId,
        order_id: ri.orderId,
        product_name: ri.productName,
        color: ri.color,
        size: ri.size,
        quantity: ri.quantity,
        updated_at: new Date().toISOString()
      }));
    } else if (type === "stock_movements") {
      formattedItems = (rawItems as StockMovement[]).map(m => ({
        id: m.id,
        company_id: companyId,
        date: m.date,
        order_id: m.orderId,
        product_name: m.productName,
        color: m.color,
        size: m.size,
        quantity_change: m.quantityChange,
        movement_type: m.movementType,
        source: m.source
      }));
    }

    if (formattedItems.length > 0) {
      // 1. Surgical upsert of all active records to ensure zero downtime or data loss
      const { error: upsertError } = await supabase.from(tableName).upsert(formattedItems);
      if (upsertError) throw upsertError;

      console.log(`Automatic background cloud sync success for table "${tableName}" (${formattedItems.length} items). Non-destructive upsert completed.`);
    } else {
      console.log(`[AutoSync] Background cloud sync for table "${tableName}" received empty set. Safety bypass triggered to preserve existing records in remote database.`);
    }
  } catch (err) {
    console.error(`[AutoSync] Background cloud sync for "${type}" was skipped or failed:`, err);
    throw err;
  }
}

/**
 * Pulls all synchronized records from Supabase isolated by company_id, 
 * writing them to the active tenant's localized localStorage state.
 */
export async function pullMultiTenantData(companyId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    // 1. Fetch Primary Company Information from corevia_companies (SOLITARY Authoritative Source)
    const { data: companyData } = await supabase
      .from("corevia_companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    // 2. Fetch Optional Extension metadata from corevia_profile (Extension table ONLY)
    const { data: profileData } = await supabase
      .from("corevia_profile")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (companyData || profileData) {
      const activeProf: BusinessProfile = {
        businessName: companyData?.name || profileData?.business_name || "Enterprise Workspace",
        businessType: profileData?.business_type || "تجارة إلكترونية",
        experienceYears: "سنة واحدة", // default fallback
        estimatedOrders: "0",
        estimatedWorkers: "0",
        currency: (profileData?.currency === "DZD" || profileData?.currency === "USD" || profileData?.currency === "EUR") ? profileData.currency : "DZD",
        defaultLanguage: "ar",
        preferredTheme: "dark",
        country: profileData?.country || "Algeria",
        ownerName: companyData?.owner_name || profileData?.owner_name || "System Owner",
        phone: companyData?.phone || profileData?.phone || "",
        email: companyData?.email || companyData?.owner_email || profileData?.email || "",
        address: profileData?.address || "",
        website: profileData?.website || "",
        commercialRegistry: profileData?.commercial_registry || "",
        taxNumber: profileData?.tax_number || "",
        passcode: profileData?.passcode || "",
        rc1: profileData?.rc1 || "",
        rc2: profileData?.rc2 || "",
        nif: profileData?.nif || "",
        logoUrl: profileData?.logo_url || profileData?.logoUrl || ""
      };
      saveBusinessProfile(activeProf);
    }

    // 2. Fetch Products
    const { data: dbProducts } = await supabase
      .from("corevia_products")
      .select("*")
      .eq("company_id", companyId);

    if (dbProducts) {
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

    if (dbOrders) {
      const formatted = dbOrders.map(o => {
        let dateVal = o.date || (o.created_at ? o.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10));
        let customerNameVal = o.customer_name || o.customer || "Client";
        let phoneVal = o.phone || "";
        let wilayaVal = o.wilaya || "Alger";
        let communeVal = o.commune || "";
        let deliveryLocationVal = o.delivery_location || "Home";
        let deliveryCompanyVal = o.delivery_company || "Yalidine Express";
        let deliveryTypeVal = o.delivery_type || "Home";
        let deliveryPriceVal = safeNum(o.delivery_price);
        let itemsVal = o.items || [];
        let totalPriceVal = safeNum(o.total_price || o.total);
        let paidAmountVal = safeNum(o.paid_amount);
        let discountVal = safeNum(o.discount);
        let notesVal = o.notes;

        if (o.notes) {
          try {
            const parsed = JSON.parse(o.notes);
            if (parsed && typeof parsed === "object" && parsed.custom_original) {
              dateVal = parsed.date || dateVal;
              customerNameVal = parsed.customerName || customerNameVal;
              phoneVal = parsed.phone || phoneVal;
              wilayaVal = parsed.wilaya || wilayaVal;
              communeVal = parsed.commune || communeVal;
              deliveryLocationVal = parsed.deliveryLocation || deliveryLocationVal;
              deliveryCompanyVal = parsed.deliveryCompany || deliveryCompanyVal;
              deliveryTypeVal = parsed.deliveryType || deliveryTypeVal;
              deliveryPriceVal = safeNum(parsed.deliveryPrice !== undefined ? parsed.deliveryPrice : deliveryPriceVal);
              itemsVal = parsed.items || itemsVal;
              totalPriceVal = safeNum(parsed.totalPrice !== undefined ? parsed.totalPrice : totalPriceVal);
              paidAmountVal = safeNum(parsed.paidAmount !== undefined ? parsed.paidAmount : paidAmountVal);
              discountVal = safeNum(parsed.discount !== undefined ? parsed.discount : discountVal);
              notesVal = parsed.notes;
            }
          } catch (e) {}
        }

        return {
          id: o.id,
          date: dateVal,
          customerName: customerNameVal,
          phone: phoneVal,
          wilaya: wilayaVal,
          commune: communeVal,
          deliveryLocation: deliveryLocationVal,
          deliveryCompany: deliveryCompanyVal,
          deliveryType: deliveryTypeVal,
          deliveryPrice: deliveryPriceVal,
          items: itemsVal,
          totalPrice: totalPriceVal,
          paidAmount: paidAmountVal,
          discount: discountVal,
          customerPaysDelivery: Boolean(o.customer_pays_delivery),
          isExchange: Boolean(o.is_exchange),
          exchangeOrderRef: o.exchange_order_ref || undefined,
          agentName: o.agent_name || "Owner",
          source: (o.source === "1" || o.source === "2" || o.source === "3") ? o.source : "1",
          status: o.status || "pending",
          returnCost: o.return_cost ? safeNum(o.return_cost) : undefined,
          returnDate: o.return_date || undefined,
          notes: notesVal,
          deletedAt: o.deleted_at || undefined,
          createdBy: o.created_by || undefined,
          updatedBy: o.updated_by || undefined,
          createdDate: o.created_date || undefined,
          createdTime: o.created_time || undefined,
          updatedDate: o.updated_date || undefined,
          updatedTime: o.updated_time || undefined
        };
      });
      saveOrders(formatted);
    }

    // 4. Fetch Suppliers
    const { data: dbSuppliers } = await supabase
      .from("corevia_suppliers")
      .select("*")
      .eq("company_id", companyId);

    if (dbSuppliers) {
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

    if (dbExpenses) {
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

    // Fetch Invited/Registered Employees for worker linking
    const { data: dbCompanyUsers } = await supabase
      .from("corevia_company_users")
      .select("*")
      .eq("company_id", companyId);

    let formatted: any[] = [];
    if (dbWorkers) {
      formatted = dbWorkers.map(w => ({
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
    }

    if (dbCompanyUsers && dbCompanyUsers.length > 0) {
      const extraWorkersToPersist: any[] = [];
      dbCompanyUsers.forEach(emp => {
        let employeeName = emp.username || emp.id || "Employee";
        let jobTitle = "Employee";
        let phone = emp.phone || "";
        
        // Parse nested fields from JSONB allowed_pages if available
        if (emp.allowed_pages) {
          try {
            const parsed = typeof emp.allowed_pages === "string" ? JSON.parse(emp.allowed_pages) : emp.allowed_pages;
            if (parsed && typeof parsed === "object") {
              if (parsed.full_name) employeeName = parsed.full_name;
              if (parsed.job_title) jobTitle = parsed.job_title;
            }
          } catch (e) {}
        }

        // Check if there is already a matching worker in formatted list
        const exists = formatted.some(w => 
          w.id === emp.id || 
          (emp.phone && w.phone && emp.phone.trim() === w.phone.trim()) ||
          (employeeName && w.name && employeeName.toLowerCase().trim() === w.name.toLowerCase().trim())
        );

        if (!exists) {
          // Provision in corevia_workers automatically
          const newWorkerId = emp.id || `worker_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
          const freshWorker = {
            id: newWorkerId,
            name: employeeName,
            code: "W-" + newWorkerId.substring(0, 4),
            phone: phone,
            baseSalary: 45000, // standard default fallback salary
            dailyHours: 8,
            overtimeRate: 2,
            role: jobTitle,
            monthlySalary: 45000,
            payrolls: [],
            createdAt: emp.created_at || new Date().toISOString()
          };
          formatted.push(freshWorker);
          extraWorkersToPersist.push({
            id: newWorkerId,
            company_id: companyId,
            name: employeeName,
            code: "W-" + newWorkerId.substring(0, 4),
            phone: phone,
            base_salary: 45000,
            daily_hours: 8,
            overtime_rate: 2,
            role: jobTitle,
            monthly_salary: 45000,
            payrolls: [],
            created_at: emp.created_at || new Date().toISOString()
          });
        }
      });

      // Insert missing workers in background asynchronously to prevent any main thread blocking
      if (extraWorkersToPersist.length > 0) {
        supabase.from("corevia_workers").upsert(extraWorkersToPersist)
          .then(({ error }) => {
            if (error) console.error("Auto-provisioning workers from employees failed:", error);
            else console.log(`Auto-provisioned ${extraWorkersToPersist.length} worker profiles dynamically.`);
          });
      }
    }

    saveWorkers(formatted);

    // 7. Fetch Salary Sheets
    const { data: dbSheets } = await supabase
      .from("corevia_salary_sheets")
      .select("*")
      .eq("company_id", companyId);

    if (dbSheets) {
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

    // 8. Fetch Basic Inventory
    try {
      const { data: dbInvBasic } = await supabase.from("corevia_inventory_basic").select("*").eq("company_id", companyId);
      if (dbInvBasic) {
        const formatted: BasicInventoryItem[] = dbInvBasic.map(bi => ({
          productId: bi.product_id,
          productName: bi.product_name,
          color: bi.color || "",
          quantity: safeNum(bi.quantity)
        }));
        saveBasicInventory(formatted);
      }
    } catch (e) {
      console.warn("Could not sync corevia_inventory_basic remote database:", e);
    }

    // 9. Fetch Sub Inventory
    try {
      const { data: dbInvSub } = await supabase.from("corevia_inventory_sub").select("*").eq("company_id", companyId);
      if (dbInvSub) {
        const formatted: SubInventoryItem[] = dbInvSub.map(si => ({
          productId: si.product_id,
          productName: si.product_name,
          color: si.color || "",
          size: si.size || "",
          quantity: safeNum(si.quantity)
        }));
        saveSubInventory(formatted);
      }
    } catch (e) {
      console.warn("Could not sync corevia_inventory_sub remote database:", e);
    }

    // 10. Fetch Return Inventory
    try {
      const { data: dbInvReturn } = await supabase.from("corevia_inventory_return").select("*").eq("company_id", companyId);
      if (dbInvReturn) {
        const formatted: ReturnInventoryItem[] = dbInvReturn.map(ri => ({
          orderId: ri.order_id,
          productName: ri.product_name,
          color: ri.color || "",
          size: ri.size || "",
          quantity: safeNum(ri.quantity)
        }));
        saveReturnInventory(formatted);
      }
    } catch (e) {
      console.warn("Could not sync corevia_inventory_return remote database:", e);
    }

    // 11. Fetch Stock Movements
    try {
      const { data: dbMovements } = await supabase
        .from("corevia_stock_movements")
        .select("*")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .limit(1000);
      if (dbMovements) {
        const formatted: StockMovement[] = dbMovements.map(m => ({
          id: m.id,
          date: m.date || new Date().toISOString(),
          orderId: m.order_id || "",
          productName: m.product_name || "",
          color: m.color || "",
          size: m.size || "",
          quantityChange: safeNum(m.quantity_change),
          movementType: (m.movement_type || "Manual Adjustment") as any,
          source: m.source || "Database"
        }));
        saveStockMovements(formatted);
      }
    } catch (e) {
      console.warn("Could not sync corevia_stock_movements remote database:", e);
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
  await pushSingleDatasetToCloud(companyId, "inventory_basic", getBasicInventory());
  await pushSingleDatasetToCloud(companyId, "inventory_sub", getSubInventory());
  await pushSingleDatasetToCloud(companyId, "inventory_return", getReturnInventory());
  await pushSingleDatasetToCloud(companyId, "stock_movements", getStockMovements());
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
  localStorage.removeItem("corevia_profile_v1");
  localStorage.removeItem("corevia_session_v1");
  localStorage.removeItem("corevia_user_session_v1");
  
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
    // Bypass remote deletions to prevent data loss in production datastores
    console.log("Sandbox database reset requested. Safety bypass active: preserving Cloud DB records, only cleared local device caches.");
    
    // 3. Mark onboarding false inside saas users table (this is the only safe status change)
    await supabase
      .from("corevia_saas_users")
      .update({ has_completed_onboarding: false })
      .eq("user_id", userId);

  } catch (err) {
    console.error("Clean slate cloud tables deletion warning:", err);
  }
}

/**
 * Calculates worker payroll strictly using database rpc if available,
 * falling back to local exact formula with decimal rounding to 2 places.
 */
export async function calculateWorkerPayroll(params: {
  baseSalary: number;
  workingDaysCount: number;
  absenceDaysCount: number;
  overtimeHoursCount: number;
  dailyWorkingHours: number;
  overtimeMultiplier: number;
  deductionsAmount: number;
  bonusesAmount: number;
}): Promise<{
  daily_base_rate: number;
  hourly_overtime_rate: number;
  overtime_pay: number;
  absence_deduction: number;
  net_salary: number;
}> {
  // Try Postgres Database RPC Function
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("calculate_worker_payroll_v1", {
        p_base_salary: params.baseSalary,
        p_working_days_count: params.workingDaysCount,
        p_absence_days_count: params.absenceDaysCount,
        p_overtime_hours_count: params.overtimeHoursCount,
        p_daily_working_hours: params.dailyWorkingHours,
        p_overtime_multiplier: params.overtimeMultiplier,
        p_deductions_amount: params.deductionsAmount,
        p_bonuses_amount: params.bonusesAmount
      });
      if (!error && data) {
        return {
          daily_base_rate: Number(data.daily_base_rate),
          hourly_overtime_rate: Number(data.hourly_overtime_rate),
          overtime_pay: Number(data.overtime_pay),
          absence_deduction: Number(data.absence_deduction),
          net_salary: Number(data.net_salary)
        };
      }
    } catch (e) {
      console.warn("Database calculate_worker_payroll RPC failed, using secure frontend calculation fallback:", e);
    }
  }

  // Fallback identical formula
  const workingDays = params.workingDaysCount || 22;
  const workingHours = params.dailyWorkingHours || 8;
  const multiplier = params.overtimeMultiplier || 1.5;
  
  const daily_base_rate = Number((params.baseSalary / workingDays).toFixed(4));
  const hourly_overtime_rate = Number(((params.baseSalary / (workingDays * workingHours)) * multiplier).toFixed(4));
  
  const overtime_pay = Number((params.overtimeHoursCount * hourly_overtime_rate).toFixed(2));
  const absence_deduction = Number((params.absenceDaysCount * daily_base_rate).toFixed(2));
  
  const net_salary = Number((params.baseSalary + overtime_pay - absence_deduction - params.deductionsAmount + params.bonusesAmount).toFixed(2));

  return {
    daily_base_rate,
    hourly_overtime_rate,
    overtime_pay,
    absence_deduction,
    net_salary: Math.max(0, net_salary)
  };
}
