# Fundana Provider Investigation

**Date**: July 2026
**Provider Name**: FUNDANA
**Website**: https://www.fundana.org/
**Category**: Humanitarian Aid / Ayuda humanitaria

## 1. Provider Overview
FUNDANA (Fundación Amigos del Niño que Amerita Protección) is a non-governmental organization (NGO) dedicated to protecting children in vulnerable situations in Venezuela. Their online platform is built using **Wix**. The website serves primarily as an institutional portfolio, showcasing their programs (e.g., "Grandes y Chiquiticos", "PROFAM"), sharing success stories via video testimonials, and soliciting donations.

## 2. Discovered Endpoints
An inspection of the frontend application and network requests reveals the site relies on the proprietary Wix platform architecture.

- **Wix Dynamic Model API**: `https://www.fundana.org/_api/v2/dynamicmodel` (Returns structural metadata for the Wix site).
- **Velo / Custom Functions (`_functions/*`)**: `Not Found`. No custom REST APIs for retrieving datasets were detected.
- No standard REST endpoints, GraphQL APIs, or open JSON/GeoJSON feeds are exposed.

## 3. Authentication
- The website is publicly accessible. 
- However, since there are no public data APIs, authentication for data retrieval is not applicable. Access to underlying Wix Data collections (if any exist for forms) is protected by Wix's internal authentication mechanisms and not exposed to the public.

## 4. Capabilities
- **Search**: `Unavailable`. There is no searchable, structured database of shelters, collection centers, or missing persons.
- **Submission**: `Unavailable` (via API). While the site likely uses Wix Forms for contact purposes or volunteering, there is no public-facing API to programmatically submit resource requests or reports.
- **Volunteer coordination**: `Unavailable` (via API). Coordinated manually via standard contact channels.
- **Collection centers**: `Unavailable`.
- **Resource/Donation requests**: `Unavailable` (via API). Donations are handled via static information and standard payment gateways, not through a structured resource-matching API.

## 5. Data Model Mapping
The platform lacks machine-readable data relevant to GeoResponde's normalized models:
- **People / Shelters / Hospitals / Collection Centers / Requests**: Not present in any structured, extractable format.
- The content is predominantly unstructured HTML and multimedia (videos/images) detailing their humanitarian efforts.

## 6. Integration Strategy & Limitations
Implementing an adapter is not feasible. The Provider Gateway requires machine-readable endpoints (REST, GraphQL, etc.) to query and federate data. Because FUNDANA's website is a static institutional page (Wix) without a public API, any attempt to integrate would require brittle web scraping of unstructured text, which violates GeoResponde's architecture guidelines.

## 7. Final Recommendation

### **Option C: Do not integrate at this time.**

**Reasoning**:
While FUNDANA performs critical humanitarian work for vulnerable children, their website does not expose any structured, machine-readable datasets or APIs related to emergency response, shelters, or missing persons. The platform is designed for institutional communication and fundraising, not as a data provider for federated platforms. Therefore, there is no viable technical path for the GeoResponde Provider Gateway to integrate with FUNDANA at this time.
