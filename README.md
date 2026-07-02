<p align="center">
  <img src="docs/GeoResponde.png" alt="GeoResponde" width="180">
</p>

<h1 align="center">
GeoResponde
</h1>

<p align="center">

<b>Open Federated Geospatial Situation Room</b>

Connecting Scientific Intelligence with Humanitarian Response.

</p>

<p align="center">

<a href="https://www.georesponde.app">🌐 Live Demo</a>
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

GeoResponde is an open-source federated humanitarian platform that connects trusted organizations instead of replacing them.

The platform combines scientific intelligence, federated humanitarian search and federated reporting into a single operational environment designed for emergency response.

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

### Report

Operations

GeoResponde now includes a federated reporting workflow capable of routing structured reports to trusted humanitarian providers.

Current report types include:

- Missing persons
- Building damage
- Shelter / Hospital status
- Resource needs

Provider integrations are currently being tested.
---

## Current Integrations

## Humanitarian Providers

- Venezuela Te Busca
- TerremotoVenezuela
- Venezuela Reporta
- Hazlo Hoy
- Patitas a Salvo
- Venezuela Busca
- Encuéntralos
- (16+ federated providers)

## Scientific Sources

- USGS
- NASA EONET
- Sentinel-derived products
- Copernicus-derived products
- FUNVISIS
- GEM Global Active Faults Database

The platform continues to expand through the Provider SDK.

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

 Scientific Intelligence  Humanitarian Federation

                 │

          Provider Gateway

                 │

          Provider Registry

                 │

    Humanitarian Organizations
    Scientific Agencies
    Public Data Sources
```

---

# Current Capabilities

- Federated Search
- Federated Reporting
- Provider Registry
- Provider SDK
- Situation Room
- Scientific Intelligence Layers
- Provider Health Monitoring
- PFIF Export
---

# Technology

- - React
- TypeScript
- Fastify
- MapLibre
- Railway
- Vercel
- pnpm Workspace
- Provider Registry
- Provider SDK
- PFIF

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

# Roadmap

Current priorities

- Community onboarding
- Additional humanitarian providers
- Scientific layers
- Open Humanitarian Interface (OHI)
- Emergency Exchange Protocol (EEP)
- Common provider submission API
- Mobile optimization

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

## Current Release

**v0.5.0-alpha**

This release introduces the federated architecture that serves as the foundation for GeoResponde's next stage.

Highlights:

- Provider Registry
- Federated Search
- Federated Reporting
- Submission Router
- Provider SDK
- Situation Room redesign
- Community contribution framework

---

# License

Released under the MIT License.

---

# Acknowledgements

GeoResponde would not exist without the humanitarian organizations, scientific institutions and volunteers who openly share information during emergencies.

Our goal is to amplify their work—not replace it.
