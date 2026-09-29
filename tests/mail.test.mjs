// Prüft Mailtext und «Fingerabdruck» (Senden-Status).  Ausführen mit:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/zeit.js';
import '../js/mail.js';

const einstellungen = { anrede: 'Hallo', absender: 'Test', wochensoll: 43, nacht: { von: '22:00', bis: '05:00', prozent: 25 } };
const personen = [{ id: 'a', name: 'Lena' }];
const arbeit = { id: '1', personId: 'a', datum: '2026-09-28', von: '07:00', bis: '16:30', pause: 30, grund: 'Lüftec', bemerkung: '' };
const krank = { id: '2', personId: 'a', datum: '2026-09-29', art: 'krank', minuten: 516, von: '', bis: '', pause: 0, grund: 'Krank', bemerkung: '' };

test('Mailtext: Krank als ganzer Tag, Total inkl. Krank', () => {
  const text = Mail.mailText({ montag: '2026-09-28', personen, eintraege: [arbeit, krank], einstellungen });
  assert.ok(text.includes('Di 29.09.2026\nKrank (ganzer Tag)\n= 8:36 h'), text);
  assert.ok(text.includes('Total Lena: 17:36 h'));
  assert.ok(text.includes('Krank/Ferien zählen als ganzer Tag (Wochensoll 43 h ÷ 5).'));
  const kurz = Mail.begleitText({ montag: '2026-09-28', personen, eintraege: [arbeit, krank], einstellungen });
  assert.ok(kurz.includes('- Lena: 17:36 h'));
});

test('Fingerabdruck normaler Einträge bleibt wie früher (sonst gälten gesendete Wochen als geändert)', () => {
  // So wurde er vor Krank/Ferien berechnet:
  const alt = (liste) => {
    const text = JSON.stringify(Mail.sortiert(liste).map((e) => [e.datum, e.von, e.bis, e.pause, e.grund, e.bemerkung || '']));
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  assert.equal(Mail.signatur([arbeit]), alt([arbeit]));
  assert.notEqual(Mail.signatur([krank]), Mail.signatur([{ ...krank, art: 'ferien', grund: 'Ferien' }]));
});
