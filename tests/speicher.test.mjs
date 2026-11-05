// Prüft, dass ältere gespeicherte Daten weiter funktionieren (z. B. Personen ohne Vorgesetzte/n).
// Ausführen im Projektordner mit:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mini-Ersatz für den Browser-Speicher
const ablage = new Map();
globalThis.localStorage = {
  getItem: (k) => (ablage.has(k) ? ablage.get(k) : null),
  setItem: (k, v) => ablage.set(k, String(v)),
};
await import('../js/speicher.js');

test('Alte Daten ohne «vorgesetzter»: du bist Vorgesetzte/r deiner Leute, dein eigenes Feld bleibt leer', () => {
  ablage.set('stempelkorrektur.v1', JSON.stringify({
    einstellungen: { personen: [{ id: 'a', name: 'Lena' }, { id: 'b', name: 'Marco' }, { id: 'c', name: 'Nina', vorgesetzter: 'Beat' }] },
    eintraege: [], gesendet: {},
  }));
  const z = Speicher.laden();
  assert.deepEqual(z.einstellungen.personen.map((p) => p.vorgesetzter), ['', 'Lena', 'Beat']);
  assert.equal(z.einstellungen.nacht.prozent, 25, 'fehlende Einstellungen kommen aus den Standardwerten');
});

test('Alter Standard 22:00–05:00 wird zu 23:00–06:00, eigene Nachtzeit bleibt', () => {
  ablage.set('stempelkorrektur.v1', JSON.stringify({
    einstellungen: { nacht: { von: '22:00', bis: '05:00', prozent: 25 } }, eintraege: [], gesendet: {},
  }));
  assert.deepEqual(Speicher.laden().einstellungen.nacht, { von: '23:00', bis: '06:00', prozent: 25 });

  ablage.set('stempelkorrektur.v1', JSON.stringify({
    einstellungen: { nacht: { von: '21:00', bis: '05:00', prozent: 10 } }, eintraege: [], gesendet: {},
  }));
  assert.deepEqual(Speicher.laden().einstellungen.nacht, { von: '21:00', bis: '05:00', prozent: 10 });
});

test('Leerer Speicher ergibt einen leeren Anfang', () => {
  ablage.clear();
  const z = Speicher.laden();
  assert.deepEqual(z.einstellungen.personen, []);
  assert.deepEqual(z.eintraege, []);
});
