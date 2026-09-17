# Kickoff

## Voorbereiden op de Mac

```
mkdir -p kit-nugget-klimt/{assets-raw/inbox,reference}
cd kit-nugget-klimt && git init
```

1. `CLAUDE.md` en `ASSETS.md` in de root
2. Poster naar `reference/poster.jpeg`, character sheet naar `reference/sheet.jpeg`
3. Alle andere plaatjes en geluiden in `assets-raw/inbox/`, namen maken niet uit
4. `claude` starten in de map

## Prompt voor Claude Code

```
Lees CLAUDE.md en ASSETS.md volledig. Bouw het hele project in een run volgens de fases in CLAUDE.md, in die volgorde. Begin met engine en tests, draai daarna de asset-pipeline op assets-raw/inbox: bekijk elk plaatje zelf, benoem het en controleer het resultaat van het keyen visueel. Ontbreekt een asset, gebruik dan de fallback en ga door, nooit blokkeren. Commit per werkend onderdeel. Besteed extra zorg aan de uitlijning van de paal-uitsparing in hang, surprised en happy op de 3D-paal: controleer dit met een screenshot als dat kan. Rapporteer aan het eind wat af is, wat op fallback draait en hoe ik op mijn telefoon test.
```

## Daarna

- Testen op telefoon in hetzelfde wifi: `npm run dev -- --host`
- Installeren als app op de iPad van Viggo kan pas na deploy op een HTTPS-host (`dist/` is statisch, elke static host werkt)
- Later assets toevoegen: in de inbox gooien en `npm run assets` draaien
