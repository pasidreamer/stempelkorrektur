// Schreibt eine PDF-Datei – ohne fremde Bibliothek, damit die App offline und per Doppelklick läuft.
// Kann genau das, was das Stempel-Blatt braucht: Text (Helvetica normal/fett), Linien, gefüllte Flächen.
// Helvetica gehört zu den 14 Standardschriften, die jedes PDF-Programm eingebaut hat.
// Umlaute gehen über die Zeichentabelle «WinAnsi» (ä ö ü ß é … sind drin, Emojis nicht).
// Normales Skript (kein «Modul»), damit die App auch per Doppelklick auf index.html läuft.
// Alles Nötige wird unten unter dem Namen «PDF» bereitgestellt.

(() => {
const A4 = { breite: 595.28, hoehe: 841.89 }; // in Punkt (1 pt = 1/72 Zoll)

// Zeichenbreiten in 1/1000 der Schriftgrösse für die Zeichen 32–255 (Helvetica = Arial)
const BREITEN = {
  normal: [
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,
  556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,
  0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,
  278,333,556,556,556,556,260,556,333,737,370,556,584,0,737,552,
  400,549,333,333,333,576,537,333,333,333,365,556,834,834,834,611,
  667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,
  722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
  556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,
  556,556,556,556,556,556,556,549,611,556,556,556,556,500,556,500
  ],
  fett: [
  278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
  975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
  333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
  611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,
  556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,
  0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,
  278,333,556,556,556,556,280,556,333,737,370,556,584,0,737,552,
  400,549,333,333,333,576,556,333,333,333,365,556,834,834,834,611,
  722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,
  722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
  556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,
  611,611,611,611,611,611,611,549,611,611,611,611,611,556,611,556
  ],
};

// Unicode → WinAnsi für die Zeichen zwischen 128 und 159
const SONDER = {
  0x20ac: 128, 0x201a: 130, 0x0192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02c6: 136,
  0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017d: 142, 0x2018: 145, 0x2019: 146, 0x201c: 147,
  0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02dc: 152, 0x2122: 153, 0x0161: 154, 0x203a: 155,
  0x0153: 156, 0x017e: 158, 0x0178: 159,
};

function zeichenCodes(text) {
  return [...String(text)].map((z) => {
    const u = z.codePointAt(0);
    if ((u >= 32 && u <= 126) || (u >= 160 && u <= 255)) return u;
    if (SONDER[u]) return SONDER[u];
    if (u === 0x202f || u === 0x2009) return 32; // schmale Leerzeichen
    if (u === 0x2192) return 62; // → wird zu >
    return 63; // alles andere wird «?»
  });
}

function breite(text, groesse, fett = false) {
  const tabelle = fett ? BREITEN.fett : BREITEN.normal;
  return zeichenCodes(text).reduce((summe, c) => summe + (tabelle[c - 32] || 0), 0) * groesse / 1000;
}

// Kürzt einen Text mit «…», bis er in die Breite passt
function kuerzen(text, maxBreite, groesse, fett = false) {
  if (breite(text, groesse, fett) <= maxBreite) return text;
  let t = String(text);
  while (t.length > 1 && breite(t + '…', groesse, fett) > maxBreite) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

// Text für PDF-Klammern ( … ): Klammern und Backslash mit \ davor, Umlaute als \ooo (Oktalzahl),
// damit die Datei reines ASCII bleibt
const BACKSLASH = String.fromCharCode(92);
function pdfText(text) {
  return zeichenCodes(text)
    .map((c) => {
      if (c === 40 || c === 41 || c === 92) return BACKSLASH + String.fromCharCode(c);
      if (c > 126) return BACKSLASH + c.toString(8).padStart(3, '0');
      return String.fromCharCode(c);
    })
    .join('');
}

const zahl = (n) => (Math.round(n * 100) / 100).toString();
const farbe = ([r, g, b]) => `${zahl(r)} ${zahl(g)} ${zahl(b)}`;

// Eine Seite. y wird von OBEN gemessen (wie am Bildschirm) und hier umgerechnet –
// PDF selbst zählt von unten.
class Seite {
  constructor() {
    this.befehle = [];
  }
  text(x, y, inhalt, { groesse = 10, fett = false, farbe: f = [0, 0, 0], ausrichtung = 'links' } = {}) {
    if (inhalt === '' || inhalt == null) return;
    const w = breite(inhalt, groesse, fett);
    const links = ausrichtung === 'rechts' ? x - w : ausrichtung === 'mitte' ? x - w / 2 : x;
    this.befehle.push(`BT /${fett ? 'F2' : 'F1'} ${zahl(groesse)} Tf ${farbe(f)} rg 1 0 0 1 ${zahl(links)} ${zahl(A4.hoehe - y)} Tm (${pdfText(inhalt)}) Tj ET`);
  }
  linie(x1, y1, x2, y2, { farbe: f = [0.8, 0.8, 0.8], dicke = 0.5 } = {}) {
    this.befehle.push(`${farbe(f)} RG ${zahl(dicke)} w ${zahl(x1)} ${zahl(A4.hoehe - y1)} m ${zahl(x2)} ${zahl(A4.hoehe - y2)} l S`);
  }
  flaeche(x, y, b, h, f) {
    this.befehle.push(`${farbe(f)} rg ${zahl(x)} ${zahl(A4.hoehe - y - h)} ${zahl(b)} ${zahl(h)} re f`);
  }
}

class Dokument {
  constructor() {
    this.seiten = [];
  }
  seite() {
    const s = new Seite();
    this.seiten.push(s);
    return s;
  }
  // Setzt die Datei zusammen: Objekte, Verzeichnis mit Byte-Positionen («xref»), Schluss («trailer»).
  alsBytes({ titel = '', erstellt = new Date() } = {}) {
    const objekte = [];
    const neu = (inhalt) => objekte.push(inhalt); // Objektnummer = Position in der Liste + 1
    const seitenNummern = this.seiten.map((_, i) => 6 + i * 2);
    neu('<< /Type /Catalog /Pages 2 0 R >>');
    neu(`<< /Type /Pages /Kids [${seitenNummern.map((n) => n + ' 0 R').join(' ')}] /Count ${this.seiten.length} >>`);
    neu('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    neu('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const zwei = (n) => String(n).padStart(2, '0');
    const d = erstellt;
    const datum = `D:${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}${zwei(d.getHours())}${zwei(d.getMinutes())}${zwei(d.getSeconds())}`;
    neu(`<< /Title (${pdfText(titel)}) /Creator (Stempelkorrektur-App) /Producer (Stempelkorrektur-App) /CreationDate (${datum}) >>`);
    for (const [i, s] of this.seiten.entries()) {
      const inhalt = s.befehle.join('\n');
      neu(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.breite} ${A4.hoehe}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${seitenNummern[i] + 1} 0 R >>`);
      neu(`<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`);
    }

    let datei = '%PDF-1.4\n';
    const positionen = [];
    objekte.forEach((inhalt, i) => {
      positionen.push(datei.length);
      datei += `${i + 1} 0 obj\n${inhalt}\nendobj\n`;
    });
    const xref = datei.length;
    // Jede Zeile im Verzeichnis ist genau 20 Byte lang (so verlangt es der PDF-Standard)
    datei += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
    datei += positionen.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
    datei += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    // Die Datei besteht nur aus ASCII-Zeichen → 1 Zeichen = 1 Byte
    return Uint8Array.from(datei, (z) => z.charCodeAt(0));
  }
}

globalThis.PDF = {
  A4,
  breite,
  kuerzen,
  neuesDokument: () => new Dokument(),
};
})();
