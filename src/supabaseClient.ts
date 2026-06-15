/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";

// Safe loading of environment variables in Vite (client-side)
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://yuuqxprqvlqvoyoltwiw.supabase.co";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1dXF4cHJxdmxxdm95b2x0d2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjAwMTksImV4cCI6MjA5NjMzNjAxOX0.mPInS2oEpM7_M1mPbCiLTf2ntK5M7uhrySWNEYLvNr8";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Log diagnostic for debugging help (never leaks private keys)
if (!isSupabaseConfigured) {
  console.log("ℹ️ Supabase environment variables are missing (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Using LocalStorage fallback.");
} else {
  console.log("🚀 Supabase credentials detected! API connector initialized successfully.");
}

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

// Secondary client used to register/manage employees without affecting the active owner's session state
export const createSecondaryClient = () => {
  return isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      })
    : null;
};
