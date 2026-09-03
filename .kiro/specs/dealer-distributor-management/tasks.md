# Implementation Plan: Dealer/Distributor Management

## Overview

All changes are confined to two files: `client/owner-script.js` (frontend SPA) and `server/server.js` (backend API). No new files are created. The work proceeds in five logical groups: navigation restructure, server-side new endpoint, four new/rewired page render functions, POS barcode input, and stock-sync verification. Each task builds incrementally so the app remains runnable after every step.

## Tasks

- [ ] 1. Navigation restructure in `owner-script.js`
  - [ ] 1.1 Replace the four legacy nav items with new ones in `renderNavigation()`
    - In the `renderNavigation()` method, replace the four `<li>` blocks for `admin-full-stock`, `admin-distributors`, `admin-purchases`, and `admin-reports` with new items: `admin-dealers` (🏪 Dealers), `admin-dealer-purchase` (📥 Dealer Purchase), `admin-purchase-history` (📋 Purchase History), `admin-stock-inventory` (📦 Stock Inventory)
    - Update the `active` class condition on each new nav item to match its own route
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 1.2 Add legacy-route redirects and new page cases in `renderPage()`
    - At the top of the `switch`/`else-if` chain in `renderPage()`, add four redirect cases: `admin-full-stock` → `admin-stock-inventory`, `admin-distributors` → `admin-dealers`, `admin-purchases` → `admin-purchase-history`, `admin-reports` → `admin-purchase-history`; each redirect calls `this.renderPage(replacementRoute)` and returns
    - Add new `else if` branches: `admin-dealers`, `admin-dealer-purchase`, `admin-purchase-history`, `admin-stock-inventory`; wire each to its render method (stubs that return `'<p>Coming soon</p>'` are acceptable for this task — they will be filled in tasks 3–5)
    - _Requirements: 1.4_

  - [ ] 1.3 Update dashboard quick-action buttons in `renderAdmin()`
    - In `renderAdmin()`, replace the four quick-action `<button>` elements that use `data-page="admin-full-stock"`, `data-page="admin-distributors"`, `onclick="app.openPurchaseEntryModal()"` (Stock Purchase), and `data-page="admin-reports"` with new buttons pointing to `admin-stock-inventory`, `admin-dealers`, `admin-dealer-purchase`, and `admin-purchase-history` respectively, updating labels and icons to match
    - _Requirements: 9.5_

  - [ ]* 1.4 Write unit tests for navigation routing
    - Assert that calling `renderPage('admin-full-stock')` ultimately renders the stock-inventory content
    - Assert that calling `renderPage('admin-distributors')` ultimately renders the dealers content
    - Assert that calling `renderPage('admin-purchases')` ultimately renders the purchase-history content
    - _Requirements: 1.4_

- [ ] 2. Add `PATCH /api/distributors/:distributorId/status` endpoint in `server.js`
  - [ ] 2.1 Implement the new status-toggle endpoint
    - After the existing `app.put('/api/distributors/:distributorId')` handler, add `app.patch('/api/distributors/:distributorId/status', ...)` that validates `status` is `'Active'` or `'Inactive'` (return 400 otherwise), calls `Distributor.findOneAndUpdate({ distributorId }, { $set: { status } }, { new: true })`, and returns 404 if not found
    - _Requirements: 2.6_

  - [ ]* 2.2 Write unit test for `PATCH /api/distributors/:distributorId/status`
    - Valid `status: 'Inactive'` payload → 200 with updated doc
    - Invalid payload (e.g. `status: 'Suspended'`) → 400
    - Unknown `distributorId` → 404
    - _Requirements: 2.6_

- [ ] 3. Implement `renderDealersPage()` (Dealer Management — `admin-dealers`)
  - [ ] 3.1 Write the `renderDealersPage()` method in `owner-script.js`
    - Copy the logic of the existing `renderDistributorsModule()` as the base; rename the method to `renderDealersPage()` and update all internal `data-page="admin-distributors"` references to `admin-dealers`, and `app.renderPage('admin-distributors')` calls to `app.renderPage('admin-dealers')`
    - Update the "Add New Distributor" label to "Add New Dealer" and the heading/title text to "Dealers"
    - Wire the `admin-dealers` case in `renderPage()` to call `this.renderDealersPage()`
    - Ensure the delete confirmation guard calls `GET /api/stock-entries?dealerId=<id>` before proceeding; if records exist, show a warning dialog; only call `DELETE /api/distributors/:distributorId` on explicit confirmation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 3.2 Write unit tests for Dealer Management page
    - Mock `GET /api/distributors` failure → inline error shown, empty list rendered (no crash)
    - Delete dealer with existing StockEntry records → confirmation dialog shown; DELETE only fires on confirm
    - _Requirements: 2.7, 2.8_

- [ ] 4. Implement `renderDealerPurchasePage()` (Dealer Purchase Entry — `admin-dealer-purchase`)
  - [ ] 4.1 Write the `renderDealerPurchasePage()` method in `owner-script.js`
    - Render a full-page form with fields: dealer dropdown (from `this.distributors`), product dropdown (from `this.products`), `purchaseDate`, `initialQuantity` (≥ 1), `purchasePrice` (≥ 0), `mrp`, `sellingPrice`, `imei1`, `imei2`, `serialNumber`, `notes`
    - Auto-generate a candidate barcode using the pattern `PROD-<6CHAR_NAME>-<DIST_CODE>-<TIMESTAMP_MOD_10000>` when the product/dealer selection changes; populate a read-only barcode field
    - On form submit: validate `initialQuantity ≥ 1` (show inline error if not); POST `{ moduleType: 'Product', masterId, masterName, dealerId, dealerName, purchaseDate, initialQuantity, purchasePrice, mrp, sellingPrice, barcode, imei1, imei2, serialNumber, notes }` to `POST /api/purchases`
    - On HTTP 409 / duplicate-key error, regenerate barcode with an incremented suffix and retry up to 3 times automatically; after 3 failures, show an error alert
    - On success: clear all form fields and display a success banner with a "Print Barcode" button that calls `printStockBarcodeSticker(barcode)`
    - Wire the `admin-dealer-purchase` case in `renderPage()` to call `this.renderDealerPurchasePage()`
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 4.2 Write property test for barcode uniqueness (Property 5)
    - **Property 5: Barcode uniqueness**
    - **Validates: Requirements 3.8**
    - Using fast-check: generate two distinct `{ productName, distCode, timestamp }` triples and assert the generated barcodes are different; also assert the barcode matches the pattern `PROD-[A-Z0-9]{1,6}-[A-Z0-9]+-[0-9]+`

  - [ ]* 4.3 Write unit tests for Dealer Purchase Entry form
    - `initialQuantity < 1` → inline validation error shown, form not submitted
    - Successful POST → form cleared, success banner with "Print Barcode" button appears
    - _Requirements: 3.7, 3.10_

- [ ] 5. Implement `renderPurchaseHistoryPage()` (Purchase History — `admin-purchase-history`)
  - [ ] 5.1 Write the `renderPurchaseHistoryPage()` method in `owner-script.js`
    - Copy the logic of the existing `renderPurchaseHistoryModule()` as the base; rename to `renderPurchaseHistoryPage()` and update all internal route references from `admin-purchases` to `admin-purchase-history`
    - Ensure each table row has a "Print Barcode" button that calls `printStockBarcodeSticker(barcode)` with the row's `barcode`, `masterName`, `dealerName`, and `sellingPrice`
    - Retain dealer filter dropdown (populated from `this.distributors`) and text search over product name, dealer name, and barcode
    - Retain the row click → detail panel showing all StockEntry fields plus StockMovement log entries for that batch
    - Wire the `admin-purchase-history` case in `renderPage()` to call `this.renderPurchaseHistoryPage()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.2 Write unit tests for Purchase History page
    - Mock `GET /api/stock-entries` failure → inline error shown, empty list rendered (no crash)
    - `initialQuantity` field displays the original value even when `currentQuantity` has decreased
    - _Requirements: 4.4, 4.9_

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement `renderStockInventoryPage()` (Stock Inventory — `admin-stock-inventory`)
  - [ ] 7.1 Write the `renderStockInventoryPage()` method in `owner-script.js`
    - Compute stock status for each product in `this.products`: `stock === 0` → "Out of Stock" (red badge), `0 < stock <= minStock` → "Low Stock" (amber badge), `stock > minStock` → "In Stock" (green badge)
    - Render a summary row at the top: total product count, in-stock count, low-stock count, out-of-stock count
    - Render the product table with columns: product name, category, current stock, minStock threshold, status badge; sorted alphabetically by name
    - Implement status filter (All / In Stock / Low Stock / Out of Stock) using a dropdown or buttons
    - Implement text search over product name and category
    - Wire the `admin-stock-inventory` case in `renderPage()` to call `this.renderStockInventoryPage()`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 7.2 Write unit tests for stock status classification
    - `{ stock: 0, minStock: 5 }` → "Out of Stock"
    - `{ stock: 3, minStock: 5 }` → "Low Stock"
    - `{ stock: 10, minStock: 5 }` → "In Stock"
    - `{ stock: 5, minStock: 5 }` → "Low Stock" (boundary: stock === minStock)
    - _Requirements: 8.3, 8.4_

- [ ] 8. Add barcode scanning input to the POS page (`admin-pos`)
  - [ ] 8.1 Add barcode input field and `lookupPOSBarcode()` method in `owner-script.js`
    - In the POS page render method, add `<input type="text" id="posBarcodeInput" placeholder="Scan barcode or enter code…">` above the existing product-search area; after render use `setTimeout(() => document.getElementById('posBarcodeInput')?.focus(), 100)` to auto-focus
    - Add an `onkeydown` handler on the input: when `Enter` is pressed, call `this.lookupPOSBarcode(this.value)` and clear the input
    - Implement `lookupPOSBarcode(barcode)`: call `GET /api/stock-entries/barcode/:barcode`; on 404 show "Barcode not recognised" toast and return; if `currentQuantity === 0` show "This item is out of stock" toast and return; find the matching product in `this.products` by `entry.masterId`; check `posCart` for an existing item with the same `stockId` — if found increment quantity by 1, if not push a new cart item `{ product, qty: 1, unitPrice: entry.sellingPrice, stockId: entry.stockId, barcode: entry.barcode, scannedUnits: [{ stockId, barcode, imei1 }] }`; re-render the POS cart; clear and re-focus `posBarcodeInput`
    - Retain existing manual product-name search as a parallel input (no changes to existing search logic)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8_

  - [ ]* 8.2 Write unit tests for POS barcode lookup
    - 404 response → "Barcode not recognised" toast shown; cart unchanged
    - `currentQuantity === 0` response → "This item is out of stock" toast; cart unchanged
    - Valid scan → correct product added to cart with `sellingPrice` as unit price
    - Second scan of same barcode → existing cart item qty incremented, no duplicate line
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.3 Write property test for FIFO deduction order (Property 6)
    - **Property 6: FIFO deduction order**
    - **Validates: Requirements 5.7**
    - Using fast-check: generate a list of ≥ 2 StockEntry batches with distinct `createdAt` timestamps and varying `currentQuantity`; simulate deducting a random quantity Q ≤ total available stock; assert that older batches are fully consumed before newer batches are touched

- [ ] 9. Verify and fix stock synchronisation (`productsCache` + Socket.IO client handler)
  - [ ] 9.1 Verify `POST /api/sales` completes stock deduction before response in `server.js`
    - Confirm that in `POST /api/sales`, the `deductProduct()` helper is `await`-ed for every item in `productItems` (or single `productId`) and that `productsCache = null; cacheTimestamp = 0; io.emit('product-updated', ...)` is executed inside the helper before the outer `res.json(sale)` is reached; add any missing `await` if found
    - _Requirements: 5.7, 7.1_

  - [ ] 9.2 Verify `POST /api/orders` completes stock deduction before response in `server.js`
    - Confirm that in `POST /api/orders`, the FIFO deduction loop over `items` is fully `await`-ed and that `productsCache = null; cacheTimestamp = 0; io.emit('product-updated', ...)` is called for each product before `res.json(savedOrderObj)` is reached; add any missing `await` if found
    - _Requirements: 7.2, 7.3_

  - [ ] 9.3 Fix `product-updated` socket handler in `owner-script.js` to remove stale `localStorage` write
    - In `setupSocketListeners()`, locate the `this.socket.on('product-updated', ...)` handler; remove the `localStorage.setItem('manjula_products', JSON.stringify(this.products))` call that writes the potentially stale merged array back to storage; verify that `this.products[index]` is updated with the event payload using `{ ...this.products[index], ...product, stock: Number(product.stock) }` before `this.renderPage(this.currentPage)` is called
    - _Requirements: 7.3, 7.4, 7.6, 7.7_

  - [ ]* 9.4 Write property test for cache freshness after stock-changing write (Property 3)
    - **Property 3: Cache is never stale after a stock-changing write**
    - **Validates: Requirements 7.3, 7.5**
    - Using fast-check: generate a sequence of 1–10 purchase or sale operations on a mocked in-memory `productsCache`; after each operation assert `productsCache === null` before the next `GET /api/products` would be served

  - [ ]* 9.5 Write property test for stock invariant after purchase (Property 1)
    - **Property 1: Stock invariant preserved after purchase**
    - **Validates: Requirements 3.4, 3.5**
    - Using fast-check: generate `{ productId: string, qty: integer(min:1, max:100) }`; mock DB operations; after a successful `POST /api/purchases`, assert `Product.stock === sum(StockEntry.currentQuantity where masterId === productId)` across 100 runs

  - [ ]* 9.6 Write property test for stock invariant after sale (Property 2)
    - **Property 2: Stock invariant preserved after sale**
    - **Validates: Requirements 7.1, 7.2, 5.7**
    - Using fast-check: generate a product with at least one StockEntry batch where `currentQuantity > 0` and a deduction quantity Q ≤ total available; after `POST /api/sales`, assert `Product.stock === sum(StockEntry.currentQuantity where masterId === productId)`

  - [ ]* 9.7 Write property test for `initialQuantity` immutability (Property 4)
    - **Property 4: initialQuantity is immutable**
    - **Validates: Requirements 4.4**
    - Using fast-check: generate a StockEntry and simulate 1–50 sequential sale deductions; assert `entry.initialQuantity` is the same value after all deductions as it was at creation

  - [ ]* 9.8 Write property test for Socket.IO event carrying fresh stock (Property 7)
    - **Property 7: Socket event carries fresh stock**
    - **Validates: Requirements 7.3, 7.4**
    - Using fast-check: generate a product with an arbitrary stock value; mock `io.emit`; run a purchase or sale operation; assert the `stock` field in the captured `product-updated` event payload equals the value written to the mocked DB in that operation, and that `productsCache === null` at the time of emission

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Manually verify: nav bar shows exactly the 4 new items; legacy routes redirect without blank screen; barcode input auto-focuses on POS page load; popup-blocked print scenario shows "Allow popups to print barcode labels"; dashboard quick-action buttons all point to active routes.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- The design confirms `POST /api/sales` and `POST /api/orders` already invalidate `productsCache` correctly; tasks 9.1–9.2 are verification + any missing `await`, not rewrites
- All property tests use **fast-check** (dev dependency only — satisfies the "no new runtime npm packages" constraint)
- `renderDealersPage()` is a rename/re-route of the existing `renderDistributorsModule()` — the underlying API calls (`/api/distributors`) and data format are unchanged
- `renderPurchaseHistoryPage()` similarly wraps the existing `renderPurchaseHistoryModule()` logic
- No MongoDB schema changes are made; all new UI maps to existing `Distributor`, `StockEntry`, and `StockMovement` fields

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2"] },
    { "id": 2, "tasks": ["1.4", "3.1", "5.1", "7.1", "9.1", "9.2", "9.3"] },
    { "id": 3, "tasks": ["3.2", "4.1", "5.2", "7.2", "9.4", "9.5", "9.6", "9.7", "9.8"] },
    { "id": 4, "tasks": ["4.2", "4.3", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3"] }
  ]
}
```
