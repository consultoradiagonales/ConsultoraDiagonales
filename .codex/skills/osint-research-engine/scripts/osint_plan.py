import argparse
from datetime import date


SOURCE_LAYERS = {
    "person": [
        "official role records and appointments",
        "asset or interest declarations where legally public",
        "electoral and party records",
        "corporate directorships and procurement links",
        "court, audit, regulatory, and media archives",
        "public social profiles relevant to the objective",
    ],
    "company": [
        "corporate registry and tax-status public pages",
        "directors, shareholders, addresses, domains, phones, emails",
        "public procurement, tenders, awards, sanctions",
        "litigation, bankruptcy, regulatory actions",
        "web archives, DNS/RDAP, certificates, technology footprint",
        "media, trade publications, social profiles",
    ],
    "institution": [
        "legal mandate, authorities, budget, org chart",
        "official gazettes, decrees, resolutions, appointments",
        "procurement, suppliers, audits, subsidies",
        "court, regulatory, and legislative records",
        "official communications and archived pages",
        "media coverage and stakeholder networks",
    ],
    "digital": [
        "exact identifier search across engines",
        "archives and cached public pages",
        "platform profile cross-links",
        "domain/IP/DNS/RDAP/certificate records",
        "metadata on lawfully provided files",
        "reputation and abuse databases where lawful",
    ],
}


def build_queries(target, target_type, jurisdiction, objective):
    base = [
        f'"{target}"',
        f'"{target}" "{jurisdiction}"',
        f'"{target}" "{objective}"',
        f'"{target}" filetype:pdf',
        f'"{target}" (decreto OR resolucion OR disposicion OR licitacion OR contratacion OR expediente)',
        f'"{target}" (denuncia OR causa OR sancion OR auditoria OR tribunal)',
    ]
    if "Argentina" in jurisdiction:
        base.extend([
            f'"{target}" site:boletinoficial.gob.ar',
            f'"{target}" site:argentina.gob.ar',
            f'"{target}" site:comprar.gob.ar OR site:contrataciones.gov.ar',
        ])
    if target_type == "company":
        base.extend([
            f'"{target}" (CUIT OR directorio OR accionista OR apoderado)',
            f'"{target}" (proveedor OR licitacion OR adjudicacion OR contrato)',
        ])
    return base


def main():
    parser = argparse.ArgumentParser(description="Generate a lawful OSINT research plan.")
    parser.add_argument("--target", required=True)
    parser.add_argument("--type", default="person", choices=["person", "company", "institution", "digital"])
    parser.add_argument("--jurisdiction", default="unspecified")
    parser.add_argument("--objective", default="general due diligence")
    args = parser.parse_args()

    print(f"# OSINT Research Plan: {args.target}")
    print(f"Generated: {date.today().isoformat()}")
    print(f"Type: {args.type}")
    print(f"Jurisdiction: {args.jurisdiction}")
    print(f"Objective: {args.objective}\n")

    print("## Source Layers")
    for item in SOURCE_LAYERS[args.type]:
        print(f"- {item}")

    print("\n## Starter Queries")
    for query in build_queries(args.target, args.type, args.jurisdiction, args.objective):
        print(f"- {query}")

    print("\n## Evidence Fields")
    print("- claim, source URL, publisher, date published, date accessed, identifiers matched, confidence, caveats")

    print("\n## Compliance")
    print("- Use open and authorized sources only. Do not bypass captchas, paywalls, logins, or access controls.")


if __name__ == "__main__":
    main()
