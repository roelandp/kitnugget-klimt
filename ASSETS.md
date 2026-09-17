# Assets voor Kit Nugget Klimt

Alles ongesorteerd in `assets-raw/inbox/`, namen maken niet uit. Claude Code bekijkt en benoemt ze zelf. Gebruik de originele downloads uit Gemini, geen screenshots.

Poster naar `reference/poster.jpeg`, character sheet naar `reference/sheet.jpeg`.

## Status

- [x] poster
- [x] character sheet
- [x] hang
- [x] jump
- [x] surprised
- [x] happy
- [x] sleep
- [x] beg (bidstand)
- [ ] wake (optioneel)
- [x] bg-dak, bg-wolken
- [ ] bg-woonkamer, bg-zolder, bg-ruimte: nog een correctie nodig (zie onder)
- [x] bg-title (doorsnede huis)
- [x] items-sheet
- [x] muisje
- [x] app-icoon
- [x] rope en carpet
- [ ] purr en meow (optioneel)

Volgorde van belang: achtergronden, items, muisje, icoon. De rest is extra.

## 1. Achtergronden (5 stuks)

Zelfde Gemini-chat, poster als referentie. Vaste prompt, alleen [SCENE] wisselen:

```
Background only, no characters, no animals, no scratching post, no text. Same stylized chunky low-poly 3D toy style and warm lighting as the poster. Vertical 9:16. Scene: [SCENE]. Keep the vertical center strip of the image calm and uncluttered, put details towards the left and right edges. Soft depth of field.
```

Scenes:
1. `cozy living room with sofa, floor lamp, plants and a window, warm evening light`
2. `wooden attic with sloped roof beams, cardboard boxes, a bookshelf and a small round window`
3. `rooftop at dusk with dark roof tiles, red brick chimneys and a purple-orange sky`
4. `big fluffy white clouds in a deep blue evening sky with a few first stars`
5. `deep blue outer space with many stars, a small ringed planet and a distant moon`

### Correcties

Woonkamer en zolder (wazige inzetjes linksonder en rechtsonder):
```
Remove the two blurry inset images at the bottom left and bottom right. Continue the wooden floor there. Keep everything else exactly the same.
```

Ruimte (lichtere rechthoek in het midden):
```
Remove the lighter vertical rectangle in the center. Make the background one smooth continuous deep blue with stars everywhere. Keep the planet and the moon exactly the same.
```

## 2. Items (1 plaatje)

```
Eight small collectible objects arranged in a clean grid of 2 columns and 4 rows, evenly spaced, not touching, each fully visible and roughly the same size: a golden bell, a blue bow tie, a gray toy mouse, a ball of red yarn, a small blue fish toy, a purple feather, a tiny golden crown, a small white astronaut helmet. Same stylized chunky low-poly 3D toy style as the poster. Plain solid green background (#00FF00), flat even lighting, no shadows on the background, no text.
```

Check: 8 losse voorwerpen, niks overlapt, niks groen van kleur.

## 3. Muisje

```
A small cute gray mouse with pink ears and a long tail, running pose, side view facing right, full body in frame. Same stylized chunky low-poly 3D toy style as the poster. Plain solid green background (#00FF00), flat even lighting, no shadow, no text.
```

## 4. App-icoon

Sheet als referentie meesturen.

```
App icon, square 1:1. Close-up of the face of the kitten from the character sheet, front view, happy, centered with some margin, identical style and eyes as the sheet. Background: soft warm gradient from orange to cream, not green. No text, no border, no rounded corners.
```

## 5. Wake (optioneel)

Slaap-versie plus sheet uploaden.

```
Keep this image exactly the same: same body, same curl, same framing, same background. Only change the face: eyes half open, just waking up, sleepy and content. Eyes in exactly the same style as the character sheet: big round brown eyes with white highlights, no eyebrows, small simple "w" mouth.
```

## 6. Texturen (optioneel)

```
Flat front-on texture that fills the entire frame edge to edge: thick beige sisal rope wound tightly in horizontal rows, even lighting, no perspective, no objects, no text. Stylized 3D toy look matching the poster. Square 1:1.
```

```
Flat front-on texture that fills the entire frame edge to edge: soft beige plush carpet, even lighting, no perspective, no objects, no text. Stylized 3D toy look matching the poster. Square 1:1.
```

## 7. Geluid (optioneel, maar leuk)

Neem de echte Kit Nugget op met Dictafoon: een keer spinnen (5 tot 10 sec) en een miauw. Opslaan als `purr.m4a` en `meow.m4a`, ook in de inbox.

## 8. Navragen bij school

> Hoi Anne en Carla, dank voor het bericht, we gaan thuis dagelijks oefenen. Om zo gericht mogelijk te oefenen: hoe ziet de tafeltoets er precies uit? Hoeveel sommen, hoeveel tijd, en door elkaar of per tafel? Groet, Roeland
