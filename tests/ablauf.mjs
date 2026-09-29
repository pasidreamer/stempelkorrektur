// Spielt die ganze App einmal durch – in einem unsichtbaren Edge in Handygrösse.
// Voraussetzung: die App läuft lokal, z. B. mit  python -m http.server 5181 --bind 127.0.0.1
// Aufruf:  node tests/ablauf.mjs http://localhost:5181/ <ordner-für-screenshots>
//   oder:  node tests/ablauf.mjs file:///C:/Pfad/zu/index.html <ordner>   (wie Doppelklick; ohne Offline-Teil)
import { mkdirSync, writeFileSync } from 'node:fs';
import { withPage, sleep } from './cdp.mjs';

const [url = 'http://localhost:5181/', ordner = 'shots'] = process.argv.slice(2);
mkdirSync(ordner, { recursive: true });
const alsDatei = url.startsWith('file:');

let fehler = 0;
function pruefe(bedingung, text) {
  console.log(`${bedingung ? '  ok  ' : 'FEHLER'}  ${text}`);
  if (!bedingung) fehler++;
}

await withPage(url, { width: 390, height: 844 }, async ({ send, evaluate, shot, errors }) => {
  const klick = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const text = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim() ?? null`);
  const setze = (sel, wert) =>
    evaluate(`(() => { const f = document.querySelector(${JSON.stringify(sel)}); f.value = ${JSON.stringify(wert)};
      f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const offen = (id) => evaluate(`document.getElementById('${id}').open`);

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // 1. Erster Start: Einrichtung öffnet sich von selbst
  pruefe(await offen('dlg-einstellungen'), 'Erster Start öffnet die Einstellungen');
  await shot(`${ordner}/01-einrichtung.png`);

  await setze('[data-person-index="0"]', 'Lena');
  await setze('[data-vorgesetzter-index="0"]', 'Beat Chef');
  for (const name of ['Marco', 'Luca', 'Nina']) {
    await klick('#st-person-plus');
    const i = await evaluate(`document.querySelectorAll('[data-person-index]').length - 1`);
    await setze(`[data-person-index="${i}"]`, name);
  }
  const vorgesetzte = await evaluate(`[...document.querySelectorAll('[data-vorgesetzter-index]')].map((f) => f.value).join(',')`);
  pruefe(vorgesetzte === 'Beat Chef,Lena,Lena,Lena', `Vorgesetzte/r: eigenes Feld frei wählbar, Mitarbeitende haben dich vorbelegt (${vorgesetzte})`);
  await shot(`${ordner}/01b-einrichtung-vorgesetzte.png`);
  await setze('#st-empfaenger', 'buero@example.ch');
  await setze('#st-anrede', 'Hallo Sandra');
  await setze('#st-absender', 'Lena');
  await klick('#form-einstellungen button[type=submit]');
  await sleep(300);
  pruefe(!(await offen('dlg-einstellungen')), 'Einstellungen gespeichert und geschlossen');
  pruefe((await evaluate(`document.querySelectorAll('.person-tab').length`)) === 4, '4 Personen-Reiter sichtbar');
  await shot(`${ordner}/02-woche-leer.png`);

  // 2. Montag für das ganze Team eintragen
  await klick('[data-neu]');
  await sleep(300);
  pruefe(await offen('dlg-eintrag'), 'Tippen auf einen leeren Tag öffnet das Eintrag-Blatt');
  pruefe((await evaluate(`document.getElementById('e-loeschen').offsetParent === null`)), 'Kein «Löschen» bei neuem Eintrag');
  pruefe((await evaluate(`document.getElementById('e-pause-andere-feld').offsetParent === null`)), 'Minuten-Feld versteckt, solange nicht «Andere»');
  for (const name of ['Marco', 'Luca', 'Nina']) {
    await evaluate(`[...document.querySelectorAll('#e-personen .chip')].find(c => c.textContent.includes('${name}')).click()`);
  }
  await setze('#e-von', '07:00');
  await setze('#e-bis', '16:30');
  await shot(`${ordner}/03-eintrag-team.png`);
  pruefe((await text('#e-ergebnis')) === '= 9:00 h', `Anzeige 9:00 h (ist: ${await text('#e-ergebnis')})`);
  await klick('#form-eintrag button[type=submit]');
  await sleep(300);
  const anzahl = await evaluate(`JSON.parse(localStorage.getItem('stempelkorrektur.v1')).eintraege.length`);
  pruefe(anzahl === 4, `Ein Eintrag für 4 Personen gespeichert (${anzahl})`);

  // 3. Dienstag Nachtarbeit 23:00–04:00, keine Pause, ESL
  await evaluate(`document.querySelectorAll('[data-neu]')[1].click()`);
  await sleep(300);
  const vorschlag = await evaluate(`document.getElementById('e-von').value + '-' + document.getElementById('e-bis').value`);
  pruefe(vorschlag === '07:00-16:30', `Neuer Eintrag schlägt die letzten Zeiten vor (${vorschlag})`);
  const auswahl = await evaluate(`document.querySelectorAll('#e-personen .chip[aria-pressed=true]').length`);
  pruefe(auswahl === 4, `«Gilt für» merkt sich das ganze Team (${auswahl})`);
  // nur Lena
  for (const name of ['Marco', 'Luca', 'Nina']) {
    await evaluate(`[...document.querySelectorAll('#e-personen .chip')].find(c => c.textContent.includes('${name}')).click()`);
  }
  await setze('#e-von', '23:00');
  await setze('#e-bis', '04:00');
  await klick('[data-pause="0"]');
  await evaluate(`document.querySelector('[data-grund="ESL"]').click()`);
  await setze('#e-bemerkung', 'Notfall Lüftung');
  await shot(`${ordner}/04-eintrag-nacht.png`);
  pruefe((await text('.ergebnis-haupt')) === '= 5:00 h (+1:15 h Nachtzuschlag)', `Nachtzuschlag angezeigt (${await text('.ergebnis-haupt')})`);
  pruefe((await text('#e-mitternacht'))?.includes('Mittwoch'), `Hinweis «über Mitternacht» (${await text('#e-mitternacht')})`);
  await klick('#form-eintrag button[type=submit]');
  await sleep(300);

  // 4. Fehler werden abgefangen
  await evaluate(`document.querySelectorAll('[data-neu]')[2].click()`);
  await sleep(200);
  await setze('#e-von', '08:00');
  await setze('#e-bis', '08:00');
  await klick('#form-eintrag button[type=submit]');
  pruefe((await text('#e-fehler'))?.includes('gleich'), `Fehler bei Von = Bis (${await text('#e-fehler')})`);
  await klick('#dlg-eintrag [data-schliessen]');

  await shot(`${ordner}/05-woche-lena.png`);
  // Wochenstand: 14:00 h gearbeitet + 1:15 h Nachtzuschlag = 15:15 h von 43:00 h
  const stand = async () => [
    (await text('.stand-kopf strong'))?.replace(/\s+/g, ' '),
    await text('.stand-text'),
    await evaluate(`document.querySelector('.stand').classList.contains('stand-erreicht')`),
  ];
  let [standZahl, standText, erreicht] = await stand();
  pruefe(standZahl === '15:15 h / 43:00 h', `Wochenstand oben (${standZahl})`);
  pruefe(standText === 'noch 27:45 h bis zum Soll · inkl. 1:15 h Nachtzuschlag' && !erreicht, `Wochenstand: was noch fehlt (${standText})`);

  // Wochensoll in den Einstellungen ändern (mit Komma wie auf dem Handy): 15,25 h = genau erreicht
  await klick('#btn-einstellungen');
  await sleep(300);
  pruefe((await evaluate(`document.getElementById('st-wochensoll').value`)) === '43', 'Einstellungen: Wochensoll ist mit 43 vorbelegt');
  await evaluate(`document.getElementById('st-wochensoll').type = 'text'`); // damit das Komma im Test ankommt
  await setze('#st-wochensoll', '15,25');
  await klick('#form-einstellungen button[type=submit]');
  await sleep(300);
  [standZahl, standText, erreicht] = await stand();
  pruefe(standZahl === '15:15 h / 15:15 h' && standText.startsWith('Soll genau erreicht') && erreicht, `Soll erreicht wird grün (${standText})`);
  await shot(`${ordner}/05b-soll-erreicht.png`);
  await klick('#btn-einstellungen');
  await sleep(300);
  await setze('#st-wochensoll', '43');
  await klick('#form-einstellungen button[type=submit]');
  await sleep(300);
  const breite = await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`);
  pruefe(breite, 'Kein seitliches Scrollen');

  // 5. Senden-Blatt: Übersicht, Hinweis, Text-Mail als Ausweichweg
  const kw = Number((await text('#woche-titel')).match(/KW (\d+)/)[1]);
  const pdfName = `Stempelkorrekturen_KW${kw}_`;
  await klick('#btn-senden');
  await sleep(700);
  pruefe(await offen('dlg-senden'), 'Senden-Blatt geöffnet');
  pruefe((await evaluate(`document.querySelectorAll('#s-uebersicht li').length`)) === 4, 'Übersicht zeigt 4 Personen');
  pruefe((await text('#s-uebersicht li'))?.includes('14:00 h (+1:15 h)'), `Übersicht mit Wochentotal (${await text('#s-uebersicht li')})`);
  pruefe((await text('#s-hinweis'))?.includes('Download-Ordner'), 'Am PC: Hinweis «PDF in die Mail ziehen»');
  await shot(`${ordner}/06-senden.png`);
  const href = await evaluate(`document.getElementById('s-mailto').href`);
  pruefe(href.startsWith('mailto:buero@example.ch?subject='), 'Text-Mail: mailto-Link mit Empfänger');
  const body = decodeURIComponent(href.split('body=')[1]);
  pruefe(body.includes('\r\n') && body.includes('= 5:00 h (+1:15 h Nachtzuschlag)'), 'Text-Mail: CRLF und Nachtzuschlag im Text');

  // Unsichtbare Links (Download, mailto) und neue Fenster mitschreiben statt ausführen
  await evaluate(`window.__links = []; window.__fenster = [];
    HTMLAnchorElement.prototype.click = function () { window.__links.push({ href: this.href, download: this.download }); };
    window.open = (u) => { window.__fenster.push(u); return {}; };`);

  // 5a. PDF ansehen: das erzeugte PDF abholen und prüfen
  await klick('#s-ansehen');
  const pdf64 = await evaluate(`(async () => { const b = new Uint8Array(await (await fetch(window.__fenster[0])).arrayBuffer());
    let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); })()`);
  const pdf = Buffer.from(pdf64, 'base64');
  writeFileSync(`${ordner}/woche.pdf`, pdf);
  pruefe(pdf.toString('latin1').startsWith('%PDF-1.4') && /\/Count 4 /.test(pdf.toString('latin1')), `«PDF ansehen»: gültiges PDF mit 4 Seiten (${pdf.length} Byte)`);
  const imPdf = (s) => pdf.toString('latin1').split(s).length - 1;
  pruefe(imPdf('(Beat Chef)') === 1 && imPdf('(Lena)') >= 4, 'PDF: Vorgesetzte/r pro Person (Chef bei Lena, Lena bei den anderen)');
  pruefe(imPdf('(Datum, Visum Vorgesetzte/r)') === 4 && imPdf('(Datum, Visum Mitarbeiter/in)') === 4, 'PDF: Unterschriftszeilen auf jedem Blatt');

  // 5b. PDF per Mail senden – PC-Weg: PDF speichern, dann Mail öffnen
  await klick('#s-pdf-senden');
  for (let i = 0; i < 50 && (await evaluate('window.__links.length')) < 2; i++) await sleep(100);
  await sleep(200); // Senden-Blatt schliesst sich direkt nach dem Öffnen der Mail
  const links = await evaluate('window.__links');
  pruefe(links[0]?.href.startsWith('blob:') && links[0].download.startsWith(pdfName), `PC: PDF wird gespeichert (${links[0]?.download})`);
  const mail = links[1]?.href ?? '';
  const begleit = decodeURIComponent(mail.split('body=')[1] ?? '');
  pruefe(mail.startsWith('mailto:buero@example.ch?subject=Stempelkorrekturen'), 'PC: danach öffnet sich die Mail mit Empfänger und Betreff');
  pruefe(begleit.includes('- Lena: 14:00 h (+1:15 h Nachtzuschlag)'), 'PC: Begleittext mit Wochentotal');
  console.log('\n--- Begleittext ---\n' + begleit.replace(/\r\n/g, '\n') + '\n-------------------\n');
  pruefe(!(await offen('dlg-senden')), 'Senden-Blatt schliesst sich');
  pruefe((await text('#status'))?.startsWith('Mail erstellt'), `Status nach dem Senden (${await text('#status')})`);
  await shot(`${ordner}/07-gesendet.png`);

  // 6. Nach dem Senden ändern → Warnung
  await klick('.eintrag');
  await sleep(200);
  await setze('#e-bis', '17:00');
  await klick('#form-eintrag button[type=submit]');
  await sleep(300);
  pruefe((await text('#status'))?.includes('geändert'), `Warnung nach Änderung (${await text('#status')})`);

  // 6b. Handy-Weg: PDF über «Teilen» an die Mail-App (iPhone vorgetäuscht, Teilen mitgeschrieben)
  await send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  await send('Page.reload');
  await sleep(2500);
  await evaluate(`window.__geteilt = []; window.__ablage = []; navigator.canShare = () => true;
    navigator.share = async (d) => { window.__geteilt.push({ name: d.files[0].name, typ: d.files[0].type, groesse: d.files[0].size, titel: d.title, text: d.text }); };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__ablage.push(t); } } });`);
  await klick('#btn-senden');
  await sleep(300);
  pruefe((await text('#s-hinweis'))?.includes('Mailprogramm wählen'), `Handy: Hinweis «Mailprogramm wählen» (${await text('#s-hinweis')})`);
  await shot(`${ordner}/06b-senden-handy.png`);
  await klick('#s-pdf-senden');
  await sleep(600);
  const geteilt = await evaluate('window.__geteilt[0] ?? null');
  pruefe(geteilt?.typ === 'application/pdf' && geteilt.groesse > 3000, `Handy: PDF wird zum Teilen übergeben (${geteilt?.name}, ${geteilt?.groesse} Byte)`);
  pruefe(new RegExp(`^${pdfName}\\d{4}_Lena\\.pdf$`).test(geteilt?.name ?? ''), 'Handy: nur die geänderte Person ist vorausgewählt, Name im Dateinamen');
  pruefe(geteilt?.titel.startsWith('Stempelkorrekturen KW') && geteilt.text.includes('Im Anhang'), 'Handy: Betreff und Begleittext dabei');
  const ablage = await evaluate('window.__ablage');
  pruefe(ablage.length === 0, `Handy: vor dem Teilen wird nichts in die Zwischenablage kopiert (${ablage.length})`);
  pruefe((await text('#status'))?.startsWith('Mail erstellt'), `Handy: Status danach (${await text('#status')})`);

  // 6c. Handy: Teilen scheitert → PDF wird gespeichert, Grund steht im Senden-Blatt
  await evaluate(`window.__links = [];
    HTMLAnchorElement.prototype.click = function () { window.__links.push({ href: this.href, download: this.download }); };
    navigator.share = async () => { throw new DOMException('Test: Teilen verweigert', 'NotAllowedError'); };`);
  await klick('#btn-senden');
  await sleep(300);
  await klick('#s-pdf-senden');
  await sleep(600);
  const ersatz = await evaluate('window.__links[0] ?? null');
  pruefe(ersatz?.href.startsWith('blob:') && ersatz.download.endsWith('.pdf'), `Handy: bei Fehler wird das PDF gespeichert (${ersatz?.download})`);
  pruefe((await text('#s-hinweis'))?.includes('NotAllowedError') && (await offen('dlg-senden')), 'Handy: Grund wird angezeigt, Senden-Blatt bleibt offen');
  await shot(`${ordner}/06c-teilen-fehler.png`);
  await klick('#dlg-senden [data-schliessen]');

  // 6d. Samsung-Browser: kann PDFs nicht teilen → gar nicht erst versuchen, sondern PDF speichern
  //     und die Mail (mit Empfänger) öffnen
  await send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  });
  await send('Page.reload');
  await sleep(2500);
  await evaluate(`window.__links = []; window.__geteilt = [];
    HTMLAnchorElement.prototype.click = function () { window.__links.push({ href: this.href, download: this.download }); };
    navigator.canShare = () => true;
    navigator.share = async () => { window.__geteilt.push('versucht'); };`);
  await klick('#btn-senden');
  await sleep(300);
  pruefe((await text('#s-hinweis'))?.includes('Samsung-Browser kann PDFs nicht teilen'), 'Samsung-Browser: Hinweis erklärt den anderen Weg');
  await klick('#s-pdf-senden');
  // Die Mail öffnet sich absichtlich kurz nach dem Speichern: warten, bis beide Links da sind (max. 5 s)
  for (let i = 0; i < 50 && (await evaluate('window.__links.length')) < 2; i++) await sleep(100);
  const samsung = await evaluate('({ links: window.__links, geteilt: window.__geteilt })');
  pruefe(samsung.geteilt.length === 0, 'Samsung-Browser: Teilen wird gar nicht erst versucht');
  pruefe(samsung.links[0]?.href.startsWith('blob:') && samsung.links[0].download.endsWith('.pdf'), `Samsung-Browser: PDF wird gespeichert (${samsung.links[0]?.download})`);
  pruefe(samsung.links[1]?.href.startsWith('mailto:buero@example.ch?'), `Samsung-Browser: danach öffnet sich die Mail mit Empfänger (${samsung.links[1]?.href.slice(0, 40) ?? 'kein zweiter Link'})`);
  await shot(`${ordner}/06d-samsung.png`);
  await klick('#dlg-senden [data-schliessen]');

  // 6e. Krank und Ferien: ganzer Tag ohne Zeiten, zählt im Wochenstand, steht in Mail und PDF
  const minutenAus = (s) => {
    const m = s.match(/(\d+):(\d+) h/);
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const standVorher = minutenAus(await text('.stand-kopf strong'));
  await evaluate(`document.querySelector('.tag-leer[data-neu]').click()`);
  await sleep(300);
  pruefe((await evaluate(`document.querySelector('[data-art="arbeit"]').getAttribute('aria-pressed')`)) === 'true', 'Neuer Eintrag: «Arbeit» ist vorgewählt');
  await evaluate(`document.querySelector('[data-art="krank"]').click()`);
  pruefe(await evaluate(`document.getElementById('e-arbeit').offsetParent === null`), 'Krank: Von, Bis, Pause und Grund sind ausgeblendet');
  pruefe((await text('.ergebnis-haupt')) === '= 8:36 h (ganzer Tag)', `Krank: ganzer Tag = 8:36 h (${await text('.ergebnis-haupt')})`);
  await shot(`${ordner}/06e-krank.png`);
  await klick('#form-eintrag button[type=submit]');
  await sleep(300);
  const krankKarte = await evaluate(`document.querySelector('.eintrag-krank')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`);
  pruefe(krankKarte.startsWith('Krank') && krankKarte.includes('ganzer Tag'), `Tageskarte zeigt «Krank · ganzer Tag» (${krankKarte})`);
  const standNachher = minutenAus(await text('.stand-kopf strong'));
  pruefe(standNachher - standVorher === 516, `Wochenstand steigt um 8:36 h (${standVorher} → ${standNachher} min)`);

  await evaluate(`document.querySelector('.tag-leer[data-neu]').click()`);
  await sleep(300);
  await evaluate(`document.querySelector('[data-art="ferien"]').click()`);
  await klick('#form-eintrag button[type=submit]');
  await sleep(300);
  pruefe(await evaluate(`!!document.querySelector('.eintrag-ferien')`), 'Ferien-Tag wird angezeigt');
  await shot(`${ordner}/06f-woche-krank-ferien.png`);

  await evaluate(`document.querySelector('.eintrag-krank').click()`);
  await sleep(300);
  pruefe((await evaluate(`document.querySelector('[data-art="krank"]').getAttribute('aria-pressed')`)) === 'true', 'Bearbeiten: Krank ist wieder ausgewählt');
  await klick('#dlg-eintrag [data-schliessen]');

  await klick('#btn-senden');
  await sleep(500);
  const textMail = decodeURIComponent(await evaluate(`document.getElementById('s-mailto').href`));
  pruefe(textMail.includes('Krank (ganzer Tag)') && textMail.includes('Ferien (ganzer Tag)'), 'Text-Mail: Krank und Ferien als ganzer Tag');
  await evaluate(`window.__fenster = []; window.open = (u) => { window.__fenster.push(u); return {}; };`);
  await klick('#s-ansehen');
  const pdfKrank64 = await evaluate(`(async () => { const b = new Uint8Array(await (await fetch(window.__fenster[0])).arrayBuffer());
    let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); })()`);
  const pdfKrank = Buffer.from(pdfKrank64, 'base64').toString('latin1');
  pruefe(pdfKrank.includes(String.raw`(Krank \(ganzer Tag\))`) && pdfKrank.includes(String.raw`(Ferien \(ganzer Tag\))`), 'PDF: Krank und Ferien als ganzer Tag');
  await klick('#dlg-senden [data-schliessen]');

  // 7. Woche wechseln
  await klick('#woche-vor');
  pruefe((await text('#woche-titel'))?.startsWith(`KW ${kw + 1}`), `Vorwärts zur KW ${kw + 1} (${await text('#woche-titel')})`);

  // 8. Dunkles Design
  await klick('#woche-zurueck');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(300);
  await shot(`${ordner}/08-dunkel.png`);
  await evaluate(`document.querySelectorAll('.eintrag')[1].click()`);
  await sleep(400);
  await shot(`${ordner}/09-dunkel-eintrag.png`);
  await klick('#dlg-eintrag [data-schliessen]');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // 9. Offline: Service Worker aktiv, App startet ohne Netz (nur über http/https möglich)
  if (!alsDatei) {
  await send('Page.reload');
  await sleep(2500);
  const sw = await evaluate(`navigator.serviceWorker.ready.then(r => !!r.active)`);
  pruefe(sw, 'Service Worker aktiv');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Page.reload');
  await sleep(2500);
  const offlineTitel = await text('#woche-titel');
  pruefe(offlineTitel?.startsWith('KW'), `Startet offline (${offlineTitel})`);
  pruefe((await evaluate(`document.querySelectorAll('.eintrag').length`)) > 0, 'Einträge offline sichtbar');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }

  const konsole = errors();
  pruefe(konsole.length === 0, `Keine Fehler in der Konsole${konsole.length ? ': ' + konsole.join(' | ') : ''}`);
});
// Das erzeugte PDF liegt danach als woche.pdf im Screenshot-Ordner – zum Anschauen einfach öffnen.

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nAlles bestanden');
process.exit(fehler ? 1 : 0);
