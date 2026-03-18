import { expect } from '@playwright/test';

export class InventoryPage {
  constructor(page) {
    this.page = page;
    this.inventoryContainer = page.locator('[data-test="inventory-container"]');
    this.inventoryItems = page.locator('.inventory_item');
    this.sortDropdown = page.locator('[data-test="product-sort-container"]');
    this.cartLink = page.locator('.shopping_cart_link');
    this.cartBadge = page.locator('.shopping_cart_badge');
    this.menuButton = page.locator('#react-burger-menu-btn');
    this.logoutLink = page.locator('#logout_sidebar_link');
  }

  async waitForLoaded() {
    await expect(this.page).toHaveURL(/\/inventory\.html/);
    await expect(this.inventoryContainer).toBeVisible();
    await expect(this.inventoryItems.first()).toBeVisible();
  }

  async sortBy(value) {
    await this.sortDropdown.selectOption(value);
  }

  async getProductNames() {
    return this.page.locator('.inventory_item_name').allTextContents();
  }

  async getProductPrices() {
    const values = await this.page.locator('.inventory_item_price').allTextContents();
    return values.map((value) => Number(value.replace('$', '').trim()));
  }

  async addItemByName(productName) {
    const card = this.page.locator('.inventory_item').filter({ hasText: productName });
    if ((await card.count()) === 0) {
      throw new Error(`Product not found for add action: ${productName}`);
    }

    const button = card.locator('button');
    await expect(button).toHaveText(/Add to cart/i);
    await button.click();
    await expect(button).toHaveText(/Remove/i);
  }

  async removeItemByName(productName) {
    const card = this.page.locator('.inventory_item').filter({ hasText: productName });
    if ((await card.count()) === 0) {
      throw new Error(`Product not found for remove action: ${productName}`);
    }

    const button = card.locator('button');
    await expect(button).toHaveText(/Remove/i);
    await button.click();
    await expect(button).toHaveText(/Add to cart/i);
  }

  async getCartBadgeCount() {
    const count = await this.cartBadge.count();
    if (count === 0) return 0;
    return Number((await this.cartBadge.textContent()) ?? '0');
  }

  async openCart() {
    await this.cartLink.click();
    await expect(this.page).toHaveURL(/\/cart\.html/);
  }

  async logout() {
    await this.menuButton.click();
    await expect(this.logoutLink).toBeVisible();
    await this.logoutLink.click();
    await expect(this.page).toHaveURL('https://www.saucedemo.com/');
  }
}
