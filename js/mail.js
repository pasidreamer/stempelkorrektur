// Baut den Mailtext und den «mailto:»-Link.
// Ein mailto-Link öffnet die Mail-App des Handys mit Empfänger, Betreff und
// Text schon ausgefüllt – man muss dort nur noch auf «Senden» tippen.
// Normales Skript (kein «Modul»), damit die App auch per Doppelklick auf index.html läuft.
// Alles Nötige wird unten unter dem Namen «Mail» bereitgestellt.

(() => {
const { berechneEintrag, istAbwesenheit, abwesenheitText, dauer, stundenText, kurzDatum, kalenderwoche, plusTage, wochentagIndex, WOCHENTAGE_KURZ } =
  Zeit; // aus zeit.js

const LINIE = '────────────────────';

function betreff(montag) {
  const { woche, jahr } = kalenderwoche(montag);
  return `Stempelkorrekturen KW ${woche}/${jahr} (${kurzDatum(montag)}–${kurzDatum(plusTage(montag, 6), true)})`;
}

function tagText(datum) {
  return `${WOCHENTAGE_KURZ[wochentagIndex(datum)]} ${kurzDatum(datum, true)}`;
}

function sortiert(eintraege) {
  return [...eintraege].sort((a, b) => (a.datum + a.von).localeCompare(b.datum + b.von));
}

// personen: [{ id, name }] in der gewünschten Reihenfolge
// eintraege: alle Einträge der Woche
function mailText({ montag, personen, eintraege, einstellungen }) {
  const { woche } = kalenderwoche(montag);
  const nacht = einstellungen.nacht;
  const zeilen = [];
  let nachtVorhanden = false;
  let abwesenheitVorhanden = false;
  let ohneStundenVorhanden = false;

  zeilen.push(einstellungen.anrede?.trim() || 'Hallo', '');
  zeilen.push(`Hier die Stempelkorrekturen für KW ${woche} (Mo ${kurzDatum(montag)} – So ${kurzDatum(plusTage(montag, 6), true)}).`);

  for (const person of personen) {
    const eigene = sortiert(eintraege.filter((e) => e.personId === person.id));
    if (eigene.length === 0) continue;

    zeilen.push('', '', LINIE, person.name, LINIE);
    let summeNetto = 0;
    let summeZuschlag = 0;

    for (const e of eigene) {
      const r = berechneEintrag(e, nacht);
      summeNetto += r.netto;
      summeZuschlag += r.zuschlag;
      if (r.zuschlag > 0) nachtVorhanden = true;

      if (istAbwesenheit(e)) {
        if (e.minuten && e.ganzerTag !== false) abwesenheitVorhanden = true;
        if (!e.minuten) ohneStundenVorhanden = true;
        zeilen.push('', tagText(e.datum), abwesenheitText(e));
        if (e.bemerkung) zeilen.push(`Bemerkung: ${e.bemerkung}`);
        zeilen.push(`= ${dauer(r.netto)}`);
        continue;
      }

      const folgetag = plusTage(e.datum, 1);
      const bisText = r.ueberMitternacht ? `${e.bis} (am ${WOCHENTAGE_KURZ[wochentagIndex(folgetag)]} ${kurzDatum(folgetag)})` : e.bis;
      const pauseText = e.pause > 0 ? `Pause ${e.pause} min` : 'ohne Pause';
      zeilen.push('', tagText(e.datum), `${e.von} – ${bisText} · ${pauseText}`, `Grund: ${e.grund}`);
      if (e.bemerkung) zeilen.push(`Bemerkung: ${e.bemerkung}`);
      zeilen.push(`= ${stundenText(r)}`);
    }

    zeilen.push('', `Total ${person.name}: ${stundenText({ netto: summeNetto, zuschlag: summeZuschlag })}`);
  }

  if (nachtVorhanden) {
    zeilen.push('', '', `Nachtarbeit ${nacht.von}–${nacht.bis} Uhr mit ${nacht.prozent} % Zuschlag (Pause anteilig abgezogen).`);
  }
  if (abwesenheitVorhanden) {
    zeilen.push('', `Krank/Ferien «ganzer Tag» = Wochensoll ${einstellungen.wochensoll} h ÷ 5.`);
  }
  if (ohneStundenVorhanden) {
    zeilen.push('', 'Krank/Ferien «keine Stunden» = nichts zu verrechnen (Stundenlohn).');
  }

  zeilen.push('', '', 'Freundliche Grüsse');
  if (einstellungen.absender?.trim()) zeilen.push(einstellungen.absender.trim());

  return zeilen.join('\n');
}

// Kurzer Mailtext, wenn das PDF angehängt ist: nur die Wochentotale zur schnellen Kontrolle.
function begleitText({ montag, personen, eintraege, einstellungen }) {
  const { woche } = kalenderwoche(montag);
  const zeilen = [
    einstellungen.anrede?.trim() || 'Hallo',
    '',
    `Im Anhang die Stempelkorrekturen für KW ${woche} (Mo ${kurzDatum(montag)} – So ${kurzDatum(plusTage(montag, 6), true)}):`,
    '',
  ];
  for (const person of personen) {
    let netto = 0;
    let zuschlag = 0;
    for (const e of eintraege.filter((x) => x.personId === person.id)) {
      const r = berechneEintrag(e, einstellungen.nacht);
      netto += r.netto;
      zuschlag += r.zuschlag;
    }
    zeilen.push(`- ${person.name}: ${stundenText({ netto, zuschlag })}`);
  }
  zeilen.push('', 'Freundliche Grüsse');
  if (einstellungen.absender?.trim()) zeilen.push(einstellungen.absender.trim());
  return zeilen.join('\n');
}

// Mehrere Adressen dürfen mit Komma, Strichpunkt oder Leerzeichen getrennt sein.
function adressen(text = '') {
  return text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((a) => encodeURIComponent(a).replace(/%40/g, '@'))
    .join(',');
}

function mailtoLink({ an, cc, betreff, text }) {
  const teile = [];
  if (cc?.trim()) teile.push('cc=' + adressen(cc));
  teile.push('subject=' + encodeURIComponent(betreff));
  teile.push('body=' + encodeURIComponent(text.replace(/\r?\n/g, '\r\n')));
  return `mailto:${adressen(an)}?${teile.join('&')}`;
}

// Kurzer «Fingerabdruck» der Einträge. Ändert sich ein Eintrag nach dem Senden,
// ändert sich auch der Fingerabdruck – so merkt die App, dass neu gesendet werden sollte.
function signatur(eintraege) {
  // Krank/Ferien hängen Art und Minuten an. Bei normalen Einträgen bleibt der Fingerabdruck
  // wie früher, sonst würden schon gesendete Wochen plötzlich als «geändert» gelten.
  const text = JSON.stringify(
    sortiert(eintraege).map((e) => [
      e.datum, e.von, e.bis, e.pause, e.grund, e.bemerkung || '',
      ...(e.art ? [e.art, e.minuten, e.ganzerTag !== false] : []),
    ]),
  );
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

globalThis.Mail = {
  betreff,
  sortiert,
  mailText,
  begleitText,
  mailtoLink,
  signatur,
};
})();
