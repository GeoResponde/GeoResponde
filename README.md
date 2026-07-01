<p align="center">
  <img src="docs/GeoResponde.png" alt="GeoResponde" width="180">
</p>

<h1 align="center">
GeoResponde
</h1>

<p align="center">

<b>Open Geospatial Situation Room</b>

Connecting Scientific Intelligence with Humanitarian Response.

</p>

<p align="center">

<a href="https://georesponde.vercel.app">🌐 Live Demo</a> •
<a href="./CONTRIBUTING.md">Contributing</a> •
<a href="./docs">Documentation</a>

</p>

---

# Why GeoResponde?

When disasters happen, information becomes fragmented.

Humanitarian organizations publish information on separate platforms.

Scientists generate critical geospatial intelligence.

Governments, NGOs, volunteers and affected families often need to search multiple websites to understand a rapidly evolving situation.

GeoResponde exists to reconnect those pieces.

Instead of creating another isolated database, GeoResponde federates trusted information from existing organizations into a single operational view while respecting data ownership.

---

# What is GeoResponde?

GeoResponde is an open-source **Geospatial Situation Room**.

It combines three complementary capabilities:

## Situation

Scientific Intelligence

- Earthquakes
- Geological information
- Active faults
- Satellite-derived products
- Hazard layers

---

## Find

Humanitarian Network

Federated search across trusted humanitarian organizations.

Examples include:

- Missing persons
- Hospitals
- Shelters
- Collection centers
- Critical resources

GeoResponde does not replace humanitarian databases.

It connects them.

---

## Report

Operations

*(Currently in development)*

GeoResponde will provide a federated reporting workflow capable of routing structured reports to the appropriate humanitarian organizations instead of creating another isolated reporting platform.

---

# Current Integrations

| Provider | Status |
|----------|--------|
| Venezuela Te Busca | ✅ Operational |
| TerremotoVenezuela.com | 🚧 Official API integration in progress |

More providers are continuously being added.

---

# Design Principles

GeoResponde is built around a small number of core principles.

### Federation over duplication

Existing organizations already maintain valuable information.

GeoResponde connects systems instead of competing with them.

---

### Scientific intelligence supports humanitarian response

Earth science should directly improve operational decision making.

---

### Data ownership remains with providers

Organizations remain the authoritative source of their own information.

GeoResponde only federates access.

---

### Open by default

Transparency, interoperability and collaboration build trust during emergencies.

---

### Reusable beyond a single disaster

GeoResponde was initially developed in response to the 2026 Venezuela earthquake.

Its architecture is intentionally designed to support future disasters, humanitarian crises and emergency response efforts anywhere in the world.

---

# Architecture

```
                 GeoResponde

        Situation      Find       Report
             │            │           │

 Scientific Intelligence  Humanitarian Network  Operations

                 │

          Provider Gateway

                 │

    Humanitarian Organizations
    Scientific Agencies
    Public Data Sources
```

---

# Technology

- React
- TypeScript
- Fastify
- MapLibre
- pnpm Workspace
- Provider Gateway Architecture

---

# Getting Started

```bash
pnpm install

pnpm dev
```

Frontend

```
http://localhost:5173
```

Backend

```
http://localhost:3001
```

---

# Roadmap

Current priorities include:

- Additional humanitarian providers
- Official provider API integrations
- Federated reporting
- Scientific intelligence layers
- Improved contributor tooling
- Provider SDK
- Provider templates

---

# Contributing

GeoResponde welcomes contributions from:

- Developers
- Humanitarian organizations
- Scientists
- GIS professionals
- Emergency managers
- Volunteers

New contributors should read 
```
CONTRIBUTING.md
``` 
and `docs/community/ways-to-contribute.md`
before opening a Pull Request.

---

# License

Released under the MIT License.

---

# Acknowledgements

GeoResponde would not exist without the humanitarian organizations, scientific institutions and volunteers who openly share information during emergencies.

Our goal is to amplify their work—not replace it.
