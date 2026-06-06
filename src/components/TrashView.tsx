/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrashItem, LanguageType } from "../types";
import { translations } from "../translations";
import { Trash2, RotateCcw, X, AlertTriangle } from "lucide-react";

interface TrashViewProps {
  trashItems: TrashItem[];
  onRestoreItem: (id: string) => void;
  onClearTrashAll: () => void;
  lang: LanguageType;
}

export default function TrashView({
  trashItems,
  onRestoreItem,
  onClearTrashAll,
  lang
}: TrashViewProps) {
  const t = translations[lang];
  const isRtl = lang === "ar";

  const currencyLabel = lang === "ar" ? "دج" : lang === "fr" ? "DA" : "DZD";

  return (
    <div className="space-y-4 pt-16 md:pt-4" id="trash_panel_view">
      
      {/* Deletion Visual Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#27272a] pb-3" id="trash_branding">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
            🗑️ {t.navTrash}
          </h1>
          <p className="text-[10px] text-slate-400 mt-0.5">{lang === "ar" ? "سلة المحذوفات وتفادي الأخطاء واسترجاع البيانات بضغطة واحدة" : "Recoverable deleted records safety drawer"}</p>
        </div>
        
        {trashItems.length > 0 && (
          <button
            onClick={onClearTrashAll}
            className="bg-rose-500/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "إفراغ سلة المحذوفات بالكامل" : "Purge Recovery Bin"}</span>
          </button>
        )}
      </div>

      {/* RECOVERY ITEMS CHECKLIST */}
      <div className="bg-[#09090b] rounded-xl border border-[#27272a] overflow-hidden shadow-lg" id="trash_table_block">
        {trashItems.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs text-pretty" id="trash_empty_state_drawer">
            <Trash2 className="w-10 h-10 mx-auto text-slate-650 mb-2" />
            <p className="font-semibold text-slate-300">{t.trashEmpty}</p>
            <p className="text-[9px] text-slate-500 mt-1">تلقائياً، تُحفظ العناصر التي تحذفها هنا للوقاية من المسح الخطأ.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right text-slate-300">
              <thead className="bg-[#121214] text-slate-400 border-b border-[#27272a] uppercase font-mono text-[9px] tracking-wide">
                <tr>
                  <th className="px-3 py-2 w-32">{lang === "ar" ? "نوع العنصر" : "Record Type"}</th>
                  <th className="px-3 py-2">{lang === "ar" ? "العنوان والتفاصيل" : "Title / Details"}</th>
                  <th className="px-3 py-2 text-center w-28">{lang === "ar" ? "تاريخ الحذف" : "Deletion Date"}</th>
                  <th className="px-3 py-2 text-center w-36">{t.tableActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f22] font-sans">
                {trashItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-3 py-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#040406] text-slate-400 border border-[#27272a] uppercase tracking-wider font-mono">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="font-bold text-white text-[11px]">{item.title}</div>
                      <div className="text-[9px] text-slate-500 font-mono">Ref ID: {item.itemId}</div>
                    </td>
                    <td className="px-3 py-1.5 text-center font-mono text-slate-400 text-[10px]">{item.deletedAt.split("T")[0]}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() => onRestoreItem(item.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all flex items-center gap-1.5 mx-auto"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t.trashRestoreBtn}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
