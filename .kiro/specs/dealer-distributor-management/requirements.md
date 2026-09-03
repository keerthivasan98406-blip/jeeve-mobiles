# Requirements Document

## Introduction

This feature adds Dealer/Distributor Management, Dealer Purchase Entry, Purchase History, Barcode Integration in the POS, and a Stock Synchronisation fix to the existing Jivi Mobiles owner portal application. All work is additive and must preserve every existing function: login, POS billing, cart, checkout, customer orders, invoices, product pages, order tracking, sales records, display stock, spare parts, and service records.

Four existing Owner Portal navigation items — "📊 Full Stock", "🤝 Distributors", "📥 Purchases", and "📈 Reports" — are replaced by the five new modules described below. All back-end schemas for `Distributor`, `StockEntry`, and `StockMovement` already exist in `server.js` and must be reused without modification to their field names or primary key fields (`distributorId`, `stockId`, `barcode`).

---

## Glossary

- **Owner Portal**: The password-protected admin SPA served from `owner.html` / `owner-script.js`.
- **Portal_App**: The `OwnerPortalApp` JavaScript class that drives the Owner Portal.
- **POS**: The Point-of-Sale billing screen inside the Owner Portal (`admin-pos` page).
- **Dealer**: A supplier or distributor from whom the shop purchases stock; stored in the `Distributor` MongoDB collection.
- **Stock_Entry**: A single purchase batch record stored in the `StockEntry` MongoDB collection; each batch has a unique barcode and tracks `initialQuantity` and `currentQuantity`.
- **Stock_Movement**: An audit-log record in the `StockMovement` MongoDB collection recording every stock-in or stock-out event.
- **Master_Product**: A product record in the `Product` MongoDB collection whose `stock` field is the single source of truth for current available quantity shown everywhere (POS, product page, owner portal, website).
- **Products_Cache**: The in-memory variable `productsCache` in `server.js` that caches the result of `GET /api/products`.
- **Barcode**: A unique alphanumeric code auto-generated per Stock_Entry batch, printed on a thermal label.
- **FIFO**: First-In First-Out — the order in which Stock_Entry batches are consumed during a sale.
- **TSPL**: Thermal-printer label language used by the existing `printUnifiedThermalLabel` function.
- **Socket_IO**: The real-time WebSocket layer used to push `product-updated` events to all connected clients.
- **renderPage**: The Portal_App method `renderPage(pageName)` that re-renders the SPA content area.
- **Stock_In**: Any event that increases `currentQuantity` on a Stock_Entry and `stock` on the Master_Product (dealer purchases).
- **Stock_Out**: Any event that decreases `currentQuantity` on a Stock_Entry and `stock` on the Master_Product (POS sale, website order).

---

## Requirements

---

### Requirement 1: Navigation Restructure

**User Story:** As an owner, I want the portal navigation to reflect only the new modules, so that I can find the correct pages without legacy clutter.

#### Acceptance Criteria

1. THE Portal_App SHALL remove the four nav links "📊 Full Stock", "🤝 Distributors", "📥 Purchases", and "📈 Reports" from the Owner Portal navigation bar.
2. THE Portal_App SHALL add four new nav links — "🏪 Dealers", "📥 Dealer Purchase", "📋 Purchase History", and "📦 Stock Inventory" — to the Owner Portal navigation bar in place of the removed links.
3. WHEN a user clicks any of the four new nav links, THE Portal_App SHALL navigate to the corresponding page without a full page reload.
4. WHEN the four legacy page routes (`admin-full-stock`, `admin-distributors`, `admin-purchases`, `admin-reports`) are requested via `renderPage`, THE Portal_App SHALL redirect to the corresponding replacement page so that no blank screen appears.

---

### Requirement 2: Dealer Management Page

**User Story:** As an owner, I want a dedicated Dealer Management page, so that I can create, view, update, and deactivate dealer records without losing existing dealer IDs.

#### Acceptance Criteria

1. THE Portal_App SHALL render the Dealer Management page at route `admin-dealers` when navigated to.
2. WHEN the Dealer Management page loads, THE Portal_App SHALL display all dealer records fetched from `GET /api/distributors`, sorted alphabetically by dealer name.
3. THE Portal_App SHALL display, for each dealer record, the dealer name, dealer code, contact person, phone number, status (Active / Inactive), and action buttons (Edit, Toggle Status, Delete).
4. WHEN an owner submits the Add Dealer form with a unique dealer name and at least one contact field, THE Portal_App SHALL send a `POST /api/distributors` request and display the new dealer in the list without a full page reload.
5. WHEN an owner submits the Edit Dealer form, THE Portal_App SHALL send a `PUT /api/distributors/:distributorId` request using the existing `distributorId` value and update the displayed record.
6. WHEN an owner toggles a dealer's status, THE Portal_App SHALL send a `PATCH /api/distributors/:distributorId/status` request and reflect the new status in the list immediately.
7. WHEN an owner attempts to delete a dealer that has associated Stock_Entry records, THE Portal_App SHALL display a confirmation warning that existing purchase history will be orphaned, and SHALL require explicit confirmation before proceeding.
8. IF the `GET /api/distributors` request fails, THEN THE Portal_App SHALL display an inline error message and SHALL show an empty list rather than crashing the page.
9. THE Portal_App SHALL support filtering the dealer list by status (All / Active / Inactive) using filter buttons on the page.
10. THE Portal_App SHALL support searching the dealer list by name, code, contact person, or phone number using a text input on the page.

---

### Requirement 3: Dealer Purchase Entry Page

**User Story:** As an owner, I want to record products purchased from a dealer, so that the stock is increased immediately and a barcode is generated for each batch.

#### Acceptance Criteria

1. THE Portal_App SHALL render the Dealer Purchase Entry page at route `admin-dealer-purchase` when navigated to.
2. WHEN the Dealer Purchase Entry page loads, THE Portal_App SHALL populate the dealer dropdown from the loaded `distributors` array and the product dropdown from the loaded `products` array.
3. WHEN an owner selects a product and dealer, enters `initialQuantity` (≥ 1), `purchasePrice` (≥ 0), and `purchaseDate`, and submits the form, THE Portal_App SHALL send a `POST /api/purchases` request with `moduleType`, `masterId`, `masterName`, `dealerId`, `dealerName`, `purchaseDate`, `initialQuantity`, `purchasePrice`, `mrp`, `sellingPrice`, and an auto-generated `barcode`.
4. WHEN the `POST /api/purchases` request succeeds, THE Server SHALL set `currentQuantity` equal to `initialQuantity` on the new Stock_Entry record.
5. WHEN the `POST /api/purchases` request succeeds, THE Server SHALL increment the Master_Product's `stock` field by `initialQuantity` and update `inStock` to `true`, then invalidate the Products_Cache and emit a `product-updated` Socket_IO event.
6. WHEN the `POST /api/purchases` request succeeds, THE Portal_App SHALL offer the owner a "Print Barcode" action that calls `printUnifiedThermalLabel` with the new batch's barcode.
7. IF the `initialQuantity` field is less than 1 or non-numeric, THEN THE Portal_App SHALL display an inline validation error and SHALL NOT submit the form.
8. IF the `barcode` value generated for the new Stock_Entry already exists in the database, THEN THE Server SHALL return an error response, and THE Portal_App SHALL re-generate a unique barcode and retry the submission automatically up to three times before displaying an error to the owner.
9. THE Portal_App SHALL allow entry of optional fields: `imei1`, `imei2`, `serialNumber`, and `notes` on the purchase entry form.
10. WHEN a purchase is saved successfully, THE Portal_App SHALL clear the form fields and display a success confirmation message on the same page.

---

### Requirement 4: Purchase History Page

**User Story:** As an owner, I want to view all historical dealer purchases, so that I can track what stock was purchased, from whom, and when.

#### Acceptance Criteria

1. THE Portal_App SHALL render the Purchase History page at route `admin-purchase-history` when navigated to.
2. WHEN the Purchase History page loads, THE Portal_App SHALL fetch and display all Stock_Entry records from `GET /api/stock-entries`, sorted by `purchaseDate` descending.
3. THE Portal_App SHALL display, for each Stock_Entry record, the barcode, product name, dealer name, purchase date, `initialQuantity`, `currentQuantity`, `purchasePrice`, and status.
4. THE Portal_App SHALL display `initialQuantity` as a read-only historical value that never decreases, regardless of subsequent sales.
5. THE Portal_App SHALL display `currentQuantity` as the remaining unsold quantity for that batch, which decreases as sales occur.
6. THE Portal_App SHALL support filtering the purchase history list by dealer using a dropdown populated from the loaded distributors.
7. THE Portal_App SHALL support text search over the purchase history list by product name, dealer name, or barcode.
8. WHEN an owner clicks a purchase record, THE Portal_App SHALL display a detail panel showing all fields of the Stock_Entry plus the associated Stock_Movement log entries for that batch.
9. IF the `GET /api/stock-entries` request fails, THEN THE Portal_App SHALL display an inline error message and an empty list.

---

### Requirement 5: Barcode Scanning in POS

**User Story:** As a shop operator, I want to scan a product barcode in the POS to add the correct item to the billing cart, so that manual product lookup is eliminated and stock deduction is accurate.

#### Acceptance Criteria

1. THE Portal_App SHALL provide a barcode input field on the POS (`admin-pos`) page that is auto-focused when the page loads.
2. WHEN a barcode value is entered into the barcode input field and the Enter key is pressed, THE Portal_App SHALL send a `GET /api/stock-entries/barcode/:barcode` request to look up the Stock_Entry.
3. WHEN the barcode lookup returns a valid Stock_Entry with `currentQuantity` > 0, THE Portal_App SHALL add the corresponding Master_Product to the POS cart with quantity 1, using the Stock_Entry's `sellingPrice` as the unit price, and SHALL associate the `stockId` and `barcode` with the cart item.
4. WHEN a barcode is scanned for a product already in the POS cart, THE Portal_App SHALL increment that cart item's quantity by 1 rather than adding a duplicate line.
5. IF the barcode lookup returns a Stock_Entry with `currentQuantity` equal to 0, THEN THE Portal_App SHALL display the message "This item is out of stock" and SHALL NOT add it to the cart.
6. IF the barcode is not found in the database, THEN THE Portal_App SHALL display the message "Barcode not recognised" and SHALL NOT add any item to the cart.
7. WHEN a POS sale is completed via `POST /api/sales`, THE Server SHALL deduct the sold quantity from the correct Stock_Entry batches using FIFO order, update the Master_Product `stock`, invalidate the Products_Cache, and emit a `product-updated` Socket_IO event — all within the same request handler before sending the response.
8. THE Portal_App SHALL also support manual product search by name in the POS as a fallback when no barcode scanner is available, preserving the existing product-search behaviour.

---

### Requirement 6: Barcode Label Printing

**User Story:** As an owner, I want to print a barcode label for any stock batch, so that physical products can be tagged for scanning at the POS.

#### Acceptance Criteria

1. THE Portal_App SHALL provide a "Print Barcode" button on each row of the Purchase History page.
2. WHEN an owner clicks "Print Barcode" on a purchase record, THE Portal_App SHALL call `printUnifiedThermalLabel` with the batch's `barcode`, `masterName`, `dealerName`, and `sellingPrice`.
3. THE Portal_App SHALL provide a "Reprint Barcode" button in the purchase record detail panel.
4. THE Portal_App SHALL support printing barcodes in the existing TSPL / browser-print format used by the existing `printUnifiedThermalLabel` function without introducing new print libraries.
5. IF the browser blocks the print popup, THEN THE Portal_App SHALL display the message "Allow popups to print barcode labels" to the owner.

---

### Requirement 7: Stock Synchronisation Fix

**User Story:** As an owner, I want stock levels to remain consistent across the POS, product page, Owner Portal, and website after every sale, so that I always see the correct available quantity without needing to refresh.

#### Acceptance Criteria

1. WHEN a POS sale is saved via `POST /api/sales`, THE Server SHALL complete the stock deduction from both the Stock_Entry `currentQuantity` and the Master_Product `stock` field before returning the HTTP response to the client.
2. WHEN a website order is saved via `POST /api/orders`, THE Server SHALL complete the stock deduction from both the Stock_Entry `currentQuantity` and the Master_Product `stock` field before returning the HTTP response to the client.
3. WHEN any stock-changing operation completes on the server, THE Server SHALL set `productsCache` to `null` and `cacheTimestamp` to `0` before emitting the `product-updated` Socket_IO event.
4. WHEN the Portal_App receives a `product-updated` Socket_IO event, THE Portal_App SHALL update the matching product's `stock` value in its local `this.products` array without triggering a full page fetch from the server.
5. WHEN a client calls `GET /api/products`, THE Server SHALL always respond with the current stock values from the database (never from a stale cache entry written before a sale completed).
6. THE Portal_App SHALL NOT optimistically update its local product stock on the client side before receiving confirmation from the server; all stock changes SHALL originate from server-side Socket_IO events.
7. WHEN the Owner Portal product list is rendered after a sale, THE Portal_App SHALL display the stock value received from the most recent `product-updated` event or from a fresh `GET /api/products` response — not a value held only in `localStorage`.

---

### Requirement 8: Stock Inventory Page (Replaces Full Stock)

**User Story:** As an owner, I want a consolidated stock inventory view showing all current stock levels, so that I can monitor overall inventory at a glance.

#### Acceptance Criteria

1. THE Portal_App SHALL render the Stock Inventory page at route `admin-stock-inventory` when navigated to.
2. WHEN the Stock Inventory page loads, THE Portal_App SHALL fetch and display all Master_Product records sorted by product name, showing product name, category, current stock quantity, minimum stock threshold, and stock status (In Stock / Low Stock / Out of Stock).
3. THE Portal_App SHALL display a "Low Stock" indicator for any product whose `stock` value is greater than 0 but less than or equal to `minStock`.
4. THE Portal_App SHALL display an "Out of Stock" indicator for any product whose `stock` value is 0.
5. THE Portal_App SHALL support filtering the stock list by status (All / In Stock / Low Stock / Out of Stock).
6. THE Portal_App SHALL support text search over the stock list by product name or category.
7. THE Portal_App SHALL display a summary row at the top of the page showing total product count, total in-stock count, total low-stock count, and total out-of-stock count.

---

### Requirement 9: Backward Compatibility and Data Integrity

**User Story:** As an owner, I want all existing portal features to continue working without data loss, so that daily operations are not interrupted during or after the upgrade.

#### Acceptance Criteria

1. THE Portal_App SHALL preserve all existing page routes and functionality: `admin-login`, `admin`, `admin-products`, `admin-tracking`, `admin-orders`, `admin-sales`, `admin-display-stock`, `admin-spare-parts`, `admin-pos`, `admin-service`, and `admin-settings`.
2. THE Server SHALL NOT delete, rename, or change the schema of any existing MongoDB collection (`Product`, `Tracking`, `Order`, `SalesRecord`, `ServiceRecord`, `DisplayStock`, `SpareParts`, `Distributor`, `StockEntry`, `StockMovement`).
3. THE Server SHALL NOT change the primary key field names `distributorId`, `stockId`, or `barcode` on existing records.
4. WHEN the barcode scanning feature is added to the POS, THE Portal_App SHALL retain the existing manual product-name search as a parallel input method.
5. WHEN new nav links are added and old ones are removed, THE Portal_App SHALL ensure the dashboard (`admin`) page quick-action buttons are updated to reflect the new module names so that no button navigates to a removed route.
