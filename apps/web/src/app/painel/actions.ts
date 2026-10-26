"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/server/auth/supabase-server";
import { log } from "@/server/logger";

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  log("info", "auth.logout");
  redirect("/login");
}
