---
name: osint-research-engine
description: Legal OSINT research workflow for investigating public persons, institutions, companies, domains, events, and networks using open sources, source triage, entity resolution, evidence logging, and analyst-grade reporting. Use when asked to rastrear, investigar, perfilar, verificar, mapear vinculos, armar dossier, due diligence, boletines oficiales, declaraciones juradas, empresas, funcionarios, campañas, reputacion, dominios, redes sociales, documentos, imagenes, metadata, geolocalizacion, archivos web, or public-record research.
---

# OSINT Research Engine

## Hard Limits

Use only lawful, open, authorized sources. Do not bypass captchas, paywalls, logins, rate limits, robots.txt, access controls, private accounts, leaked credentials, or technical barriers. Do not assist stalking, doxxing, harassment, intimidation, or publication of sensitive personal data. For private persons, minimize collection and report only information directly relevant to a legitimate purpose.

If a user requests evasion or intrusive targeting, pivot to compliant alternatives: public records, consent-based verification, official requests, archived public pages, and manual review.

## Intake

Before researching, define:

- Target: person, institution, company, domain, handle, phone, email, event, document, image, or location.
- Jurisdiction and language: country, province/state, city, dates.
- Objective: due diligence, political analysis, corruption risk, reputational mapping, asset/context verification, media monitoring, fact-checking.
- Output: short brief, dossier, timeline, network map, source table, risk memo, or lead list.
- Red lines: private-person sensitivity, minors, medical/financial data, protected traits, active legal matters.

Ask only for missing facts that materially change the search path.

## Workflow

1. Normalize identifiers.
   - Names: aliases, spelling variants, accents, maiden/married names, initials.
   - Organizations: legal name, fantasy name, tax ID, directors, addresses, domains.
   - Digital: usernames, emails, phones, domains, IPs, images, docs.

2. Build query sets.
   - Use exact phrases, OR variants, date windows, jurisdiction terms, filetypes, site filters, and language variants.
   - Keep a query log: query, engine/source, date, result count, useful hits.

3. Source in layers.
   - Official records first, then primary documents, archives, reputable media, specialist databases, social platforms, forums/blogs, maps/geodata, multimedia, and metadata.
   - Separate confirmed facts from leads, allegations, and inferred links.

4. Resolve entities.
   - Match by at least two independent identifiers when possible: name + date, name + role, company + tax ID, handle + profile image, address + official registry.
   - Flag homonyms, recycled usernames, shared addresses, shell entities, and outdated records.

5. Preserve evidence.
   - Capture URL, title, publisher, date published, date accessed, archive URL when available, screenshot/file hash when relevant, and exact claim supported.
   - Prefer official or primary-source citations for high-impact claims.

6. Analyze.
   - Produce timelines, role maps, ownership/control chains, campaign/donor/media relationships, conflicts of interest, procurement links, litigation/regulatory history, and reputational risks.
   - Rate confidence: High, Medium, Low. Explain what would change the rating.

7. Report.
   - Start with key findings.
   - Include source table.
   - Include uncertainty and open leads.
   - Do not overclaim. Do not launder rumors into facts.

## Source Families

For detailed source ideas and query patterns, read `references/source-map.md`.

Use categories inspired by the OSINT Framework:

- Username, email, domain, IP, images/videos/docs.
- Social networks, messaging footprints, forums/blogs, archives.
- People search and public records.
- Business records, procurement, corporate registries.
- Transportation, maps/geolocation, property, campaign finance.
- Search engines, media, official gazettes, court/regulatory records.
- Metadata, translation, encoding/decoding, digital currency.

## Argentina And Political Analysis

For Argentina-focused political and institutional research, prioritize:

- Boletin Oficial nacional, provincial, and municipal.
- Declaraciones juradas patrimoniales where legally public.
- AFIP/ARCA public tax status pages where accessible without evasion.
- IGJ and provincial corporate registries.
- Compras publicas, contrataciones, licitaciones, convenios, subsidios.
- Poder Judicial, Ministerio Publico, tribunales de cuentas, legislatures.
- Electoral records, party records, campaign finance, appointments, decrees.
- Local media, archive snapshots, and official social accounts.

## Output Template

Use this structure unless the user asks otherwise:

```markdown
# OSINT Brief: [target]

## Key Findings
- [finding] [confidence] [source]

## Identity And Scope
- Target:
- Jurisdiction:
- Time window:
- Known identifiers:

## Timeline
| Date | Event | Source | Confidence |
|---|---|---|---|

## Network Map
| Entity | Relationship | Evidence | Confidence |
|---|---|---|---|

## Source Table
| Claim | Source | Type | Date accessed | Confidence |
|---|---|---|---|---|

## Open Leads
- [lead] / [next lawful source]

## Risks And Caveats
- [homonyms, missing records, source bias, legal sensitivity]
```

## Tools

Use `scripts/osint_plan.py` to generate a first-pass research plan from a target, jurisdiction, and objective.

Example:

```bash
python scripts/osint_plan.py --target "Empresa X" --type company --jurisdiction "Argentina, Buenos Aires" --objective "due diligence politico"
```

Use `tools/osint-google-launcher.html` in the workspace as a manual Google query launcher when the user wants the workflow to start from Google. Convert the user's question into lawful search queries, open or provide the launcher queries, then transform returned public results into an OSINT brief with source logging and confidence ratings.

Do not use personal identifiers such as DNI as the sole target for locating a person. For consented self-checks, treat DNI as a private disambiguation field and avoid publishing it in outputs.
