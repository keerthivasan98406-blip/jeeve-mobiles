# Requirements Document

## Introduction

This document defines the requirements for a white-label rebuild of an existing mobile shop website. The source codebase is the **Manjula Mobile World** application — a full-stack Node.js + Express + MongoDB + Socket.IO platform with a vanilla HTML/CSS/JS frontend. The goal is to produce a fully independent, rebranded instance of the same platform for a new shop owner: new shop name, new MongoDB Atlas database, new server deployment, new admin credentials, new SEO identity, and new license — while keeping every pixel of the UI and every line of functional logic exactly as-is.

The new shop owner provides their own shop details (name, phone, email, address, UPI ID, business start year, etc.) as configurable parameters. Those values are treated as inputs throughout this document, referred to by placeholder tokens in `[BRACKETS]`.

---

## Glossary

- **Source Site**: The original Manjula Mobile World deployment used as the reference implementation.
- **New Site**: The rebuilt, rebranded deployment produced by this project.
- **Shop_Config**: The set of new-owner-provided values (shop name, phone, email, address, UPI ID, start year, deployment URL, Google verification code, etc.) that replace all Manjula-specific branding.
- **Admin**: The single privileged owner/operator account that can access the Owner Portal.
- **Owner_Portal**: The password- and OTP-protected admin dashboard (`/owner.html`) for managing all backend data.
- **OTP**: A 6-digit one-time password sent to the Admin's registered email for two-factor login.
- **Env_File**: The server-side `.env` file containing all secrets and configuration values.
- **MongoDB_Atlas**: The cloud MongoDB service used for all persistent data storage.
- **Render**: The cloud platform used to host and run the Node.js server (or equivalent PaaS).
- **SEO_Bundle**: The set of files and HTML metadata that define the New Site's search-engine identity: `index.html` meta tags, `sitemap.xml`, `robots.txt`, `business-info.json`, Google site-verification HTML file, and JSON-LD schema.
- **UPI**: Unified Payments Interface — the payment method used for checkout, identified by the shop's UPI ID.
- **Socket.IO**: The real-time WebSocket library used for live data sync between server and all connected clients.
- **HMAC-SHA256**: The hashing algorithm used to store and verify the Admin password without storing it in plaintext.
- **QR_ID**: A unique identifier assigned to each repair job (Tracking record) used for QR-code-based lookup.
- **keep-alive**: The background ping mechanism in `keep-alive.js` that prevents the Render free-tier server from sleeping.
- **Print_Agent**: The local Node.js agent (`print-agent/agent.js`) that connects to a thermal label printer.

---

## Requirements

---

### Requirement 1: Shop Branding Configuration

**User Story:** As the new shop owner, I want all visible shop branding (name, phone, email, address, tagline) replaced with my own details throughout the entire application, so that customers and search engines see only my shop's identity — not the original shop's.

#### Acceptance Criteria

1. THE Shop_Config SHALL contain the following configurable fields: `shopName`, `shopPhone` (primary), `shopPhone2` (optional secondary), `shopEmail`, `shopAddress`, `shopCity`, `shopRegion`, `shopPostalCode`, `shopUpiId`, `businessStartYear`, `deploymentUrl`, `tagline`, and `alternateName` (array).

2. WHEN the application is deployed, THE New_Site SHALL display `shopName` in every location where "Manjula Mobile World" currently appears, including: the scrolling top-header ticker, the navbar brand title, the loading screen heading, the page `<title>` tag, the OTP email subject and body, and the footer (if present).

3. WHEN the application is deployed, THE New_Site SHALL display `shopPhone` (and `shopPhone2` if provided) in every location where "+91 82484 54841 / 9840694616" currently appears, including the top-header ticker and the contact section.

4. WHEN the application is deployed, THE New_Site SHALL display `shopEmail` in every location where "manjulamobiles125@gmail.com" currently appears, including the top-header ticker and any contact links.

5. WHEN the application is deployed, THE New_Site SHALL display `shopAddress`, `shopCity`, and `shopRegion` in every location where "Ramapuram, Tamil Nadu" currently appears, including the top-header ticker and the about/contact section.

6. THE New_Site SHALL NOT contain the string "Manjula" anywhere in rendered page content, meta tags, JSON-LD schema, email templates, or JavaScript class names visible to end users.

7. WHEN a visitor loads any page, THE New_Site SHALL display the new shop's `shopName` as the primary brand, with no reference to the original shop's identity.

---

### Requirement 2: Frontend UI Preservation

**User Story:** As the new shop owner, I want the complete look, layout, and user experience of the site to remain identical to the source site, so that customers get a proven, polished experience without any redesign cost.

#### Acceptance Criteria

1. THE New_Site SHALL preserve `styles.css` in its entirety — all CSS rules, class names, colour values (red gradient theme `#dc2626` / `#b91c1c`), animation definitions, responsive breakpoints, and component styles — with no modifications except replacing hardcoded shop-name strings in CSS comments (if any).

2. THE New_Site SHALL preserve the complete structure and logic of `script.js`, including the `ManjulaMobilesApp` class (which MAY be renamed to reflect the new shop but MUST retain all methods, event delegation, Socket.IO listeners, cart logic, checkout flow, tracking lookup, carousel, and page-routing functions).

3. THE New_Site SHALL preserve the complete HTML structure of `index.html`, including all `<section>`, `<div>` layout hierarchies, data attributes (`data-page`, `data-action`), and script/stylesheet references.

4. THE New_Site SHALL preserve the complete Owner Portal (`owner.html` + `owner-script.js`), including the `OwnerPortalApp` class, all admin sections (Products, Orders, Tracking, Sales Records, Service Records, Display Stock, Spare Parts, POS Billing), and all UI components.

5. WHEN a visitor uses the site on any screen size, THE New_Site SHALL render with the same responsive behaviour as the source site, including the fixed top-header, fixed navbar, mobile hamburger menu, hero carousel, product cards, cart sidebar, and checkout flow.

6. THE New_Site SHALL preserve all four hero carousel images from `client/public/assets/images/` unless the new owner provides replacement images.

7. IF the new owner provides replacement carousel images, THEN THE New_Site SHALL substitute them with no change to the carousel HTML/CSS/JS mechanism.

---

### Requirement 3: MongoDB Atlas Database — New Instance

**User Story:** As the new shop owner, I want my own independent MongoDB Atlas database, so that my shop's data (products, orders, repairs, sales) is completely separate from the original shop and under my own account.

#### Acceptance Criteria

1. THE New_Site SHALL connect exclusively to a new MongoDB Atlas cluster provisioned under the new owner's account, identified by a new `MONGO_URI` connection string stored in the Env_File.

2. THE New_Site SHALL use the same six Mongoose schemas as the source site — `Product`, `Tracking`, `Order`, `SalesRecord`, `ServiceRecord`, `DisplayStock`, `SpareParts` — with identical field names, types, indexes, and `strict: false` / `timestamps: true` options where present in the source.

3. WHEN the server starts for the first time against the new database, THE Server SHALL create all required collections and indexes automatically via Mongoose's schema registration (no manual DB setup required beyond providing the URI).

4. THE New_Site SHALL NOT share any database connection, collection, or data with the source site's MongoDB cluster.

5. IF the MongoDB connection fails at startup, THEN THE Server SHALL log the error and continue running in offline mode, serving fallback product data to the frontend as the source site does.

6. THE Server SHALL use the same MongoDB connection pool settings as the source: `maxPoolSize: 20`, `minPoolSize: 5`, `serverSelectionTimeoutMS: 15000`, `socketTimeoutMS: 30000`, `connectTimeoutMS: 15000`, `family: 4`.

---

### Requirement 4: Admin Authentication — New Credentials

**User Story:** As the new shop owner, I want a new, private set of admin credentials (phone, password, OTP email) that only I know, so that the original developer has no access to my Owner Portal.

#### Acceptance Criteria

1. THE Env_File SHALL contain a new `ADMIN_PHONE` value set to the new owner's chosen admin phone number.

2. THE Env_File SHALL contain a new `ADMIN_SALT` value (a unique string chosen for this deployment) and a new `ADMIN_PASSWORD_HASH` value that is the HMAC-SHA256 of the new admin password computed with the new salt — replacing the source site's salt (`mmw2026`) and hash entirely.

3. THE Server SHALL verify admin login by computing `HMAC-SHA256(ADMIN_SALT, inputPassword)` and comparing to `ADMIN_PASSWORD_HASH`, with no hardcoded fallback credentials in server code (all values come exclusively from the Env_File).

4. WHEN an admin login attempt is made with invalid phone or password, THE Server SHALL return HTTP 401 and log a warning without revealing which field was incorrect.

5. THE Env_File SHALL contain a new `ADMIN_BACKUP_OTP` — a static emergency OTP code chosen by the new owner — replacing the source value (`984069`).

6. THE OTP email sent during admin login SHALL reference the new shop's `shopName` and be delivered to the email address configured in `SMTP_USER` (the new owner's email).

7. THE Env_File SHALL contain new SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) for the new owner's email account, OR a new `RESEND_API_KEY` for the Resend HTTP API, OR both — replacing all source SMTP/Resend credentials.

8. WHEN both Resend and SMTP are configured, THE Server SHALL use Resend as primary in production and SMTP as primary in development, matching the source site's delivery-order logic.

9. WHEN an OTP is generated, THE Server SHALL store it in-memory with a 5-minute expiry and delete it after successful verification, identical to the source site's behaviour.

10. THE Owner_Portal login page SHALL use the `localStorage` key reflecting the new shop name (e.g., `[shopSlug]_admin_logged_in`) rather than `manjula_admin_logged_in`, so there is no session collision if both sites are ever accessed from the same browser.

---

### Requirement 5: Server Deployment — New Service

**User Story:** As the new shop owner, I want the backend deployed under a new, independent hosting service or service name, so that my site has its own URL and is not dependent on the original developer's hosting account.

#### Acceptance Criteria

1. THE New_Site SHALL be deployable to a new Render web service (or equivalent PaaS) under the new owner's account, with a service name derived from `shopName`.

2. THE `render.yaml` SHALL be updated so that `services[0].name` matches the new shop's service name (e.g., `[shop-slug]-mobiles`), replacing `manjula-mobiles`.

3. WHEN deployed, THE Server SHALL be reachable at the new deployment URL (`deploymentUrl` from Shop_Config), with no CORS or redirect behaviour referencing the old Render URL.

4. THE `script.js` GitHub Pages fallback URL (currently `https://manjulamobilesworld.onrender.com`) SHALL be updated to `deploymentUrl`, so that a GitHub Pages frontend correctly calls the new backend.

5. THE Server SHALL continue to expose the `/health` and `/ping` endpoints for uptime monitoring.

6. THE keep-alive service (`keep-alive.js`) SHALL target the new deployment URL for its self-ping requests, replacing all references to the source URL.

---

### Requirement 6: SEO Identity — New Shop

**User Story:** As the new shop owner, I want the site's SEO metadata to represent my shop exclusively, so that search engines index my business correctly and customers can find me.

#### Acceptance Criteria

1. THE `<title>` tag in `index.html` SHALL be set to `"[shopName] - Mobile Repair & Parts | [shopCity], [shopRegion]"` (using Shop_Config values).

2. THE `<meta name="description">` tag SHALL describe the new shop using `shopName`, `shopCity`, `shopRegion`, and `shopPhone`.

3. THE `<meta name="keywords">` tag SHALL contain keywords derived from `shopName`, `shopCity`, `shopRegion`, and relevant mobile repair terms, with no reference to "Manjula" or "Ramapuram" (unless those are the new shop's values).

4. THE Open Graph tags (`og:title`, `og:description`, `og:url`, `og:site_name`) SHALL reference the new shop's `shopName` and `deploymentUrl`.

5. THE Twitter Card tags SHALL reference the new shop's `shopName`.

6. THE `<meta name="google-site-verification">` tag SHALL contain the new owner's Google Search Console verification token, replacing `google5739f7b57b6f777b`.

7. THE JSON-LD `LocalBusiness` schema in `index.html` SHALL be fully replaced with the new shop's details: `name`, `url`, `telephone`, `email`, `address` (all sub-fields), `openingHours`, and `sameAs`.

8. THE `client/business-info.json` SHALL be replaced with new content reflecting all Shop_Config values, following the same JSON-LD `LocalBusiness` schema structure as the source file.

9. THE `client/sitemap.xml` SHALL be updated so all `<loc>` URLs reference `deploymentUrl` (and the new GitHub Pages URL if applicable), with `<lastmod>` set to the deployment date.

10. THE `client/robots.txt` SHALL allow all crawlers (`User-agent: *`, `Allow: /`) and set `Sitemap:` to `[deploymentUrl]/sitemap.xml`.

11. THE Google site-verification HTML file (`client/google5739f7b57b6f777b.html`) SHALL be replaced with a new file named after the new owner's Google verification token (e.g., `client/google[NEW_TOKEN].html`) with content matching Google's required format.

12. THE server route that serves the Google verification file SHALL be updated to reference the new filename, so GET `/google[NEW_TOKEN].html` serves the correct file.

---

### Requirement 7: Package Metadata and License

**User Story:** As the new shop owner, I want the project's package.json files and LICENSE to reflect my shop and ownership, so that the codebase is correctly attributed and the license is appropriate.

#### Acceptance Criteria

1. THE root `package.json` `name` field SHALL be set to a kebab-case slug derived from `shopName` (e.g., `[shop-slug]-world`), replacing `manjula-mobiles-world`.

2. THE root `package.json` `description` field SHALL describe the new shop.

3. THE root `package.json` `repository.url` SHALL be set to the new owner's GitHub repository URL, replacing the source repo URL.

4. THE root `package.json` `author` field SHALL be set to the new owner's name.

5. THE `server/package.json` `name` field SHALL be updated to match the new shop slug.

6. THE `server/package.json` `description` field SHALL describe the new shop's backend.

7. THE `LICENSE` file SHALL be replaced with a new license appropriate to the new owner's preference (e.g., MIT with new owner name and current year), with no reference to the original copyright holder.

---

### Requirement 8: Environment Variables — Complete Replacement

**User Story:** As the new shop owner, I want a clean `.env` file containing only my own credentials and configuration values, so that no original shop secrets are present in my deployment.

#### Acceptance Criteria

1. THE Env_File SHALL contain a new `MONGO_URI` pointing to the new MongoDB Atlas cluster.

2. THE Env_File SHALL contain a new `ADMIN_PHONE` (new owner's phone number).

3. THE Env_File SHALL contain a new `ADMIN_SALT` (unique string for this deployment).

4. THE Env_File SHALL contain a new `ADMIN_PASSWORD_HASH` (HMAC-SHA256 of new password with new salt).

5. THE Env_File SHALL contain a new `ADMIN_BACKUP_OTP` (new owner's chosen emergency code).

6. THE Env_File SHALL contain new SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) for the new owner's email account.

7. THE Env_File SHALL contain a new `RESEND_API_KEY` for the new owner's Resend account (if using Resend).

8. THE Env_File SHALL contain `LABEL_PRINTER_NAME` set to the new owner's thermal printer model, or retain the default if the same printer is used.

9. THE Env_File SHALL NOT contain any credential, URI, API key, phone number, or secret value from the source site's `.env`.

10. THE `server/.gitignore` SHALL include `.env` to prevent secrets from being committed to the new repository.

---

### Requirement 9: Backend API and Architecture Preservation

**User Story:** As the new shop owner, I want all backend API endpoints, Socket.IO events, and server logic to work identically to the source site, so that the frontend continues to function without any code changes to the API layer.

#### Acceptance Criteria

1. THE Server SHALL expose all REST API endpoints at the same paths as the source site:
   - `GET/POST /api/products`, `PATCH/DELETE /api/products/:id`
   - `GET/POST /api/tracking`, `PATCH/DELETE /api/tracking/:qrId`
   - `GET/POST /api/orders`, `PATCH/DELETE /api/orders/:orderId`
   - `GET/POST /api/sales`, `PATCH/DELETE /api/sales/:saleId`
   - `GET/POST /api/services`, `PATCH/DELETE /api/services/:serviceId`
   - `GET/POST /api/display-stock`, `PATCH/DELETE /api/display-stock/:stockItemId`
   - `GET/POST /api/spare-parts`, `PATCH/DELETE /api/spare-parts/:partItemId`
   - `POST /api/admin/send-otp`, `POST /api/admin/login`
   - `GET /health`, `GET /ping`
   - `GET /sitemap.xml`, `GET /robots.txt`, `GET /business-info.json`, `GET /google[TOKEN].html`

2. THE Server SHALL emit the same Socket.IO events as the source site: `product-added`, `product-updated`, `product-deleted`, `tracking-added`, `tracking-updated`, `tracking-deleted`, `order-added`, `order-updated`, `order-deleted`.

3. THE Server SHALL use the same in-memory product cache mechanism (60-second TTL, invalidated on POST/PATCH/DELETE) as the source site.

4. THE Server SHALL use the same fallback products array for offline mode as the source site (or an equivalent set for the new shop).

5. THE Server SHALL preserve the `50mb` JSON payload limit for base64 payment screenshot uploads.

6. WHEN a product is created or updated, THE Server SHALL emit the appropriate Socket.IO event to all connected clients.

7. THE Server SHALL preserve the MongoDB connection diagnostic logic (dropping the `id_1` index on startup if it exists).

8. THE Server SHALL serve all static files from the `client/` directory using Express static middleware with `no-cache` headers for `.js`, `.html`, and `.css` files.

---

### Requirement 10: UPI Checkout Flow

**User Story:** As a customer, I want to pay for products via UPI by scanning a QR code and uploading a payment screenshot, so that I can complete a purchase online.

#### Acceptance Criteria

1. WHEN a customer initiates UPI checkout, THE New_Site SHALL display a UPI QR code generated from `shopUpiId` (from Shop_Config), replacing the source UPI ID `9894703254@upi`.

2. THE `script.js` `upiLink` property SHALL be set to `shopUpiId` at initialisation, so that all QR code generation and UPI deep-link buttons use the new shop's UPI ID.

3. WHEN a customer uploads a payment screenshot, THE Server SHALL accept a base64-encoded image in the `paymentScreenshot.data` field of the order POST body and store it in MongoDB, with no changes to the upload mechanism.

4. WHEN an admin views an order in the Owner Portal, THE Owner_Portal SHALL display the payment screenshot inline, allowing the admin to verify payment.

5. WHEN a UPI payment order is placed, THE Server SHALL set the order status to `"Payment Verification Pending"` and emit an `order-added` Socket.IO event to notify the admin in real time.

---

### Requirement 11: Repair Job Tracking System

**User Story:** As a customer, I want to look up the status of my mobile repair job using a QR code or job ID, so that I can know when my device will be ready without calling the shop.

#### Acceptance Criteria

1. WHEN a customer scans the QR code on their repair receipt, THE New_Site SHALL look up the QR_ID against the `Tracking` collection in the new MongoDB database and display the repair status.

2. THE Tracking schema SHALL preserve all fields from the source: `qrId`, `qrPassword`, `customerName`, `productName`, `deviceModel`, `contact`, `address`, `dateIn`, `dateOut`, `status`, `issue`, `estimatedDays`, `amount`, `advanceAmount`, `paidAmount`, `totalReceived`, `balanceAmount`, `balancePaidDate`, `createdAt`, `completedAt`, `lastUpdated`.

3. WHEN an admin updates a tracking record's status in the Owner Portal, THE Server SHALL persist the change to the new MongoDB database and emit a `tracking-updated` Socket.IO event.

4. WHEN a new tracking record is created, THE Server SHALL assign a unique `qrId` and return it so the admin can print a QR label.

---

### Requirement 12: Owner Portal — Full Feature Parity

**User Story:** As the new shop owner, I want the complete Owner Portal dashboard with all management sections working against my new database, so that I can manage products, orders, repairs, sales, services, and stock from day one.

#### Acceptance Criteria

1. THE Owner_Portal SHALL require two-factor authentication: correct phone + password (verified via HMAC-SHA256 against new credentials) AND a valid 6-digit OTP sent to the new owner's email.

2. THE Owner_Portal SHALL provide a Products section where the admin can create, read, update, and delete products, with changes reflected in real time on the customer-facing site via Socket.IO.

3. THE Owner_Portal SHALL provide an Orders section where the admin can view all orders (including payment screenshots), update order status, and delete orders.

4. THE Owner_Portal SHALL provide a Tracking section where the admin can create, update, and delete repair job records, with QR_ID generation for customer receipts.

5. THE Owner_Portal SHALL provide a Sales Records section where the admin can log and review product sales, including multi-item sales with IMEI tracking.

6. THE Owner_Portal SHALL provide a Service Records section where the admin can log and review repair service transactions.

7. THE Owner_Portal SHALL provide a Display Stock section where the admin can track stock levels and history for display items.

8. THE Owner_Portal SHALL provide a Spare Parts section where the admin can track stock levels, owner price, and customer price for spare parts inventory.

9. THE Owner_Portal SHALL provide a POS Billing section for in-store sales, preserving all existing billing cart logic.

10. WHEN the admin logs out, THE Owner_Portal SHALL clear the login state from `localStorage` using the new shop's key (not `manjula_admin_logged_in`).

11. THE Owner_Portal `shopConfig` default values stored in `localStorage` SHALL reference the new shop's name, phone, email, address, and tagline — not the source shop's defaults.

---

### Requirement 13: Print Agent — Configurable Printer

**User Story:** As the new shop owner, I want the local print agent to work with my own thermal label printer, so that I can print repair job QR labels from the Owner Portal.

#### Acceptance Criteria

1. THE Print_Agent (`print-agent/agent.js`) SHALL read the printer name from the `LABEL_PRINTER_NAME` environment variable, so the new owner can configure their printer model without modifying source code.

2. THE `LABEL_PRINTER_NAME` value in the Env_File SHALL be set to the new owner's printer model, replacing the source value (`Zenpert 4T520`) if a different printer is used.

3. THE Print_Agent startup scripts (`start-agent.bat`, `setup-autostart.bat`) SHALL not contain hardcoded references to the source shop's name in any user-visible output.

---

### Requirement 14: Keep-Alive Service

**User Story:** As the new shop owner, I want the keep-alive service to ping my server so that the free-tier Render instance does not sleep between customer visits.

#### Acceptance Criteria

1. THE keep-alive service (`keep-alive.js`) SHALL send periodic ping requests to the new deployment URL (`deploymentUrl`) at the same interval as the source site.

2. THE `keep-alive.js` file SHALL contain no hardcoded references to the source site's Render URL (`https://manjulamobilesworld.onrender.com`).

3. IF the ping request fails, THEN THE keep-alive service SHALL log the error and retry at the next scheduled interval without crashing the server process.

---

### Requirement 15: Repository and Git Configuration

**User Story:** As the new shop owner, I want the codebase in my own GitHub repository with no links back to the original developer's repository, so that I have full ownership and control of the source code.

#### Acceptance Criteria

1. THE New_Site's git remote origin SHALL point to the new owner's GitHub repository, not `https://github.com/keerthivasan98406-blip/manjulamobilesworld.git`.

2. THE `server/.gitignore` and root `.gitignore` (if present) SHALL include `.env` to prevent secrets from being pushed.

3. THE `render.yaml` `autoDeploy` flag SHALL be set to `true` so that pushes to the `main` branch automatically trigger a new deployment.

4. THE `.github/workflows/` directory MAY be cleared or updated to reflect the new repo's CI/CD needs; no workflow SHALL reference the source repo.

---

### Requirement 16: Functional Smoke-Test Checklist

**User Story:** As the new shop owner, I want a clear acceptance checklist to verify the rebuild is complete and correct before going live.

#### Acceptance Criteria

1. WHEN a visitor opens the New Site's deployment URL, THE New_Site SHALL load the home page with the new shop name in the navbar, the scrolling top-header ticker showing the new phone and email, and the hero carousel displaying correctly — all within 7 seconds.

2. WHEN a visitor navigates to the Products page, THE New_Site SHALL display products fetched from the new MongoDB Atlas database (or fallback data if empty).

3. WHEN a visitor adds a product to the cart and proceeds to UPI checkout, THE New_Site SHALL display a UPI QR code encoded with the new shop's UPI ID.

4. WHEN an admin visits `/owner.html` and enters the new phone, new password, and a valid OTP sent to the new email, THE Owner_Portal SHALL grant access and display the admin dashboard.

5. WHEN an admin creates a product in the Owner Portal, THE Server SHALL persist it to the new MongoDB database and emit a `product-added` Socket.IO event that updates the customer-facing products page in real time.

6. WHEN a search engine crawler requests `/sitemap.xml`, THE New_Site SHALL return the updated sitemap referencing the new deployment URL.

7. WHEN a search engine crawler requests `/robots.txt`, THE New_Site SHALL return a valid robots.txt with `Sitemap:` pointing to the new URL.

8. WHEN Google Search Console requests `/google[NEW_TOKEN].html`, THE New_Site SHALL serve the correct verification file for the new owner's Search Console property.

9. WHEN the server receives a request to `/health`, THE Server SHALL return a JSON response with `database: "connected"` confirming the new MongoDB Atlas connection is active.

10. THE New_Site SHALL contain no visible occurrence of "Manjula", "manjulamobilesworld.onrender.com", "manjulamobiles125@gmail.com", "+91 82484 54841", or "9840694616" in any page rendered to the end user.
