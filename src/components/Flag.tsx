import React from "react";

interface FlagProps {
  lang: string;
  className?: string;
}

export const Flag: React.FC<FlagProps> = ({ lang, className = "" }) => {
  const src = lang === "ar" 
    ? "https://flagcdn.com/w40/dz.png" 
    : lang === "fr" 
      ? "https://flagcdn.com/w40/fr.png" 
      : "https://flagcdn.com/w40/us.png";
      
  const alt = lang === "ar" ? "DZ" : lang === "fr" ? "FR" : "US";
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`w-4 h-3 object-cover rounded-sm shadow-sm border border-slate-700/30 dark:border-white/10 ${className}`} 
      referrerPolicy="no-referrer"
    />
  );
};
