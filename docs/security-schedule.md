# Security Schedule

**LegalAI Contract Review Platform**

*Schedule to Terms of Service and Data Processing Addendum*

---

## 1. Architecture Overview

LegalAI is a multi-tenant software-as-a-service platform for contract review and legal document analysis. The platform operates on shared infrastructure: a managed PostgreSQL database (Supabase), object storage for contract files (Supabase Storage), and a Next.js web application as the sole client interface.

**Customer access.** Customers access the platform only through the LegalAI web application, over authenticated HTTPS connections. No direct database credentials, connection strings, or administrative access are provided to customers. Data is retrieved, created, and updated exclusively through the application and through exports that customers request.

---

## 2. Data Segregation and Multi-Tenancy

The platform serves multiple law firms (tenants) on the same underlying database. Data belonging to each firm is logically segregated.

**Tenant identification.** Every record that contains or references customer data—contracts, analyses, user profiles, and related metadata—includes a unique firm identifier (`firm_id`). This identifier links each record to a single tenant.

**Row-Level Security (RLS).** PostgreSQL Row-Level Security policies are applied to all tables that hold tenant data. These policies enforce that a query or operation may only access rows where `firm_id` equals the firm identifier of the authenticated user. A user belonging to Firm A cannot read, update, or delete data belonging to Firm B, regardless of how the query is constructed.

**Application layer.** In addition to database-level enforcement, the application layer validates that requests and operations are scoped to the authenticated user’s firm. Access control is implemented at both the database and application layers.

**Storage.** Contract files (PDF, DOCX) are stored in object storage. Storage paths incorporate the firm identifier. Access policies ensure that a user can only read or write objects associated with their firm.

---

## 3. Access Controls and Authentication

**Authentication.** User authentication is handled by Supabase Auth. Users sign in with email and password (or configured identity providers). Session tokens are used for subsequent requests.

**Authorization.** Once authenticated, a user’s firm association is determined from their profile. All data access is filtered by this firm identifier. There is no mechanism by which a user can access another firm’s data through the application or through direct database access (which customers do not have).

**Administrative access.** Only authorized LegalAI personnel may access the database and storage for platform operations, support, or security purposes. Such access is controlled, logged, and limited to what is necessary for those purposes.

---

## 4. Encryption and Storage

**Encryption in transit.** All connections between the user’s browser and the LegalAI application, and between the application and Supabase, use TLS (HTTPS). Data cannot be read in transit.

**Encryption at rest.** Data stored in the PostgreSQL database and in object storage is encrypted at rest using industry-standard encryption provided by the hosting infrastructure (Supabase / underlying cloud provider).

**No customer database access.** Customers do not receive database credentials or connection strings. Access to stored data occurs only through the web application or through exports provided by LegalAI.

---

## 5. Logging and Monitoring

LegalAI maintains logs of significant events for security, compliance, and support purposes. These include:

- User sign-ins and sign-outs
- Contract uploads
- Document reviews and analyses
- Other sensitive operations (e.g., exports, configuration changes)

Logs are retained for a defined period and used for incident response, security review, and compliance or audit requests where appropriate.

---

## 6. Data Backups and Retention

**Backups.** Database and storage backups are performed by the hosting infrastructure. Backups support recovery from operational failures and are managed according to LegalAI’s internal policies.

**Retention.** Data retention periods are defined in the applicable Terms of Service or Data Processing Addendum. LegalAI will retain Customer Data for the duration of the agreement and for any required period thereafter as specified in those documents.

---

## 7. Exports and Data Portability

**Exports.** Customers can export data through the LegalAI web application in standard formats (e.g., PDF, DOCX, CSV) where supported. Exports are limited to the customer’s own data and respect the same access controls as the application.

**Data portability.** If a customer terminates the agreement and requests a full export of their data, LegalAI will provide a structured export of the customer’s data in a machine-readable format, subject to the terms of the agreement and any applicable retention or deletion requirements. LegalAI does not lock customers into the platform; data portability is available on request.

---

## Summary of Key Points

| Topic | Detail |
|-------|--------|
| **Customer database access** | None. Customers access data only through the web application and exports. |
| **Multi-tenancy** | All tenant data tagged with `firm_id`; RLS and application logic enforce isolation. |
| **Encryption** | Data encrypted at rest and in transit (TLS). |
| **Access control** | Database (RLS) and application layers enforce per-firm access. |
| **Logging** | Sign-ins, uploads, reviews, and other operations logged. |
| **Data portability** | Structured exports available on request upon termination. |

---

*This Security Schedule may be updated from time to time. Material changes will be communicated in accordance with the Terms of Service or Data Processing Addendum.*
