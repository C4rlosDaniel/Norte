import { expect, test, type Browser, type Page } from "@playwright/test";

import { e2eRestaurantSlug, hasCredentials, login } from "./helpers";

/**
 * Cria, confere no cardápio público e remove categoria/produto/adicionais.
 * A limpeza roda mesmo em caso de falha para não deixar lixo no banco real.
 */
async function cleanup(browser: Browser, categoryName: string): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());

  try {
    await login(page);
    await page.goto("/painel/cardapio");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const card = page.locator("article", { hasText: categoryName });
      if ((await card.count()) === 0) return;

      const editLink = card.getByRole("link", { name: "Editar" }).first();
      if ((await editLink.count()) === 0) break;

      await editLink.click();
      await expect(page).toHaveURL(/\/painel\/cardapio\/produtos\//);
      await page.getByRole("button", { name: "Excluir produto" }).click();
      await expect(page).toHaveURL(/\/painel\/cardapio$/);
    }

    const card = page.locator("article", { hasText: categoryName });
    if ((await card.count()) === 0) return;

    await card.getByText("Editar categoria").click();
    await card.getByRole("button", { name: "Remover categoria" }).click();
    await expect(page.locator("article", { hasText: categoryName })).toHaveCount(0);
  } finally {
    await context.close();
  }
}

async function deleteProductFromPanel(page: Page, productName: string): Promise<void> {
  const card = page.locator("article", { hasText: productName });
  await card.getByRole("link", { name: "Editar" }).click();

  await expect(page.getByRole("heading", { name: productName })).toBeVisible();
  await page.getByRole("button", { name: "Excluir produto" }).click();
  await expect(page).toHaveURL(/\/painel\/cardapio$/);
}

test.describe("cardápio no painel e no site", () => {
  test.skip(!hasCredentials(), "Defina E2E_EMAIL e E2E_PASSWORD para rodar o fluxo autenticado.");

  test("cria categoria, produto e adicional, confere no cardápio público e remove", async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);

    const suffix = Date.now().toString(36);
    const categoryName = `E2E Categoria ${suffix}`;
    const productName = `E2E Produto ${suffix}`;
    const groupName = `E2E Grupo ${suffix}`;
    const optionName = `E2E Extra ${suffix}`;

    page.on("dialog", (dialog) => dialog.accept());

    try {
      await login(page);
      await page.goto("/painel/cardapio");

      // Categoria
      await page.locator("#new-category-name").fill(categoryName);
      await page.locator("#new-category-order").fill("99");
      await page.getByRole("button", { name: "Criar categoria" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Categoria criada." }),
      ).toBeVisible();

      const categoryCard = page.locator("article", { hasText: categoryName });
      await expect(categoryCard).toBeVisible();

      // Produto
      await categoryCard.getByRole("link", { name: "Novo produto" }).click();
      await expect(page).toHaveURL(/\/painel\/cardapio\/produtos\/novo\?categoria=/);

      await page.locator("#product-name").fill(productName);
      await page.locator("#product-price").fill("12,34");
      await page
        .locator("#product-description")
        .fill("Produto criado pelo teste E2E e removido no final.");
      await page.getByRole("button", { name: "Criar produto" }).click();

      await expect(page).toHaveURL(/\/painel\/cardapio\/produtos\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("heading", { name: productName })).toBeVisible();

      // Grupo de adicionais
      await page.getByText("Novo grupo de adicionais", { exact: true }).click();
      await page.locator("#new-group-name").fill(groupName);
      await page.locator("#new-group-max").fill("2");
      await page.getByRole("button", { name: "Criar grupo" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Grupo de adicionais criado." }),
      ).toBeVisible();
      await expect(page.getByText(groupName, { exact: true })).toBeVisible();

      // Opção do grupo
      const addOption = page.locator("details", { hasText: "Adicionar opção" }).last();
      await addOption.locator("summary").click();
      await addOption.locator('input[name="name"]').fill(optionName);
      await addOption.locator('input[name="price"]').fill("2,00");
      await addOption.getByRole("button", { name: "Adicionar opção" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Adicional criado." }),
      ).toBeVisible();
      await expect(page.getByText(optionName, { exact: true })).toBeVisible();

      // Cardápio público (sem sessão, mesma página)
      await page.goto(`/cardapio/${e2eRestaurantSlug}`);
      await expect(page.getByRole("heading", { name: categoryName, exact: true })).toBeVisible();

      const publicProduct = page.locator("article", { hasText: productName });
      await expect(publicProduct).toBeVisible();
      await expect(publicProduct.getByText("R$ 12,34")).toBeVisible();

      await publicProduct.getByText("Adicionais", { exact: true }).click();
      await expect(publicProduct.getByText(new RegExp(optionName))).toBeVisible();

      // Categoria com produto não pode ser apagada
      await page.goto("/painel/cardapio");
      const cardWithProduct = page.locator("article", { hasText: categoryName });
      await cardWithProduct.getByText("Editar categoria").click();
      await cardWithProduct.getByRole("button", { name: "Remover categoria" }).click();
      await expect(cardWithProduct.getByRole("alert")).toContainText("ainda tem produtos");

      // Remove o produto e depois a categoria
      await deleteProductFromPanel(page, productName);

      const emptyCard = page.locator("article", { hasText: categoryName });
      await emptyCard.getByText("Editar categoria").click();
      await emptyCard.getByRole("button", { name: "Remover categoria" }).click();
      await expect(page.locator("article", { hasText: categoryName })).toHaveCount(0);
    } finally {
      await cleanup(browser, categoryName);
    }
  });
});
