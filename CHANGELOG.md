# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# v0.5.0-alpha

Release date: 2026-07-02

## Added

- Provider Registry architecture
- Shared Provider SDK
- Federated humanitarian search
- Federated reporting
- Submission Router
- PFIF support
- NASA EONET layer
- Venezuela Reporta integration
- Situation Room redesign
- Provider Health dashboard
- Building damage reporting
- Search by structured providers
- Community onboarding infrastructure

## Changed

- Provider Gateway now uses registry-based adapter loading.
- Improved deployment architecture (Railway + Vercel).
- Improved CI pipeline.

## Contributors

- @napogeof
- @Sve-nnN

## [0.2.0-alpha] - 2026-06-29

### Added
- **Situation Module (Beta)**: Fully functional geospatial mapping interface combining Scientific Intelligence (earthquakes, faults, satellite imagery).
- **Find Module (Experimental)**: Federated search capability integrated with the first live humanitarian provider (`Venezuela Te Busca`).
- **Provider Gateway Architecture**: Robust plugin system for connecting external real-world humanitarian databases via independent adapters.
- **Remix Single Fetch Transport**: Stable deserialization pipeline for Remix-based providers.
- **Internationalization (i18n)**: English and Spanish localization support out of the box.

### Changed
- Refactored frontend layer structure to distinctly separate Scientific vs Humanitarian/Logistics categories.
- Migrated away from regex parsing to structural object tree traversal for provider integrations.
- Overhauled documentation to present GeoResponde as a Geospatial Situation Room rather than just a GIS viewer.

### Removed
- Removed internal mock providers and sandbox testing scripts from the active codebase.
