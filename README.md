# Foto-Text zu Word

Texte von Fotos (auch vom Bildschirm abfotografiert) erkennen und als Word-Datei speichern.
Läuft komplett im Browser und ohne Internet. Die Bilder verlassen das Gerät nicht.

- **App öffnen:** https://mathiasweb-create.github.io/foto-text-zu-word/
- **iPhone/iPad:** Adresse in Safari öffnen, Teilen, „Zum Home-Bildschirm“.
- **Anleitung:** [Anleitung.md](Anleitung.md)

## Aufbau
- `index.html`: die fertige App (alle Bausteine eingebettet), `sw.js` hält sie offline bereit.
- `quelle/`: Quelltext. Neu bauen mit
  `npm i tesseract.js@5.1.1 tesseract.js-core@5.1.1 docx@8.5.0 @tesseract.js-data/deu @tesseract.js-data/eng`
  und `python quelle/build.py node_modules Foto-Text-zu-Word.html .`

Verwendete Bausteine: tesseract.js (Apache-2.0), docx (MIT), Wortliste aus dem Hunspell-Wörterbuch de_AT / igerman98 (GPL).
