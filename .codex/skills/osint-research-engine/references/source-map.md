# OSINT Source Map

## Query Patterns

- Exact name: `"Nombre Apellido"` plus city, role, institution, party, company, or date.
- Variants: `"Apellido Nombre" OR "N. Apellido" OR "Nombre A."`
- Official only: `site:gov.ar`, `site:gob.ar`, `site:boletinoficial.gob.ar`, `site:jus.gob.ar`.
- Documents: `filetype:pdf`, `filetype:xls`, `filetype:doc`, `filetype:csv`.
- Proceedings: `"Nombre Apellido" (decreto OR resolucion OR disposicion OR licitacion OR contratacion OR expediente)`.
- Companies: `"razon social" OR "CUIT" OR "directorio" OR "accionista" OR "apoderado"`.
- Archives: use the Wayback Machine and official cached pages where lawful.

## People

Collect only proportionate public facts. Useful categories:

- Official role history: appointments, decrees, agency pages, legislative bios.
- Declarations: legally public asset disclosures, interests, incompatibilities.
- Electoral: candidacies, donations, party affiliations when public.
- Corporate: directorships, beneficial ownership where public, procurement links.
- Media: interviews, allegations, corrections, right-of-reply.
- Social: verified accounts, public posts relevant to mandate or public role.

## Institutions

- Legal creation, mandate, authorities, budget, org chart.
- Procurement, tenders, awards, suppliers, audit findings.
- Sanctions, litigation, regulatory findings.
- Public communications and archived changes.
- Staff transitions and revolving-door indicators.

## Companies

- Legal name, tax ID, incorporation, directors, shareholders when public.
- Domains, websites, brand names, addresses, phones, emails.
- Public contracts, sanctions, bankruptcy, litigation, import/export clues.
- Related entities by shared directors, addresses, emails, phone numbers, procurement clusters.

## Digital Identifiers

- Username: search across platforms, archives, code repos, forums. Confirm by avatar, bio, links, timing, language, and cross-links.
- Email: search exact email, domain ownership clues, breach claims only as leads; do not use leaked credentials or private breach data.
- Domain/IP: WHOIS/RDAP, DNS, certificates, passive DNS where lawful, web archives, technology fingerprints.
- Images/docs: reverse image search, EXIF/metadata extraction on files the user lawfully provides, OCR, hashes, publication context.

## Confidence Rules

- High: primary/official source or two strong independent sources with matching identifiers.
- Medium: reputable secondary source plus partial corroboration.
- Low: single secondary source, social post, forum mention, weak entity match, or unresolved homonym.

## Evidence Log Fields

Record: target, claim, source URL, source title, publisher, source type, publication date, access date, archive URL, quote/excerpt, identifiers matched, confidence, caveats, next step.

## Prohibited Methods

Do not: bypass captcha/paywall/login, scrape against terms or technical controls, impersonate, phish, use leaked credentials, deanonymize private individuals without legitimate public-interest basis, infer protected traits unnecessarily, or publish home addresses/private contact details unless clearly official and necessary.
