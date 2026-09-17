# Kit Nugget Klimt

Tafelspel voor Viggo (10). Kit Nugget, een rood kitten, klimt een eindeloze krabpaal op. Elke goede tafelsom is een stap omhoog. Doel: tafels automatiseren (antwoord binnen 3 sec), niet alleen een spelletje.

Harde deadline: woensdag 23 september 2026, toets tafels 5 t/m 9.

Taal: alle teksten in het spel Nederlands. Naam altijd voluit "Kit Nugget", nooit alleen "Nugget". Code en comments Engels. Geen em-dashes in teksten.

Toon van het spel: nooit straffend. Geen rood scherm, geen buzzer, geen game over, nooit vallen.

## Stack

- Vite + TypeScript, vanilla (geen React)
- Three.js voor de scene
- Vitest voor de engine
- vite-plugin-pwa, offline speelbaar
- sharp voor de asset-pipeline (dev dependency)
- Geen backend, geen accounts
- `base: './'` in vite config, build is statisch (`dist/`)
- PWA en service worker werken alleen over HTTPS of localhost. Testen op telefoon via LAN kan met `npm run dev -- --host`, installeren als app pas na deploy op een HTTPS-host.

Geen extra dependencies zonder reden.

## Structuur

```
assets-raw/
  inbox/        alles wat Roeland aanlevert, ongesorteerd, willekeurige namen
reference/
  poster.jpeg   stijlreferentie
  sheet.jpeg    character sheet Kit Nugget
scripts/
  assets.ts     pipeline: sorteren, keyen, schalen, exporteren
src/
  engine/       sommenkiezer, status per som, tijdsgrens. Pure TS, geen DOM, geen Three
  game/         ronde, hoogte, combo, record, items, streak
  scene/        Three.js: paal, platforms, camera, Kit Nugget, effecten, achtergrond, muisje
  ui/           numpad, steunsom-overlay, tafelkaart, toets, verzameling, menu
  audio/        WebAudio synth plus optionele samples
  storage/      load/save/migrate
  content/      steunsommen per som (NL), itemlijst, zones
public/
  sprites/ bg/ items/ misc/ audio/   output van de pipeline
```

Regel: `engine` weet niks van graphics. `scene` weet niks van sommen, krijgt alleen events: `bigJump`, `smallStep`, `stay`, `combo(n)`, `itemCollected(id)`, `zoneChanged(id)`, `roundEnd`.

## Stap 0: asset-pipeline

Roeland gooit alle Gemini-plaatjes ongesorteerd in `assets-raw/inbox/`. Bekijk elk plaatje zelf, bepaal wat het is en geef het de juiste naam. Verwachte assets:

| Doel | Naam | Bron |
|---|---|---|
| Kit Nugget aan de paal, ogen open, w-mondje | hang | groen scherm, uitsparing voor paal |
| Kit Nugget aan de paal, verbaasd, o-mondje | surprised | idem |
| Kit Nugget aan de paal, ogen dicht, grote lach | happy | idem |
| Kit Nugget springt, pootjes omhoog | jump | groen scherm |
| Kit Nugget opgerold slapend | sleep | groen scherm |
| Kit Nugget opgerold, ogen half open | wake | groen scherm, optioneel |
| Kit Nugget rechtop, pootjes tegen elkaar | beg | groen scherm |
| Achtergronden | bg-woonkamer, bg-zolder, bg-dak, bg-wolken, bg-ruimte | 9:16, geen groen |
| Doorsnede huis met woonkamer, zolder, dak en sterrenhemel in een beeld | bg-title | 9:16, achtergrond startscherm |
| Verzamelitems | items-sheet | groen scherm, raster met 8 voorwerpen |
| Muisje | mouse | groen scherm |
| App-icoon | icon | vierkant, geen groen |
| Texturen | rope, carpet | beeldvullend, optioneel |
| Geluid | purr.m4a, meow.m4a | opnames echte kat, optioneel |

Pipeline (`npm run assets`):
1. Groen wegkeyen in HSV met tolerantie. Achtergrond is niet exact #00FF00, ongeveer rgb(20,190,40) met licht verloop, en in de items-sheet verschilt de tint per vak. Rand 1 tot 2 px feather, green despill op randpixels (let op de gouden bel en kroon: die spiegelen groen).
2. `hang`, `surprised`, `happy`: NIET trimmen. Eerst naar exact hetzelfde canvas schalen (grootste van de drie). Meet per plaatje de kolommen van de verticale uitsparing (van de afgesneden rand van de linkerpoot tot de rechte rand van het lijf). Afwijking groter dan 2 px corrigeren met horizontale offset. Schrijf `poleLeft` en `poleRight` (fractie van de breedte) naar `public/sprites/sprites.json`.
3. Overige sprites trimmen met 4 px marge.
4. `items-sheet`: keyen, losse voorwerpen uitsnijden via connected components, elk uitgesneden plaatje bekijken en benoemen volgens de itemlijst hieronder.
5. Sprites naar webp met alpha, max 768 px hoog. Achtergronden naar webp q80, max 1080x1920. Icon naar 192, 512 en 180 (apple-touch-icon) png.
6. Texturen tileable maken door mirror-tiling als de randen niet aansluiten.

Elk asset is optioneel. Ontbreekt er iets, dan valt het spel terug op:
- sprites: placeholder (oranje afgeronde vorm met oren en staart uit primitives)
- achtergronden: kleurverloop per zone
- items: simpele low-poly vormen in code
- muisje: rustige ring die leegloopt
- texturen: procedureel
- geluid: WebAudio synth

De build mag nooit blokkeren op een ontbrekend asset.

## Spelregels

Ronde = 20 sommen, ca. 2 tot 3 minuten.

- Invoer via groot numpad op het scherm, plus fysiek toetsenbord. Geen multiple choice.
- Automatisch bevestigen zodra het aantal ingetypte cijfers gelijk is aan het aantal cijfers van het goede antwoord. Reactietijd = tonen van de som tot laatste cijfer.
- Goed binnen de tijdsgrens: grote sprong (+3 m), combo +1.
- Goed maar te traag: klein stapje (+1 m), combo reset. Altijd vooruit.
- Fout: Kit Nugget blijft hangen en kijkt verbaasd. Steunsom in beeld, Viggo typt het goede antwoord alsnog in (telt niet voor hoogte), som komt binnen 3 beurten terug.
- Combo vanaf 3: extra effect. Vanaf 5: +1 m bonus per sprong.
- Einde ronde: meters deze ronde, ronderecord, totale hoogte, aantal snel/traag/fout, en de 3 sommen die nog aandacht nodig hebben.

### Hoogte

Hoogte is cumulatief. Kit Nugget gaat verder waar hij was en zakt nooit. Een perfecte ronde levert maximaal ca. 75 m op, een gewone ronde 35 tot 55 m.

- `totalHeight`: loopt altijd door, bepaalt zone en items
- `roundGain`: meters in deze ronde, dit is de score
- `bestRound`: ronderecord, dit probeert Viggo te verbeteren

### Zones (op totalHeight)

| Zone | Van | Tot |
|---|---|---|
| woonkamer | 0 | 100 |
| zolder | 100 | 250 |
| dak | 250 | 450 |
| wolken | 450 | 700 |
| ruimte | 700 | oneindig |

Bij 2 rondes per dag is dat ongeveer 100 m per dag: woensdag zit hij rond de wolken. Overgang tussen zones: crossfade over 10 m.

Achtergrond per zone is een enkel 9:16 plaatje, niet tegelbaar. Dus geen doorlopende scroll: toon het plaatje op 125% van de schermhoogte (cover) en schuif het langzaam van onderkant naar bovenkant op basis van de voortgang binnen de zone (0 tot 1). Tijdens een sprong een klein extra parallax-duwtje (max 1% van de hoogte) voor het gevoel van beweging. In de zone ruimte daarbovenop een laag losse sterren in code die wel doorscrollt.

### Items (op totalHeight)

| id | Naam | Hoogte |
|---|---|---|
| bell | belletje | 30 |
| bowtie | strikje | 80 |
| mouse-toy | speelmuis | 150 |
| yarn | bolletje wol | 230 |
| fish | visje | 320 |
| feather | veertje | 430 |
| crown | kroontje | 560 |
| helmet | astronautenhelm | 700 |

Item ligt op het platform op die hoogte. Komt Kit Nugget erlangs, dan pakt hij het (kort effect, event `itemCollected`). Items komen in het scherm Verzameling: plank met 8 plekken, nog niet gevonden items als silhouet met de hoogte erbij. Items worden niet gedragen op de sprite.

### Streak (mild)

- Teller "dagen gespeeld", geen verlies bij een gemiste dag.
- Is de laatste ronde meer dan 20 uur geleden: startscherm toont `sleep` met tekst "Kit Nugget heeft geslapen. Tik om hem wakker te maken." Tik: `wake` (of `happy` als wake ontbreekt), daarna normaal startscherm met `beg`.

### Tijdsindicatie

Standaard: muisje loopt over het platform boven Kit Nugget van de rand naar de paal in de duur van de tijdsgrens. Op tijd goed: muisje gevangen, sterretjes. Te laat: muisje glipt weg, geen negatief effect. In instellingen te wisselen naar een rustige ring. Geen rood, geen geknipper.

## Engine

Item = een som `a x b` met a uit de gekozen tafels en b van 1 t/m 10. `7x8` en `8x7` zijn aparte items maar delen een `pairKey`, zodat status van de een de ander beinvloedt (omkeerregel).

Per item bijhouden:
- `seen`, `correct`, `wrong`
- `rtEma`: exponentieel voortschrijdend gemiddelde van reactietijd bij goede antwoorden (alpha 0.4)
- `streakFast`: aantal keer achter elkaar goed binnen 3 sec
- `fastDays`: set van datums waarop snel goed
- `lastSeen` (timestamp)
- `status`: `nieuw` | `oefenen` | `snel` | `geautomatiseerd`

Statusregels:
- `nieuw`: seen = 0
- `oefenen`: laatste antwoord fout, of rtEma > 5 sec
- `snel`: rtEma tussen 3 en 5 sec, laatste 2 goed
- `geautomatiseerd`: streakFast >= 3 en fastDays.size >= 2
- Een fout zet de status altijd terug naar `oefenen`

Tijdsgrens per item: start 6 sec, wordt `clamp(rtEma * 1.25, 3, 6)`.

Sommenkiezer per beurt:
1. Staat er een foute som in de herhaalrij met wachttijd 0: die.
2. Anders 70% kans op een item uit `nieuw`/`oefenen` (gewogen op hoogste rtEma en meeste fouten), 30% kans op `snel`/`geautomatiseerd` (gewogen op langst niet gezien).
3. Nooit twee keer dezelfde som of hetzelfde pair direct achter elkaar.
4. Sommen met b = 1 en b = 10 tellen mee maar krijgen een laag gewicht.

Vitest dekt: statusovergangen, herhaalrij binnen 3 beurten, 70/30-verdeling over 1000 trekkingen (seeded RNG), geen directe herhaling, tijdsgrens-clamp, cumulatieve hoogte, item-unlocks, zonegrenzen.

## Steunsommen (content/)

Per tafel een strategie, per lastige som een vaste tekst:
- x5: helft van x10
- x6: x5 plus nog 1 keer
- x7: x5 plus x2
- x8: verdubbelen, verdubbelen, verdubbelen
- x9: x10 min 1 keer
- 7x8 = 56: "5, 6, 7, 8"
- 6x6, 7x7, 8x8, 9x9: kwadraten als ankers
- Omkeren: "7x3 is hetzelfde als 3x7"

De overlay toont de steunsom in stappen, bv. `9 x 7  =  10 x 7 - 7  =  70 - 7  =  63`.

## Scene (2.5D)

Stijlreferentie: `reference/poster.jpeg` (chunky low-poly, warm licht, zachte vormen). Geen Blender.

- Paal: 3D-cilinder met sisaltouw-textuur, oneindig door segmenten te recyclen.
- Platforms: afgeronde 3D-schijven met vloerbedekking-look, om en om links en rechts.
- Camera: perspectief, volgt Kit Nugget omhoog met lichte vertraging.
- Kit Nugget: sprite op een plane net voor de paal. Anker de sprite zo dat de band `poleLeft..poleRight` precies over de paal valt en schaal zodat de bandbreedte gelijk is aan de paaldiameter op het scherm. Kat hangt rechts van de paal, voor platforms links spiegelen.
- Poses: `hang` (rust), `jump` (tijdens sprong), `surprised` (fout), `happy` (snel goed en combo), `sleep`/`wake`/`beg` (startscherm).
- Beweging in code: squash en stretch, boogsprong, lichte idle-wiebel, sterretjes bij snel goed.
- Sprite-laag zo bouwen dat hij later vervangen kan worden door een `.glb` met dezelfde events.
- Doel 60 fps op iPhone en iPad. Pixel ratio cappen op 2.

## Audio

- WebAudio synth als basis: sprong (korte boing), stapje (tik), combo (oplopend belletje), fout (zacht vragend "hm?", geen buzzer), item (glinstering), ronde klaar (kort deuntje).
- Zijn `purr` en `meow` aanwezig: `purr` bij happy/combo, `meow` bij ronde klaar en wakker worden.
- Audio ontgrendelen op eerste tik (iOS). Mute-knop, keuze onthouden.

## UI

- Staand, mobiel eerst. Bovenste 55% scene, onderste 45% som plus numpad.
- Numpad: knoppen minimaal 64 px, cijfers 0 t/m 9, wissen en OK. Automatisch bevestigen bij het juiste aantal cijfers, OK is er voor als Viggo een korter antwoord wil insturen.
- Som groot in beeld boven het numpad.
- Startscherm: achtergrond `bg-title` (licht geblurd en gedimd zodat tekst leesbaar blijft), Kit Nugget (`beg` of `sleep`), totale hoogte, ronderecord, dagen gespeeld. Knoppen: Speel, Toets, Tafelkaart, Verzameling, Instellingen.
- Dagdoel: 2 rondes per dag, getoond als 2 pootafdrukken die inkleuren. Na 2 rondes: "Kit Nugget is moe en tevreden. Morgen weer!" Doorspelen mag gewoon, geen blokkade. Dit stuurt op kort en dagelijks oefenen in plaats van een keer lang.
- Instellingen: tafels kiezen (standaard 5, 6, 7, 8, 9), geluid, muisje of ring, voortgang wissen (met bevestiging).
- Tafelkaart: raster b 1 t/m 10 x gekozen tafels, kleur per status (grijs, oranje, lichtgroen, groen). Tik op een vakje toont rtEma, goed/fout en de steunsom. Dit is ook het ouderdashboard.
- Toets: tafels kiezen, aantal sommen en totale tijd instelbaar (standaard 40 sommen in 2 min, format school nog na te vragen). Geen hints, geen tijdsgrens per som, geen directe feedback per som. Resultaat: score, tijd, lijst van foute en overgeslagen sommen. Antwoorden tellen mee voor de engine-statistiek. Beloning: +1 m per goed antwoord. Laatste 10 toetsresultaten bewaren.
- Geen zoom, geen scroll, geen tekstselectie tijdens het spel.

## Storage

Key `kitnugget.v1`, een JSON-blob, met `schemaVersion` en migratie. Profiel-klaar opzetten: `{ activeProfile: "viggo", profiles: { viggo: {...} } }`, maar nog geen profielkeuze in de UI.

## Fases

Alles in een run, in deze volgorde. Commit per werkend onderdeel. Na elke fase: tests groen en `npm run build` slaagt.

1. Scaffold, engine, tests
2. Asset-pipeline (stap 0), `npm run assets` draaien
3. Game-loop, numpad, steunsom-overlay, storage
4. Scene: paal, platforms, camera, Kit Nugget met sprites, paal-uitlijning
5. Tafelkaart en toets
6. Zones met achtergronden, items en verzameling, muisje, audio, streak
7. PWA: manifest, iconen, offline
8. Controle: als er een headless browser beschikbaar is, screenshots op 390x844 en 820x1180 en layout nalopen

Rapporteer aan het eind: wat af is, welke assets ontbraken en op fallback draaien, en het commando om op de telefoon te testen.

## Niet nu

Profielkeuze (Wyne), tweespelermodus, deelsommen, tafels boven 10, echt 3D-model, accounts, server, sync, analytics.
