import { expect, test } from "@playwright/test";
import postgres, { type Sql } from "postgres";

import { e2eRestaurantSlug, hasCredentials, login } from "./helpers";

/**
 * Fluxo crítico da Fase 3 contra o Supabase real.
 *
 * O horário do restaurante é forçado aberto só durante o teste e restaurado no
 * final. O pedido criado também é apagado. A numeração global não volta atrás:
 * buracos são esperados e fazem parte da regra de negócio.
 */

type SettingsSnapshot = {
  is_manually_closed: boolean;
  delivery_enabled: boolean;
  min_order_cents: number;
  payment_methods: string[];
};

type HourSnapshot = {
  weekday: number;
  opens_at: string;
  closes_at: string;
  accepts_delivery_until: string;
  is_closed: boolean;
};

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
const suffix = Date.now().toString(36);
const customerName = `E2E Cliente ${suffix}`;
const customerPhone = `119${Date.now().toString().slice(-8)}`;

let sql: Sql;
let restaurantId = "";
let restaurantName = "";
let productName = "";
let settingsSnapshot: SettingsSnapshot | null = null;
let hoursSnapshot: HourSnapshot[] = [];

test.describe("pedido do cardápio até o painel", () => {
  test.skip(
    !hasCredentials() || !hasDatabase,
    "Defina E2E_EMAIL, E2E_PASSWORD e DATABASE_URL para rodar o fluxo real.",
  );

  test.beforeAll(async () => {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL não configurada.");

    sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10 });

    const [restaurant] = await sql<
      Array<{ id: string; name: string }>
    >`select id, name from restaurants where slug = ${e2eRestaurantSlug}`;

    if (!restaurant) throw new Error(`Restaurante ${e2eRestaurantSlug} não encontrado.`);
    restaurantId = restaurant.id;
    restaurantName = restaurant.name;

    const [settings] = await sql<SettingsSnapshot[]>`
      select is_manually_closed, delivery_enabled, min_order_cents, payment_methods
      from restaurant_settings
      where restaurant_id = ${restaurantId}
    `;
    if (!settings) throw new Error("Configurações do restaurante não encontradas.");
    settingsSnapshot = settings;

    hoursSnapshot = await sql<HourSnapshot[]>`
      select weekday, opens_at, closes_at, accepts_delivery_until, is_closed
      from business_hours
      where restaurant_id = ${restaurantId}
      order by weekday
    `;

    // Aberto agora e com entrega liberada, sem depender do horário real da loja.
    await sql`
      update restaurant_settings
      set is_manually_closed = false,
          delivery_enabled = true,
          min_order_cents = 0,
          payment_methods = ${sql.array(["cash", "card", "pix"])}
      where restaurant_id = ${restaurantId}
    `;
    await sql`
      update business_hours
      set opens_at = '00:00:00',
          closes_at = '23:59:59',
          accepts_delivery_until = '23:59:59',
          is_closed = false
      where restaurant_id = ${restaurantId}
    `;

    const [product] = await sql<Array<{ name: string }>>`
      select p.name
      from products p
      join menu_categories c on c.id = p.category_id
      where p.restaurant_id = ${restaurantId}
        and p.is_available = true
        and c.is_active = true
        and not exists (select 1 from modifier_groups g where g.product_id = p.id)
      order by p.sort_order asc, p.name asc
      limit 1
    `;

    if (!product) {
      throw new Error("Nenhum produto sem adicionais disponível para o E2E.");
    }
    productName = product.name;
  });

  test.afterAll(async () => {
    if (!sql || !restaurantId) return;

    try {
      await sql`
        delete from orders
        where restaurant_id = ${restaurantId}
          and customer_name = ${customerName}
      `;

      if (settingsSnapshot) {
        await sql`
          update restaurant_settings
          set is_manually_closed = ${settingsSnapshot.is_manually_closed},
              delivery_enabled = ${settingsSnapshot.delivery_enabled},
              min_order_cents = ${settingsSnapshot.min_order_cents},
              payment_methods = ${sql.array(settingsSnapshot.payment_methods)}
          where restaurant_id = ${restaurantId}
        `;
      }

      if (hoursSnapshot.length > 0) {
        await sql`delete from business_hours where restaurant_id = ${restaurantId}`;
        for (const hour of hoursSnapshot) {
          await sql`
            insert into business_hours (
              restaurant_id, weekday, opens_at, closes_at, accepts_delivery_until, is_closed
            ) values (
              ${restaurantId}, ${hour.weekday}, ${hour.opens_at}, ${hour.closes_at},
              ${hour.accepts_delivery_until}, ${hour.is_closed}
            )
          `;
        }
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  test("cria o pedido, confirma no painel, reflete no link público e cancela", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // Cardápio público: o produto escolhido não tem adicionais, então entra com um clique.
    await page.goto(`/cardapio/${e2eRestaurantSlug}`);
    await expect(page.getByRole("heading", { name: restaurantName })).toBeVisible();
    await expect(page.getByText(/^Aberto/).first()).toBeVisible();

    await page
      .getByRole("button", { name: `Adicionar ${productName}`, exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Adicionado ao carrinho." }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Ver carrinho" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(productName).first()).toBeVisible();
    await page.getByRole("link", { name: "Fechar pedido" }).click();

    await expect(page).toHaveURL(new RegExp(`/checkout/${e2eRestaurantSlug}$`));
    await expect(page.getByRole("heading", { name: "Finalizar pedido" })).toBeVisible();
    await expect(page.locator("#customerName")).toBeVisible();

    await page.locator("#customerName").fill(customerName);
    await page.locator("#customerPhone").fill(customerPhone);

    await page.locator('input[name="type"][value="delivery"]').check();
    await page.locator("#addressStreet").fill("Rua do Teste E2E");
    await page.locator("#addressNumber").fill("123");
    await page.locator("#addressDistrict").fill("Centro");
    await page.locator("#addressReference").fill(`Teste ${suffix}`);

    await page.locator('input[name="paymentMethod"][value="pix"]').check();
    await page.locator("#notes").fill(`Pedido E2E ${suffix}`);

    await page.getByRole("button", { name: /Enviar pedido/ }).click();

    await expect(page).toHaveURL(/\/pedido\/[0-9a-f]{16}$/, { timeout: 60_000 });
    const orderUrl = page.url();
    const orderCode = orderUrl.split("/").pop() ?? "";

    await expect(page.getByRole("heading", { name: /Pedido #\d{4,}/ })).toBeVisible();
    await expect(page.getByText("Novo", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(customerName).first()).toBeVisible();
    await expect(page.getByText(productName).first()).toBeVisible();
    await expect(page.getByText("Forma: Pix", { exact: true })).toBeVisible();

    // Painel: encontra o pedido recém-criado, aceita e verifica o histórico.
    await login(page);
    await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();

    await page.locator("a", { hasText: customerName }).first().click();
    await expect(page.getByRole("heading", { name: /Pedido #\d{4,}/ })).toBeVisible();
    await expect(page.getByText("Novo", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Aceitar pedido" }).click();
    await expect(page).toHaveURL(/\?ok=1$/);
    await expect(page.getByText("Status atualizado.", { exact: true })).toBeVisible();
    await expect(page.getByText("Confirmado", { exact: true }).first()).toBeVisible();

    const panelDetailUrl = page.url();
    await expect(page.getByText(productName).first()).toBeVisible();

    // O link público reflete a mudança sem sessão.
    await page.goto(orderUrl);
    await expect(page.getByText("Confirmado", { exact: true }).first()).toBeVisible();

    // Cancela pelo painel e confere o link público e os efeitos colaterais.
    await page.goto(panelDetailUrl);
    await page.locator("summary", { hasText: "Cancelar pedido" }).click();
    await page.locator("#cancel-reason").fill("Cancelado pelo teste E2E");
    await page.getByRole("button", { name: "Confirmar cancelamento" }).click();

    await expect(page).toHaveURL(/\?ok=1$/);
    await expect(page.getByText("Cancelado", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Não enviado", { exact: true })).toBeVisible();

    await page.goto(orderUrl);
    await expect(page.getByText("Cancelado", { exact: true }).first()).toBeVisible();
    expect(orderCode).toMatch(/^[0-9a-f]{16}$/);
  });
});
