/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BusinessProfile, LanguageType } from "../types";
import { translations } from "../translations";
import { 
  Settings, ShieldAlert, BadgeCheck, Plus, X, Paintbrush, Sliders, Upload, Image,
  Database, RefreshCw, CloudLightning, Copy, Check, CheckCircle2, Download, Terminal,
  Server, Sparkles, Key, AlertCircle
} from "lucide-react";
import SheetsSyncSettings from "./SheetsSyncSettings";
import UsersPermissionsView from "./UsersPermissionsView";
import { supabase, isSupabaseConfigured } from "../supabaseClient";
import { pushFullTenantData, pullMultiTenantData } from "../supabaseSync";
import {
  getOrders, saveOrders,
  getProducts, saveProducts,
  getSuppliers, saveSuppliers,
  getWorkers, saveWorkers,
  getSalarySheets, saveSalarySheets,
  getFixedExpenses, saveFixedExpenses,
  getVarExpenses, saveVarExpenses,
  getAdExpenses, saveAdExpenses,
  saveBusinessProfile
} from "../storageUtils";

interface SettingsViewProps {
  profile: BusinessProfile;
  onSaveProfile: (p: BusinessProfile) => void;
  lang: LanguageType;
  customColorsList: string[];
  onSaveCustomColors: (arr: string[]) => void;
  onTriggerNotification: (msg: string) => void;
  onTriggerRefreshOrders?: () => void;
  onReloadAllStates?: () => void;
  session?: any;
  seatsLimit?: number;
}

export default function SettingsView({
  profile,
  onSaveProfile,
  lang,
  customColorsList,
  onSaveCustomColors,
  onTriggerNotification,
  onTriggerRefreshOrders,
  onReloadAllStates,
  session,
  seatsLimit
}: SettingsViewProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";

  // State variables synchronized with user props
  const [bName, setBName] = useState(profile.businessName || "");
  const [bEmail, setBEmail] = useState(profile.email || "");
  const [bPhone, setBPhone] = useState(profile.phone || "");
  const [bCurrency, setBCurrency] = useState(profile.currency || "DZD");
  const [bCountry, setBCountry] = useState<"Algeria" | "France" | "Morocco" | "Other">(profile.country || "Algeria");
  const [bRegistry, setBRegistry] = useState(profile.commercialRegistry || "");
  const [bAddress, setBAddress] = useState(profile.address || "");
  const [bRC1, setBRC1] = useState(profile.rc1 || "");
  const [bRC2, setBRC2] = useState(profile.rc2 || "");
  const [bNIF, setBNIF] = useState(profile.nif || "");
  const [bLogoUrl, setBLogoUrl] = useState<string | undefined>(profile.logoUrl);

  // Synchronize local states when parent profile changes
  React.useEffect(() => {
    setBName(profile.businessName || "");
    setBEmail(profile.email || "");
    setBPhone(profile.phone || "");
    setBCurrency(profile.currency || "DZD");
    setBCountry(profile.country || "Algeria");
    setBRegistry(profile.commercialRegistry || "");
    setBAddress(profile.address || "");
    setBRC1(profile.rc1 || "");
    setBRC2(profile.rc2 || "");
    setBNIF(profile.nif || "");
    setBLogoUrl(profile.logoUrl);
    setPasscode(profile.passcode || "1234");
  }, [profile]);
  
  // Security
  const [passcode, setPasscode] = useState(profile.passcode || "1234");
  const [showPasscodeVal, setShowPasscodeVal] = useState(false);

  // New color adding block
  const [newColorEntry, setNewColorEntry] = useState("");

  // Supabase Integration & Synchronization Modules
  const [isSyncingToSupabase, setIsSyncingToSupabase] = useState(false);
  const [isPullingFromSupabase, setIsPullingFromSupabase] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Connection tester
  const handleTestConnection = async () => {
    if (!supabase) {
      setDbTestResult("MISSING_KEYS");
      return;
    }
    setIsTestingConnection(true);
    setDbTestResult(null);

    try {
      // Execute simple query to test connection
      const { data, error } = await supabase.from("corevia_profile").select("id").limit(1);
      
      if (error) {
        // Table might not exist yet, which is expected before schema setup
        if (error.code === "PGRST116" || error.code === "42P01") {
          setDbTestResult("CONNECTED_BUT_NO_TABLES");
          onTriggerNotification(
            lang === "ar"
              ? "🟢 متصل بـ Supabase بنجاح! ولكن يرجى تشغيل كود إنشاء الجداول الأولية أولاً."
              : "🟢 Connected to Supabase! However, you need to execute the SQL tables schema script."
          );
        } else {
          throw error;
        }
      } else {
        setDbTestResult("FULLY_CONNECTED");
        onTriggerNotification(
          lang === "ar"
            ? "🟢 تم الاتصال بنجاح وقراءة قاعدة البيانات بنشاط!"
            : "🟢 Successfully connected and authenticated with Supabase database!"
        );
      }
    } catch (err: any) {
      console.error("Supabase test error:", err);
      setDbTestResult(`ERROR: ${err.message || "Failed to query database"}`);
      onTriggerNotification(
        lang === "ar"
          ? "❌ فشل الاتصال بقاعدة البيانات. تحقق من صحة المفاتيح وصلاحية الخادم."
          : "❌ Connection failed. Check credentials and server availability."
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Push Local Data to Supabase
  const handlePushToSupabase = async () => {
    if (!supabase) {
      setDbTestResult("MISSING_KEYS");
      return;
    }
    setIsSyncingToSupabase(true);
    setDbTestResult(null);

    try {
      const companyId = session?.company_id || "cop_default";
      const email = session?.email || "unknown@corevia.com";

      onTriggerNotification(lang === "ar" ? "جاري مزامنة ورفع جميع البيانات والملفات السحابية..." : "Uploading multi-tenant secure sandbox state onto cloud...");
      await pushFullTenantData(companyId, email);

      onTriggerNotification(lang === "ar" ? "✅ تمت مزامنة جميع البيانات ورفعها بنجاح إلى قاعدة Supabase!" : "✅ Successfully backed up & synchronized all datasets with Supabase Cloud Postgres.");
      setDbTestResult("CONNECTED_AND_SYNCED");
    } catch (err: any) {
      console.error("Supabase backup error:", err);
      setDbTestResult(`ERROR_PUSH: ${err.message || "Failed to sync tables"}`);
      onTriggerNotification(lang === "ar" ? "❌ فشل رفع الملفات والمزامنة السحابية." : "❌ Cloud sync failed. Ensure your SQL tables are created.");
    } finally {
      setIsSyncingToSupabase(false);
    }
  };

  // Pull Cloud Data from Supabase
  const handlePullFromSupabase = async () => {
    if (!supabase) {
      setDbTestResult("MISSING_KEYS");
      return;
    }
    const confirmAction = window.confirm(
      lang === "ar"
        ? "⚠️ تحذير: تنزيل البيانات من Supabase سيستبدل جميع البيانات المحلية المحفوظة في هذا المتصفح تماماً. هل أنت متأكد من الاستمرار؟"
        : "⚠️ Warning: Downloading data from Supabase will fully overwrite your browser's local sandbox state. Proceed?"
    );
    if (!confirmAction) return;

    setIsPullingFromSupabase(true);
    setDbTestResult(null);

    try {
      const companyId = session?.company_id || "cop_default";
      onTriggerNotification(lang === "ar" ? "جاري تنزيل وهيكلة البيانات المعزولة سحابياً..." : "Downloading multi-tenant cloud schemas...");
      const success = await pullMultiTenantData(companyId);

      if (success) {
        onTriggerNotification(lang === "ar" ? "✅ تم جلب وتنزيل قاعدة بيانات السحابة بالكامل بنجاح للمتصفح!" : "✅ Data synchronized successfully. Pulled all tables clean from Supabase cloud.");
        setDbTestResult("CONNECTED_AND_PULLED");
        if (onReloadAllStates) {
          onReloadAllStates();
        }
      } else {
        throw new Error("Failed to pull database data");
      }
    } catch (err: any) {
      console.error(err);
      setDbTestResult(`ERROR_PULL: ${err.message || "Unknown error during data download"}`);
      onTriggerNotification(lang === "ar" ? `❌ خطأ في التنزيل: يرجى التأكد من تشغيل كود SQL الأساسي` : `❌ Download failed: Ensure you have executed the tables database script first.`);
    } finally {
      setIsPullingFromSupabase(false);
    }
  };

  const copySqlSchemaText = () => {
    const rawSql = `-- Corevia Enterprise Database SQL Schema & Security Hardening
-- Paste this script into your Supabase SQL Editor and run it in 1 click!

-- 0. Tenant Companies and Users (Clipboard Copy)
create table if not exists corevia_companies (
  id text primary key,
  name text not null,
  business_type text,
  owner_name text,
  phone text,
  email text,
  seatsLimit integer default 5,
  accountStatus text default 'Active',
  subscriptionPlan text default 'Standard_Monthly',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Saas Users (Clipboard Copy)
create table if not exists corevia_saas_users (
  user_id text primary key,
  company_id text references corevia_companies(id) on delete set null,
  email text not null,
  username text,
  has_completed_onboarding boolean default false,
  role text default 'admin',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_company_users (
  id text primary key,
  company_id text default 'cop_default',
  full_name text not null,
  phone text not null,
  email text,
  username text,
  job_title text,
  password text,
  assigned_responsibilities text,
  allowed_pages jsonb default '[]'::jsonb,
  status text default 'Active',
  last_activity text,
  auth_user_id text,
  invitation_token text,
  invitation_expires text,
  invitation_used boolean default false,
  deleted_at timestamp with time zone default null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 1. Business Profile
create table if not exists corevia_profile (
  id text primary key,
  company_id text default null,
  business_name text not null,
  business_type text,
  currency text default 'DZD',
  country text default 'Algeria',
  owner_name text,
  phone text,
  email text,
  address text,
  website text,
  commercial_registry text,
  tax_number text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Products and Inventory
create table if not exists corevia_products (
  id text primary key,
  company_id text default 'cop_default',
  name text not null,
  wholesale_cost_price numeric not null,
  wholesale_percentage numeric,
  wholesale_price numeric not null,
  retail_cost_price numeric not null,
  retail_percentage numeric,
  retail_price numeric not null,
  colors jsonb default '[]'::jsonb,
  sizes text[] default '{}'::text[],
  created_at text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

create table if not exists corevia_inventory_basic (
  id text primary key,
  company_id text default 'cop_default',
  product_id text not null,
  product_name text not null,
  color text,
  quantity numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_inventory_sub (
  id text primary key,
  company_id text default 'cop_default',
  product_id text not null,
  product_name text not null,
  color text,
  size text,
  quantity numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_inventory_return (
  id text primary key,
  company_id text default 'cop_default',
  order_id text not null,
  product_name text not null,
  color text,
  size text,
  quantity numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_stock_movements (
  id text primary key,
  company_id text default 'cop_default',
  date timestamp with time zone default timezone('utc'::text, now()),
  order_id text,
  product_name text,
  color text,
  size text,
  quantity_change numeric,
  movement_type text,
  source text
);

-- 3. Corevia Orders
create table if not exists corevia_orders (
  id text primary key,
  company_id text default 'cop_default',
  date text not null,
  customer_name text not null,
  phone text not null,
  wilaya text,
  commune text,
  delivery_location text,
  delivery_company text,
  delivery_type text,
  delivery_price numeric default 0,
  items jsonb default '[]'::jsonb,
  total_price numeric not null,
  paid_amount numeric default 0,
  discount numeric default 0,
  customer_pays_delivery boolean default true,
  is_exchange boolean default false,
  exchange_order_ref text,
  agent_name text,
  source text,
  status text default 'pending',
  return_cost numeric,
  return_date text,
  notes text,
  deleted_at text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

-- 4. Supplier Pipeline
create table if not exists corevia_suppliers (
  id text primary key,
  company_id text default 'cop_default',
  name text not null,
  phone text,
  address text,
  email text,
  created_at text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

-- 5. Business Expenses
create table if not exists corevia_expenses (
  id text primary key,
  company_id text default 'cop_default',
  type text not null,
  name text,
  amount numeric,
  date text,
  month_year text,
  platform text,
  amount_usd numeric,
  exchange_rate numeric,
  amount_currency numeric,
  start_date text,
  end_date text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

-- 6. Payroll & Workers
create table if not exists corevia_workers (
  id text primary key,
  company_id text default 'cop_default',
  name text not null,
  code text,
  phone text,
  base_salary numeric,
  daily_hours numeric,
  overtime_rate numeric,
  role text,
  monthly_salary numeric,
  payrolls jsonb default '[]'::jsonb,
  created_at text,
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

create table if not exists corevia_salary_sheets (
  id text primary key,
  company_id text default 'cop_default',
  worker_id text not null,
  worker_name text,
  month_year text,
  date_from text,
  date_to text,
  overtime_hours numeric,
  absence_days numeric,
  missing_hours numeric,
  paid_vacation_days numeric,
  expenses jsonb default '[]'::jsonb,
  pay_status text,
  calculated_salary jsonb,
  updated_at text,
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

create table if not exists corevia_employee_submissions (
  id text primary key,
  company_id text default 'cop_default',
  employee_id text not null,
  employee_name text not null,
  type text not null,
  amount numeric not null,
  description text,
  date text not null,
  status text default 'pending',
  created_at text
);

-- 7. Realtime Chat Messages
create table if not exists corevia_chat_messages (
  id text primary key,
  company_id text default 'cop_default',
  sender_id text not null,
  sender_name text not null,
  sender_job_title text,
  content text,
  voice_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. Enterprise Core Activity logs audit trail
create table if not exists corevia_activity_logs (
  id text primary key,
  company_id text default 'cop_default',
  actor_name text not null,
  actor_role text,
  operation text not null,
  item_type text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  browser_details text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- --- SAAS MULTI-TENANT ISOLATION POLICIES (RLS SECURITY) ---
alter table corevia_companies enable row level security;
alter table corevia_saas_users enable row level security;
alter table corevia_company_users enable row level security;
alter table corevia_profile enable row level security;
alter table corevia_products enable row level security;
alter table corevia_inventory_basic enable row level security;
alter table corevia_inventory_sub enable row level security;
alter table corevia_inventory_return enable row level security;
alter table corevia_stock_movements enable row level security;
alter table corevia_orders enable row level security;
alter table corevia_suppliers enable row level security;
alter table corevia_expenses enable row level security;
alter table corevia_workers enable row level security;
alter table corevia_salary_sheets enable row level security;
alter table corevia_employee_submissions enable row level security;
alter table corevia_chat_messages enable row level security;
alter table corevia_activity_logs enable row level security;

-- Define a policy helper query concept (Secure claim lookup)
drop policy if exists tenant_isolation on corevia_companies;
create policy tenant_isolation on corevia_companies for all using (
  id = coalesce((select company_id from corevia_saas_users where user_id = auth.uid() limit 1), id)
);

drop policy if exists tenant_isolation on corevia_saas_users;
create policy tenant_isolation on corevia_saas_users for all using (
  auth.uid() is null or user_id = auth.uid()
);

drop policy if exists tenant_isolation on corevia_company_users;
create policy tenant_isolation on corevia_company_users for all using (
  company_id = coalesce((select company_id from corevia_saas_users where user_id = auth.uid() limit 1), company_id)
);

-- Apply standard tenant filter policies to remaining framework tables
do $$
declare
  t text;
begin
  for t in array['corevia_profile', 'corevia_products', 'corevia_inventory_basic', 'corevia_inventory_sub', 'corevia_inventory_return', 'corevia_stock_movements', 'corevia_orders', 'corevia_suppliers', 'corevia_expenses', 'corevia_workers', 'corevia_salary_sheets', 'corevia_employee_submissions', 'corevia_chat_messages', 'corevia_activity_logs']
  loop
    execute format('drop policy if exists tenant_isolation_policy on %I;', t);
    execute format('create policy tenant_isolation_policy on %I for all using (
      company_id = coalesce(
        (select company_id from corevia_saas_users where user_id = auth.uid() limit 1),
        (select company_id from corevia_company_users where id = auth.uid() limit 1),
        company_id
      )
    );', t);
  end loop;
end;
$$;

-- --- DATABASE-FIRST SECURITY-CRITICAL PROCEDURAL FUNCTIONS ---

-- 1. Database-First Payroll Calculator RPC Function
create or replace function calculate_worker_payroll_v1(
  p_base_salary numeric,
  p_working_days_count numeric,
  p_absence_days_count numeric,
  p_overtime_hours_count numeric,
  p_daily_working_hours numeric,
  p_overtime_multiplier numeric,
  p_deductions_amount numeric,
  p_bonuses_amount numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_daily_base_rate numeric;
  v_hourly_overtime_rate numeric;
  v_overtime_pay numeric;
  v_absence_deduction numeric;
  v_net_salary numeric;
begin
  v_daily_base_rate := round((p_base_salary / coalesce(p_working_days_count, 22)), 4);
  v_hourly_overtime_rate := round(((p_base_salary / (coalesce(p_working_days_count, 22) * coalesce(p_daily_working_hours, 8))) * coalesce(p_overtime_multiplier, 1.5)), 4);
  v_overtime_pay := round((coalesce(p_overtime_hours_count, 0) * v_hourly_overtime_rate), 2);
  v_absence_deduction := round((coalesce(p_absence_days_count, 0) * v_daily_base_rate), 2);
  v_net_salary := round((p_base_salary + v_overtime_pay - v_absence_deduction - coalesce(p_deductions_amount, 0) + coalesce(p_bonuses_amount, 0)), 2);
  if v_net_salary < 0 then
    v_net_salary := 0;
  end if;
  return json_build_object(
    'daily_base_rate', v_daily_base_rate,
    'hourly_overtime_rate', v_hourly_overtime_rate,
    'overtime_pay', v_overtime_pay,
    'absence_deduction', v_absence_deduction,
    'net_salary', v_net_salary
  );
end;
$$;

-- 2. Subscription User Seats Verification RPC Function
create or replace function check_seat_limit_v1(p_company_id text)
returns json
language plpgsql
security definer
as $$
declare
  v_limit integer;
  v_used integer;
  v_allowed boolean;
begin
  select coalesce(seatsLimit, 5) into v_limit from corevia_companies where id = p_company_id;
  if v_limit is null then
    v_limit := 5;
  end if;
  select count(*)::integer into v_used from corevia_company_users where company_id = p_company_id and (deleted_at is null);
  v_used := v_used + 1; -- 1 Owner seat allocation
  if v_used >= v_limit then
    v_allowed := false;
  else
    v_allowed := true;
  end if;
  return json_build_object(
    'limit', v_limit,
    'used', v_used,
    'allowed', v_allowed
  );
end;
$$;

-- 3. Transacted Atomic Inventory & Stock Movements Process triggers
create or replace function process_inventory_and_logs_v1(
  p_company_id text,
  p_order_id text,
  p_product_name text,
  p_color text,
  p_size text,
  p_qty_change numeric,
  p_movement_type text,
  p_source text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Insert auditable movement record
  insert into corevia_stock_movements(id, company_id, order_id, product_name, color, size, quantity_change, movement_type, source)
  values ('mv-' || floor(random() * 10000000)::text, p_company_id, p_order_id, p_product_name, p_color, p_size, p_qty_change, p_movement_type, p_source);
  
  -- Update primary sub inventory
  if p_size is not null and p_size <> '' then
    insert into corevia_inventory_sub(id, company_id, product_id, product_name, color, size, quantity)
    values ('sub-' || floor(random() * 10000000)::text, p_company_id, 'p-' || p_product_name, p_product_name, p_color, p_size, p_qty_change)
    on conflict (id) do update set quantity = corevia_inventory_sub.quantity + p_qty_change;
  end if;

  -- Update basic inventory
  insert into corevia_inventory_basic(id, company_id, product_id, product_name, color, quantity)
  values ('bsc-' || floor(random() * 10000000)::text, p_company_id, 'p-' || p_product_name, p_product_name, p_color, p_qty_change)
  on conflict (id) do update set quantity = corevia_inventory_basic.quantity + p_qty_change;
end;
$$;`;

    navigator.clipboard.writeText(rawSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
    onTriggerNotification(lang === "ar" ? "✅ تم نسخ سكريبت SQL للحافظة!" : "✅ SQL Script copied to clipboard!");
  };

  // Sub-tabs active page indicator
  const [activePage, setActivePage] = useState<"company" | "control" | "integrations" | "users">("company");

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultString = reader.result as string;
        setBLogoUrl(resultString);
        onTriggerNotification(
          lang === "ar"
            ? "تم تحميل الشعار بنجاح! يرجى الضغط على زر تطبيق وحفظ التعديلات في الأسفل لاعتماد التغييرات."
            : "Logo chargé avec succès ! Veuillez cliquer sur le bouton de sauvegarde pour appliquer."
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // Localization Dictionary
  const localT = {
    ar: {
      desc: "تهيئة الهوية الميدانية، كلمات المرور، وربط السجلات التجارية",
      formHeader: "📂 إعدادات هوية ومكتب العلامة التجارية",
      labelBName: "اسم الشركة / المتجر الرئيسي *",
      labelBEmail: "البريد الإلكتروني المعتمد *",
      labelBPhone: "هاتف التواصل",
      labelBCurrency: "العملة الافتراضية للتقارير",
      labelBRegistry: "السجل التجاري أو الرقم الضريبي",
      securitySection: "شفرة المرور وحماية علامات التبويب المقيدة",
      passcodeDesc: "الرقم السري PIN المستخدم لحظر الدخول الغير مصرح به للتاب والملفات المالية أو الأجور للعمال (4 أرقام عددية).",
      btnSave: "تطبيق وحفظ التعديلات البنائية",
      colorsHeader: "لوحة الألوان المدعومة للملابس",
      colorsLabel: "أضف خيارات ألوان جديدة لتظهر مباشرة عند بناء مواصفات الملابس والموديلات:",
      colorPlaceholder: "مثال: أحمر فاقع (Bright Red)...",
      passcodePlaceholder: "1234",
    },
    fr: {
      desc: "Spécifications de la firme, mot de passe et registre commercial",
      formHeader: "📂 Identité d'entreprise & Espace de travail",
      labelBName: "Nom de l'entreprise / Boutique principale *",
      labelBEmail: "Adresse e-mail agréée *",
      labelBPhone: "Téléphone de contact",
      labelBCurrency: "Devise par défaut pour les rapports",
      labelBRegistry: "Registre de Commerce ou R.C. / ID Fiscal",
      securitySection: "Code d'accès & Restrictions des onglets financiers",
      passcodeDesc: "Le code PIN est requis pour restreindre l'accès non autorisé aux onglets financiers ou salaires (4 chiffres).",
      btnSave: "Appliquer et sauvegarder",
      colorsHeader: "Palettes de couleurs de vêtements",
      colorsLabel: "Ajoutez de nouvelles options de couleurs pour vos spécifications :",
      colorPlaceholder: "Ex: Rouge vif (Bright Red)...",
      passcodePlaceholder: "1234",
    },
    en: {
      desc: "Manage profile, passwords, and commercial registry details",
      formHeader: "📂 Business Identity & Workspace Settings",
      labelBName: "Business Name / Main Store *",
      labelBEmail: "Authorized Email *",
      labelBPhone: "Contact Phone",
      labelBCurrency: "Default Reporting Currency",
      labelBRegistry: "Commercial Registry / Tax ID",
      securitySection: "Passcode Shield & Tab Restrictions",
      passcodeDesc: "The PIN code restricts unauthorized access to protected financial sheets and payroll listings (4 digits).",
      btnSave: "Apply & Save Configurations",
      colorsHeader: "Supported Apparel Colors Palette",
      colorsLabel: "Define new color options to populate cloth/model forms instantly:",
      colorPlaceholder: "e.g., Bright Red...",
      passcodePlaceholder: "1234",
    }
  };

  const currentT = localT[lang] || localT.en;

  const handleUpdateBrandSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim()) return;

    const modified: BusinessProfile = {
      ...profile,
      businessName: bName,
      email: bEmail,
      phone: bPhone,
      currency: bCurrency,
      country: bCountry,
      commercialRegistry: bRegistry,
      passcode,
      address: bAddress,
      rc1: bRC1,
      rc2: bRC2,
      nif: bNIF,
      logoUrl: bLogoUrl
    };

    onSaveProfile(modified);
    onTriggerNotification(
      lang === "ar"
        ? "تم حفظ وتحديث الإعدادات المؤسسية بنجاح."
        : lang === "fr"
        ? "Paramètres de l'entreprise enregistrés avec succès."
        : "Workspace settings saved successfully."
    );
  };

  const handleAddNewColorOption = () => {
    if (!newColorEntry.trim()) return;
    if (customColorsList.some(x => x.toLowerCase() === newColorEntry.trim().toLowerCase())) {
      onTriggerNotification(
        lang === "ar"
          ? "هذا اللون مسجل مسبقاً في الدليل الإنشائي."
          : lang === "fr"
          ? "Cette couleur est déjà enregistrée."
          : "This color is already registered."
      );
      return;
    }

    const updated = [...customColorsList, newColorEntry.trim()];
    onSaveCustomColors(updated);
    onTriggerNotification(
      lang === "ar"
        ? `تمت إضافة اللون الجديد (${newColorEntry}) لقائمة التحديد.`
        : lang === "fr"
        ? `Nouvelle couleur (${newColorEntry}) ajoutée.`
        : `New color (${newColorEntry}) added.`
    );
    setNewColorEntry("");
  };

  const handleRemoveColorOption = (colorText: string) => {
    const updated = customColorsList.filter(c => c !== colorText);
    onSaveCustomColors(updated);
  };

  const tabNames = {
    ar: {
      company: "💼 إعدادات الشركة",
      control: "🎮 التحكم في المنصة",
      integrations: "🚀 التكاملات"
    },
    fr: {
      company: "💼 Établissement",
      control: "🎮 Contrôle Plateforme",
      integrations: "🚀 Intégrations"
    },
    en: {
      company: "💼 Company Profile",
      control: "🎮 Platform Control",
      integrations: "🚀 Integrations"
    }
  };
  const activeTabsText = tabNames[lang] || tabNames.en;

  return (
    <div className="space-y-4 pt-16 md:pt-4 text-right" id="settings_panel_view">
      
      {/* Visual branding header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#27272a] pb-3 ${isRtl ? "text-right" : "text-left"}`} id="settings_branding">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-1.5 justify-end">
            <span>{t.navSettings}</span>
            <span>⚙️</span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-0.5">{currentT.desc}</p>
        </div>
      </div>

      {/* Modern Sub-Navigation tabs */}
      <div 
        className="flex border-b border-[#27272a] gap-2 mb-4 scrollbar-none overflow-x-auto" 
        id="settings_sub_tabs"
        style={{ direction: isRtl ? "rtl" : "ltr" }}
      >
        <button
          onClick={() => setActivePage("company")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activePage === "company"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          {activeTabsText.company}
        </button>
        <button
          onClick={() => setActivePage("control")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activePage === "control"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          {activeTabsText.control}
        </button>
        <button
          onClick={() => setActivePage("integrations")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activePage === "integrations"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          {activeTabsText.integrations}
        </button>
        <button
          onClick={() => setActivePage("users")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activePage === "users"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-slate-450 hover:text-slate-200"
          }`}
        >
          {lang === "ar" ? "👥 المستخدمين والصلاحيات" : "👥 Users & Permissions"}
        </button>
      </div>

      {/* Tab 1: Company Profile Configuration */}
      {activePage === "company" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 bounce-in" id="settings_structural_grid_company_tab">
          
          {/* SECTION 1: CORE BRAND METADATA & LOCK CODE */}
          <div className={`lg:col-span-2 bg-[#09090b] p-4 rounded-xl border border-[#27272a] space-y-3.5 ${isRtl ? "text-right" : "text-left"}`} id="brand_metadata_settings_form_wrapper">
            <h2 className="text-xs font-bold text-white border-b border-[#27272a] pb-2">{currentT.formHeader}</h2>

            <form onSubmit={handleUpdateBrandSettings} className="space-y-3.5 text-xs font-sans">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Business Name */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBName}</label>
                  <input
                    type="text"
                    required
                    value={bName}
                    onChange={(e) => setBName(e.target.value)}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBEmail}</label>
                  <input
                    type="email"
                    required
                    value={bEmail}
                    onChange={(e) => setBEmail(e.target.value)}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 font-mono text-xs ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Phone */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBPhone}</label>
                  <input
                    type="text"
                    value={bPhone}
                    onChange={(e) => setBPhone(e.target.value)}
                    placeholder="+213 550 12 34 56"
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none placeholder-slate-500 font-mono text-xs ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">
                    {lang === "ar" ? "بلد النشاط أو المقر" : lang === "fr" ? "Pays d'activité" : "Country of operation"}
                  </label>
                  <select
                    value={bCountry}
                    onChange={(e) => {
                      const selected = e.target.value as "Algeria" | "France" | "Morocco" | "Other";
                      setBCountry(selected);
                      if (selected === "Algeria") setBCurrency("DZD");
                      else if (selected === "France") setBCurrency("EUR");
                    }}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none font-semibold text-xs ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <option value="Algeria" className="bg-[#09090b]">{lang === "ar" ? "الجزائر 🇩🇿" : lang === "fr" ? "Algérie" : "Algeria"}</option>
                    <option value="France" className="bg-[#09090b]">{lang === "ar" ? "فرنسا 🇫🇷" : lang === "fr" ? "France" : "France"}</option>
                    <option value="Morocco" className="bg-[#09090b]">{lang === "ar" ? "المغرب 🇲🇦" : lang === "fr" ? "Maroc" : "Morocco"}</option>
                    <option value="Other" className="bg-[#09090b]">{lang === "ar" ? "أخرى 🌐" : lang === "fr" ? "Autre/Global" : "Other/Global"}</option>
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBCurrency}</label>
                  <select
                    value={bCurrency}
                    onChange={(e) => setBCurrency(e.target.value)}
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none font-semibold text-xs ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <option value="DZD" className="bg-[#09090b]">DZD (الدينار الجزائري)</option>
                    <option value="USD" className="bg-[#09090b]">USD (الدولار الأمريكي)</option>
                    <option value="EUR" className="bg-[#09090b]">EUR (اليورو الأوروبي)</option>
                  </select>
                </div>

                {/* Fiscal Registry */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">{currentT.labelBRegistry}</label>
                  <input
                    type="text"
                    value={bRegistry}
                    onChange={(e) => setBRegistry(e.target.value)}
                    placeholder="16/00-0982736B20"
                    className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-[#27272a] placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  />
                </div>
              </div>

              {/* SECTION: COMPANY INFORMATION (معلومات الشركة) */}
              <div className="p-3 bg-[#040406]/50 rounded-lg border border-[#27272a] space-y-2.5">
                <span className={`text-[10px] font-bold text-slate-450 uppercase tracking-widest block border-b border-[#27272a]/80 pb-1.5 flex items-center gap-1 ${isRtl ? "justify-end flex-row-reverse" : "justify-start flex-row"}`}>
                  <span>🏢 معلومات السجل والشركة (بيانات الفاتورة والتقارير)</span>
                </span>

                {/* Company Logo Upload Block */}
                <div className="p-3 bg-[#0d0d11]/80 rounded-lg border border-[#27272a] flex flex-col sm:flex-row items-center gap-3.5" style={{ direction: isRtl ? "rtl" : "ltr" }}>
                  <div className="w-16 h-16 rounded-lg bg-[#040406] border border-[#27272a] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {bLogoUrl ? (
                      <img src={bLogoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-[10px] text-slate-500 font-mono uppercase font-bold text-center">No Logo</div>
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-right" style={{ textAlign: isRtl ? "right" : "left" }}>
                    <span className="block text-slate-200 font-bold text-[11px] mb-1">شعار الشركة (Company Logo Setting)</span>
                    <p className="text-[10px] text-slate-400 mb-2">أضف شعار الشركة ليظهر تلقائياً في فواتير نظام ERP الخاص بك.</p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start" style={{ flexDirection: isRtl ? "row" : "row-reverse", justifyContent: isRtl ? "flex-start" : "flex-end" }}>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-slate-200 rounded-lg cursor-pointer text-[10px] font-bold transition-all">
                        <Upload className="w-3.5 h-3.5 text-rose-500" />
                        <span>{bLogoUrl ? "تغيير الشعار" : "تحميل شعار جديد"}</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      {bLogoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setBLogoUrl(undefined);
                            onTriggerNotification(lang === "ar" ? "تمت إزالة الشعار مؤقتاً. اضغط تطبيق وحفظ لاعتماده." : "Logo supprimé. Enregistrez pour appliquer.");
                          }}
                          className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-350 border border-rose-900/50 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          إزالة الشعار
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Company Phone */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">رقم هاتف الشركة (TEL) *</label>
                    <input
                      type="text"
                      required
                      value={bPhone}
                      onChange={(e) => setBPhone(e.target.value)}
                      placeholder="+213 550 12 34 56"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 font-mono text-xs placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* Company Address */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">مقر الشركة (العنوان الرسمي) *</label>
                    <input
                      type="text"
                      required
                      value={bAddress}
                      onChange={(e) => setBAddress(e.target.value)}
                      placeholder="Didouche Mourad, Alger"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg focus:outline-none focus:border-rose-500 text-xs placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* RC 1 */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">السجل التجاري (RC)</label>
                    <input
                      type="text"
                      value={bRC1}
                      onChange={(e) => setBRC1(e.target.value)}
                      placeholder="16/00-0987654B20"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* RC 2 */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">رقم التعريف الإحصائي (NIS)</label>
                    <input
                      type="text"
                      value={bRC2}
                      onChange={(e) => setBRC2(e.target.value)}
                      placeholder="20B0987654"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>

                  {/* NIF */}
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 text-[10.5px]">الرقم التعريفي الجبائي (NIF)</label>
                    <input
                      type="text"
                      value={bNIF}
                      onChange={(e) => setBNIF(e.target.value)}
                      placeholder="002016098765432"
                      className={`w-full bg-[#09090b] border border-[#27272a] p-1.8 text-white rounded-lg font-mono text-xs focus:outline-none focus:border-rose-500 placeholder-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PIN PASSCODE SECURITY */}
              <div className="p-3 bg-[#040406]/50 rounded-lg border border-[#27272a] space-y-2.5">
                <span className={`text-[10px] font-bold text-slate-450 uppercase tracking-widest block border-b border-[#27272a]/80 pb-1.5 flex items-center gap-1 ${isRtl ? "justify-end flex-row-reverse" : "justify-start flex-row"}`}>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>{currentT.securitySection}</span>
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3box">
                  <div className="relative">
                    <input
                      type={showPasscodeVal ? "text" : "password"}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-lg p-1.8 text-center font-mono text-base text-white tracking-widest focus:outline-none focus:border-rose-500"
                      placeholder={currentT.passcodePlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscodeVal(!showPasscodeVal)}
                      className={`absolute ${isRtl ? "left-3" : "right-3"} top-2.5 text-slate-450 font-bold text-[9px] hover:text-white cursor-pointer`}
                    >
                      {showPasscodeVal ? (lang === "ar" ? "إخفاء" : lang === "fr" ? "Cacher" : "Hide") : (lang === "ar" ? "إظهار" : lang === "fr" ? "Montrer" : "Show")}
                    </button>
                  </div>

                  <div className={`flex flex-col justify-center text-slate-400 text-[9.5px] ${isRtl ? "text-right" : "text-left"}`}>
                    <p>{currentT.passcodeDesc}</p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className={`pt-2 border-t border-[#27272a] flex ${isRtl ? "justify-end" : "justify-start"}`}>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-550 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md focus:outline-none cursor-pointer"
                >
                  {currentT.btnSave}
                </button>
              </div>

            </form>
          </div>

          {/* SECTION 2: CUSTOM COLORS PALETTES LIST */}
          <div className={`bg-[#09090b] p-4 rounded-xl border border-[#27272a] space-y-3 ${isRtl ? "text-right" : "text-left"}`} id="colors_custom_palette_console">
            <h3 className={`text-xs font-bold text-white flex items-center gap-1.5 border-b border-[#27272a] pb-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <Paintbrush className="w-3.5 h-3.5 text-rose-500" />
              <span>{currentT.colorsHeader}</span>
            </h3>

            <p className="text-[10px] text-slate-400 leading-normal">{currentT.colorsLabel}</p>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={newColorEntry}
                onChange={(e) => setNewColorEntry(e.target.value)}
                placeholder={currentT.colorPlaceholder}
                className={`w-full bg-[#040406] border border-[#27272a] p-1.8 text-white text-xs rounded-lg focus:outline-none focus:border-rose-500 ${isRtl ? "text-right" : "text-left"}`}
              />
              <button
                onClick={handleAddNewColorOption}
                className="bg-[#27272a] hover:bg-[#3f3f46] text-white p-2 rounded-lg text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className={`flex flex-wrap gap-1.5 pt-1.5 ${isRtl ? "justify-start sm:justify-end flex-row-reverse" : "justify-start flex-row"}`} id="custom_colors_index">
              {customColorsList.map((col, idx) => (
                <span key={idx} className={`bg-[#040406] border border-[#27272a] text-[9.5px] py-0.5 px-2 rounded font-medium text-slate-350 flex items-center gap-1 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                  <span>{col}</span>
                  <button
                    onClick={() => handleRemoveColorOption(col)}
                    className="text-rose-450 hover:text-rose-400 font-bold text-xs cursor-pointer ml-1"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Supabase Relational Database Integration & Synchronization Console */}
      {activePage === "control" && (
        <div className="space-y-6 bounce-in text-right" id="supabase_connector_console">
          
          {/* Main Status Header Card */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isSupabaseConfigured ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                }`}>
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {isRtl ? "ربط قاعدة بيانات Supabase (PostgreSQL)" : "Supabase PostgreSQL Database Connector"}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {isRtl 
                      ? "إدارة الدخول، وحفظ الطلبيات، والمخزن، والعمال في سحابة مؤمنة."
                      : "Cloud-hosted relational replication for orders, warehouse stocks and active staff."}
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div>
                {isSupabaseConfigured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full text-[10px] font-black">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isRtl ? "متصل كودياً بالسحابة" : "Connected in code"}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/25 rounded-full text-[10px] font-black animate-pulse">
                    <CloudLightning className="w-3.5 h-3.5" />
                    <span>{isRtl ? "غير متصل (يعمل محلياً)" : "Disconnected (Local Sandbox)"}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Instruction block based on configure status */}
            {!isSupabaseConfigured ? (
              <div className="space-y-4">
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-xs text-zinc-350 leading-relaxed text-right space-y-2">
                  <p className="font-bold text-white flex items-center gap-1.5 justify-end">
                    <span>{isRtl ? "مطلوب إعداد مفاتيح البيئة (Environment Variables)" : "Environment Keys Required!"}</span>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  </p>
                  <p>
                    {isRtl 
                      ? "لتفعيل الدخول السحابي وحسابات الأدمن الحقيقية والمزامنة عبر Vercel أو الخادم المحلي، يرجى تسجيل الدخول في Supabase.com وإنشاء مشروع جديد، ثم إضافة المتغيرات التالية في الإعدادات الخاصة بموقعك:"
                      : "To enable live cloud admin accounts, login sessions and multi-device persistence in Vercel or locally, please register at Supabase.com, create a project, and add these environmental variables:"}
                  </p>
                  <div className="bg-[#040406]/85 p-3 rounded-lg border border-zinc-800 font-mono text-[10px] text-left text-zinc-400 space-y-1" dir="ltr">
                    <div>VITE_SUPABASE_URL=<span className="text-zinc-500">_YOUR_SUPABASE_PROJECT_URL_</span></div>
                    <div>VITE_SUPABASE_ANON_KEY=<span className="text-zinc-500">_YOUR_SUPABASE_ANON_PUBLIC_KEY_</span></div>
                  </div>
                </div>

                <div className="text-zinc-400 text-xs">
                  {isRtl 
                    ? "💡 بمجرد وضع هذه المتغيرات في لوحة تحكم Vercel أو ملف .env محلياً، سيقوم الموقع تلقائياً بالتحويل من التخزين المحلي المؤقت (LocalStorage) إلى السحاب اللامتناهي للطلبيات والمخازن!"
                    : "💡 Once configured on Vercel or locally inside your environment variables, Corevia ERP will seamlessly upgrade from local Web storage to persistent Postgres Cloud Synchronization!"}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs text-zinc-350 leading-relaxed space-y-2">
                  <p className="font-black text-white flex items-center gap-1.5 justify-end">
                    <span>{isRtl ? "سحابة المزامنة نشطة! 🚀" : "Cloud Connection is Enabled! 🚀"}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </p>
                  <p>
                    {isRtl 
                      ? "لقد قمنا بتثبيت مكتبة Supabase JS بنجاح. يمكنك الآن اختبار الاتصال المباشر وقراءة/كتابة البيانات السحابية، ورفع النسخ المحلية الاحتياطية وتنزيلها من السحاب فورياً."
                      : "Your application is successfully linked to your PostgreSQL database. You can test your connection, upload current local browser database backups, and recover data anytime."}
                  </p>
                </div>

                {/* Operations Panel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* Test Connection Button */}
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="bg-[#18181b] hover:bg-zinc-800 border border-zinc-800 text-zinc-100 hover:text-white rounded-xl p-3 text-xs font-bold flex flex-col items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-55"
                  >
                    <RefreshCw className={`w-5 h-5 text-indigo-400 ${isTestingConnection ? "animate-spin" : ""}`} />
                    <span>{isRtl ? "فحص و اختبار الاتصال" : "Test Live Connection"}</span>
                  </button>

                  {/* Push Backup Data (Local to Cloud) */}
                  <button
                    onClick={handlePushToSupabase}
                    disabled={isSyncingToSupabase}
                    className="bg-[#18181b] hover:bg-zinc-850 border border-emerald-500/15 text-emerald-400 hover:text-emerald-300 rounded-xl p-3 text-xs font-bold flex flex-col items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-55"
                  >
                    <Upload className="w-5 h-5 text-emerald-500" />
                    <span>{isRtl ? "رفع النسخة المحلية الاحتياطية ☁️" : "Push Browser Backup to Cloud ☁️"}</span>
                  </button>

                  {/* Pull Local Data (Cloud to Local) */}
                  <button
                    onClick={handlePullFromSupabase}
                    disabled={isPullingFromSupabase}
                    className="bg-[#18181b] hover:bg-zinc-850 border border-indigo-500/15 text-indigo-400 hover:text-indigo-350 rounded-xl p-3 text-xs font-bold flex flex-col items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-55"
                  >
                    <Download className="w-5 h-5 text-indigo-400" />
                    <span>{isRtl ? "جلب وتنزيل قاعدة البيانات" : "Pull Data from Supabase"}</span>
                  </button>

                </div>

                {/* DB Test Result Output */}
                {dbTestResult && (
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 font-mono text-[10.5px] text-zinc-400 text-left space-y-1" dir="ltr">
                    <span className="text-zinc-500">DATABASE_DIAGNOSTICS_PAYLOAD:</span>
                    <pre className="overflow-x-auto whitespace-pre-wrap mt-1 text-zinc-200">
                      {dbTestResult === "CONNECTED_BUT_NO_TABLES" && (
                        "🟢 Connection verified! But table structures are missing. Run SQL script below to provision standard schema."
                      )}
                      {dbTestResult === "FULLY_CONNECTED" && (
                        "🟢 Verified active link! Corevia ERP PostgreSQL schema tables are online and fully queried."
                      )}
                      {dbTestResult === "CONNECTED_AND_SYNCED" && (
                        "✅ Succeeded: Packaged profile properties, orders, products, suppliers, salary and expenses uploaded successfully!"
                      )}
                      {dbTestResult === "CONNECTED_AND_PULLED" && (
                        "✅ Succeeded: Overwritten browser cache and retrieved latest cloud schema datasets."
                      )}
                      {!["CONNECTED_BUT_NO_TABLES", "FULLY_CONNECTED", "CONNECTED_AND_SYNCED", "CONNECTED_AND_PULLED"].includes(dbTestResult) && dbTestResult}
                    </pre>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* COPY SCRIPT SQL ACCORDION CARD */}
          <div className="bg-[#121214] border border-[#27272a] rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-white">
                  {isRtl ? "سكريبت تهيئة وجداول SQL أولية للبث" : "Supabase PostgreSQL Provisioning SQL Script"}
                </h4>
              </div>
              <button
                onClick={() => setShowSqlSchema(!showSqlSchema)}
                className="text-xs font-extrabold text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 px-3 py-1 bg-zinc-900 rounded-lg cursor-pointer"
              >
                {showSqlSchema ? (isRtl ? "إخفاء الكود ✕" : "Hide Script ✕") : (isRtl ? "عرض السكريبت 📄" : "Show Script 📄")}
              </button>
            </div>

            <p className="text-xs text-zinc-450 leading-relaxed">
              💡 {isRtl 
                ? "لتهيئة الجداول وتجنيب المشروع أخطاء الاتصال، فقط انسخ هذا الكريبت المجمع، واذهب إلى لوحة تحكم Supabase > SQL Editor > اضغط على New Query والصق السكريبت واضغط على RUN لتثبيته في ثانية واحدة!"
                : "To easily initialize Postgres tables for Corevia ERP, copy this optimized structure, and navigate to your Supabase Dashboard > SQL Editor > Paste and click RUN!"}
            </p>

            {showSqlSchema && (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    onClick={copySqlSchemaText}
                    className="flex items-center gap-1 text-[10px] uppercase font-black tracking-wider bg-emerald-500/15 border border-emerald-500/25 hover:bg-emerald-550/20 text-emerald-400 px-3 py-1.5 rounded-lg active:scale-95 transition cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? (isRtl ? "تم النسخ!" : "COPIED!") : (isRtl ? "نسخ الكود بالكامل" : "COPY SCRIPT")}</span>
                  </button>
                </div>
                
                <div className="relative rounded-xl overflow-hidden border border-zinc-850 bg-zinc-950 max-h-72 overflow-y-auto" dir="ltr">
                  <pre className="p-4 text-[10px] text-zinc-300 font-mono text-left whitespace-pre select-all">
{`-- Corevia Enterprise Database SQL Schema & Security Hardening
-- Paste this script into your Supabase SQL Editor and run it in 1 click!

-- 0. Tenant Companies and Users (Visual View)
create table if not exists corevia_companies (
  id text primary key,
  name text not null,
  business_type text,
  owner_name text,
  phone text,
  email text,
  seatsLimit integer default 5,
  accountStatus text default 'Active',
  subscriptionPlan text default 'Standard_Monthly',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Saas Users (Visual View)
create table if not exists corevia_saas_users (
  user_id text primary key,
  company_id text references corevia_companies(id) on delete set null,
  email text not null,
  username text,
  has_completed_onboarding boolean default false,
  role text default 'admin',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_company_users (
  id text primary key,
  company_id text default 'cop_default',
  full_name text not null,
  phone text not null,
  email text,
  username text,
  job_title text,
  password text,
  assigned_responsibilities text,
  allowed_pages jsonb default '[]'::jsonb,
  status text default 'Active',
  last_activity text,
  auth_user_id text,
  invitation_token text,
  invitation_expires text,
  invitation_used boolean default false,
  deleted_at timestamp with time zone default null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 1. Business Profile
create table if not exists corevia_profile (
  id text primary key,
  company_id text default null,
  business_name text not null,
  business_type text,
  currency text default 'DZD',
  country text default 'Algeria',
  owner_name text,
  phone text,
  email text,
  address text,
  website text,
  commercial_registry text,
  tax_number text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Products and Inventory
create table if not exists corevia_products (
  id text primary key,
  company_id text default 'cop_default',
  name text not null,
  wholesale_cost_price numeric not null,
  wholesale_percentage numeric,
  wholesale_price numeric not null,
  retail_cost_price numeric not null,
  retail_percentage numeric,
  retail_price numeric not null,
  colors jsonb default '[]'::jsonb,
  sizes text[] default '{}'::text[],
  created_at text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

create table if not exists corevia_inventory_basic (
  id text primary key,
  company_id text default 'cop_default',
  product_id text not null,
  product_name text not null,
  color text,
  quantity numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_inventory_sub (
  id text primary key,
  company_id text default 'cop_default',
  product_id text not null,
  product_name text not null,
  color text,
  size text,
  quantity numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_inventory_return (
  id text primary key,
  company_id text default 'cop_default',
  order_id text not null,
  product_name text not null,
  color text,
  size text,
  quantity numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists corevia_stock_movements (
  id text primary key,
  company_id text default 'cop_default',
  date timestamp with time zone default timezone('utc'::text, now()),
  order_id text,
  product_name text,
  color text,
  size text,
  quantity_change numeric,
  movement_type text,
  source text
);

-- 3. Corevia Orders
create table if not exists corevia_orders (
  id text primary key,
  company_id text default 'cop_default',
  date text not null,
  customer_name text not null,
  phone text not null,
  wilaya text,
  commune text,
  delivery_location text,
  delivery_company text,
  delivery_type text,
  delivery_price numeric default 0,
  items jsonb default '[]'::jsonb,
  total_price numeric not null,
  paid_amount numeric default 0,
  discount numeric default 0,
  customer_pays_delivery boolean default true,
  is_exchange boolean default false,
  exchange_order_ref text,
  agent_name text,
  source text,
  status text default 'pending',
  return_cost numeric,
  return_date text,
  notes text,
  deleted_at text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

-- 4. Supplier Pipeline
create table if not exists corevia_suppliers (
  id text primary key,
  company_id text default 'cop_default',
  name text not null,
  phone text,
  address text,
  email text,
  created_at text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

-- 5. Business Expenses
create table if not exists corevia_expenses (
  id text primary key,
  company_id text default 'cop_default',
  type text not null,
  name text,
  amount numeric,
  date text,
  month_year text,
  platform text,
  amount_usd numeric,
  exchange_rate numeric,
  amount_currency numeric,
  start_date text,
  end_date text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

-- 6. Payroll & Workers
create table if not exists corevia_workers (
  id text primary key,
  company_id text default 'cop_default',
  name text not null,
  code text,
  phone text,
  base_salary numeric,
  daily_hours numeric,
  overtime_rate numeric,
  role text,
  monthly_salary numeric,
  payrolls jsonb default '[]'::jsonb,
  created_at text,
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

create table if not exists corevia_salary_sheets (
  id text primary key,
  company_id text default 'cop_default',
  worker_id text not null,
  worker_name text,
  month_year text,
  date_from text,
  date_to text,
  overtime_hours numeric,
  absence_days numeric,
  missing_hours numeric,
  paid_vacation_days numeric,
  expenses jsonb default '[]'::jsonb,
  pay_status text,
  calculated_salary jsonb,
  updated_at text,
  created_by text,
  updated_by text,
  created_date text,
  created_time text,
  updated_date text,
  updated_time text
);

create table if not exists corevia_employee_submissions (
  id text primary key,
  company_id text default 'cop_default',
  employee_id text not null,
  employee_name text not null,
  type text not null,
  amount numeric not null,
  description text,
  date text not null,
  status text default 'pending',
  created_at text
);

-- 7. Realtime Chat Messages
create table if not exists corevia_chat_messages (
  id text primary key,
  company_id text default 'cop_default',
  sender_id text not null,
  sender_name text not null,
  sender_job_title text,
  content text,
  voice_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. Enterprise Core Activity logs audit trail
create table if not exists corevia_activity_logs (
  id text primary key,
  company_id text default 'cop_default',
  actor_name text not null,
  actor_role text,
  operation text not null,
  item_type text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  browser_details text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- --- SAAS MULTI-TENANT ISOLATION POLICIES (RLS SECURITY) ---
alter table corevia_companies enable row level security;
alter table corevia_saas_users enable row level security;
alter table corevia_company_users enable row level security;
alter table corevia_profile enable row level security;
alter table corevia_products enable row level security;
alter table corevia_inventory_basic enable row level security;
alter table corevia_inventory_sub enable row level security;
alter table corevia_inventory_return enable row level security;
alter table corevia_stock_movements enable row level security;
alter table corevia_orders enable row level security;
alter table corevia_suppliers enable row level security;
alter table corevia_expenses enable row level security;
alter table corevia_workers enable row level security;
alter table corevia_salary_sheets enable row level security;
alter table corevia_employee_submissions enable row level security;
alter table corevia_chat_messages enable row level security;
alter table corevia_activity_logs enable row level security;

-- Define a policy helper query concept (Secure claim lookup)
drop policy if exists tenant_isolation on corevia_companies;
create policy tenant_isolation on corevia_companies for all using (
  id = coalesce((select company_id from corevia_saas_users where user_id = auth.uid() limit 1), id)
);

drop policy if exists tenant_isolation on corevia_saas_users;
create policy tenant_isolation on corevia_saas_users for all using (
  auth.uid() is null or user_id = auth.uid()
);

drop policy if exists tenant_isolation on corevia_company_users;
create policy tenant_isolation on corevia_company_users for all using (
  company_id = coalesce((select company_id from corevia_saas_users where user_id = auth.uid() limit 1), company_id)
);

-- Apply standard tenant filter policies to remaining framework tables
do $$
declare
  t text;
begin
  for t in array['corevia_profile', 'corevia_products', 'corevia_inventory_basic', 'corevia_inventory_sub', 'corevia_inventory_return', 'corevia_stock_movements', 'corevia_orders', 'corevia_suppliers', 'corevia_expenses', 'corevia_workers', 'corevia_salary_sheets', 'corevia_employee_submissions', 'corevia_chat_messages', 'corevia_activity_logs']
  loop
    execute format('drop policy if exists tenant_isolation_policy on %I;', t);
    execute format('create policy tenant_isolation_policy on %I for all using (
      company_id = coalesce(
        (select company_id from corevia_saas_users where user_id = auth.uid() limit 1),
        (select company_id from corevia_company_users where id = auth.uid() limit 1),
        company_id
      )
    );', t);
  end loop;
end;
$$;

-- --- DATABASE-FIRST SECURITY-CRITICAL PROCEDURAL FUNCTIONS ---

-- 1. Database-First Payroll Calculator RPC Function
create or replace function calculate_worker_payroll_v1(
  p_base_salary numeric,
  p_working_days_count numeric,
  p_absence_days_count numeric,
  p_overtime_hours_count numeric,
  p_daily_working_hours numeric,
  p_overtime_multiplier numeric,
  p_deductions_amount numeric,
  p_bonuses_amount numeric
)
returns json
language plpgsql
security definer
as $$
declare
  v_daily_base_rate numeric;
  v_hourly_overtime_rate numeric;
  v_overtime_pay numeric;
  v_absence_deduction numeric;
  v_net_salary numeric;
begin
  v_daily_base_rate := round((p_base_salary / coalesce(p_working_days_count, 22)), 4);
  v_hourly_overtime_rate := round(((p_base_salary / (coalesce(p_working_days_count, 22) * coalesce(p_daily_working_hours, 8))) * coalesce(p_overtime_multiplier, 1.5)), 4);
  v_overtime_pay := round((coalesce(p_overtime_hours_count, 0) * v_hourly_overtime_rate), 2);
  v_absence_deduction := round((coalesce(p_absence_days_count, 0) * v_daily_base_rate), 2);
  v_net_salary := round((p_base_salary + v_overtime_pay - v_absence_deduction - coalesce(p_deductions_amount, 0) + coalesce(p_bonuses_amount, 0)), 2);
  if v_net_salary < 0 then
    v_net_salary := 0;
  end if;
  return json_build_object(
    'daily_base_rate', v_daily_base_rate,
    'hourly_overtime_rate', v_hourly_overtime_rate,
    'overtime_pay', v_overtime_pay,
    'absence_deduction', v_absence_deduction,
    'net_salary', v_net_salary
  );
end;
$$;

-- 2. Subscription User Seats Verification RPC Function
create or replace function check_seat_limit_v1(p_company_id text)
returns json
language plpgsql
security definer
as $$
declare
  v_limit integer;
  v_used integer;
  v_allowed boolean;
begin
  select coalesce(seatsLimit, 5) into v_limit from corevia_companies where id = p_company_id;
  if v_limit is null then
    v_limit := 5;
  end if;
  select count(*)::integer into v_used from corevia_company_users where company_id = p_company_id and (deleted_at is null);
  v_used := v_used + 1; -- 1 Owner seat allocation
  if v_used >= v_limit then
    v_allowed := false;
  else
    v_allowed := true;
  end if;
  return json_build_object(
    'limit', v_limit,
    'used', v_used,
    'allowed', v_allowed
  );
end;
$$;

-- 3. Transacted Atomic Inventory & Stock Movements Process triggers
create or replace function process_inventory_and_logs_v1(
  p_company_id text,
  p_order_id text,
  p_product_name text,
  p_color text,
  p_size text,
  p_qty_change numeric,
  p_movement_type text,
  p_source text
)
returns void
language plpgsql
security definer
as $$
begin
  -- Insert auditable movement record
  insert into corevia_stock_movements(id, company_id, order_id, product_name, color, size, quantity_change, movement_type, source)
  values ('mv-' || floor(random() * 10000000)::text, p_company_id, p_order_id, p_product_name, p_color, p_size, p_qty_change, p_movement_type, p_source);
  
  -- Update primary sub inventory
  if p_size is not null and p_size <> '' then
    insert into corevia_inventory_sub(id, company_id, product_id, product_name, color, size, quantity)
    values ('sub-' || floor(random() * 10000000)::text, p_company_id, 'p-' || p_product_name, p_product_name, p_color, p_size, p_qty_change)
    on conflict (id) do update set quantity = corevia_inventory_sub.quantity + p_qty_change;
  end if;

  -- Update basic inventory
  insert into corevia_inventory_basic(id, company_id, product_id, product_name, color, quantity)
  values ('bsc-' || floor(random() * 10000000)::text, p_company_id, 'p-' || p_product_name, p_product_name, p_color, p_qty_change)
  on conflict (id) do update set quantity = corevia_inventory_basic.quantity + p_qty_change;
end;
$$;`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Workspace integrations & Pipelines */}
      {activePage === "integrations" && (
        <div className="space-y-5 bounce-in" id="settings_integrations_page_viewport">
          
          <div className={`p-4 bg-[#09090b] rounded-xl border border-[#27272a] ${isRtl ? "text-right" : "text-left"}`}>
            <h3 className="text-xs font-bold text-white mb-2">⭐ {isRtl ? "مزامنة Google Sheets الحية" : "Live Google Sheets Connector Pipeline"}</h3>
            <p className="text-[10px] text-zinc-400 mb-4 leading-relaxed">
              {isRtl 
                ? "قم بربط حساب Google الخاص بك لبث وتحديث جميع طلبيات الكوريفيا والمنتجات في مستندات Google Sheets فوراً ومزامنة المبيعات وحركات المخزون الثنائية بشكل حي وتلقائي."
                : "Bind your secure Google Account profile to stream, record and map order details live inside Google Sheets spreadsheets automatically."}
            </p>
          </div>

          <SheetsSyncSettings 
            lang={lang} 
            onTriggerNotification={onTriggerNotification} 
            onTriggerRefreshOrders={onTriggerRefreshOrders} 
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Yalidine Express integration placeholder */}
            <div className="p-4 bg-zinc-900/10 border border-[#27272a] rounded-xl text-right space-y-2 opacity-65">
              <div className="flex items-center justify-between border-b border-[#27272a]/60 pb-2">
                <span className="text-[9px] bg-rose-550/15 text-rose-400 px-2 py-0.5 rounded font-bold border border-rose-500/20">{isRtl ? "قريباً جداً" : "Soon"}</span>
                <h4 className="text-xs font-bold text-white">Yalidine Express يالدين</h4>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                مزامنة تلقائية للطلبيات مع منصة يالدين، استخراج وتحديث أرقام التتبع وبطاقات الشحن بضغطة زر واحدة.
              </p>
            </div>

            {/* SMS Gateway integration placeholder */}
            <div className="p-4 bg-zinc-900/10 border border-[#27272a] rounded-xl text-right space-y-2 opacity-65">
              <div className="flex items-center justify-between border-b border-[#27272a]/60 pb-2">
                <span className="text-[9px] bg-rose-550/15 text-rose-400 px-2 py-0.5 rounded font-bold border border-rose-500/20">{isRtl ? "قريباً جداً" : "Soon"}</span>
                <h4 className="text-xs font-bold text-white">بوابة الرسائل SMS Gateway</h4>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                إرسال رسائل تأكيد نصية تلقائية للعملاء وتنبيهات بمواعيد تسليم الطرود والدفع عند الاستلام.
              </p>
            </div>

            {/* Algérie Poste integration placeholder */}
            <div className="p-4 bg-zinc-900/10 border border-[#27272a] rounded-xl text-right space-y-2 opacity-65">
              <div className="flex items-center justify-between border-b border-[#27272a]/60 pb-2">
                <span className="text-[9px] bg-rose-550/15 text-rose-400 px-2 py-0.5 rounded font-bold border border-rose-500/20">{isRtl ? "قريباً جداً" : "Soon"}</span>
                <h4 className="text-xs font-bold text-white">بريد الجزائر (ECCP / ECC)</h4>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                متابعة الطرود البريدية، واستيراد تقارير الدفع وإشعارات استلام المبالغ المالية لحسابك الجاري ECC.
              </p>
            </div>
          </div>
        </div>
      )}

      {activePage === "users" && (
        <div className="bounce-in">
          <UsersPermissionsView
            lang={lang}
            session={session}
            onTriggerNotification={onTriggerNotification}
            seatsLimit={seatsLimit}
          />
        </div>
      )}

    </div>
  );
}
