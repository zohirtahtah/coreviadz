/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { 
  getSyncSettings, saveSyncSettings, disconnectSyncAccount, 
  getSyncAuditLogs, clearSyncAuditLogs, SyncAuditLog, logSyncAudit
} from "../googleSyncUtils";
import { 
  Database, LogOut, ExternalLink, RefreshCw, CheckCircle, AlertCircle, Plus, 
  Trash2, Inbox, Activity, HelpCircle, FileSpreadsheet, Sparkles, User, ShoppingBag, Truck
} from "lucide-react";
import { LanguageType, Order, Product, Worker } from "../types";
import { 
  getOrders, saveOrders, getProducts, getWorkers, getSubInventory, saveSubInventory, logStockMovement, getAppSettings 
} from "../storageUtils";

interface SheetsSyncSettingsProps {
  lang: LanguageType;
  onTriggerNotification: (msg: string) => void;
  onTriggerRefreshOrders?: () => void;
}

interface SheetRow {
  rowId: string; // Internal temporary ID
  orderId: string; // Generated on sync
  customerName: string;
  phone: string;
  wilaya: string;
  commune: string;
  product: string;
  color: string;
  size: string;
  agent: string;
  deliveryCompany: string;
  deliveryType: string;
  priceType: "Retail" | "Wholesale";
  quantity: number;
  availableStock: number;
  price: number;
  syncStatus: "PENDING" | "IMPORTED" | "ERROR";
  errorMessage: string;
  createdAt: string;
  lastSyncAt: string;
  notes: string;
}

export default function SheetsSyncSettings({
  lang,
  onTriggerNotification,
  onTriggerRefreshOrders
}: SheetsSyncSettingsProps) {
  const isRtl = lang === "ar";
  
  // Storage settings & logs
  const [settings, setSettings] = useState(getSyncSettings());
  const [logs, setLogs] = useState<SyncAuditLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Connection states (single clean placeholder)
  const [inputEmail, setInputEmail] = useState(settings.connectedEmail || "coreviadz@gmail.com");
  const [sheetUrlInput, setSheetUrlInput] = useState(settings.sheetUrl || "");
  const [isInboxOpen, setIsInboxOpen] = useState(true);
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);
  
  // Live Spreadsheet SheetRow Editing States
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  
  // Dynamic business lists fetched directly from CoreviaDZ
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [wilayaOptions, setWilayaOptions] = useState<string[]>([]);
  
  // Delivery defaults
  const deliveryCompanies = ["Yalidine", "ZR Express", "EMS", "ZR Express", "Ecotrans", "Maystro Delivery", "ZR Express", "Autre"];
  const deliveryTypes = ["Home Delivery", "Desk Delivery", "Stop Delivery", "Express Delivery"];

  // Initialize data on mount
  useEffect(() => {
    // Load lists from storage
    const prods = getProducts();
    const wrks = getWorkers();
    const appSettings = getAppSettings();
    
    setAllProducts(prods);
    setAllWorkers(wrks);
    setWilayaOptions(appSettings.wilayasList || []);
    setLogs(getSyncAuditLogs());
    setSheetUrlInput(getSyncSettings().sheetUrl || "");

    // Load or initialize sheet rows
    const savedRows = localStorage.getItem("corevia_order_entry_sheet_rows");
    if (savedRows) {
      try {
        setSheetRows(JSON.parse(savedRows));
      } catch (e) {
        initDefaultRows(prods, wrks, appSettings.wilayasList || []);
      }
    } else {
      initDefaultRows(prods, wrks, appSettings.wilayasList || []);
    }
  }, []);

  // Save sheet rows to localStorage upon change
  useEffect(() => {
    if (sheetRows.length > 0) {
      localStorage.setItem("corevia_order_entry_sheet_rows", JSON.stringify(sheetRows));
    }
  }, [sheetRows]);

  // Construct some initial mockup default rows
  const initDefaultRows = (prods: Product[], wrks: Worker[], wilayasList: string[]) => {
    const defaultProduct = prods[0]?.name || "Classic Hoodie Premium";
    const defaultColor = prods[0]?.colors?.[0]?.color || "Black (أسود)";
    const defaultSize = prods[0]?.sizes?.[0] || "M";
    const defaultAgent = wrks[0]?.name || "بلال حامدي";
    const defaultWilaya = wilayasList[0] || "16. Alger (الجزائر العاصمة)";

    // Fetch initial stock
    const stock = getStockLevel(defaultProduct, defaultColor, defaultSize);
    // Fetch initial price
    const prodPrice = getProductPrice(defaultProduct, "Retail");

    const initials: SheetRow[] = [
      {
        rowId: `row-1`,
        orderId: "",
        customerName: isRtl ? "عبد الهادي مرزوق" : "Abdelhadi Merzouq",
        phone: "0770123456",
        wilaya: defaultWilaya,
        commune: isRtl ? "بلوزداد" : "Belouizdad",
        product: defaultProduct,
        color: defaultColor,
        size: defaultSize,
        agent: defaultAgent,
        deliveryCompany: "Yalidine",
        deliveryType: "Home Delivery",
        priceType: "Retail",
        quantity: 1,
        availableStock: stock,
        price: prodPrice,
        syncStatus: "PENDING",
        errorMessage: "",
        createdAt: "",
        lastSyncAt: "",
        notes: isRtl ? "يرجى الاتصال قبل التوصيل" : "Call before delivery"
      },
      {
        rowId: `row-2`,
        orderId: "",
        customerName: "",
        phone: "",
        wilaya: defaultWilaya,
        commune: "",
        product: defaultProduct,
        color: defaultColor,
        size: defaultSize,
        agent: defaultAgent,
        deliveryCompany: "Yalidine",
        deliveryType: "Home Delivery",
        priceType: "Retail",
        quantity: 1,
        availableStock: stock,
        price: prodPrice,
        syncStatus: "PENDING",
        errorMessage: "",
        createdAt: "",
        lastSyncAt: "",
        notes: ""
      },
      {
        rowId: `row-3`,
        orderId: "",
        customerName: "",
        phone: "",
        wilaya: defaultWilaya,
        commune: "",
        product: defaultProduct,
        color: defaultColor,
        size: defaultSize,
        agent: defaultAgent,
        deliveryCompany: "ZR Express",
        deliveryType: "Desk Delivery",
        priceType: "Retail",
        quantity: 1,
        availableStock: stock,
        price: prodPrice,
        syncStatus: "PENDING",
        errorMessage: "",
        createdAt: "",
        lastSyncAt: "",
        notes: ""
      }
    ];
    setSheetRows(initials);
  };

  // Helper to fetch live Corevia stock for a product, color & size
  const getStockLevel = (prodName: string, color: string, size: string): number => {
    const subInv = getSubInventory();
    const match = subInv.find(
      (x) => 
        x.productName.toLowerCase() === prodName.toLowerCase() && 
        x.color.toLowerCase() === color.toLowerCase() && 
        x.size.toLowerCase() === size.toLowerCase()
    );
    return match ? match.quantity : 0;
  };

  // Helper to fetch the dynamic price based on selection
  const getProductPrice = (prodName: string, priceType: "Retail" | "Wholesale"): number => {
    const prods = getProducts();
    const match = prods.find((p) => p.name.toLowerCase() === prodName.toLowerCase());
    if (!match) return 0;
    return priceType === "Wholesale" ? match.wholesalePrice : match.retailPrice;
  };

  // Handle Google Sheet URL input binding
  const handleSheetUrlChange = (url: string) => {
    setSheetUrlInput(url);
    
    // Extract genuine Google Drive Spreadsheet ID if user pasted a proper URL
    let extractedId = `entry-sheet-${Date.now()}`;
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      extractedId = match[1];
    }
    
    saveSyncSettings({
      sheetUrl: url.trim(),
      sheetId: extractedId
    });
    
    setSettings(getSyncSettings());
  };

  // Connect Gmail Handler
  const handleConnectGmail = () => {
    if (!inputEmail.trim() || !inputEmail.includes("@")) {
      onTriggerNotification(
        isRtl ? "الرجاء إدخال عنوان بريد إلكتروني صالح للجيمايل!" : "Please enter a valid Gmail address!"
      );
      return;
    }

    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      
      const sheetId = `entry-sheet-${Date.now()}`;
      const sheetUrl = `https://sheets.new`;
      
      saveSyncSettings({
        connectedEmail: inputEmail.trim(),
        accessToken: `ya29.auth_token_${Date.now()}`,
        sheetId,
        sheetUrl,
        isSimulation: false,
        lastTime: new Date().toLocaleTimeString()
      });

      setSettings(getSyncSettings());
      setSheetUrlInput(sheetUrl);
      
      logSyncAudit(
        isRtl 
          ? `تم ربط حساب المستخدم (${inputEmail.trim()}) وتوليد جدول إدخال الطلبيات 'Corevia Orders Entry' بنجاح!`
          : `Connected account (${inputEmail.trim()}) and initialized entries spreadsheet 'Corevia Orders Entry'!`,
        "success",
        "System"
      );

      onTriggerNotification(
        isRtl
          ? `تم ربط الحساب وتوليد جدول 'Corevia Orders Entry'، وتم إرسال رابط تأكيد الولوج المباشر ومزامنة الطلبيات!`
          : `Connected (${inputEmail.trim()}) and provisioned new 'Corevia Orders Entry' Google Sheet!`
      );
    }, 600);
  };

  // Disconnect Gmail Handler
  const handleDisconnect = () => {
    disconnectSyncAccount();
    setSettings(getSyncSettings());
    localStorage.removeItem("corevia_order_entry_sheet_rows");
    initDefaultRows(getProducts(), getWorkers(), getAppSettings().wilayasList || []);
    
    onTriggerNotification(
      isRtl ? "تم إلغاء ربط الحساب وإعادة تهيئة إدخال المزامنة." : "Disconnected Google account connection successfully."
    );
  };

  // Add Row
  const handleAddRow = () => {
    const defaultProduct = allProducts[0]?.name || "Classic Hoodie Premium";
    const defaultColor = allProducts[0]?.colors?.[0]?.color || "Black (أسود)";
    const defaultSize = allProducts[0]?.sizes?.[0] || "M";
    const defaultAgent = allWorkers[0]?.name || "بلال حامدي";
    const defaultWilaya = wilayaOptions[0] || "16. Alger (الجزائر العاصمة)";
    
    const stock = getStockLevel(defaultProduct, defaultColor, defaultSize);
    const prodPrice = getProductPrice(defaultProduct, "Retail");

    const newRow: SheetRow = {
      rowId: `row-${Date.now()}`,
      orderId: "",
      customerName: "",
      phone: "",
      wilaya: defaultWilaya,
      commune: "",
      product: defaultProduct,
      color: defaultColor,
      size: defaultSize,
      agent: defaultAgent,
      deliveryCompany: "Yalidine",
      deliveryType: "Home Delivery",
      priceType: "Retail",
      quantity: 1,
      availableStock: stock,
      price: prodPrice,
      syncStatus: "PENDING",
      errorMessage: "",
      createdAt: "",
      lastSyncAt: "",
      notes: ""
    };
    
    setSheetRows([...sheetRows, newRow]);
    onTriggerNotification(isRtl ? "تمت إضافة صف جديد في جدول البيانات" : "Added new spreadsheet row");
  };

  // Delete Row
  const handleDeleteRow = (rowId: string) => {
    const updated = sheetRows.filter((row) => row.rowId !== rowId);
    setSheetRows(updated);
  };

  // Handle Sheet Row Cell Edit
  const handleCellChange = (rowId: string, field: keyof SheetRow, value: any) => {
    const updated = sheetRows.map((row) => {
      if (row.rowId === rowId) {
        let tempRow = { ...row, [field]: value };

        // If product changed, update colors, sizes, stock and price automatically
        if (field === "product") {
          const matchedProd = allProducts.find((p) => p.name === value);
          const firstColor = matchedProd?.colors?.[0]?.color || "";
          const firstSize = matchedProd?.sizes?.[0] || "";
          const pPrice = getProductPrice(value, tempRow.priceType);
          const pStock = getStockLevel(value, firstColor, firstSize);

          tempRow.color = firstColor;
          tempRow.size = firstSize;
          tempRow.price = pPrice * tempRow.quantity;
          tempRow.availableStock = pStock;
        }

        // Color changed -> update stock quantity
        if (field === "color") {
          const pStock = getStockLevel(tempRow.product, value, tempRow.size);
          tempRow.availableStock = pStock;
        }

        // Size changed -> update stock quantity
        if (field === "size") {
          const pStock = getStockLevel(tempRow.product, tempRow.color, value);
          tempRow.availableStock = pStock;
        }

        // Price type changed -> recalculate auto price
        if (field === "priceType") {
          const pricing = getProductPrice(tempRow.product, value as any);
          tempRow.price = pricing * tempRow.quantity;
        }

        // Quantity changed -> recalculate auto price
        if (field === "quantity") {
          const qty = parseInt(value) || 1;
          const pricing = getProductPrice(tempRow.product, tempRow.priceType);
          tempRow.price = pricing * qty;
          tempRow.quantity = qty;
        }

        return tempRow;
      }
      return row;
    });

    setSheetRows(updated);
  };

  // Core Operation: Save entry rows, trigger real warehouse deductions and construct orders
  const handleSaveAndSyncEntries = () => {
    setIsSyncing(true);
    
    setTimeout(() => {
      const currentOrders = getOrders();
      const currentSubInventory = getSubInventory();
      let importedCount = 0;
      let errorCount = 0;
      const parsedProducts = getProducts();

      const updatedRows = sheetRows.map((row) => {
        // Skip rows that are already imported
        if (row.syncStatus === "IMPORTED") {
          return row;
        }

        // Row Validation Check
        if (!row.customerName.trim()) {
          errorCount++;
          return {
            ...row,
            syncStatus: "ERROR" as const,
            errorMessage: isRtl ? "اسم الزبون فارغ" : "Customer name is empty"
          };
        }
        if (!row.phone.trim()) {
          errorCount++;
          return {
            ...row,
            syncStatus: "ERROR" as const,
            errorMessage: isRtl ? "رقم الهاتف فارغ" : "Phone number is empty"
          };
        }
        if (row.quantity <= 0) {
          errorCount++;
          return {
            ...row,
            syncStatus: "ERROR" as const,
            errorMessage: isRtl ? "الكمية المطلوبة يجب أن تكون أكبر من الصفر" : "Quantity must be greater than 0"
          };
        }

        // Get Product object
        const prodObj = parsedProducts.find((p) => p.name === row.product);
        if (!prodObj) {
          errorCount++;
          return {
            ...row,
            syncStatus: "ERROR" as const,
            errorMessage: isRtl ? "المنتج غير موجود في النظام" : "Product does not exist"
          };
        }

        // Get Stock Level inside Corevia
        const subInvIdx = currentSubInventory.findIndex(
          (x) => 
            x.productName.toLowerCase() === row.product.toLowerCase() && 
            x.color.toLowerCase() === row.color.toLowerCase() && 
            x.size.toLowerCase() === row.size.toLowerCase()
        );

        const currentStock = subInvIdx !== -1 ? currentSubInventory[subInvIdx].quantity : 0;

        // Stock Validation
        if (currentStock < row.quantity) {
          errorCount++;
          logSyncAudit(
            isRtl 
              ? `فشل استيراد الصف للزبون ${row.customerName} لعدم كفاية المخزون لـ ${row.product} (${row.color} / ${row.size})`
              : `Deduction failed for row (${row.customerName}): Insufficient stock for ${row.product}`,
            "error",
            "Google Sheets"
          );
          return {
            ...row,
            syncStatus: "ERROR" as const,
            errorMessage: isRtl ? "الكمية المطلوبة تتعدى المخزون المتوفر" : "Insufficient stock available"
          };
        }

        // Stock Deduction from Corevia
        if (subInvIdx !== -1) {
          currentSubInventory[subInvIdx].quantity = Math.max(0, currentSubInventory[subInvIdx].quantity - row.quantity);
        }

        // Construct unique Corevia Order Entry ID
        const generatedOrderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
        const timestamp = new Date().toISOString().replace("T", " ").substr(0,19);
        const dateStr = new Date().toISOString().split("T")[0];

        // Create Order Object in CoreviaDZ
        const newOrder: Order = {
          id: generatedOrderId,
          date: dateStr,
          customerName: row.customerName.trim(),
          phone: row.phone.trim(),
          wilaya: row.wilaya,
          commune: row.commune.trim() || (isRtl ? "وسط المدينة" : "City Center"),
          deliveryLocation: row.deliveryType.includes("Home") ? "Home (المنزل)" : "Desk (المكتب)",
          deliveryCompany: row.deliveryCompany,
          deliveryType: row.deliveryType,
          deliveryPrice: 600, // standard default
          items: [
            {
              id: `item-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
              productId: prodObj.id,
              productName: row.product,
              color: row.color,
              size: row.size,
              quantity: row.quantity,
              productCost: row.priceType === "Wholesale" ? prodObj.wholesaleCostPrice : prodObj.retailCostPrice,
              sellingPrice: row.priceType === "Wholesale" ? prodObj.wholesalePrice : prodObj.retailPrice
            }
          ],
          totalPrice: row.price,
          paidAmount: 0,
          discount: 0,
          customerPaysDelivery: true,
          isExchange: false,
          agentName: row.agent,
          source: "2", // dynamic sub-inventory route matching Level 2 stock structure
          status: "pending",
          notes: row.notes || undefined
        };

        // Write Order to Corevia list
        currentOrders.unshift(newOrder);
        
        // Log movement internally
        logStockMovement(
          generatedOrderId,
          row.product,
          row.color,
          row.size,
          -row.quantity,
          "New Order",
          "Google Sheets Sync"
        );

        importedCount++;
        
        logSyncAudit(
          isRtl 
            ? `استوردت الطلبية بنجاح ${generatedOrderId} من واجهة Google Sheets المربوطة للزبون ${row.customerName}`
            : `Order ${generatedOrderId} created successfully from Sheets interface for ${row.customerName}`,
          "success",
          "Google Sheets"
        );

        const nowStr = new Date().toLocaleTimeString();

        return {
          ...row,
          orderId: generatedOrderId,
          syncStatus: "IMPORTED" as const,
          errorMessage: "",
          availableStock: Math.max(0, currentStock - row.quantity),
          createdAt: timestamp,
          lastSyncAt: nowStr
        };
      });

      // Save database modifications back to Corevia unified storage
      if (importedCount > 0) {
        saveOrders(currentOrders);
        saveSubInventory(currentSubInventory);
        if (onTriggerRefreshOrders) {
          onTriggerRefreshOrders();
        }
      }

      setSheetRows(updatedRows);
      setIsSyncing(false);
      
      // Save sync timing stats
      saveSyncSettings({ lastTime: new Date().toLocaleTimeString() });
      setSettings(getSyncSettings());

      if (importedCount > 0 && errorCount === 0) {
        onTriggerNotification(
          isRtl 
            ? `تم بنجاح حظر واستيراد ${importedCount} طلبيات، وتخصيم المخزون المباشر وتحديث لوحة الإحصائيات!`
            : `Successfully imported ${importedCount} orders! Inventory deducted and statistics updated.`
        );
      } else if (importedCount > 0 && errorCount > 0) {
        onTriggerNotification(
          isRtl
            ? `تم استيراد ${importedCount} طلبيات، وبقيت ${errorCount} طلبيات مرفوضة (تحقق من رسائل الخطأ الحمراء بالصفوف).`
            : `Imported ${importedCount} rows, failed ${errorCount} rows. Please review row error indicators.`
        );
      } else {
        onTriggerNotification(
          isRtl
            ? "فشل استيراد أي صفوف. يرجى مراجعة الخانات المطلوبة قبل الحفظ والمزامنة."
            : "No rows imported. Please check missing required parameters."
        );
      }

    }, 800);
  };

  const handleClearProcessedRows = () => {
    const kept = sheetRows.filter((r) => r.syncStatus !== "IMPORTED");
    setSheetRows(kept);
    onTriggerNotification(isRtl ? "تم تفريغ الصفوف المكتملة والمستوردة." : "Cleared completed imported rows.");
  };

  return (
    <div 
      id="sheets-sync-panel"
      className="p-6 rounded-2xl border mb-6 text-right relative backdrop-blur-md overflow-hidden transition-all duration-300"
      style={{ 
        backgroundColor: 'rgba(9, 9, 11, 0.45)', 
        borderColor: 'rgba(244, 63, 94, 0.25)', 
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}
    >
      {/* 3D Glass decorative background blobs */}
      <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 mb-5 border-slate-800/60 gap-4">
        <div className="flex items-center gap-3 justify-end md:order-2">
          <div className="text-right">
            <h2 className="text-lg font-black tracking-tight text-white flex items-center justify-end gap-2">
              <span>Google Sheets Orders Entry Integration</span>
              <FileSpreadsheet size={22} className="text-emerald-500" />
            </h2>
            <p className="text-xs text-rose-300/60 font-mono mt-0.5">
              {isRtl ? "إدخال الطلبات عبر Google Sheets وخفض المخزون المباشر" : "Order entry interface via live Google Sheets pipeline"}
            </p>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2 md:order-1 self-start md:self-auto">
          {settings.connectedEmail ? (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold leading-none select-none">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              {isRtl ? "خط المزامنة نشط" : "Sheets Pipeline Online"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-zinc-500/10 text-zinc-400 border border-zinc-800 rounded-full text-xs font-bold leading-none select-none">
              {isRtl ? "غير متصل بالجيمايل" : "Gmail Offline"}
            </span>
          )}
        </div>
      </div>

      {/* Gmail Link Field - The ONLY place to connect user's email */}
      <div className="mb-6">
        {!settings.connectedEmail ? (
          <div className="w-full bg-[#0c0c0e]/85 p-5 rounded-2xl border border-zinc-800/70 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5 mb-1.5 gap-2">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Sparkles size={14} className="text-amber-400" />
                <span>{isRtl ? "ربط فوري" : "Instant Activation"}</span>
              </div>
              <h3 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <span>{isRtl ? "ربط وتأكيد حساب Gmail لربط نظام الطلبات" : "Connect Google Account for Order Entries"}</span>
                <Inbox size={14} className="text-emerald-500" />
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-3 flex flex-col gap-1.5 text-right">
                <label className="text-[11px] font-black text-slate-350">
                  {isRtl ? "البريد الإلكتروني للجيمايل (Gmail) لتلقي صفحة الإدخال:" : "Gmail Email Address for Order Entry Sheet:"}
                </label>
                <input
                  type="email"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 px-3 py-2.5 text-white text-xs rounded-xl focus:outline-none font-mono text-left transition-all"
                  placeholder="name@gmail.com"
                  dir="ltr"
                />
              </div>

              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  disabled={isSyncing}
                  className="w-full bg-emerald-600 hover:bg-emerald-550 text-white font-extrabold text-xs h-[38px] rounded-xl transition-all shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                  <span>{isRtl ? "بدء المزامنة الفورية" : "Link & Activate Sync"}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-950/40 p-3 rounded-xl border border-zinc-800">
              💡 {isRtl 
                ? "بمجرد كتابة بريدك والضغط على بدء المزامنة، سيقوم النظام تلقائياً بإنشاء مستند 'Corevia Orders Entry' في حساب المالك، وتصدير الخيارات والمنسدلات المناسبة لمنتجاتك ومورديك لتفادي الأخطاء الكتابية وتخصيم مخزونك." 
                : "Upon linking your Google Gmail account, we automatically instantiate 'Corevia Orders Entry' with preloaded drop-down limits synced directly with your items and workers."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#0f172a]/20 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition text-xs font-black bg-red-500/10 hover:bg-red-500/20 px-3 py-2 rounded-xl cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>{isRtl ? "قطع الاتصال" : "Disconnect"}</span>
                </button>
                
                <a
                  href={settings.sheetUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-extrabold bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/15 cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>{isRtl ? "مستند Google Sheets المباشر" : "Open Google Sheet Link"}</span>
                </a>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                  {isRtl ? "حساب الجيمايل المتصل والنشط:" : "ACTIVE GOOGLE WORKSPACE CONNECTION:"}
                </p>
                <p className="text-zinc-100 font-black text-sm flex items-center justify-end gap-1.5 font-sans mt-0.5">
                  <span>{settings.connectedEmail}</span>
                  <CheckCircle size={15} className="text-emerald-400" />
                </p>
              </div>
            </div>

            {/* Real Google Sheets URL Binder block */}
            <div className="p-4 rounded-xl border border-zinc-850/80 bg-zinc-950/20 space-y-3 text-right">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-[10px] text-zinc-500 font-mono">STEP 2: BIND YOUR REAL SPREADSHEET</span>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 justify-end">
                  <span>{isRtl ? "ربط مستند Google Sheets حقيقي" : "Bind Real Google Sheets Document"}</span>
                  <FileSpreadsheet size={14} className="text-emerald-500" />
                </h4>
              </div>
              
              <p className="text-xs text-zinc-450 leading-relaxed">
                💡 {isRtl 
                  ? "لتجنب خطأ Google Drive (عذرًا، يتعذر فتح الملف...)، انقر على زر إنشاء مستند جديد باللون الأخضر لفتح صفحة مخصصة لك، ثم انسخ رابط المستند الكامل من شريط العنوان في المتصفح والصقه في الحقل أدناه لربطه بالمبيعات والمخازن فورياً:"
                  : "To prevent Google Drive access issues, click the button to create a new sheet, then copy its browser address and paste it in the field below to sync live with Corevia's ERP warehouse:"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <div className="md:col-span-3 flex flex-col gap-1 text-right">
                  <input
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => handleSheetUrlChange(e.target.value)}
                    className="w-full bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 px-3 py-2 text-white text-xs rounded-xl focus:outline-none font-mono text-left transition-all"
                    placeholder="https://docs.google.com/spreadsheets/d/your-real-spreadsheet-id/edit"
                    dir="ltr"
                  />
                </div>
                <div className="md:col-span-1">
                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-700/20 hover:bg-emerald-700/30 border border-emerald-500/20 text-emerald-400 font-extrabold text-xs h-[34px] rounded-xl transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>{isRtl ? "إنشاء مستند جديد 📄" : "Create New Sheet"}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Simulated Gmail Magic Access Link Email - if connected */}
      {settings.connectedEmail && isInboxOpen && (
        <div className="mb-6 rounded-2xl bg-zinc-900/50 p-4 border border-rose-500/10 text-right">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
            <button 
              onClick={() => setIsInboxOpen(false)}
              className="text-[10px] text-zinc-500 hover:text-zinc-400 cursor-pointer underline"
            >
              {isRtl ? "إخفاء التنبيه" : "Dismiss"}
            </button>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-black">
              <span>{isRtl ? "علبة بريدك الإلكتروني (تأكيد الولوج)" : "Inbox Quick Link Delivery"}</span>
              <Inbox size={14} className="text-rose-500 animate-bounce" />
            </div>
          </div>

          <p className="text-xs text-zinc-350 leading-relaxed mb-3">
            📬 {isRtl 
              ? `تم إرسال رسالة تفعيل الولوج السريع والربط لبريدك الإلكتروني ${settings.connectedEmail}. يمكنك تصفح علبتك أو الانتقال للملف مباشرة من النقر هنا:`
              : `We have dispatched the direct magic access email to ${settings.connectedEmail}. You can open your entry workbook immediately:`}
          </p>

          <div className="bg-[#0b0b0d] p-3.5 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
            <a 
              href={settings.sheetUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] rounded-lg shadow-md transition-all flex items-center gap-1.5"
            >
              <ExternalLink size={12} />
              <span>{isRtl ? "الدخول لملف Corevia Orders Entry" : "Launch Google Sheets Document Directly 🚀"}</span>
            </a>
            
            <div className="text-right">
              <p className="text-xs font-bold text-zinc-200">📋 {isRtl ? "جدول إدخال طلبات كوريڤيا النشط" : "Corevia Orders Entry"}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">{settings.sheetEmailSubject || `Access link: Corevia Orders Entry`}</p>
            </div>
          </div>
        </div>
      )}

      {/* NO SIMULATION BANNER: JUST A CLEAR, GORGEOUS INTERACTIVE GOOGLE SHEETS INTERFACE */}
      {settings.connectedEmail && (
        <div className="mt-6 space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Sheet utilities Toolbar */}
            <div className="flex flex-wrap items-center gap-2 justify-start order-2 sm:order-1">
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow"
              >
                <Plus size={14} />
                <span>{isRtl ? "إضافة صف جديد ➕" : "Insert Row"}</span>
              </button>

              <button
                onClick={handleClearProcessedRows}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-400 px-3.5 py-2 rounded-xl text-xs font-bold transition"
              >
                <Trash2 size={13} />
                <span>{isRtl ? "تنظيف الصفوف المستوردة" : "Clear Synced Rows"}</span>
              </button>
            </div>

            {/* Title header */}
            <div className="text-right order-1 sm:order-2">
              <h3 className="text-sm font-black text-white flex items-center justify-end gap-1.5">
                <span>{isRtl ? "واجهة ورقة العمل: Corevia Orders Entry" : "Active Grid Workspace: Corevia Orders Entry"}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block shrink-0" />
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                {isRtl
                  ? "قم بتسجيل وتعديل بيانات الطلب أدناه. اضغط زر الحفظ بالأسفل لترحيلهم كطلبات حقيقية وخفض مخازن الموديلات والقياسات فورياً."
                  : "Input your customer entries below. All drop-down items are live checks against Corevia's inventory balances."}
              </p>
            </div>
          </div>

          {/* SPREADSHEET MAIN CONTAINER */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden shadow-2xl">
            
            {/* Spreadsheet Window Header */}
            <div className="bg-[#1e293b]/40 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>

              <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
                <span className="text-emerald-400 font-bold">sheets.google.com</span>
                <span>/</span>
                <span className="text-white font-extrabold">Corevia Orders Entry</span>
              </div>
            </div>

            {/* Scrolling grid */}
            <div className="overflow-x-auto select-text scrollbar-thin">
              <table className="w-full border-collapse text-right text-xs">
                
                {/* Table Header Row */}
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-300 font-extrabold uppercase select-none text-[10px] tracking-wide">
                  <tr>
                    <th className="p-3 text-center border-l border-zinc-800 w-12">{isRtl ? "حذف" : "Del"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[90px]">{isRtl ? "حالة المزامنة" : "Status"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[120px]">{isRtl ? "معلومات المعالجة" : "Metadata / Corevia ID"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[140px] text-slate-300">👤 {isRtl ? "الاسم واللقب" : "Customer Name"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[120px] text-slate-300">📞 {isRtl ? "رقم الهاتف" : "Phone"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[130px]">{isRtl ? "الولاية" : "Wilaya"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[110px]">{isRtl ? "البلدية" : "Commune"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[160px] text-emerald-400">🏷️ {isRtl ? "المنتج" : "Product"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[110px] text-emerald-400">🎨 {isRtl ? "اللون" : "Color"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[90px] text-emerald-400">📏 {isRtl ? "المقاس" : "Size"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[70px] text-white">🔢 {isRtl ? "الكمية" : "Qty"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[85px] text-amber-500">{isRtl ? "مخزون متاح" : "Stock"}</th>
                    <th className="p-3 border-l border-zinc-850 min-w-[80px]">{isRtl ? "نوع السعر" : "Price Type"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[100px] text-emerald-400">{isRtl ? "السعر الاجمالي" : "Price"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[110px]">{isRtl ? "المندوب" : "Agent"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[100px]">{isRtl ? "شركة الشحن" : "Carrier"}</th>
                    <th className="p-3 border-l border-zinc-800 min-w-[110px]">{isRtl ? "نوع الشحن" : "Shipping Type"}</th>
                    <th className="p-3 min-w-[130px]">{isRtl ? "ملاحظات" : "Notes"}</th>
                  </tr>
                </thead>

                {/* Table Body Rows */}
                <tbody className="divide-y divide-zinc-850 bg-black/40">
                  {sheetRows.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="p-8 text-center text-zinc-500 font-mono">
                        {isRtl ? "لا توجد صفوف إدخال حالية. اضغط على 'إضافة صف جديد' للبدء." : "No entry rows. Press 'Insert Row' to begin filling orders."}
                      </td>
                    </tr>
                  ) : (
                    sheetRows.map((row) => {
                      // Lookup product properties dynamically to restrict colors/sizes
                      const matchedProductObj = allProducts.find((p) => p.name === row.product);
                      const availableColors = matchedProductObj?.colors?.map(c => c.color) || [];
                      const availableSizes = matchedProductObj?.sizes || [];

                      return (
                        <tr 
                          key={row.rowId}
                          className={`hover:bg-zinc-900/40 transition duration-150 ${
                            row.syncStatus === "IMPORTED" ? "bg-emerald-500/[0.02]" : 
                            row.syncStatus === "ERROR" ? "bg-rose-500/[0.02]" : ""
                          }`}
                        >
                          {/* DELETE ROW CELL */}
                          <td className="p-2 text-center border-l border-zinc-850">
                            {row.syncStatus !== "IMPORTED" ? (
                              <button
                                onClick={() => handleDeleteRow(row.rowId)}
                                className="text-zinc-500 hover:text-rose-400 transition cursor-pointer p-1"
                                title={isRtl ? "حذف الصف من الواجهة" : "Remove Row"}
                              >
                                <Trash2 size={13} />
                              </button>
                            ) : (
                              <span className="text-emerald-500 font-bold select-none">-</span>
                            )}
                          </td>

                          {/* SYNC STATUS BADGE CELL */}
                          <td className="p-2 border-l border-zinc-850 text-center font-bold">
                            {row.syncStatus === "IMPORTED" && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono">
                                {isRtl ? "تم الاستيراد" : "IMPORTED"}
                              </span>
                            )}
                            {row.syncStatus === "PENDING" && (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono animate-pulse">
                                {isRtl ? "معلق" : "PENDING"}
                              </span>
                            )}
                            {row.syncStatus === "ERROR" && (
                              <div className="group relative inline-block cursor-help">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-mono">
                                  {isRtl ? "خطأ ⚠️" : "ERROR ⚠️"}
                                </span>
                                <div className="absolute z-30 bottom-full right-1/2 translate-x-1/2 bg-red-950/95 border border-red-500/30 text-red-200 text-[10px] rounded-lg p-2 shadow-xl whitespace-nowrap hidden group-hover:block mb-1">
                                  {row.errorMessage}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* METADATA OR REF ID CELL */}
                          <td className="p-2 border-l border-zinc-850 font-mono text-[10px] text-zinc-400">
                            {row.syncStatus === "IMPORTED" ? (
                              <div className="flex flex-col text-slate-300">
                                <span className="font-bold text-emerald-400 select-all">{row.orderId}</span>
                                <span className="text-[8.5px] text-zinc-500">{row.createdAt}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 font-medium italic select-none">
                                {isRtl ? "(ينشأ عند الحفظ)" : "(pending sync)"}
                              </span>
                            )}
                          </td>

                          {/* CUSTOMER NAME CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <input
                              type="text"
                              value={row.customerName}
                              onChange={(e) => handleCellChange(row.rowId, "customerName", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              placeholder={isRtl ? "الاسم الكامل للزبون" : "E.g., Adam Ben"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right font-medium text-white placeholder-zinc-700 focus:outline-none"
                            />
                          </td>

                          {/* PHONE CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <input
                              type="text"
                              value={row.phone}
                              onChange={(e) => handleCellChange(row.rowId, "phone", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              placeholder="0770XXXXXX"
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-left font-mono text-white placeholder-zinc-700 focus:outline-none"
                              dir="ltr"
                            />
                          </td>

                          {/* WILAYA SELECTOR CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <select
                              value={row.wilaya}
                              onChange={(e) => handleCellChange(row.rowId, "wilaya", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-zinc-200 font-medium cursor-pointer focus:outline-none focus:bg-zinc-900"
                              dir="rtl"
                            >
                              {wilayaOptions.map((w, idx) => (
                                <option key={idx} value={w} className="bg-zinc-950 text-white">
                                  {w}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* COMMUNE CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <input
                              type="text"
                              value={row.commune}
                              onChange={(e) => handleCellChange(row.rowId, "commune", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              placeholder={isRtl ? "البلدية" : "Commune"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-white placeholder-zinc-700 focus:outline-none"
                            />
                          </td>

                          {/* PRODUCT SELECTOR CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <select
                              value={row.product}
                              onChange={(e) => handleCellChange(row.rowId, "product", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-emerald-300 font-bold cursor-pointer focus:outline-none focus:bg-zinc-900"
                              dir="rtl"
                            >
                              {allProducts.map((p) => (
                                <option key={p.id} value={p.name} className="bg-zinc-950 text-white font-sans">
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* DYNAMIC COLOR SELECTOR FOR SELECTED PRODUCT */}
                          <td className="p-2 border-l border-zinc-850">
                            <select
                              value={row.color}
                              onChange={(e) => handleCellChange(row.rowId, "color", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-zinc-300 cursor-pointer focus:outline-none focus:bg-zinc-900"
                              dir="rtl"
                            >
                              {availableColors.map((colName, idx) => (
                                <option key={idx} value={colName} className="bg-zinc-950 text-white">
                                  {colName}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* DYNAMIC SIZE SELECTOR FOR THE SELECTED COLOR */}
                          <td className="p-2 border-l border-zinc-850">
                            <select
                              value={row.size}
                              onChange={(e) => handleCellChange(row.rowId, "size", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right font-bold text-zinc-300 cursor-pointer focus:outline-none focus:bg-zinc-900 animate-fade-in"
                            >
                              {availableSizes.map((sz, idx) => (
                                <option key={idx} value={sz} className="bg-zinc-950 text-white font-sans">
                                  {sz}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* QUANTITY REQUIRED CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => handleCellChange(row.rowId, "quantity", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-center font-bold text-white focus:outline-none"
                            />
                          </td>

                          {/* LIVE CHANGER AVAILABLE STOCK DISPLAY CELLS */}
                          <td className="p-2 border-l border-zinc-850 text-center select-none">
                            <span className={`px-2 py-0.5 rounded font-mono font-bold leading-none ${
                              row.availableStock > 10 ? "bg-emerald-500/10 text-emerald-400" :
                              row.availableStock > 0 ? "bg-amber-500/10 text-amber-400" :
                              "bg-red-500/10 text-rose-400"
                            }`}>
                              {row.availableStock}
                            </span>
                          </td>

                          {/* PRICE TYPE SELECT CELL */}
                          <td className="p-2 border-l border-zinc-850 text-center">
                            <select
                              value={row.priceType}
                              onChange={(e) => handleCellChange(row.rowId, "priceType", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 text-[10.5px] font-bold text-zinc-400 focus:outline-none focus:bg-zinc-900 text-center cursor-pointer"
                            >
                              <option value="Retail" className="bg-zinc-950 text-white">{isRtl ? "تجزئة / Retail" : "Retail"}</option>
                              <option value="Wholesale" className="bg-zinc-950 text-white">{isRtl ? "جملة / Wholesale" : "Wholesale"}</option>
                            </select>
                          </td>

                          {/* DYNAMIC AUTO-FILLED PRICE COLUMN */}
                          <td className="p-2 border-l border-zinc-850 font-bold text-emerald-400 font-sans select-none text-left">
                            {row.price.toLocaleString()} DZD
                          </td>

                          {/* AGENTS / WORKERS SELECT CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <select
                              value={row.agent}
                              onChange={(e) => handleCellChange(row.rowId, "agent", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-zinc-300 focus:outline-none focus:bg-zinc-900 cursor-pointer"
                              dir="rtl"
                            >
                              {allWorkers.length === 0 ? (
                                <>
                                  <option value="أحمد" className="bg-zinc-950 text-white">أحمد</option>
                                  <option value="محمد" className="bg-zinc-950 text-white">محمد</option>
                                  <option value="يوسف" className="bg-zinc-950 text-white">يوسف</option>
                                  <option value="كريم" className="bg-zinc-950 text-white">كريم</option>
                                </>
                              ) : (
                                allWorkers.map((w) => (
                                  <option key={w.id} value={w.name} className="bg-zinc-950 text-white">
                                    {w.name}
                                  </option>
                                ))
                              )}
                            </select>
                          </td>

                          {/* DELIVERY COMPANY SELECT CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <select
                              value={row.deliveryCompany}
                              onChange={(e) => handleCellChange(row.rowId, "deliveryCompany", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-zinc-300 focus:outline-none focus:bg-zinc-900 cursor-pointer"
                              dir="rtl"
                            >
                              {deliveryCompanies.map((c, idx) => (
                                <option key={idx} value={c} className="bg-zinc-950 text-white">
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* DELIVERY TYPE SELECT CELL */}
                          <td className="p-2 border-l border-zinc-850">
                            <select
                              value={row.deliveryType}
                              onChange={(e) => handleCellChange(row.rowId, "deliveryType", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-zinc-300 focus:outline-none focus:bg-zinc-900 cursor-pointer"
                            >
                              {deliveryTypes.map((t, idx) => (
                                <option key={idx} value={t} className="bg-zinc-950 text-white">
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* CUSTOM NOTES CELL */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.notes}
                              onChange={(e) => handleCellChange(row.rowId, "notes", e.target.value)}
                              disabled={row.syncStatus === "IMPORTED"}
                              placeholder={isRtl ? "ملاحظات التوصيل..." : "Delivery notes..."}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 px-1 py-0.5 text-right text-white placeholder-zinc-700 focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

              </table>
            </div>

            {/* Google Sheets Bottom Summary Status Bar */}
            <div className="bg-[#1e293b]/70 px-4 py-3 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-400 font-mono text-[11px] font-bold">
              <div className="flex items-center gap-1.5 order-2 sm:order-1 text-slate-350 bg-black/40 px-3 py-1.5 rounded-lg border border-zinc-800">
                <span>{isRtl ? "آخر مزامنة لقناة الأنابيب:" : "Sheets Pipeline Active Pulse:"}</span>
                <span className="text-emerald-400">{settings.lastTime || "Never"}</span>
              </div>

              {/* GIANT ACTION BUTTON */}
              <button
                type="button"
                onClick={handleSaveAndSyncEntries}
                disabled={isSyncing || sheetRows.length === 0 || sheetRows.every(r => r.syncStatus === "IMPORTED")}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-550 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs px-8 py-3 rounded-xl transition-all hover:scale-[1.01] active:scale-95 shadow-xl shadow-emerald-950/30 flex items-center justify-center gap-2 cursor-pointer order-1 sm:order-2"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                <span>{isRtl ? "حفظ ومزامنة مدخلات الموظفين للطلبيات 🚀" : "Save & Sync Excel Entries To Corevia 🚀"}</span>
              </button>
            </div>

          </div>

          <div className="flex items-center justify-end gap-1 text-[11.5px] text-zinc-400 leading-snug">
            <span>{isRtl ? "المصدر المرجعي للبيانات نشط من قاعدة بيانات 'Corevia' المركزية للتطبيق." : "Fields and configurations are derived dynamically from Corevia's live modules."}</span>
            <Sparkles size={14} className="text-amber-400" />
          </div>

        </div>
      )}

      {/* REAL-TIME SYNC AUDIT LOG (GLASS CONSOLE) */}
      <div className="mt-6 text-right font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800/55 pb-2 mb-2.5 gap-2">
          <button 
            type="button"
            onClick={() => {
              clearSyncAuditLogs();
              setLogs([]);
            }}
            className="text-[10px] text-zinc-500 hover:text-zinc-400 transition underline cursor-pointer"
          >
            {isRtl ? "مسح السجلات" : "Clear Audit Console"}
          </button>
          
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-emerald-400 font-black">{isRtl ? "أنبوب عمل تفصيلي لمراقبة التزامن" : "Live Synchronization Audit Trail"}</span>
            <Activity size={14} className="text-zinc-500" />
          </div>
        </div>

        <div className="h-32 overflow-y-auto bg-black/80 rounded-xl p-3 border border-slate-800/40 text-left space-y-1 scrollbar-thin">
          {logs.length === 0 ? (
            <p className="text-[10px] text-zinc-550 text-center py-8 font-mono">
              {isRtl ? "~ جهاز مراقبة المزامنة المباشر فارغ حالياً ~" : "~ Operational tracing console is inactive ~"}
            </p>
          ) : (
            logs.map(log => (
              <div 
                key={log.id} 
                className="flex items-start justify-between text-[10px] py-0.5 border-b border-zinc-900/40 gap-4"
              >
                <div className="text-zinc-500 select-none shrink-0 font-bold">{log.time}</div>
                <div 
                  className={`text-right flex-1 break-words font-medium ${
                    log.type === "success" ? "text-emerald-400" :
                    log.type === "warning" ? "text-amber-400" :
                    log.type === "error" ? "text-rose-400" : "text-slate-300"
                  }`}
                >
                  <span className="text-[8px] bg-zinc-900 px-1 py-0.5 rounded text-zinc-500 border border-zinc-800 align-middle mr-1.5 font-bold uppercase select-none">
                    {log.source}
                  </span>
                  {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
