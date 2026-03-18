import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.mjs';
import { InventoryPage } from '../pages/InventoryPage.mjs';
import { CartPage } from '../pages/CartPage.mjs';
import { testData } from '../fixtures/uiTestData.mjs';

async function loginAsStandardUser(loginPage, inventoryPage) {
  await loginPage.goto();
  await loginPage.login(testData.users.standard.username, testData.users.standard.password);
  await inventoryPage.waitForLoaded();
}

function expectSortedAscending(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  expect(numbers).toEqual(sorted);
}

function expectSortedDescending(strings) {
  const sorted = [...strings].sort((a, b) => b.localeCompare(a));
  expect(strings).toEqual(sorted);
}

test.describe('UI Automation Conversion: UI01-UI10', () => {
  test.afterEach(async ({ page }, testInfo) => {
    try {
      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('test-case-screenshot', {
        body: screenshot,
        contentType: 'image/png'
      });
    } catch (error) {
      await testInfo.attach('test-case-screenshot-error', {
        body: Buffer.from(String(error?.message || error)),
        contentType: 'text/plain'
      });
    }
  });

  test('UI01 - Valid login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginPage.goto();
    await loginPage.login(testData.users.standard.username, testData.users.standard.password);

    await inventoryPage.waitForLoaded();
    await expect(inventoryPage.cartLink).toBeVisible();
  });

  test('UI02 - Filter products by Name (Z to A)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginAsStandardUser(loginPage, inventoryPage);
    await inventoryPage.sortBy('za');

    const productNames = await inventoryPage.getProductNames();
    expectSortedDescending(productNames);
  });

  test('UI03 - Filter products by Price (low to high)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginAsStandardUser(loginPage, inventoryPage);
    await inventoryPage.sortBy('lohi');

    const prices = await inventoryPage.getProductPrices();
    expectSortedAscending(prices);
  });

  test('UI04 - Add single product to cart', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);

    await loginAsStandardUser(loginPage, inventoryPage);
    await inventoryPage.addItemByName(testData.products.backpack);

    await expect(inventoryPage.cartBadge).toHaveText('1');
    await inventoryPage.openCart();
    await cartPage.waitForLoaded();

    const items = await cartPage.getItemNames();
    expect(items).toContain(testData.products.backpack);
  });

  test('UI05 - Add multiple products to cart', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginAsStandardUser(loginPage, inventoryPage);
    await inventoryPage.addItemByName(testData.products.backpack);
    await inventoryPage.addItemByName(testData.products.bikeLight);

    await expect(inventoryPage.cartBadge).toHaveText('2');
  });

  test('UI06 - Remove product from inventory cart action', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginAsStandardUser(loginPage, inventoryPage);
    await inventoryPage.addItemByName(testData.products.backpack);
    await inventoryPage.removeItemByName(testData.products.backpack);

    expect(await inventoryPage.getCartBadgeCount()).toBe(0);
  });

  test('UI07 - Remove product from cart page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);
    const cartPage = new CartPage(page);

    await loginAsStandardUser(loginPage, inventoryPage);
    await inventoryPage.addItemByName(testData.products.backpack);
    await inventoryPage.openCart();
    await cartPage.waitForLoaded();

    await cartPage.removeItemByName(testData.products.backpack);
    const items = await cartPage.getItemNames();

    expect(items).not.toContain(testData.products.backpack);
    await expect(page.locator('.shopping_cart_badge')).toHaveCount(0);
  });

  test('UI08 - Logout from inventory page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const inventoryPage = new InventoryPage(page);

    await loginAsStandardUser(loginPage, inventoryPage);
    await inventoryPage.logout();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(page).toHaveURL('https://www.saucedemo.com/');
  });

  test('UI09 - Negative login with invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(testData.users.invalid.username, testData.users.invalid.password);

    await loginPage.assertErrorMessage(testData.errors.invalidCredentials);
    await expect(page).toHaveURL('https://www.saucedemo.com/');
  });

  test('UI10 - Negative login with empty credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('', '');

    await loginPage.assertErrorMessage(testData.errors.usernameRequired);
    await expect(page).toHaveURL('https://www.saucedemo.com/');
  });
});
