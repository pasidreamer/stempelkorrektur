// Gestaltet das Stempelkorrektur-Blatt als PDF: eine A4-Seite pro Person,
// aufgebaut wie das Papierformular (alle 7 Tage, Von/Bis, Pause, Grund) plus Stunden und Nachtzuschlag.
// Braucht zeit.js und pdf.js.
// Normales Skript (kein «Modul»), damit die App auch per Doppelklick auf index.html läuft.
// Alles Nötige wird unten unter dem Namen «Blatt» bereitgestellt.

(() => {
const { berechne, dauer, kurzDatum, kalenderwoche, plusTage, tageDerWoche, wochentagIndex, WOCHENTAGE } = Zeit;

// Farben als [rot, grün, blau] von 0 bis 1
const TEXT = [0.08, 0.13, 0.17];
const GRAU = [0.34, 0.39, 0.43];
const LINIE = [0.82, 0.85, 0.87];
const AKZENT = [0.043, 0.431, 0.463]; // das Petrol der App
const KOPF_FLAECHE = [0.93, 0.95, 0.95];
const WOCHENENDE = [0.975, 0.98, 0.98];

const RAND = 42;
const BREITE = PDF.A4.breite - 2 * RAND;
const UNTEN = 770; // ab hier beginnt eine neue Seite

// Spalten: x-Position und Ausrichtung
const SP = {
  tag: RAND + 6,
  datum: RAND + 70,
  von: RAND + 120,
  bis: RAND + 160,
  pause: RAND + 214,
  grund: RAND + 262,
  stunden: RAND + 432, // rechtsbündig
  nacht: RAND + BREITE - 6, // rechtsbündig
};

function kopf(seite, { person, montag, fortsetzung, ohneTabelle = false }) {
  const { woche, jahr } = kalenderwoche(montag);
  const sonntag = plusTage(montag, 6);
  seite.text(RAND, 58, 'Stempelkorrekturen', { groesse: 20, fett: true, farbe: AKZENT });
  seite.text(RAND + BREITE, 58, `KW ${woche} / ${jahr}`, { groesse: 20, fett: true, farbe: TEXT, ausrichtung: 'rechts' });
  seite.text(RAND, 76, fortsetzung ? 'Antrag an Vorgesetzte/n (Fortsetzung)' : 'Antrag an Vorgesetzte/n', { groesse: 10, farbe: GRAU });
  seite.text(RAND + BREITE, 76, `Mo ${kurzDatum(montag)} – So ${kurzDatum(sonntag, true)}`, { groesse: 10, farbe: GRAU, ausrichtung: 'rechts' });
  seite.linie(RAND, 90, RAND + BREITE, 90, { farbe: AKZENT, dicke: 1.4 });

  seite.text(RAND, 112, 'MITARBEITER/IN', { groesse: 7.5, fett: true, farbe: GRAU });
  seite.text(RAND, 128, PDF.kuerzen(person.name, BREITE / 2 - 12, 13, true), { groesse: 13, fett: true, farbe: TEXT });
  const mitte = RAND + BREITE / 2;
  seite.text(mitte, 112, 'VORGESETZTE/R', { groesse: 7.5, fett: true, farbe: GRAU });
  // Pro Person eingetragen (Einstellungen). Leer = Feld bleibt frei zum Ausfüllen von Hand.
  seite.text(mitte, 128, PDF.kuerzen(person.vorgesetzter?.trim() ?? '', BREITE / 2, 13, true), { groesse: 13, fett: true, farbe: TEXT });
  seite.linie(RAND, 142, RAND + BREITE, 142, { farbe: LINIE });
  if (ohneTabelle) return 142;

  // Tabellenkopf
  seite.flaeche(RAND, 156, BREITE, 22, KOPF_FLAECHE);
  const k = { groesse: 8, fett: true, farbe: GRAU };
  seite.text(SP.tag, 170, 'Tag', k);
  seite.text(SP.datum, 170, 'Datum', k);
  seite.text(SP.von, 170, 'Von', k);
  seite.text(SP.bis, 170, 'Bis', k);
  seite.text(SP.pause, 170, 'Pause', k);
  seite.text(SP.grund, 170, 'Grund', k);
  seite.text(SP.stunden, 170, 'Stunden', { ...k, ausrichtung: 'rechts' });
  seite.text(SP.nacht, 170, 'Nachtzuschlag', { ...k, ausrichtung: 'rechts' });
  return 178; // hier beginnt die erste Zeile
}

function fuss(seite, erstelltAm, nummer, total) {
  const d = erstelltAm;
  const wann = `${kurzDatum(Zeit.alsText(d), true)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  seite.linie(RAND, 804, RAND + BREITE, 804, { farbe: LINIE });
  seite.text(RAND, 816, `Erstellt am ${wann} mit der Stempelkorrektur-App`, { groesse: 7.5, farbe: GRAU });
  seite.text(RAND + BREITE, 816, `Seite ${nummer} von ${total}`, { groesse: 7.5, farbe: GRAU, ausrichtung: 'rechts' });
}

// Baut die Seiten einer Person. Gibt die Seiten zurück (meist eine).
function personSeiten(dok, { person, montag, eintraege, einstellungen }) {
  const nacht = einstellungen.nacht;
  const seiten = [];
  let seite = dok.seite();
  seiten.push(seite);
  let y = kopf(seite, { person, montag });
  let summeNetto = 0;
  let summeZuschlag = 0;
  let mitMitternacht = false;

  for (const datum of tageDerWoche(montag)) {
    const i = wochentagIndex(datum);
    const amTag = eintraege.filter((e) => e.datum === datum).sort((a, b) => a.von.localeCompare(b.von));
    const zeilen = amTag.length ? amTag : [null];
    const hoehe = zeilen.reduce((h, e) => h + (e?.bemerkung ? 32 : 22), 0);

    if (y + hoehe > UNTEN) {
      seite = dok.seite();
      seiten.push(seite);
      y = kopf(seite, { person, montag, fortsetzung: true });
    }
    if (i >= 5) seite.flaeche(RAND, y, BREITE, hoehe, WOCHENENDE);

    zeilen.forEach((e, nr) => {
      const zeilenHoehe = e?.bemerkung ? 32 : 22;
      const grund = y + 14.5;
      if (nr === 0) {
        seite.text(SP.tag, grund, WOCHENTAGE[i], { groesse: 9.5, fett: true, farbe: TEXT });
        seite.text(SP.datum, grund, kurzDatum(datum), { groesse: 9.5, farbe: TEXT });
      }
      if (e) {
        const r = berechne(e, nacht);
        summeNetto += r.netto;
        summeZuschlag += r.zuschlag;
        if (r.ueberMitternacht) mitMitternacht = true;
        const z = { groesse: 9.5, farbe: TEXT };
        seite.text(SP.von, grund, e.von, z);
        seite.text(SP.bis, grund, e.bis + (r.ueberMitternacht ? ' +1' : ''), z);
        seite.text(SP.pause, grund, e.pause > 0 ? `${e.pause} min` : '–', z);
        seite.text(SP.grund, grund, PDF.kuerzen(e.grund, SP.stunden - SP.grund - 48, 9.5), z);
        seite.text(SP.stunden, grund, dauer(r.netto), { ...z, fett: true, ausrichtung: 'rechts' });
        if (r.zuschlag) seite.text(SP.nacht, grund, `+${dauer(r.zuschlag)}`, { ...z, farbe: AKZENT, fett: true, ausrichtung: 'rechts' });
        if (e.bemerkung) {
          seite.text(SP.grund, y + 26, PDF.kuerzen(e.bemerkung, SP.nacht - SP.grund, 8), { groesse: 8, farbe: GRAU });
        }
      }
      y += zeilenHoehe;
    });
    seite.linie(RAND, y, RAND + BREITE, y, { farbe: LINIE });
  }

  // Total
  y += 4;
  seite.linie(RAND, y, RAND + BREITE, y, { farbe: TEXT, dicke: 0.8 });
  y += 17;
  seite.text(SP.tag, y, 'Total Woche', { groesse: 10.5, fett: true, farbe: TEXT });
  seite.text(SP.stunden, y, dauer(summeNetto), { groesse: 10.5, fett: true, farbe: TEXT, ausrichtung: 'rechts' });
  if (summeZuschlag) {
    seite.text(SP.nacht, y, `+${dauer(summeZuschlag)}`, { groesse: 10.5, fett: true, farbe: AKZENT, ausrichtung: 'rechts' });
    y += 17;
    seite.text(SP.tag, y, 'Total inkl. Nachtzuschlag', { groesse: 9.5, farbe: TEXT });
    seite.text(SP.nacht, y, dauer(summeNetto + summeZuschlag), { groesse: 10.5, fett: true, farbe: TEXT, ausrichtung: 'rechts' });
  }

  // Erklärungen
  y += 30;
  const hinweise = [];
  if (summeZuschlag) hinweise.push(`Nachtarbeit ${nacht.von}–${nacht.bis} Uhr mit ${nacht.prozent} % Zeitzuschlag. Pausen werden anteilig abgezogen.`);
  if (mitMitternacht) hinweise.push('«+1» bei Bis: Die Arbeit endete am Folgetag.');
  for (const h of hinweise) {
    seite.text(RAND, y, h, { groesse: 8, farbe: GRAU });
    y += 12;
  }

  // Unterschriften wie auf dem Papierformular, unten auf der Seite.
  // Passt der Block nicht mehr hin, kommt er auf eine eigene Folgeseite.
  let u = Math.max(y + 24, 700);
  if (u + 90 > 800) {
    seite = dok.seite();
    seiten.push(seite);
    u = kopf(seite, { person, montag, fortsetzung: true, ohneTabelle: true }) + 30;
  }
  unterschriften(seite, u);
  return seiten;
}

function unterschriften(seite, y) {
  const halb = BREITE / 2;
  const feld = (x, yLinie, breite, text) => {
    seite.linie(x, yLinie, x + breite, yLinie, { farbe: TEXT, dicke: 0.6 });
    seite.text(x, yLinie + 12, text, { groesse: 7.5, farbe: GRAU });
  };
  feld(RAND, y + 28, halb - 18, 'Datum, Visum Mitarbeiter/in');
  feld(RAND + halb, y + 28, halb, 'Datum, Visum Vorgesetzte/r');
  feld(RAND, y + 72, halb - 18, 'Erfassungsdatum & Visum Personalbüro');
}

// personen: [{ id, name, vorgesetzter }] – je eine Seite (oder mehr); eintraege: alle Einträge der Woche
function erstellen({ montag, personen, eintraege, einstellungen, erstelltAm = new Date() }) {
  const dok = PDF.neuesDokument();
  const alleSeiten = personen.flatMap((person) =>
    personSeiten(dok, { person, montag, eintraege: eintraege.filter((e) => e.personId === person.id), einstellungen }),
  );
  alleSeiten.forEach((s, i) => fuss(s, erstelltAm, i + 1, alleSeiten.length));
  const { woche, jahr } = kalenderwoche(montag);
  return dok.alsBytes({ titel: `Stempelkorrekturen KW ${woche}/${jahr}`, erstellt: erstelltAm });
}

// «Stempelkorrekturen_KW39_2026.pdf», bei einer einzelnen Person mit Namen
function dateiname(montag, personen) {
  const { woche, jahr } = kalenderwoche(montag);
  const zusatz = personen.length === 1 ? '_' + personen[0].name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') : '';
  return `Stempelkorrekturen_KW${woche}_${jahr}${zusatz}.pdf`;
}

globalThis.Blatt = {
  erstellen,
  dateiname,
};
})();
