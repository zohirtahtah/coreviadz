import React, { useState } from "react";
import { 
  Search, Building2, Users, ShoppingCart, Tag, Ticket, Activity, ChevronRight, CornerDownLeft
} from "lucide-react";
import { supabase } from "../../supabaseClient";

interface SearchTabProps {
  isRtl: boolean;
  onTriggerNotification: (msg: string, type: "success" | "info") => void;
  onSelectCompanyById: (companyId: string) => void;
}

export default function SearchTab({ isRtl, onTriggerNotification, onSelectCompanyById }: SearchTabProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{
    companies: any[];
    employees: any[];
    products: any[];
    orders: any[];
    tickets: any[];
  }>({
    companies: [],
    employees: [],
    products: [],
    orders: [],
    tickets: []
  });

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    try {
      const q = `%${query.trim().toLowerCase()}%`;

      // Perform parallel lightweight queries
      const [
        { data: cos },
        { data: emps },
        { data: prods },
        { data: ords },
        { data: tix }
      ] = await Promise.all([
        supabase.from("corevia_companies").select("*").or(`name.ilike.${q},owner_name.ilike.${q},email.ilike.${q},id.ilike.${q}`),
        supabase.from("corevia_company_users").select("*").or(`username.ilike.${q},email.ilike.${q}`),
        supabase.from("corevia_products").select("*").ilike("name", q),
        supabase.from("corevia_orders").select("*").or(`customer_name.ilike.${q},phone.ilike.${q}`),
        supabase.from("corevia_support_tickets").select("*").or(`subject.ilike.${q},message.ilike.${q}`).limit(20)
      ]);

      setResults({
        companies: cos || [],
        employees: emps || [],
        products: prods || [],
        orders: ords || [],
        tickets: tix || []
      });

      onTriggerNotification(isRtl ? "اكتمل البحث في جميع الكيانات!" : "Global index lookup completed!", "success");
    } catch (err: any) {
      console.error(err);
      onTriggerNotification(err.message, "info");
    } finally {
      setSearching(false);
    }
  };

  const totalHits = 
    results.companies.length + 
    results.employees.length + 
    results.products.length + 
    results.orders.length + 
    results.tickets.length;

  return (
    <div className="space-y-6" id="super_admin_global_search_tab">
      
      {/* Dynamic Search Box Input */}
      <form onSubmit={handleSearchSubmit} className="relative max-w-2xl mx-auto">
        <Search className="w-5 h-5 text-zinc-500 absolute top-3.5 right-4" />
        <input 
          type="text"
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isRtl ? "ابحث عن أي شيء (شركة، عميل، منتج، فاتورة، موظف، تذكرة دعم)..." : "Search across Companies, Employees, Products, Orders, Tickets..."}
          className="w-full p-3.5 pr-11 bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl placeholder-zinc-500 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all text-right"
        />
        <button 
          type="submit"
          disabled={searching}
          className="absolute left-2.5 top-2.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white font-extrabold text-xs rounded-lg shadow transition cursor-pointer active:scale-95 disabled:opacity-50"
        >
          {searching ? (isRtl ? "جاري..." : "Searching...") : (isRtl ? "ابحث" : "Search")}
        </button>
      </form>

      {/* Result Bento Categories */}
      {totalHits > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Companies Hits */}
          {results.companies.length > 0 && (
            <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black text-white flex items-center gap-2 justify-end">
                <span>{isRtl ? `الشركات المكتشفة (${results.companies.length})` : `Companies (${results.companies.length})`}</span>
                <Building2 className="w-4 h-4 text-indigo-400" />
              </h4>
              <div className="space-y-2">
                {results.companies.map((c) => (
                  <div 
                    key={c.id} 
                    onClick={() => onSelectCompanyById(c.id)}
                    className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg hover:border-indigo-600 transition-all flex items-center justify-between text-xs cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                    <div className="text-right">
                      <span className="font-bold text-white block">{c.name}</span>
                      <span className="text-[10px] text-zinc-500 block font-mono">ID: {c.id} | Email: {c.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employees Hits */}
          {results.employees.length > 0 && (
            <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black text-white flex items-center gap-2 justify-end">
                <span>{isRtl ? `الموظفون والمستخدمون (${results.employees.length})` : `Workspace Users (${results.employees.length})`}</span>
                <Users className="w-4 h-4 text-sky-400" />
              </h4>
              <div className="space-y-2">
                {results.employees.map((e) => (
                  <div 
                    key={e.id}
                    onClick={() => onSelectCompanyById(e.company_id)}
                    className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg hover:border-sky-500 transition-all flex items-center justify-between text-xs cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                    <div className="text-right">
                      <span className="font-bold text-white block">{e.username}</span>
                      <span className="text-[10px] text-zinc-500 block font-mono">Workspace: {e.company_id} | Email: {e.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product hits */}
          {results.products.length > 0 && (
            <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black text-white flex items-center gap-2 justify-end">
                <span>{isRtl ? `المنتجات المكتشفة (${results.products.length})` : `Products catalog hits (${results.products.length})`}</span>
                <Tag className="w-4 h-4 text-emerald-400" />
              </h4>
              <div className="space-y-2">
                {results.products.map((p) => (
                  <div 
                    key={p.id}
                    onClick={() => onSelectCompanyById(p.company_id)}
                    className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg hover:border-emerald-500 transition-all flex items-center justify-between text-xs cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                    <div className="text-right">
                      <span className="font-bold text-white block">{p.name}</span>
                      <span className="text-[10px] text-zinc-500 block font-mono">Workspace: {p.company_id} | Retail Price: {p.retailPrice || p.retail_price} DZD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders hits */}
          {results.orders.length > 0 && (
            <div className="bg-[#121214] border border-[#27272a] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black text-white flex items-center gap-2 justify-end">
                <span>{isRtl ? `طلبات المبيعات وعملاء التوصيل (${results.orders.length})` : `Sales Orders hits (${results.orders.length})`}</span>
                <ShoppingCart className="w-4 h-4 text-amber-400" />
              </h4>
              <div className="space-y-2">
                {results.orders.map((o) => (
                  <div 
                    key={o.id}
                    onClick={() => onSelectCompanyById(o.company_id)}
                    className="p-3 bg-zinc-900 border border-zinc-850 rounded-lg hover:border-amber-500 transition-all flex items-center justify-between text-xs cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                    <div className="text-right">
                      <span className="font-bold text-white block">{o.customerName || o.customer_name}</span>
                      <span className="text-[10px] text-zinc-500 block font-mono">Workspace: {o.company_id} | Total: {o.totalPrice || o.total_price} DZD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        query.trim() && !searching && (
          <div className="text-center text-zinc-500 py-12">
            <Search className="w-8 h-8 text-zinc-750 mx-auto mb-2" />
            <p className="text-xs font-bold">{isRtl ? "⚠️ لا توجد نتائج مطابقة للبحث." : "No matching index rows found."}</p>
          </div>
        )
      )}

    </div>
  );
}
