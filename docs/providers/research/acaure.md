# Provider Investigation: Acaure

## Overview
**Provider Name:** Acaure (Donaciones Acaure)
**Website:** [https://www.donacionesacaure.com/](https://www.donacionesacaure.com/)
**Primary Function:** Volunteer initiative that raises funds to buy food in bulk (primarily protein) and delivers it to kitchens (cocinas) serving affected zones and hospitals.

This investigation was performed to determine whether `Acaure` can be integrated into GeoResponde.

## Objectives Review
- [x] Endpoint Discovery
- [x] Authentication
- [x] Data Model Mapping
- [x] Provider Capabilities (Search, Submit)

---

## 1. Endpoint Discovery & Authentication

### Architecture
The site is a **static HTML website** hosted on Vercel. 
- There is no traditional backend API (REST or GraphQL).
- **Search/Read:** All transparency data (deliveries, purchases, stats) is hardcoded into a static JavaScript file (`/data.js`) which assigns a `window.DONATION_DATA` object.
- **Submit/Write:** The site uses a Google Apps Script Web App (`https://script.google.com/macros/.../exec`) to receive form POSTs for users registering their monetary donations.

### Authentication
- None required. Both the `data.js` file and the Google Apps Script endpoint are public.

---

## 2. Provider Capabilities & Data Mapping

### Search Integration (Find Help)
**Outcome:** ❌ Not integrable as a Search Provider.

**Reasoning:**
GeoResponde's federated architecture maps actionable resources and needs (e.g., a clinic offering medical aid, a shelter with capacity, or a directory of psychologists). 

The data provided by Acaure in `data.js` consists entirely of **historical transparency logs**:
- `entregas`: A list of past deliveries of raw ingredients (e.g., "40 kg carne molida") to various locations (e.g., "Restaurante Misenplas", "Colegio Avila").
- `compras`: A log of bulk food purchases.
- `stats`: Total funds raised and plates served.

This data lacks:
1. **Actionability:** It does not indicate where victims can currently go to receive food, only where ingredients were previously dropped off.
2. **Contact/Location Data:** The locations (e.g., "Oceania") lack geographic coordinates, addresses, or contact information for victims to reach out.

### Submission Integration (Request Help)
**Outcome:** ❌ Not integrable as a Submission Partner.

**Reasoning:**
The only data submission capability on the Acaure website is a form to **register a monetary donation** (payment method, amount, name, email) that submits to a Google Sheet via Apps Script. 

There is no endpoint or mechanism for victims to submit a "Need" (e.g., request food or request to become a supported kitchen). Therefore, it does not fit GeoResponde's need-submission workflow.

---

## Conclusion

**Final Verdict:** ❌ The provider is not currently integrable into GeoResponde.

**Summary:** 
Acaure serves as an excellent transparency and fundraising portal for their specific volunteer initiative, but it does not operate a directory of services, an actionable map of resources, or an intake API for victims. 

**Recommendation:** 
We will not build an adapter for Acaure. No further development action is required for this provider. If Acaure eventually opens a public API for kitchens needing supplies or victims needing meals, we can revisit the integration.
