/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LanguageType = "ar" | "fr" | "en";
export type ThemeType = "light" | "dark";

export interface BusinessProfile {
  businessName: string;
  businessType: string;
  experienceYears: string;
  logoUrl?: string;
  estimatedOrders: string;
  estimatedWorkers: string;
  currency: "DZD" | "USD" | "EUR";
  defaultLanguage: LanguageType;
  preferredTheme: ThemeType;
  country?: "Algeria" | "France" | "Morocco" | "Other";
  
  // Custom Invoice/Corporate Details
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  commercialRegistry?: string;
  taxNumber?: string;
  passcode?: string;
  rc1?: string;
  rc2?: string;
  nif?: string;
}

export interface UserSession {
  username: string;
  email: string;
  isRegistered: boolean;
  isApproved: boolean;
  isSuspended: boolean;
  user_id?: string;
  company_id?: string;
  role?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  productCost: number; // DZD/Selected Currency
  sellingPrice: number; // DZD/Selected Currency
}

export interface Order {
  id: string; // Auto numeric
  date: string;
  customerName: string;
  phone: string;
  wilaya: string;
  commune: string;
  deliveryLocation: string; // Desk, Home, etc.
  deliveryCompany: string;
  deliveryType: string; // Desk / Stop / Home
  deliveryPrice: number;
  items: OrderItem[];
  totalPrice: number; // Σ (sellingPrice * qty)
  paidAmount: number;
  discount: number;
  customerPaysDelivery: boolean;
  isExchange: boolean;
  exchangeOrderRef?: string;
  agentName: string;
  source: "1" | "2" | "3"; // 1: Basic, 2: Sub, 3: Return
  status: "pending" | "shipping" | "delivered" | "returned";
  returnCost?: number;
  returnDate?: string;
  notes?: string;
  deletedAt?: string;
}

export interface ProductColorQuantity {
  color: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  wholesaleCostPrice: number;
  wholesalePercentage: number;
  wholesalePrice: number;
  retailCostPrice: number;
  retailPercentage: number;
  retailPrice: number;
  colors: ProductColorQuantity[];
  sizes: string[]; // e.g., ["S", "M", "L", "XL"]
  createdAt: string;
}

export interface BasicInventoryItem {
  productId: string;
  productName: string;
  color: string;
  quantity: number;
}

export interface SubInventoryItem {
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
}

export interface ReturnInventoryItem {
  orderId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  createdAt: string;
}

export interface SupplierPurchaseItem {
  id: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  costPrice: number;
  wholesalePercentage: number;
  retailPercentage: number;
  sellingPrice: number;
  targetTable: "1" | "2"; // 1: Basic, 2: Sub
}

export interface InvoicePayment {
  id: string;
  date: string;
  amount: number;
}

export interface SupplierInvoice {
  id: string; // Auto numeric
  date: string;
  supplierId: string;
  supplierName: string;
  items: SupplierPurchaseItem[];
  totalAmount: number; // Σ (costPrice * quantity)
  payments: InvoicePayment[];
  createdAt: string;
  updatedAt?: string;
}

export interface WorkerExpense {
  id: string;
  desc: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface WorkerPayrollPayment {
  id: string;
  payPeriod: string;
  datePaid: string;
  baseSalary: number;
  overtimeHours: number;
  overtimeEarned: number;
  bonus: number;
  absenceDays: number;
  absenceDeductions: number;
  cashAdvances: number;
  otherDeductions: number;
  netSalary: number;
  released: boolean;
  notes?: string;
}

export interface Worker {
  id: string;
  name: string;
  code: string;
  phone: string;
  baseSalary: number;
  dailyHours: number;
  overtimeRate: number; // default: 2 (double)
  role: string;
  monthlySalary: number;
  payrolls: WorkerPayrollPayment[];
  createdAt: string;
}

export interface WorkerSalarySheet {
  id: string;
  workerId: string;
  workerName: string;
  monthYear: string; // YYYY-MM
  dateFrom: string;
  dateTo: string;
  overtimeHours: number;
  absenceDays: number;
  missingHours: number;
  paidVacationDays: number;
  expenses: WorkerExpense[];
  payStatus: "paid" | "unpaid";
  calculatedSalary: {
    baseSalary: number;
    dailyRate: number;
    hourlyRate: number;
    overtimePay: number;
    absenceDeduction: number;
    expensesDeduction: number;
    netSalary: number;
  };
  updatedAt: string;
}

export interface Expense {
  id: string;
  title: string;
  type: "fixed" | "variable" | "ads";
  amount: number;
  date: string;
  isUSD?: boolean;
  usdAmount?: number;
  exchangeRate?: number;
  notes?: string;
  createdAt: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  date: string;
}

export interface VariableExpense {
  id: string;
  name: string;
  amount: number;
  date: string;
  monthYear: string; // YYYY-MM
}

export interface AdExpense {
  id: string;
  platform: "Facebook" | "Google" | "TikTok" | "Snapchat" | "Other";
  amountUSD: number;
  exchangeRate: number; // DZD per USD
  amountCurrency: number; // DZD equivalent
  startDate: string;
  endDate: string;
  monthYear: string; // YYYY-MM
}

export interface TrashItem {
  id: string;
  itemId: string;
  type: "order" | "invoice" | "worker" | "product";
  title: string;
  deletedAt: string;
  originalData: any; // Entire JSON of entity to restore
}

export interface StockMovement {
  id: string;
  date: string;
  orderId: string;
  productName: string;
  color: string;
  size: string;
  quantityChange: number; // e.g., -2 or +2
  movementType: "New Order" | "Order Update" | "Order Delete" | "Return" | "Manual Adjustment";
  source: string; // e.g., "Basic", "Sub", "Return", "Google Sheets Sync"
}

export interface AppSettings {
  passcode: string; // passcode to protect sensitive screens
  isPasscodeEnabled: boolean;
  colors: string[]; // customizable product colors
  wilayasList: string[]; // Algerian wilayas
}

export interface ActiveDevice {
  id: string;
  browser: string;
  os: string;
  activityType: string;
  lastActive: string;
}

export interface SaaSCompany {
  id: string;
  companyName: string;
  ownerName: string;
  email: string;
  phone: string;
  country: string;
  registrationDate: string;
  lastLogin: string;
  emailVerified: boolean;
  subscriptionPlan: "Free" | "Basic" | "Pro" | "Enterprise";
  seatsLimit: number;
  seatsUsed: number;
  accountStatus: "Pending Verification" | "Active" | "Read Only" | "Suspended" | "Disabled";
  expirationDate: string;
  activeDevices: ActiveDevice[];
  twoFactorEnabled?: boolean;
  otpCode?: string;
}

export interface SaaSActivityLog {
  id: string;
  timestamp: string;
  companyName: string;
  email: string;
  operation: string;
  details: string;
  ipAddress: string;
}

export interface SuperAdminConfig {
  twoFactorGlobalState: boolean;
  failedLoginAttemptsCount: number;
  ipTrackingEnabled: boolean;
}

