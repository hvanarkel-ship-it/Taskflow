# DPM CRM / Taskflow — projecthandboek

[Documentatie-index](DOCUMENTATION.md) · [Verificatie en verbeterpunten](VERIFICATION.md) · [README](README.md)

| Documentbeheer | Waarde |
| --- | --- |
| Beoordeeld | 9 november 2026 |
| Repository | `hvanarkel-ship-it/Taskflow` |
| Branch | `main` |
| Bronsnapshot | [`4b946d938a52`](https://github.com/hvanarkel-ship-it/Taskflow/commit/4b946d938a52df4926362eaed715507eb5878302) |
| Scope | Bron- en documentatiecontrole; geen nieuwe runtime-, herstel- of gebruikersacceptatietest |

## Doel en gebruik

Lokale CRM voor bedrijven, contacten, verkoopkansen, taken, interacties en teambeheer, met een AI-assistent. De bestaande README beschrijft Nederlands en Engels.

Registreer lokaal met het adres uit ADMIN_EMAIL en voer alleen voor die bedoelde beheerder `npm run admin:approve` uit. Nieuwe gebruikers krijgen volgens de README niet automatisch beheerrechten. Gebruik daarna bedrijven/contacten, deals en taken; CSV-import eerst met een kleine synthetische dataset controleren.

## Architectuur en afhankelijkheden

React 18/Babel-interface → lokale Express-server → PostgreSQL. De AI-aanroep loopt via de serverproxy. Dit is geen zelfstandig werkende GitHub Pages-site.

**Runtime:** Node.js ≥18 volgens package.json; PostgreSQL; npm-lockfile aanwezig.

**Technische ingang:** [server.js](server.js). Bestaande productspecificaties en AGENTS-instructies blijven leidend; dit handboek beschrijft de aangetroffen inrichting.

## Installatie en lokale start

Voer `npm ci` uit, kopieer `.env.example` naar `.env` en configureer minimaal DATABASE_URL en JWT_SECRET. Gebruik uitsluitend een ontwikkeldatabase voor eerste inrichting met `npm run db:setup`. Start met `npm run dev`; de README noemt http://localhost:8888.

De genoemde commando's zijn afgeleid van repositorybestanden. Ze zijn in deze documentatie-update niet uitgevoerd tegen productie. Database-inrichting, migraties, seed/import en accountkoppelingen wijzigen gegevens en vereisen de juiste doelomgeving.

## Configuratie

De volgende **namen** zijn aangetroffen in [`.env.example`](.env.example). Het voorbeeld is geen volledige garantie dat alle runtimevariabelen hierin staan. Benodigde waarden hangen af van ingeschakelde functies.

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGIN`
- `PORT`

Bewaar geheime waarden buiten Git. Een clientconfiguratie of publiek project-ID vervangt geen toegangsregels. Gebruik voor tests synthetische gegevens en een afgescheiden omgeving.

## Controles vóór een functionele release

Bestaande controlecommando's (voer ieder vanuit de repositoryroot uit, tenzij het commando zelf van map wisselt):

```sh
npm run check
npm run db:health 
```

Een vermeld commando is geen geslaagd testresultaat. Leg uitvoerdatum, commit, omgeving, exitstatus en eventuele beperkingen vast.

1. Login en geweigerde toegang zonder token.
2. Bedrijf/contact en deal aanmaken met testgegevens; daarna teruglezen.
3. Taken en interacties aan de juiste gebruiker koppelen.
4. AI-foutmelding bij ontbrekende providerconfiguratie.
5. Databasegezondheid zonder onnodige gevoelige details.

## Uitrol en releasebewijs

De CI-workflow voert npm ci en npm run check uit. Een draaiende lokale Node-server en database blijven nodig. In de onderzochte workflow is geen productie-uitrol vastgelegd.

Bewaar bij een release de broncommit, uitgevoerde checks, doelomgeving, actieve versie, verificatiedatum en herstelreferentie. “In GitHub”, “build geslaagd” en “operationeel” zijn verschillende statussen.

## Back-up en herstel

Maak een PostgreSQL-back-up en bewaar serverconfiguratie/secrets apart. Leg appcommit en databaseschemaversie samen vast. Herstel in een aparte database en controleer gebruikersscheiding voordat de actieve verbinding wordt omgezet.

Een herstelprocedure is pas bewezen na een geslaagde terugleestest. Noteer wat is hersteld, welke data-ouderdom resteert en of writes/backgroundtaken tijdens herstel waren gestopt. In deze audit is geen recovery time of recovery point objective gemeten of gegarandeerd.

## Storingswijzer

| Symptoom | Eerste controle |
| --- | --- |
| Server start niet | Controleer DATABASE_URL, JWT_SECRET, poort en serverlog. |
| Account blijft geblokkeerd | Controleer registratie- en goedkeuringspad; maak niet willekeurig accounts beheerder. |
| Gegevens ontbreken | Controleer actieve database en gebruiker vóór opnieuw importeren. |

## Onderhoud

Werk documentatie bij in dezelfde wijziging als scripts, configuratie, schema, providercontracten of deploymentgedrag veranderen. Gebruik het verificatieregister voor bewijs en beperkingen; beschrijf historische resultaten met hun eigen datum. Controleer vóór een functionele release de bovenstaande acceptatiepunten en relevante bestaande CI.

## Bronverwijzingen

- [README.md](README.md)
- [package.json](package.json)
- [server.js](server.js)
- [.env.example](.env.example)
- [.github/workflows/ci.yml](.github/workflows/ci.yml)
