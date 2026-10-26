import { expect, type Page } from "@playwright/test";

export const e2eEmail = process.env["E2E_EMAIL"];
export const e2ePassword = process.env["E2E_PASSWORD"];
export const e2eRestaurantSlug = process.env["E2E_RESTAURANT_SLUG"] ?? "amigos-do-norte";

export function hasCredentials(): boolean {
  return Boolean(e2eEmail && e2ePassword);
}

/** Login real contra o Supabase. O painel redireciona /painel -> /painel/pedidos. */
export async function login(page: Page): Promise<void> {
  if (!e2eEmail || !e2ePassword) {
    throw new Error("Defina E2E_EMAIL e E2E_PASSWORD.");
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(e2eEmail);
  await page.getByLabel("Senha").fill(e2ePassword);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/painel\/pedidos/);
}
