# DPM CRM / Taskflow — documentatie

## Snel naar de juiste informatie

| Vraag | Document |
| --- | --- |
| Wat doet dit project en hoe begin ik? | [README](README.md) |
| Hoe werkt installatie, configuratie en beheer? | [Projecthandboek](HANDBOOK.md) |
| Wat is bewezen en wat staat open? | [Verificatie en verbeterpunten](VERIFICATION.md) |

Geïnventariseerd op 9 november 2026 vanaf commit `4b946d938a52`. Bestaande inhoud en historische dossiers zijn behouden. Een datum in een bestandsnaam maakt de inhoud niet automatisch actueel.

## Configuratie en uitvoering

- [README.md](README.md)
- [package.json](package.json)
- [server.js](server.js)
- [.env.example](.env.example)
- [.github/workflows/ci.yml](.github/workflows/ci.yml)

## Beschikbare scripts

Bron: [package.json](package.json). De tabel beschrijft de huidige opdrachten en is geen instructie om ze allemaal uit te voeren. Database-, seed-, reset-, clean-, import- en publicatiecommando's kunnen data of bestanden wijzigen.

| Script | Werkelijke opdracht |
| --- | --- |
| `dev` | `node server.js` |
| `db:setup` | `node scripts/setup-db.js` |
| `db:copy-local` | `node scripts/copy-to-local.js` |
| `db:reset` | `node scripts/reset-db.js` |
| `db:health` | `node scripts/health-check.js` |
| `admin:approve` | `node scripts/approve-admin.js` |
| `check` | `node scripts/check-syntax.js && node --test` |
| `test` | `node --test` |

## GitHub-workflows

- [.github/workflows/ci.yml](.github/workflows/ci.yml)

Een workflowbestand bewijst configuratie, geen geslaagde uitvoering. Lees padfilters en triggers voordat een documentatiepush als deploymentbewijs wordt gebruikt.

## Bestaande documentatie

### Projectroot

- [CLAUDE.md](CLAUDE.md)
