# Kit Nugget Klimt

Tafelspel voor Viggo. Kit Nugget, een rood kitten, klimt een eindeloze krabpaal
op. Elke goede tafelsom is een stap omhoog. Doel is automatiseren: antwoord
binnen drie seconden, niet alleen een spelletje.

Alles draait lokaal in de browser. Geen backend, geen accounts, geen analytics.
Offline speelbaar zodra het een keer geladen is.

## Commando's

```
npm install
npm run dev            # lokaal op http://localhost:5173
npm run dev -- --host  # ook bereikbaar op de telefoon in hetzelfde wifi
npm test               # de engine-tests
npm run build          # statische build in dist/
npm run preview        # dist/ serveren, inclusief service worker
npm run assets         # assets-raw/inbox verwerken naar public/
```

## Op de telefoon of iPad testen

1. `npm run dev -- --host`
2. Het `Network:`-adres uit de terminal openen op de iPad.

Installeren als app (Deel > Zet op beginscherm) werkt pas na deploy op een
HTTPS-host, want een service worker draait alleen over HTTPS of op localhost.
`dist/` is volledig statisch, dus elke static host volstaat.

## Altijd de verse versie

Een geinstalleerde web-app mag nooit op oude code blijven hangen:

- de service worker draait met `skipWaiting` en `clientsClaim`, dus nieuwe code
  neemt het meteen over in plaats van te wachten op een volgende keer;
- er wordt op een update gecontroleerd bij elke start, elke keer dat de app naar
  de voorgrond komt, bij het terugkomen van het netwerk, en elk half uur;
- zodra een nieuwe versie het overneemt herlaadt de pagina zichzelf een keer,
  met een kort bericht in beeld;
- de buildstempel staat onderaan het startscherm en in Instellingen, zodat je
  kunt zien welke versie er draait.

Offline blijft alles werken: de hele build plus alle plaatjes en geluiden staat
in de precache.

## Assets

Alles ongesorteerd in `assets-raw/inbox/` gooien en `npm run assets` draaien.
Plaatjes worden op bestandsnaam herkend, geluiden op wat er in de naam staat
(`meow`, `purr`, `loop`/`music`/`seamless`). Namen die de pipeline niet kent
worden aan het eind gemeld.

| Naam | Wat |
|---|---|
| `hang`, `surprised`, `happy` | Kit Nugget aan de paal, groen scherm met uitsparing |
| `jump`, `sleep`, `beg`, `wake` | losse poses, groen scherm |
| `mouse` | muisje, groen scherm |
| `items-sheet` | raster met 8 voorwerpen, groen scherm |
| `bg-woonkamer` ... `bg-ruimte`, `bg-title` | achtergronden 9:16, geen groen |
| `icon` | app-icoon, vierkant |
| `rope`, `carpet` | texturen, vierkant |
| geluid | `meow*`, `purr*`, `*loop*` of `*seamless*` |

De pipeline sleutelt groen weg op groen-dominantie, haalt de spill van de gouden
bel en kroon af, meet de paal-uitsparing van de drie hangposes en zet ze op een
gedeeld canvas, snijdt de items-sheet los en schrijft `public/sprites/sprites.json`.

Elk asset is optioneel. Wat ontbreekt valt terug op code-getekende vormen, een
kleurverloop per zone of de WebAudio-synth. De build blokkeert nooit.

### Bekende correcties in achtergronden

Twee achtergronden kwamen terug met een wazig inzetje linksonder en rechtsonder,
en de ruimte-achtergrond met een lichtere verticale rechthoek. Die inzetjes zijn
zacht ingefade, dus er valt niets betrouwbaar aan te detecteren. De correcties
staan daarom expliciet in `scripts/lib/repair.ts`. Vervang je een achtergrond
door een nieuwe render, haal dan zijn regel daar weg.

## Structuur

```
assets-raw/inbox/   alles wat aangeleverd wordt, ongesorteerd
reference/          poster en character sheet
scripts/            de asset-pipeline
src/engine/         sommenkiezer, status per som, tijdsgrens. Pure TS
src/game/           ronde, hoogte, combo, dagdoel
src/scene/          Three.js: paal, platforms, camera, Kit Nugget, achtergrond
src/ui/             schermen, numpad, steunsom-overlay
src/audio/          WebAudio-synth plus de opnames
src/storage/        load, save, migratie
src/content/        steunsommen, items, zones
public/             output van de pipeline
```

`engine` weet niets van graphics. `scene` weet niets van sommen en krijgt alleen
de events uit `src/game/events.ts`.
