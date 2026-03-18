# UI01-UI10 Manual to Automation Mapping

| TC ID | Manual Intent | Automation Steps | Key Assertions |
|---|---|---|---|
| UI01 | Valid login | Open login page, fill valid username/password, click Login | URL contains `/inventory.html`, inventory list visible |
| UI02 | Filter products | Login, select sort option `za` | Product names are sorted descending |
| UI03 | Filter products | Login, select sort option `lohi` | Product prices are sorted ascending |
| UI04 | Add to cart | Login, click Add to Cart on one product, open cart | Cart badge `1`, selected product visible in cart |
| UI05 | Add to cart (multiple) | Login, add two products | Cart badge `2` |
| UI06 | Remove from cart (inventory) | Login, add product then click Remove on same product | Button state changes `Remove -> Add to cart`, cart badge removed |
| UI07 | Remove from cart (cart page) | Login, add product, open cart, remove product | Item is removed from cart list, cart badge hidden |
| UI08 | Logout | Login, open menu, click Logout | Redirected to login URL, username input visible |
| UI09 | Negative login | Open login page, submit invalid credentials | Exact error text for invalid credentials |
| UI10 | Negative login | Open login page, submit empty credentials | Exact error text for required username |

## Notes
- Conversion keeps original test intent and adds explicit waits/assertions.
- POM is used for selector reuse and maintainability.
- Tests are isolated and independently executable.
