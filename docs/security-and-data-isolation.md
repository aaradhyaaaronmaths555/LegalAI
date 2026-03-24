# Security & Data Isolation

**LegalAI — Contract Review Platform**

*A one-page overview for law firms*

---

## How Your Data Is Stored

Your firm’s data—contracts, analyses, and related records—is stored in a secure cloud environment. All data is:

- **Encrypted at rest** — Data stored in the database and file storage is encrypted using industry-standard encryption.
- **Encrypted in transit** — Every connection between your browser and our servers uses TLS (HTTPS), so data cannot be read while in transit.
- **Held in enterprise-grade infrastructure** — Data is hosted on Supabase, which uses PostgreSQL and secure object storage with strict access controls.

Your firm does **not** receive direct database access. All interaction with your data happens only through the LegalAI web application, exports you request, and (if applicable) a future read-only API.

---

## How We Isolate Each Law Firm

LegalAI is a **multi-tenant** platform: multiple law firms use the same underlying system. Strict isolation ensures that each firm can only access its own data.

- **Tenant tagging** — Every record (contracts, users, analyses) is tagged with a unique firm identifier.
- **Row-level security** — Database security rules enforce that a firm can read, update, or delete only rows that belong to that firm. Firm A cannot view, modify, or export Firm B’s data under any circumstances.
- **No cross-firm access** — The architecture and security policies prevent any overlap between firms. Your data stays yours.

---

## Who Can Access the Database

- **You** — Access is via the LegalAI web app only. You sign in with your credentials and see only your firm’s data.
- **LegalAI** — Only authorized platform administrators can access the database, and only for platform operations, support, and security. Access is controlled, logged, and auditable.
- **Third parties** — External parties (including other law firms) do **not** have database access. There are no shared credentials, and no direct database connections are offered to clients.

---

## Exports and Data Portability

We support your right to control and move your data.

- **Exports** — You can export your data in common formats (e.g., PDF, DOCX, CSV) through the application. These exports respect the same access rules as the app: you see only your firm’s data.
- **Data portability** — If you decide to leave the platform, we can provide a structured export of your firm’s data so you can migrate to another system.
- **No lock-in** — Your data belongs to you. Exports and data portability processes are available on request.

---

## Auditability and Logging

For transparency and compliance, we log important actions and events, including:

- User sign-ins and sign-outs
- Contract uploads
- Document reviews and analyses
- Other sensitive operations

These logs support internal security review, incident response, and audit requests when required.

---

## Summary

| Point | Detail |
|-------|--------|
| **Access** | Web app only — no direct database access for law firms |
| **Isolation** | Tenant-level isolation; Firm A cannot access Firm B’s data |
| **Encryption** | Encrypted at rest and in transit |
| **Exports** | PDF, DOCX, CSV (and other formats where available) |
| **Logging** | Logins, uploads, reviews logged for auditability |
| **Portability** | Full data export available on request |

---

*For questions about security or data handling, contact your LegalAI account manager or support.*
