import { useMemo } from "react";
import type { LanguageType } from "../types";

interface TrialBadgeProps {
  status: string;
  trialStartAt: string;
  lang: LanguageType;
}

const TRIAL_DAYS = 15;

export default function TrialBadge({ status, trialStartAt, lang }: TrialBadgeProps) {
  const isRtl = lang === "ar";

  const { daysLeft, isUrgent } = useMemo(() => {
    if (!trialStartAt || status !== "trial") {
      return { daysLeft: 0, isUrgent: false };
    }
    const start = new Date(trialStartAt);
    const end = new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { daysLeft: diff, isUrgent: diff <= 3 };
  }, [trialStartAt, status]);

  if (status !== "trial" || daysLeft === 0) return null;

  return (
    <div
      className={`px-3 py-1 rounded-full font-bold text-[11px] shadow-sm transition-all duration-300 whitespace-nowrap ${
        isUrgent
          ? "bg-red-600 text-white animate-pulse"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"
      }`}
    >
      {isUrgent ? "🚨 " : "⏳ "}
      {isRtl
        ? isUrgent ? `متبقي ${daysLeft} أيام` : `تجربة: ${daysLeft} يوم`
        : isUrgent ? `${daysLeft} days left` : `Trial: ${daysLeft}d`}
    </div>
  );
}
