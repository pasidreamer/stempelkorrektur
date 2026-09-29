// Prüft die Stundenrechnung. Ausführen im Projektordner mit:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/zeit.js'; // stellt «Zeit» bereit
const { berechne, pruefe, kalenderwoche, startWoche, montagDerWoche, dauer, stundenText } = globalThis.Zeit;

const nacht = { von: '22:00', bis: '05:00', prozent: 25 };

test('normaler Tag ohne Nachtarbeit', () => {
  const r = berechne({ von: '07:00', bis: '16:30', pause: 30 }, nacht);
  assert.equal(r.netto, 9 * 60);
  assert.equal(r.nacht, 0);
  assert.equal(r.zuschlag, 0);
  assert.equal(r.ueberMitternacht, false);
});

test('Beispiel aus dem Auftrag: 23:00 bis 04:00 am nächsten Tag', () => {
  const r = berechne({ von: '23:00', bis: '04:00', pause: 0 }, nacht);
  assert.equal(r.ueberMitternacht, true);
  assert.equal(r.netto, 5 * 60);
  assert.equal(r.nacht, 5 * 60);
  assert.equal(r.zuschlag, 75); // 25 % von 5 h = 1:15 h
  assert.equal(stundenText(r), '5:00 h (+1:15 h Nachtzuschlag)');
});

test('eine Stunde Nacht gibt 1:15 h', () => {
  const r = berechne({ von: '23:00', bis: '00:00', pause: 0 }, nacht);
  assert.equal(r.netto + r.zuschlag, 75);
});

test('Abend bis in die Nacht: nur der Teil ab 22 Uhr zählt', () => {
  const r = berechne({ von: '18:00', bis: '00:00', pause: 0 }, nacht);
  assert.equal(r.netto, 6 * 60);
  assert.equal(r.nacht, 2 * 60);
  assert.equal(r.zuschlag, 30);
});

test('früher Morgen: 04:00 bis 12:00 hat eine Nachtstunde', () => {
  const r = berechne({ von: '04:00', bis: '12:00', pause: 0 }, nacht);
  assert.equal(r.nacht, 60);
  assert.equal(r.zuschlag, 15);
});

test('Pause in reiner Nachtschicht verkürzt die Nachtzeit', () => {
  const r = berechne({ von: '23:00', bis: '04:00', pause: 30 }, nacht);
  assert.equal(r.netto, 270);
  assert.equal(r.nacht, 270);
});

test('Pause wird anteilig abgezogen', () => {
  // 20:00–02:00 = 6 h, davon 4 h Nacht; 30 min Pause → 5:30 h, Nacht 4 × 5.5/6 = 3:40 h
  const r = berechne({ von: '20:00', bis: '02:00', pause: 30 }, nacht);
  assert.equal(r.netto, 330);
  assert.equal(r.nacht, 220);
  assert.equal(r.zuschlag, 55);
});

test('lange Schicht, die am Folgeabend wieder in die Nacht läuft', () => {
  const r = berechne({ von: '23:30', bis: '23:00', pause: 0 }, nacht);
  // 23:30–05:00 = 5:30 h plus 22:00–23:00 am Folgetag = 1 h
  assert.equal(r.nacht, 390);
});

test('eigenes Nachtfenster und Prozentsatz', () => {
  const r = berechne({ von: '22:00', bis: '07:00', pause: 0 }, { von: '23:00', bis: '06:00', prozent: 10 });
  assert.equal(r.nacht, 7 * 60);
  assert.equal(r.zuschlag, 42);
});

test('Eingabefehler werden erkannt', () => {
  assert.match(pruefe({ von: '08:00', bis: '08:00' }), /gleich/);
  assert.match(pruefe({ von: '08:00', bis: '09:00', pause: 60 }), /Pause/);
  assert.equal(pruefe({ von: '08:00', bis: '17:00', pause: 30 }), null);
});

test('Kalenderwochen nach ISO', () => {
  assert.deepEqual(kalenderwoche('2026-09-28'), { jahr: 2026, woche: 40 });
  assert.deepEqual(kalenderwoche('2026-01-01'), { jahr: 2026, woche: 1 });
  assert.deepEqual(kalenderwoche('2027-01-01'), { jahr: 2026, woche: 53 });
  assert.deepEqual(kalenderwoche('2024-12-30'), { jahr: 2025, woche: 1 });
  assert.deepEqual(kalenderwoche('2026-03-30'), { jahr: 2026, woche: 14 }); // nach Sommerzeit-Umstellung
});

test('Startwoche: montags die Vorwoche, sonst die laufende', () => {
  assert.equal(startWoche('2026-09-28'), '2026-09-21'); // Montag
  assert.equal(startWoche('2026-09-27'), '2026-09-21'); // Sonntag
  assert.equal(startWoche('2026-09-30'), '2026-09-28'); // Mittwoch
  assert.equal(montagDerWoche('2026-10-04'), '2026-09-28');
});

test('Dauer-Anzeige', () => {
  assert.equal(dauer(0), '0:00 h');
  assert.equal(dauer(75), '1:15 h');
  assert.equal(dauer(2400), '40:00 h');
});
