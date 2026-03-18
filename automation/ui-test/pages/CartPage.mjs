import { expect } from '@playwright/test';

export class CartPage {
  constructor(page) {
    this.page = page;
    this.cartItems = page.locator('.cart_item');
  }

  async waitForLoaded() {
    await expect(this.page).toHaveURL(/\/cart\.html/);
    await expect(this.page.locator('.cart_list')).toBeVisible();
  }

  async getItemNames() {
    return this.page.locator('.inventory_item_name').allTextContents();
  }

  async removeItemByName(productName) {
    const cartItem = this.page.locator('.cart_item').filter({ hasText: productName });
    if ((await cartItem.count()) === 0) {
      throw new Error(`Product not found in cart: ${productName}`);
    }

    const removeButton = cartItem.locator('button');
    await expect(removeButton).toHaveText(/Remove/i);
    await removeButton.click();
    await expect(cartItem).toHaveCount(0);
  }
}
