"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/server/auth/require-member";
import { getDb } from "@/server/db/client";
import { log } from "@/server/logger";
import { settingsInputSchema } from "@/server/restaurant/settings-schema";
import { updateSettings } from "@/server/restaurant/update-settings";

export type SettingsFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function saveSettingsAction(
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const member = await requireMember();

  const parsed = settingsInputSchema.safeParse({
    phone: String(formData.get("phone") ?? ""),
    addressLine: String(formData.get("addressLine") ?? ""),
    deliveryFee: String(formData.get("deliveryFee") ?? ""),
    deliveryEnabled: formData.get("deliveryEnabled") === "on",
    isManuallyClosed: formData.get("isManuallyClosed") === "on",
    closedMessage: String(formData.get("closedMessage") ?? ""),
  });

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: flattened.fieldErrors,
    };
  }

  try {
    await updateSettings(getDb(), member.restaurantId, parsed.data);
  } catch (error) {
    log("error", "settings.update_failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { status: "error", message: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/painel/configuracoes");
  revalidatePath("/");
  log("info", "settings.updated", { restaurantId: member.restaurantId });

  return { status: "success", message: "Configurações salvas." };
}
