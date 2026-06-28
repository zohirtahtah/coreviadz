import { supabase } from "./supabaseClient";

export interface PlatformConfig {
  platformName: string;
  supportEmail: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  website: string;
  docsUrl: string;
  maintenanceMode: boolean;
  defaultCurrency: string;
  smtpServer: string;
  smtpPort: number;
  smtpUser: string;
  currentVersion: string;
  releaseDate: string;
  releaseNotes: string;
  minDbVersion: string;
  migrationStatus: string;
  subscriptionPlans: any;
  newErpModules: string[];
}

const DEFAULT_CONFIG: PlatformConfig = {
  platformName: "Corevia ERP",
  supportEmail: "support@corevia-erp.com",
  phone: "+213 (0) 550 00 00 10",
  whatsapp: "+213 (0) 550 00 00 10",
  telegram: "@corevia_erp_support",
  website: "https://corevia-erp.com",
  docsUrl: "https://docs.corevia-erp.com",
  maintenanceMode: false,
  defaultCurrency: "DZD",
  smtpServer: "smtp.corevia-erp.com",
  smtpPort: 587,
  smtpUser: "no-reply@corevia-erp.com",
  currentVersion: "v2.5.0",
  releaseDate: "2026-06-28",
  releaseNotes: "Production architecture isolation update, non-destructive additive schema enforcement, and multi-tenant live subscription tracking.",
  minDbVersion: "v2.0",
  migrationStatus: "Completed",
  subscriptionPlans: {
    Starter: { price: 29, seats: 5 },
    Professional: { price: 79, seats: 15 },
    Enterprise: { price: 199, seats: 99 }
  },
  newErpModules: [
    "Sales & CRM Module",
    "Multi-Storehouse Inventory",
    "Suppliers & Purchasing",
    "Advanced HR & Workers Payroll",
    "Live Analytics Dashboard",
    "Automated Cloud Backup"
  ]
};

export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  // Try reading local storage cache first for zero-latency load
  const cached = localStorage.getItem("corevia_platform_config");
  let activeConfig = DEFAULT_CONFIG;
  if (cached) {
    try {
      activeConfig = { ...DEFAULT_CONFIG, ...JSON.parse(cached) };
    } catch (e) {
      console.warn("Could not parse cached platform config", e);
    }
  }

  if (!supabase) {
    return activeConfig;
  }

  try {
    const { data, error } = await supabase
      .from("corevia_platform_config")
      .select("*")
      .eq("id", "global_config")
      .maybeSingle();

    if (error) {
      // Table doesn't exist yet, return cached or default and don't crash
      if (error.code === "PGRST116" || error.code === "42P01" || error.message.includes("relation does not exist")) {
        console.info("[PlatformConfig] corevia_platform_config table not found, using default fallback.");
      } else {
        console.warn("[PlatformConfig] Error querying platform config table:", error);
      }
      return activeConfig;
    }

    if (data) {
      // Parse database row back into typed interface
      const dbConfig: PlatformConfig = {
        platformName: data.platform_name || DEFAULT_CONFIG.platformName,
        supportEmail: data.support_email || DEFAULT_CONFIG.supportEmail,
        phone: data.phone || DEFAULT_CONFIG.phone,
        whatsapp: data.whatsapp || DEFAULT_CONFIG.whatsapp,
        telegram: data.telegram || DEFAULT_CONFIG.telegram,
        website: data.website || DEFAULT_CONFIG.website,
        docsUrl: data.docs_url || DEFAULT_CONFIG.docsUrl,
        maintenanceMode: Boolean(data.maintenance_mode),
        defaultCurrency: data.default_currency || DEFAULT_CONFIG.defaultCurrency,
        smtpServer: data.smtp_server || DEFAULT_CONFIG.smtpServer,
        smtpPort: Number(data.smtp_port || DEFAULT_CONFIG.smtpPort),
        smtpUser: data.smtp_user || DEFAULT_CONFIG.smtpUser,
        currentVersion: data.current_version || DEFAULT_CONFIG.currentVersion,
        releaseDate: data.release_date || DEFAULT_CONFIG.releaseDate,
        releaseNotes: data.release_notes || DEFAULT_CONFIG.releaseNotes,
        minDbVersion: data.min_db_version || DEFAULT_CONFIG.minDbVersion,
        migrationStatus: data.migration_status || DEFAULT_CONFIG.migrationStatus,
        subscriptionPlans: data.subscription_plans || DEFAULT_CONFIG.subscriptionPlans,
        newErpModules: data.new_erp_modules || DEFAULT_CONFIG.newErpModules
      };
      
      localStorage.setItem("corevia_platform_config", JSON.stringify(dbConfig));
      return dbConfig;
    } else {
      // If table exists but empty, try writing default once so it has a seed
      await supabase.from("corevia_platform_config").insert({
        id: "global_config",
        platform_name: DEFAULT_CONFIG.platformName,
        support_email: DEFAULT_CONFIG.supportEmail,
        phone: DEFAULT_CONFIG.phone,
        whatsapp: DEFAULT_CONFIG.whatsapp,
        telegram: DEFAULT_CONFIG.telegram,
        website: DEFAULT_CONFIG.website,
        docs_url: DEFAULT_CONFIG.docsUrl,
        maintenance_mode: DEFAULT_CONFIG.maintenanceMode,
        default_currency: DEFAULT_CONFIG.defaultCurrency,
        smtp_server: DEFAULT_CONFIG.smtpServer,
        smtp_port: DEFAULT_CONFIG.smtpPort,
        smtp_user: DEFAULT_CONFIG.smtpUser,
        current_version: DEFAULT_CONFIG.currentVersion,
        release_date: DEFAULT_CONFIG.releaseDate,
        release_notes: DEFAULT_CONFIG.releaseNotes,
        min_db_version: DEFAULT_CONFIG.minDbVersion,
        migration_status: DEFAULT_CONFIG.migrationStatus,
        subscription_plans: DEFAULT_CONFIG.subscriptionPlans,
        new_erp_modules: DEFAULT_CONFIG.newErpModules
      });
      return DEFAULT_CONFIG;
    }
  } catch (err) {
    console.warn("[PlatformConfig] Could not synchronize platform config from remote DB, using cached version.", err);
    return activeConfig;
  }
}

export async function savePlatformConfig(config: PlatformConfig): Promise<void> {
  // Update local storage cache immediately
  localStorage.setItem("corevia_platform_config", JSON.stringify(config));

  if (!supabase) return;

  try {
    const payload = {
      id: "global_config",
      platform_name: config.platformName,
      support_email: config.supportEmail,
      phone: config.phone,
      whatsapp: config.whatsapp,
      telegram: config.telegram,
      website: config.website,
      docs_url: config.docsUrl,
      maintenance_mode: config.maintenanceMode,
      default_currency: config.defaultCurrency,
      smtp_server: config.smtpServer,
      smtp_port: config.smtpPort,
      smtp_user: config.smtpUser,
      current_version: config.currentVersion,
      release_date: config.releaseDate,
      release_notes: config.releaseNotes,
      min_db_version: config.minDbVersion,
      migration_status: config.migrationStatus,
      subscription_plans: config.subscriptionPlans,
      new_erp_modules: config.newErpModules
    };

    const { error } = await supabase
      .from("corevia_platform_config")
      .upsert(payload);

    if (error) {
      throw error;
    }
    console.log("[PlatformConfig] Global configurations updated successfully in Supabase.");
  } catch (err) {
    console.error("[PlatformConfig] Failed to save platform config in Supabase:", err);
    throw err;
  }
}
