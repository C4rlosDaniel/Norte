import { expect, test } from "@playwright/test";

const email = process.env["E2E_EMAIL"];
const password = process.env["E2E_PASSWORD"];
const restaurantName = process.env["E2E_RESTAURANT_NAME"] ?? "Amigos do Norte";

test("painel exige login", async ({ page }) => {
  await page.goto("/painel/pedidos");

  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test.describe("fluxo autenticado", () => {
  test.skip(
    !email || !password,
    "Defina E2E_EMAIL e E2E_PASSWORD para rodar o fluxo autenticado.",
  );

  test("login, persistência das configurações e logout", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/painel\/pedidos/);
    await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
    await expect(page.getByText(restaurantName).first()).toBeVisible();

    await page.getByRole("link", { name: "Configurações" }).click();
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();

    const fee = page.getByLabel("Taxa de entrega (R$)");
    const original = await fee.inputValue();
    const testValue = original === "6,50" ? "6,51" : "6,50";

    await fee.fill(testValue);
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByRole("status")).toContainText("Configurações salvas.");

    await page.reload();
    await expect(page.getByLabel("Taxa de entrega (R$)")).toHaveValue(testValue);

    // Restaura o valor original para o teste ser idempotente.
    await page.getByLabel("Taxa de entrega (R$)").fill(original);
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByRole("status")).toContainText("Configurações salvas.");

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/painel/pedidos");
    await expect(page).toHaveURL(/\/login/);
  });
});
