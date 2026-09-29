// Alles rund um Datum, Kalenderwoche und Stundenrechnung.
// Reine Funktionen ohne Bildschirm – dadurch mit `node --test` prüfbar.
// Normales Skript (kein «Modul»), damit die App auch per Doppelklick auf index.html läuft.
// Alles Nötige wird unten unter dem Namen «Zeit» bereitgestellt.

(() => {
const TAG_MIN = 24 * 60;
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ---------- Datum ----------

// Datum immer als Text «JJJJ-MM-TT» speichern. Gerechnet wird um 12 Uhr mittags,
// damit die Sommerzeit-Umstellung nie einen Tag verschiebt.
function alsDatum(text) {
  const [j, m, t] = text.split('-').map(Number);
  return new Date(j, m - 1, t, 12);
}

function alsText(datum) {
  const j = datum.getFullYear();
  const m = String(datum.getMonth() + 1).padStart(2, '0');
  const t = String(datum.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

function heute() {
  return alsText(new Date());
}

function plusTage(text, tage) {
  const d = alsDatum(text);
  d.setDate(d.getDate() + tage);
  return alsText(d);
}

// 0 = Montag … 6 = Sonntag
function wochentagIndex(text) {
  return (alsDatum(text).getDay() + 6) % 7;
}

function montagDerWoche(text) {
  return plusTage(text, -wochentagIndex(text));
}

function tageDerWoche(montag) {
  return Array.from({ length: 7 }, (_, i) => plusTage(montag, i));
}

// Kalenderwoche nach ISO 8601 (so wie in der Schweiz üblich):
// Die Woche gehört zu dem Jahr, in dem ihr Donnerstag liegt.
function kalenderwoche(text) {
  const donnerstag = alsDatum(plusTage(montagDerWoche(text), 3));
  const jahr = donnerstag.getFullYear();
  const ersterJan = new Date(jahr, 0, 1, 12);
  // Tage seit 1. Januar; runden, weil die Sommerzeit eine Stunde dazwischenschiebt.
  const tage = Math.round((donnerstag - ersterJan) / 86400000);
  return { jahr, woche: Math.floor(tage / 7) + 1 };
}

function wochenSchluessel(montag) {
  const { jahr, woche } = kalenderwoche(montag);
  return `${jahr}-W${String(woche).padStart(2, '0')}`;
}

// «28.09.» bzw. «28.09.2026»
function kurzDatum(text, mitJahr = false) {
  const [j, m, t] = text.split('-');
  return mitJahr ? `${t}.${m}.${j}` : `${t}.${m}.`;
}

// Welche Woche beim Öffnen zeigen? Am Montag die vergangene Woche
// (da wird nachgetragen), sonst die laufende.
function startWoche(heuteText = heute()) {
  const montag = montagDerWoche(heuteText);
  return wochentagIndex(heuteText) === 0 ? plusTage(montag, -7) : montag;
}

// ---------- Uhrzeit & Dauer ----------

function minuten(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// 510 → «8:30 h»
function dauer(min) {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m} h`;
}

// Rechnet einen Eintrag aus.
// - Ist «Bis» früher als (oder gleich) «Von», geht die Arbeit über Mitternacht.
// - Nachtzeit = Überschneidung mit dem Nachtfenster (Standard 22:00–05:00).
// - Die Pause wird anteilig von Tag- und Nachtzeit abgezogen.
function berechne({ von, bis, pause = 0 }, nacht = { von: '22:00', bis: '05:00', prozent: 25 }) {
  const start = minuten(von);
  let ende = minuten(bis);
  const ueberMitternacht = ende <= start;
  if (ueberMitternacht) ende += TAG_MIN;

  const brutto = ende - start;
  const netto = Math.max(0, brutto - pause);

  const nStart = minuten(nacht.von);
  let nEnde = minuten(nacht.bis);
  if (nEnde <= nStart) nEnde += TAG_MIN;

  // Das Nachtfenster vom Vortag, vom Tag selbst und vom Folgetag prüfen.
  let nachtBrutto = 0;
  for (const tag of [-1, 0, 1]) {
    const a = tag * TAG_MIN + nStart;
    const b = tag * TAG_MIN + nEnde;
    nachtBrutto += Math.max(0, Math.min(ende, b) - Math.max(start, a));
  }

  const nachtNetto = brutto > 0 ? Math.round((nachtBrutto * netto) / brutto) : 0;
  const zuschlag = Math.round((nachtNetto * (nacht.prozent || 0)) / 100);

  return { brutto, netto, nacht: nachtNetto, zuschlag, ueberMitternacht };
}

// Gibt einen Fehlertext zurück oder null, wenn alles stimmt.
function pruefe({ von, bis, pause = 0 }) {
  if (!von || !bis) return 'Bitte «Von» und «Bis» ausfüllen.';
  if (von === bis) return '«Von» und «Bis» sind gleich.';
  const { brutto } = berechne({ von, bis, pause: 0 });
  if (pause < 0) return 'Die Pause kann nicht negativ sein.';
  if (pause >= brutto) return 'Die Pause ist länger als die Arbeitszeit.';
  return null;
}

// «5:00 h» oder «5:00 h (+1:15 h Nachtzuschlag)»
function stundenText({ netto, zuschlag }) {
  return zuschlag > 0 ? `${dauer(netto)} (+${dauer(zuschlag)} Nachtzuschlag)` : dauer(netto);
}

// ---------- Krank und Ferien ----------

// Ein Eintrag hat die «art» arbeit (Standard), krank oder ferien.
// Krank und Ferien zählen als ganzer Tag: Wochensoll ÷ 5 (bei 43 h: 8:36 h).
const ABWESENHEITEN = { krank: 'Krank', ferien: 'Ferien' };

function istAbwesenheit(eintrag) {
  return eintrag.art === 'krank' || eintrag.art === 'ferien';
}

// Minuten eines ganzen Tages aus dem Wochensoll in Stunden (43 → 516 = 8:36 h)
function tagessoll(wochensollStunden) {
  return Math.round((wochensollStunden * 60) / 5);
}

// Wie Krank/Ferien in Liste, Mail und PDF heissen:
// «Krank (ganzer Tag)», «Krank (keine Stunden)» (Stundenlohn: nichts zu verrechnen) oder nur «Krank»,
// wenn von Hand eine andere Zeit gewählt wurde. Einträge ohne «ganzerTag» (vor dem 30.09.2026)
// waren immer ganze Tage.
function abwesenheitText(eintrag) {
  const name = ABWESENHEITEN[eintrag.art];
  if (!eintrag.minuten) return `${name} (keine Stunden)`;
  if (eintrag.ganzerTag !== false) return `${name} (ganzer Tag)`;
  return name;
}

// Wie berechne(), kennt aber auch Krank/Ferien. Deren Minuten stehen im Eintrag selbst,
// damit eine spätere Änderung des Wochensolls alte Wochen nicht verändert.
function berechneEintrag(eintrag, nacht) {
  if (istAbwesenheit(eintrag)) {
    const m = eintrag.minuten || 0;
    return { brutto: m, netto: m, nacht: 0, zuschlag: 0, ueberMitternacht: false, abwesend: true };
  }
  return berechne(eintrag, nacht);
}

globalThis.Zeit = {
  WOCHENTAGE,
  WOCHENTAGE_KURZ,
  alsDatum,
  alsText,
  heute,
  plusTage,
  wochentagIndex,
  montagDerWoche,
  tageDerWoche,
  kalenderwoche,
  wochenSchluessel,
  kurzDatum,
  startWoche,
  minuten,
  dauer,
  berechne,
  pruefe,
  stundenText,
  ABWESENHEITEN,
  istAbwesenheit,
  abwesenheitText,
  tagessoll,
  berechneEintrag,
};
})();
