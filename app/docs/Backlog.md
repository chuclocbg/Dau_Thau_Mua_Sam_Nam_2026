# Architecture Backlog

Items recorded during implementation. Do not implement unless Program Manager instructs.

---

## Module A1 — Legal Document Importer

- **PDF binary extraction**: `pdfjs-dist` (browser build) for real PDF→text. Current path accepts pre-extracted text only. Add when Vietnamese govt portals are integrated.
- **DOCX table preservation**: `word/document.xml` strip loses table structure. Add a table-aware XML parser when structured tables (e.g. threshold tables in Nghị định) are needed.
- **Clause detection for scanned PDFs**: current `^\d+\. ` pattern requires clean OCR. Add fuzzy matching when scanned document upload is a requirement.

---

## Module A2 — Legal Schema

- **Prisma + PostgreSQL backend**: `prisma/schema.prisma` is written as a spec but not wired. Run `npx prisma init && npx prisma migrate dev` when a Node.js server is added to the project.
- **Full-text search (PostgreSQL tsvector)**: schema includes `searchVector` placeholder. Activate when PostgreSQL is live — requires `pg_trgm` extension and trigger on `legal_documents`.
- **LegalVersion event sourcing**: current version model is snapshot-based. Consider append-only event log if amendment audit trail becomes a compliance requirement.
