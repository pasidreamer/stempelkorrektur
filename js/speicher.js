// Speichert alles direkt auf dem Handy (im «localStorage» des Browsers).
// Es gibt keinen Server: Namen, E-Mail-Adressen und Zeiten verlassen das Gerät
// erst, wenn du die Mail abschickst.
// Nur diese Datei kennt das Speicherformat.
// Normales Skript (kein «Modul»), damit die App auch per Doppelklick auf index.html läuft.
// Alles Nötige wird unten unter dem Namen «Speicher» bereitgestellt.

(() => {
const SCHLUESSEL = 'stempelkorrektur.v1';
const AUFBEWAHREN_TAGE = 400; // ältere Einträge werden beim Start aufgeräumt

const STANDARD_EINSTELLUNGEN = {
  empfaenger: '',
  cc: '',
  anrede: 'Hallo',
  absender: '',
  personen: [], // [{ id, name }]
  gruende: ['Lüftec', 'ESL', 'Reparatur intern'],
  nacht: { von: '22:00', bis: '05:00', prozent: 25 },
};

function leererZustand() {
  return {
    einstellungen: structuredClone(STANDARD_EINSTELLUNGEN),
    eintraege: [], // [{ id, personId, datum, von, bis, pause, grund, bemerkung }]
    gesendet: {}, // { '2026-W40': { am, signatur } }
    zuletzt: null, // zuletzt gespeicherte Werte als Vorschlag für den nächsten Eintrag
  };
}

function laden() {
  const zustand = leererZustand();
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (roh) {
      const gespeichert = JSON.parse(roh);
      Object.assign(zustand, gespeichert);
      zustand.einstellungen = { ...structuredClone(STANDARD_EINSTELLUNGEN), ...gespeichert.einstellungen };
      zustand.einstellungen.nacht = { ...STANDARD_EINSTELLUNGEN.nacht, ...gespeichert.einstellungen?.nacht };
    }
  } catch (fehler) {
    console.warn('Gespeicherte Daten konnten nicht gelesen werden', fehler);
  }
  aufraeumen(zustand);
  return zustand;
}

function speichern(zustand) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(zustand));
    return true;
  } catch (fehler) {
    console.warn('Speichern fehlgeschlagen', fehler);
    return false;
  }
}

function aufraeumen(zustand) {
  const grenze = new Date();
  grenze.setDate(grenze.getDate() - AUFBEWAHREN_TAGE);
  const grenzText = grenze.toISOString().slice(0, 10);
  zustand.eintraege = zustand.eintraege.filter((e) => e.datum >= grenzText);
}

function neueId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

globalThis.Speicher = {
  STANDARD_EINSTELLUNGEN,
  laden,
  speichern,
  neueId,
};
})();
