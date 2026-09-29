// Die Oberfläche: zeichnet Woche, Personen und Tage und reagiert auf Antippen.
// Rechnen → zeit.js · Speichern → speicher.js · Mailtext → mail.js · PDF → pdf.js + blatt.js
// Diese Dateien lädt index.html vorher; sie stellen «Zeit», «Speicher», «Mail», «PDF» und «Blatt» bereit.

(() => {
const zeit = Zeit;
const { laden, speichern, neueId } = Speicher;
const { betreff, mailText, begleitText, mailtoLink, signatur } = Mail;

const zustand = laden();
const ansicht = {
  montag: zeit.startWoche(),
  personId: zustand.einstellungen.personen[0]?.id ?? null,
  letzteAuswahl: [], // «Gilt für» vom letzten Eintrag – praktisch, wenn das Team zusammen unterwegs war
};

const $ = (sel) => document.querySelector(sel);
const PAUSEN = [0, 15, 30, 45, 60];

// Text sicher ins HTML einsetzen (Namen könnten < oder & enthalten)
function esc(text = '') {
  return String(text).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]);
}

const symbol = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

function einstellungen() {
  return zustand.einstellungen;
}

function person(id) {
  return einstellungen().personen.find((p) => p.id === id);
}

function wochenEintraege(personId) {
  const bis = zeit.plusTage(ansicht.montag, 6);
  return zustand.eintraege.filter(
    (e) => e.datum >= ansicht.montag && e.datum <= bis && (personId === undefined || e.personId === personId),
  );
}

function summe(eintraege) {
  let netto = 0;
  let zuschlag = 0;
  for (const e of eintraege) {
    const r = zeit.berechne(e, einstellungen().nacht);
    netto += r.netto;
    zuschlag += r.zuschlag;
  }
  return { netto, zuschlag };
}

function speichereUndZeichne() {
  if (!speichern(zustand)) zeigeToast('Achtung: konnte nicht gespeichert werden.');
  zeichne();
}

// ---------- Senden-Status pro Person und Woche ----------

function wochenSchluessel() {
  return zeit.wochenSchluessel(ansicht.montag);
}

// 'offen' | 'gesendet' | 'geaendert' | null (keine Einträge)
function sendeStatus(personId) {
  const eigene = wochenEintraege(personId);
  const info = zustand.gesendet[wochenSchluessel()]?.[personId];
  if (eigene.length === 0) return info ? 'geaendert' : null;
  if (!info) return 'offen';
  return info.signatur === signatur(eigene) ? 'gesendet' : 'geaendert';
}

// ---------- Zeichnen ----------

function zeichne() {
  zeichneWoche();
  zeichnePersonen();
  zeichneStatus();
  zeichneTage();
  zeichneFuss();
}

function relativeWoche() {
  const diff = Math.round((zeit.alsDatum(ansicht.montag) - zeit.alsDatum(zeit.montagDerWoche(zeit.heute()))) / (7 * 86400000));
  if (diff === 0) return 'Diese Woche';
  if (diff === -1) return 'Letzte Woche';
  if (diff === 1) return 'Nächste Woche';
  return diff < 0 ? `Vor ${-diff} Wochen` : `In ${diff} Wochen`;
}

function zeichneWoche() {
  const { woche } = zeit.kalenderwoche(ansicht.montag);
  const sonntag = zeit.plusTage(ansicht.montag, 6);
  $('#woche-titel').innerHTML = `KW ${woche} <span class="woche-rel">${relativeWoche()}</span>`;
  $('#woche-daten').textContent = `${zeit.kurzDatum(ansicht.montag)} – ${zeit.kurzDatum(sonntag, true)}`;
}

function zeichnePersonen() {
  const personen = einstellungen().personen;
  $('#personen').innerHTML = personen
    .map((p) => {
      const s = summe(wochenEintraege(p.id));
      const gesendet = sendeStatus(p.id) === 'gesendet';
      const summeText = s.netto > 0 ? zeit.dauer(s.netto) + (s.zuschlag ? ` +${zeit.dauer(s.zuschlag)}` : '') : 'leer';
      return `
        <button class="person-tab" role="tab" type="button" data-person="${p.id}"
          aria-selected="${p.id === ansicht.personId}">
          <span class="name">${esc(p.name)}${gesendet ? symbol('haken') : ''}</span>
          <span class="summe">${summeText}</span>
        </button>`;
    })
    .join('');
  $('#personen').hidden = personen.length === 0;
}

function zeichneStatus() {
  const personen = einstellungen().personen;
  const status = personen.map((p) => sendeStatus(p.id)).filter(Boolean);
  const gesendet = status.filter((s) => s === 'gesendet').length;
  const geaendert = status.filter((s) => s === 'geaendert').length;
  let html = '';

  if (geaendert > 0) {
    html = `<span class="pille pille-warn">Nach dem Senden geändert – bitte nochmals senden</span>`;
  } else if (status.length > 0 && gesendet === status.length) {
    const zeiten = Object.values(zustand.gesendet[wochenSchluessel()] || {}).map((i) => i.am);
    const zuletzt = new Date(zeiten.sort().at(-1));
    const wann = `${zeit.WOCHENTAGE_KURZ[(zuletzt.getDay() + 6) % 7]} ${zeit.kurzDatum(zeit.alsText(zuletzt))}, ${zuletzt.toTimeString().slice(0, 5)}`;
    html = `<span class="pille pille-ok">${symbol('haken')} Mail erstellt am ${wann}</span>`;
  } else if (gesendet > 0) {
    html = `<span class="pille">${gesendet} von ${status.length} Personen gesendet</span>`;
  }
  $('#status').innerHTML = html;
}

function zeichneTage() {
  const personen = einstellungen().personen;
  if (personen.length === 0) {
    $('#tage').innerHTML = `
      <div class="leerzustand">
        <h2>Noch nicht eingerichtet</h2>
        <p>Trag zuerst ein, für wen du Korrekturen machst und an wen die Mail geht.</p>
        <button type="button" class="btn btn-primaer btn-gross" data-aktion="einrichten">Jetzt einrichten</button>
      </div>`;
    return;
  }

  const heute = zeit.heute();
  const nacht = einstellungen().nacht;
  const eigene = wochenEintraege(ansicht.personId);

  const tage = zeit.tageDerWoche(ansicht.montag).map((datum, i) => {
    const klassen = [datum === heute ? 'tag-heute' : '', i >= 5 ? 'tag-wochenende' : ''].join(' ');
    const kopf = `<span class="tag-name">${zeit.WOCHENTAGE[i]}</span><span class="tag-datum">${zeit.kurzDatum(datum)}</span>`;
    const amTag = eigene.filter((e) => e.datum === datum).sort((a, b) => a.von.localeCompare(b.von));

    if (amTag.length === 0) {
      return `
        <button type="button" class="tag tag-leer ${klassen}" data-neu="${datum}"
          aria-label="${zeit.WOCHENTAGE[i]} ${zeit.kurzDatum(datum)}: Eintrag hinzufügen">
          ${kopf}<span class="tag-plus">${symbol('plus')} eintragen</span>
        </button>`;
    }

    const s = summe(amTag);
    const zeilen = amTag
      .map((e) => {
        const r = zeit.berechne(e, nacht);
        const bis = r.ueberMitternacht ? `${e.bis} <span class="leise">(+1 Tag)</span>` : e.bis;
        const pause = e.pause > 0 ? `Pause ${e.pause} min` : 'ohne Pause';
        const nachtZeile = r.zuschlag
          ? `<div class="eintrag-nacht">${symbol('mond')} Nacht ${zeit.dauer(r.nacht)} → +${zeit.dauer(r.zuschlag)} Zuschlag</div>`
          : '';
        return `
          <button type="button" class="eintrag" data-id="${e.id}" aria-label="Eintrag ${e.von} bis ${e.bis} bearbeiten">
            <div class="eintrag-zeit">${e.von} – ${bis}</div>
            <div class="eintrag-info">${pause}${amTag.length > 1 ? ` · ${zeit.dauer(r.netto)}` : ''}${e.bemerkung ? ` · ${esc(e.bemerkung)}` : ''}</div>
            <span class="eintrag-grund">${esc(e.grund)}</span>
            ${nachtZeile}
          </button>`;
      })
      .join('');

    return `
      <section class="tag ${klassen}">
        <div class="tag-kopf">${kopf}<span class="tag-summe">${zeit.stundenText(s).replace(' Nachtzuschlag', '')}</span></div>
        ${zeilen}
        <button type="button" class="tag-mehr" data-neu="${datum}">${symbol('plus')} Weiterer Eintrag</button>
      </section>`;
  });

  const total = summe(eigene);
  const name = person(ansicht.personId)?.name ?? '';
  const totalHtml = eigene.length
    ? `<div class="wochen-total"><span>Total ${esc(name)}</span><strong>${zeit.stundenText(total)}</strong></div>`
    : '';

  $('#tage').innerHTML = tage.join('') + totalHtml;
}

function zeichneFuss() {
  const alle = wochenEintraege();
  const knopf = $('#btn-senden');
  knopf.disabled = alle.length === 0 || einstellungen().personen.length === 0;
  $('#btn-senden-text').textContent =
    alle.length === 0 ? 'Noch keine Einträge diese Woche' : `KW ${zeit.kalenderwoche(ansicht.montag).woche} per Mail senden`;
}

// ---------- Rückmeldung ----------

let toastTimer;
function zeigeToast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('sichtbar');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('sichtbar'), 3200);
}

// ---------- Eintrag-Blatt ----------

const editor = {
  id: null, // gesetzt beim Bearbeiten
  datum: null,
  besitzer: null, // Person des bearbeiteten Eintrags (kann nicht abgewählt werden)
  personen: new Set(),
  pause: 30,
  pauseAndere: false,
  grund: '',
  grundAnderes: false,
};

function oeffneEditor({ datum, id }) {
  const e = id ? zustand.eintraege.find((x) => x.id === id) : null;
  const vorschlag = zustand.zuletzt ?? { von: '07:00', bis: '16:30', pause: 30, grund: einstellungen().gruende[0] ?? '' };
  const werte = e ?? { ...vorschlag, datum, bemerkung: '' };

  editor.id = e?.id ?? null;
  editor.datum = werte.datum;
  editor.besitzer = e?.personId ?? null;

  if (e) {
    editor.personen = new Set([e.personId]);
  } else if (ansicht.letzteAuswahl.includes(ansicht.personId)) {
    editor.personen = new Set(ansicht.letzteAuswahl.filter((pid) => person(pid)));
  } else {
    editor.personen = new Set([ansicht.personId]);
  }

  editor.pause = Number(werte.pause) || 0;
  editor.pauseAndere = !PAUSEN.includes(editor.pause);
  editor.grund = werte.grund ?? '';
  editor.grundAnderes = Boolean(editor.grund) && !einstellungen().gruende.includes(editor.grund);

  const i = zeit.wochentagIndex(editor.datum);
  $('#e-titel').textContent = `${zeit.WOCHENTAGE[i]}, ${zeit.kurzDatum(editor.datum, true)}`;
  $('#e-von').value = werte.von;
  $('#e-bis').value = werte.bis;
  $('#e-pause-andere').value = editor.pauseAndere ? editor.pause : '';
  $('#e-grund-anderes').value = editor.grundAnderes ? editor.grund : '';
  $('#e-bemerkung').value = werte.bemerkung ?? '';
  $('#e-loeschen').hidden = !e;
  $('#e-fehler').textContent = '';

  zeichneEditor();
  $('#dlg-eintrag').showModal();
  $('#e-von').blur(); // nicht sofort die Tastatur/Zeitauswahl öffnen
}

function chip({ text, gedrueckt, daten, gesperrt = false }) {
  return `<button type="button" class="chip" aria-pressed="${gedrueckt}" ${daten} ${gesperrt ? 'disabled' : ''}>${symbol('haken')}${esc(text)}</button>`;
}

function zeichneEditor() {
  const personen = einstellungen().personen;
  $('#e-personen').innerHTML = personen
    .map((p) =>
      chip({
        text: p.name,
        gedrueckt: editor.personen.has(p.id),
        daten: `data-person="${p.id}"`,
        gesperrt: p.id === editor.besitzer,
      }),
    )
    .join('');

  $('#e-pause').innerHTML =
    PAUSEN.map((m) =>
      chip({ text: m === 0 ? 'Keine' : `${m} min`, gedrueckt: !editor.pauseAndere && editor.pause === m, daten: `data-pause="${m}"` }),
    ).join('') + chip({ text: 'Andere', gedrueckt: editor.pauseAndere, daten: 'data-pause="andere"' });
  $('#e-pause-andere-feld').hidden = !editor.pauseAndere;

  $('#e-grund').innerHTML =
    einstellungen()
      .gruende.map((g) => chip({ text: g, gedrueckt: !editor.grundAnderes && editor.grund === g, daten: `data-grund="${esc(g)}"` }))
      .join('') + chip({ text: 'Anderer …', gedrueckt: editor.grundAnderes, daten: 'data-grund-anderes' });
  $('#e-grund-anderes-feld').hidden = !editor.grundAnderes;

  zeichneErgebnis();
}

function editorWerte() {
  const pause = editor.pauseAndere ? Math.max(0, Math.round(Number($('#e-pause-andere').value) || 0)) : editor.pause;
  const grund = editor.grundAnderes ? $('#e-grund-anderes').value.trim() : editor.grund;
  return {
    datum: editor.datum,
    von: $('#e-von').value,
    bis: $('#e-bis').value,
    pause,
    grund,
    bemerkung: $('#e-bemerkung').value.trim(),
  };
}

function zeichneErgebnis() {
  const w = editorWerte();
  const hinweis = $('#e-mitternacht');
  const box = $('#e-ergebnis');

  if (!w.von || !w.bis || w.von === w.bis) {
    box.innerHTML = '';
    hinweis.hidden = true;
    return;
  }

  const r = zeit.berechne(w, einstellungen().nacht);
  if (r.ueberMitternacht) {
    const folgetag = zeit.plusTage(w.datum, 1);
    hinweis.textContent = `Über Mitternacht – endet am ${zeit.WOCHENTAGE[zeit.wochentagIndex(folgetag)]}, ${zeit.kurzDatum(folgetag)}`;
  }
  hinweis.hidden = !r.ueberMitternacht;

  if (w.pause >= r.brutto) {
    box.innerHTML = '';
    return;
  }

  const nachtZeile = r.zuschlag
    ? `<div class="ergebnis-nacht">${symbol('mond')} davon Nacht ${zeit.dauer(r.nacht)} · Zuschlag ${einstellungen().nacht.prozent} %</div>`
    : '';
  box.innerHTML = `<div class="ergebnis-haupt">= ${zeit.stundenText(r)}</div>${nachtZeile}`;
}

function speichereEintrag(ereignis) {
  ereignis.preventDefault();
  const w = editorWerte();

  const fehler =
    (editor.personen.size === 0 && 'Bitte mindestens eine Person wählen.') ||
    zeit.pruefe(w) ||
    (!w.grund && 'Bitte einen Grund antippen.');
  if (fehler) {
    $('#e-fehler').textContent = fehler;
    return;
  }

  const gleich = (e, pid) =>
    e.personId === pid && e.datum === w.datum && e.von === w.von && e.bis === w.bis;

  let anzahl = 0;
  if (editor.id) {
    const e = zustand.eintraege.find((x) => x.id === editor.id);
    Object.assign(e, w);
    anzahl = 1;
  }
  for (const pid of editor.personen) {
    if (pid === editor.besitzer) continue;
    if (zustand.eintraege.some((e) => gleich(e, pid))) continue; // nicht doppelt anlegen
    zustand.eintraege.push({ id: neueId(), personId: pid, ...w });
    anzahl++;
  }

  zustand.zuletzt = { von: w.von, bis: w.bis, pause: w.pause, grund: w.grund };
  if (!editor.id) ansicht.letzteAuswahl = [...editor.personen];

  $('#dlg-eintrag').close();
  speichereUndZeichne();
  zeigeToast(anzahl > 1 ? `Gespeichert für ${anzahl} Personen` : 'Gespeichert');
}

function loescheEintrag() {
  if (!editor.id) return;
  if (!confirm('Diesen Eintrag löschen?')) return;
  zustand.eintraege = zustand.eintraege.filter((e) => e.id !== editor.id);
  $('#dlg-eintrag').close();
  speichereUndZeichne();
  zeigeToast('Eintrag gelöscht');
}

// ---------- Senden-Blatt ----------

const senden = { auswahl: new Set() };

function oeffneSenden() {
  const mitEintraegen = einstellungen().personen.filter((p) => wochenEintraege(p.id).length > 0);
  const offene = mitEintraegen.filter((p) => sendeStatus(p.id) !== 'gesendet');
  // Standard: alle, die noch nicht (oder nicht aktuell) gesendet wurden
  senden.auswahl = new Set((offene.length ? offene : mitEintraegen).map((p) => p.id));
  $('#s-titel').textContent = `KW ${zeit.kalenderwoche(ansicht.montag).woche} senden`;
  zeichneSenden();
  $('#dlg-senden').showModal();
}

function zeichneSenden() {
  const e = einstellungen();
  const mitEintraegen = e.personen.filter((p) => wochenEintraege(p.id).length > 0);

  $('#s-an').innerHTML = e.empfaenger
    ? `<span>${esc(e.empfaenger)}${e.cc ? `<br><span class="leise">Kopie: ${esc(e.cc)}</span>` : ''}</span>
       <button type="button" class="btn" data-aktion="einstellungen">Ändern</button>`
    : `<span class="an-fehlt">Noch keine Empfänger-Adresse</span>
       <button type="button" class="btn" data-aktion="einstellungen">Eintragen</button>`;

  $('#s-personen').innerHTML = mitEintraegen
    .map((p) => {
      const st = sendeStatus(p.id);
      const zusatz = st === 'gesendet' ? ' (schon gesendet)' : st === 'geaendert' ? ' (geändert)' : '';
      return chip({ text: p.name + zusatz, gedrueckt: senden.auswahl.has(p.id), daten: `data-person="${p.id}"` });
    })
    .join('');

  const personen = mitEintraegen.filter((p) => senden.auswahl.has(p.id));
  const leer = personen.length === 0;

  // Übersicht: wer steht im PDF, mit Wochentotal
  $('#s-uebersicht').innerHTML = leer
    ? '<li class="leise">Bitte oben mindestens eine Person antippen.</li>'
    : personen
        .map((p) => {
          const eigene = wochenEintraege(p.id);
          return `<li><span>${esc(p.name)}</span><span class="zahlen">${eigene.length} ${eigene.length === 1 ? 'Eintrag' : 'Einträge'} · ${zeit.stundenText(summe(eigene)).replace(' Nachtzuschlag', '')}</span></li>`;
        })
        .join('');
  $('#s-pdf-senden').disabled = leer;
  $('#s-ansehen').disabled = leer;

  $('#s-hinweis').textContent = kannPdfTeilen(new File([''], 'probe.pdf', { type: 'application/pdf' }))
    ? `Im nächsten Schritt «Mail» oder «Outlook» wählen – das PDF ist angehängt.${
        e.empfaenger ? ` Die Adresse ${e.empfaenger} liegt dann in der Zwischenablage: ins Feld «An» tippen und «Einsetzen».` : ''
      }`
    : 'Das PDF wird im Download-Ordner gespeichert und die Mail öffnet sich. Dann das PDF in die Mail ziehen und senden.';

  // Text-Mail ohne PDF (wie bisher)
  const text = mailText({ montag: ansicht.montag, personen, eintraege: wochenEintraege(), einstellungen: e });
  const titel = betreff(ansicht.montag);
  $('#s-betreff').textContent = titel;
  $('#s-text').textContent = text;
  const link = $('#s-mailto');
  const bereit = Boolean(e.empfaenger) && !leer;
  link.href = bereit ? mailtoLink({ an: e.empfaenger, cc: e.cc, betreff: titel, text }) : '#';
  link.setAttribute('aria-disabled', String(!bereit));
}

function markiereGesendet() {
  const schluessel = wochenSchluessel();
  zustand.gesendet[schluessel] ??= {};
  const am = new Date().toISOString();
  for (const pid of senden.auswahl) {
    zustand.gesendet[schluessel][pid] = { am, signatur: signatur(wochenEintraege(pid)) };
  }
  speichern(zustand);
}

function sendenAbschliessen(meldung) {
  markiereGesendet();
  $('#dlg-senden').close();
  zeichne();
  zeigeToast(meldung);
}

// ---------- PDF ----------

// Auf dem Handy geht das PDF über «Teilen» direkt als Anhang in die Mail-App.
// Am PC ist dieser Weg unzuverlässig; dort wird das PDF gespeichert und die Mail geöffnet.
const IST_HANDY =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

function kannPdfTeilen(datei) {
  try {
    return IST_HANDY && Boolean(navigator.canShare?.({ files: [datei] }));
  } catch {
    return false;
  }
}

function sendePersonen() {
  return einstellungen().personen.filter((p) => senden.auswahl.has(p.id) && wochenEintraege(p.id).length > 0);
}

function pdfDatei(personen) {
  const bytes = Blatt.erstellen({ montag: ansicht.montag, personen, eintraege: wochenEintraege(), einstellungen: einstellungen() });
  return new File([bytes], Blatt.dateiname(ansicht.montag, personen), { type: 'application/pdf' });
}

// Öffnet eine Adresse über einen unsichtbaren Link (für Download und mailto)
function oeffneLink(href, dateiname) {
  const a = document.createElement('a');
  a.href = href;
  if (dateiname) a.download = dateiname;
  document.body.append(a);
  a.click();
  a.remove();
}

async function pdfSenden() {
  const personen = sendePersonen();
  if (personen.length === 0) return;
  const e = einstellungen();
  const datei = pdfDatei(personen);
  const titel = betreff(ansicht.montag);
  const text = begleitText({ montag: ansicht.montag, personen, eintraege: wochenEintraege(), einstellungen: e });

  if (kannPdfTeilen(datei)) {
    // «Teilen» kann keinen Empfänger mitgeben (das erlaubt das Handy nicht). Darum die Adresse
    // in die Zwischenablage legen. Nicht abwarten, sonst verfällt die Erlaubnis zum Teilen.
    if (e.empfaenger) navigator.clipboard?.writeText(e.empfaenger).catch(() => {});
    try {
      await navigator.share({ files: [datei], title: titel, text });
      sendenAbschliessen('PDF an die Mail-App übergeben');
    } catch (fehler) {
      if (fehler.name !== 'AbortError') zeigeToast('Teilen hat nicht geklappt – bitte «PDF ansehen» nutzen');
    }
    return;
  }

  const url = URL.createObjectURL(datei);
  oeffneLink(url, datei.name);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  setTimeout(() => {
    oeffneLink(mailtoLink({ an: e.empfaenger, cc: e.cc, betreff: titel, text }));
    sendenAbschliessen(`${datei.name} gespeichert – in die Mail ziehen und senden`);
  }, 600);
}

function pdfAnsehen() {
  const personen = sendePersonen();
  if (personen.length === 0) return;
  const datei = pdfDatei(personen);
  const url = URL.createObjectURL(datei);
  // In neuem Tab öffnen; blockiert der Browser das, wird das PDF stattdessen gespeichert.
  if (!window.open(url, '_blank')) oeffneLink(url, datei.name);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- Einstellungen-Blatt ----------

const entwurf = { personen: [], gruende: [] };

function oeffneEinstellungen() {
  const e = einstellungen();
  entwurf.personen = e.personen.map((p) => ({ ...p }));
  entwurf.gruende = [...e.gruende];
  if (entwurf.personen.length === 0) entwurf.personen.push({ id: neueId(), name: '', vorgesetzter: '' });

  $('#st-willkommen').hidden = e.personen.length > 0;
  $('#st-empfaenger').value = e.empfaenger;
  $('#st-cc').value = e.cc;
  $('#st-anrede').value = e.anrede;
  $('#st-absender').value = e.absender;
  $('#st-nacht-von').value = e.nacht.von;
  $('#st-nacht-bis').value = e.nacht.bis;
  $('#st-nacht-prozent').value = e.nacht.prozent;
  $('#st-fehler').textContent = '';

  zeichneEinstellungsListen();
  if ($('#dlg-senden').open) $('#dlg-senden').close();
  $('#dlg-einstellungen').showModal();
}

function zeichneEinstellungsListen() {
  $('#st-personen').innerHTML = entwurf.personen
    .map(
      (p, i) => `
      <div class="person-karte">
        <div class="listen-zeile">
          <input type="text" class="eingabe" data-person-index="${i}" value="${esc(p.name)}"
            placeholder="${i === 0 ? 'Dein Name' : `Mitarbeiter/in ${i}`}" aria-label="Name Person ${i + 1}" autocomplete="off">
          <button type="button" class="icon-btn" data-person-weg="${i}" aria-label="Person entfernen">${symbol('muell')}</button>
        </div>
        <label class="person-vorgesetzt">
          <span>Vorgesetzte/r</span>
          <input type="text" class="eingabe" data-vorgesetzter-index="${i}" value="${esc(p.vorgesetzter ?? '')}"
            placeholder="${i === 0 ? 'Name deines Chefs' : esc(entwurf.personen[0]?.name || 'Dein Name')}" autocomplete="off">
        </label>
      </div>`,
    )
    .join('');

  $('#st-gruende').innerHTML = entwurf.gruende
    .map(
      (g, i) => `
      <div class="listen-zeile">
        <input type="text" class="eingabe" data-grund-index="${i}" value="${esc(g)}" aria-label="Grund ${i + 1}" autocomplete="off">
        <button type="button" class="icon-btn" data-grund-weg="${i}" aria-label="Grund entfernen">${symbol('muell')}</button>
      </div>`,
    )
    .join('');
}

function speichereEinstellungen(ereignis) {
  ereignis.preventDefault();
  const personen = entwurf.personen
    .map((p) => ({ ...p, name: p.name.trim(), vorgesetzter: (p.vorgesetzter ?? '').trim() }))
    .filter((p) => p.name);
  const gruende = [...new Set(entwurf.gruende.map((g) => g.trim()).filter(Boolean))];
  const empfaenger = $('#st-empfaenger').value.trim();
  const prozent = Number($('#st-nacht-prozent').value);

  const fehler =
    (personen.length === 0 && 'Bitte mindestens eine Person eintragen.') ||
    (empfaenger && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empfaenger) && 'Die Empfänger-Adresse sieht nicht richtig aus.') ||
    (gruende.length === 0 && 'Bitte mindestens einen Grund eintragen.') ||
    (!(prozent >= 0 && prozent <= 100) && 'Der Nachtzuschlag muss zwischen 0 und 100 % liegen.') ||
    ((!$('#st-nacht-von').value || !$('#st-nacht-bis').value) && 'Bitte die Nachtzeit ausfüllen.');
  if (fehler) {
    $('#st-fehler').textContent = fehler;
    $('#st-fehler').scrollIntoView({ block: 'nearest' });
    return;
  }

  Object.assign(zustand.einstellungen, {
    personen,
    gruende,
    empfaenger,
    cc: $('#st-cc').value.trim(),
    anrede: $('#st-anrede').value.trim() || 'Hallo',
    absender: $('#st-absender').value.trim(),
    nacht: { von: $('#st-nacht-von').value, bis: $('#st-nacht-bis').value, prozent },
  });
  if (!person(ansicht.personId)) ansicht.personId = personen[0].id;

  $('#dlg-einstellungen').close();
  speichereUndZeichne();
  zeigeToast('Einstellungen gespeichert');
}

// ---------- Ereignisse ----------

function wechsleWoche(tage) {
  ansicht.montag = zeit.plusTage(ansicht.montag, tage);
  zeichne();
}

$('#woche-zurueck').addEventListener('click', () => wechsleWoche(-7));
$('#woche-vor').addEventListener('click', () => wechsleWoche(7));
$('#btn-einstellungen').addEventListener('click', oeffneEinstellungen);
$('#btn-senden').addEventListener('click', oeffneSenden);

$('#personen').addEventListener('click', (ereignis) => {
  const tab = ereignis.target.closest('[data-person]');
  if (!tab) return;
  ansicht.personId = tab.dataset.person;
  zeichne();
});

$('#tage').addEventListener('click', (ereignis) => {
  const ziel = ereignis.target.closest('[data-neu], [data-id], [data-aktion]');
  if (!ziel) return;
  if (ziel.dataset.aktion === 'einrichten') oeffneEinstellungen();
  else if (ziel.dataset.id) oeffneEditor({ id: ziel.dataset.id });
  else oeffneEditor({ datum: ziel.dataset.neu });
});

// Alle Blätter: Schliessen-Knopf und Tippen auf den dunklen Hintergrund
for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', (ereignis) => {
    if (ereignis.target === dlg || ereignis.target.closest('[data-schliessen]')) dlg.close();
  });
}

// Eintrag-Blatt
$('#form-eintrag').addEventListener('submit', speichereEintrag);
$('#e-loeschen').addEventListener('click', loescheEintrag);
for (const feld of ['#e-von', '#e-bis', '#e-pause-andere', '#e-grund-anderes']) {
  $(feld).addEventListener('input', () => {
    $('#e-fehler').textContent = '';
    zeichneErgebnis();
  });
}

$('#e-personen').addEventListener('click', (ereignis) => {
  const c = ereignis.target.closest('[data-person]');
  if (!c || c.disabled) return;
  const pid = c.dataset.person;
  editor.personen.has(pid) ? editor.personen.delete(pid) : editor.personen.add(pid);
  zeichneEditor();
});

$('#e-pause').addEventListener('click', (ereignis) => {
  const c = ereignis.target.closest('[data-pause]');
  if (!c) return;
  if (c.dataset.pause === 'andere') {
    editor.pauseAndere = true;
    zeichneEditor();
    $('#e-pause-andere').focus();
  } else {
    editor.pauseAndere = false;
    editor.pause = Number(c.dataset.pause);
    zeichneEditor();
  }
});

$('#e-grund').addEventListener('click', (ereignis) => {
  const c = ereignis.target.closest('[data-grund], [data-grund-anderes]');
  if (!c) return;
  $('#e-fehler').textContent = '';
  if (c.hasAttribute('data-grund-anderes')) {
    editor.grundAnderes = true;
    zeichneEditor();
    $('#e-grund-anderes').focus();
  } else {
    editor.grundAnderes = false;
    editor.grund = c.dataset.grund;
    zeichneEditor();
  }
});

// Senden-Blatt
$('#s-personen').addEventListener('click', (ereignis) => {
  const c = ereignis.target.closest('[data-person]');
  if (!c) return;
  const pid = c.dataset.person;
  senden.auswahl.has(pid) ? senden.auswahl.delete(pid) : senden.auswahl.add(pid);
  zeichneSenden();
});

$('#dlg-senden').addEventListener('click', (ereignis) => {
  if (ereignis.target.closest('[data-aktion="einstellungen"]')) oeffneEinstellungen();
});

$('#s-mailto').addEventListener('click', (ereignis) => {
  if ($('#s-mailto').getAttribute('aria-disabled') === 'true') {
    ereignis.preventDefault();
    if (!einstellungen().empfaenger) oeffneEinstellungen();
    return;
  }
  // Der Link öffnet die Mail-App; wir merken uns, dass diese Woche verschickt wurde.
  setTimeout(() => sendenAbschliessen('Mail-App geöffnet – dort auf «Senden» tippen'), 400);
});

$('#s-pdf-senden').addEventListener('click', pdfSenden);
$('#s-ansehen').addEventListener('click', pdfAnsehen);

// Einstellungen-Blatt
$('#form-einstellungen').addEventListener('submit', speichereEinstellungen);

$('#st-personen').addEventListener('input', (ereignis) => {
  const { personIndex, vorgesetzterIndex } = ereignis.target.dataset;
  if (personIndex !== undefined) entwurf.personen[personIndex].name = ereignis.target.value;
  if (vorgesetzterIndex !== undefined) entwurf.personen[vorgesetzterIndex].vorgesetzter = ereignis.target.value;
});
$('#st-gruende').addEventListener('input', (ereignis) => {
  const i = ereignis.target.dataset.grundIndex;
  if (i !== undefined) entwurf.gruende[i] = ereignis.target.value;
});

$('#st-personen').addEventListener('click', (ereignis) => {
  const knopf = ereignis.target.closest('[data-person-weg]');
  if (!knopf) return;
  const p = entwurf.personen[knopf.dataset.personWeg];
  const hatEintraege = zustand.eintraege.some((e) => e.personId === p.id);
  if (hatEintraege && !confirm(`${p.name || 'Diese Person'} hat Einträge. Trotzdem entfernen?`)) return;
  entwurf.personen.splice(knopf.dataset.personWeg, 1);
  zeichneEinstellungsListen();
});
$('#st-gruende').addEventListener('click', (ereignis) => {
  const knopf = ereignis.target.closest('[data-grund-weg]');
  if (!knopf) return;
  entwurf.gruende.splice(knopf.dataset.grundWeg, 1);
  zeichneEinstellungsListen();
});

$('#st-person-plus').addEventListener('click', () => {
  // Neue Mitarbeitende: du (die erste Person) bist als Vorgesetzte/r schon eingetragen
  entwurf.personen.push({ id: neueId(), name: '', vorgesetzter: entwurf.personen[0]?.name.trim() ?? '' });
  zeichneEinstellungsListen();
  $(`[data-person-index="${entwurf.personen.length - 1}"]`).focus();
});
$('#st-grund-plus').addEventListener('click', () => {
  entwurf.gruende.push('');
  zeichneEinstellungsListen();
  $(`[data-grund-index="${entwurf.gruende.length - 1}"]`).focus();
});

$('#st-alles-loeschen').addEventListener('click', () => {
  if (!confirm('Wirklich ALLE Einträge aller Wochen löschen? Das kann nicht rückgängig gemacht werden.')) return;
  zustand.eintraege = [];
  zustand.gesendet = {};
  speichereUndZeichne();
  zeigeToast('Alle Einträge gelöscht');
});

// ---------- Start ----------

zeichne();
if (einstellungen().personen.length === 0) oeffneEinstellungen();

// Offline-Fähigkeit: der «Service Worker» legt die App-Dateien auf dem Handy ab,
// damit sie auch ohne Empfang startet. Läuft nur über https (oder lokal).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch((fehler) => console.warn('Service Worker nicht aktiv', fehler));
}
})();
