// Prüft das PDF: gültiger Aufbau (Verzeichnis zeigt auf die richtigen Stellen), Inhalt, Umlaute.
// Ausführen im Projektordner mit:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import '../js/zeit.js';
import '../js/pdf.js';
import '../js/blatt.js';

const einstellungen = { absender: 'Lena Kläui', nacht: { von: '22:00', bis: '05:00', prozent: 25 } };
const personen = [{ id: 'p1', name: 'Lena Kläui' }, { id: 'p2', name: 'Jürg Müller' }];
const eintraege = [
  { id: 'a', personId: 'p1', datum: '2026-09-21', von: '07:00', bis: '16:30', pause: 30, grund: 'Lüftec', bemerkung: '' },
  { id: 'b', personId: 'p1', datum: '2026-09-22', von: '23:00', bis: '04:00', pause: 0, grund: 'ESL', bemerkung: 'Notfall (Küche) – Zürich' },
  { id: 'c', personId: 'p2', datum: '2026-09-21', von: '07:00', bis: '16:30', pause: 30, grund: 'Reparatur intern', bemerkung: '' },
];

function erzeugen() {
  return Blatt.erstellen({ montag: '2026-09-21', personen, eintraege, einstellungen, erstelltAm: new Date(2026, 8, 29, 8, 15) });
}

test('PDF-Aufbau ist gültig', () => {
  const bytes = erzeugen();
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const startxref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.ok(text.slice(startxref).startsWith('xref\n'), 'startxref zeigt auf das Verzeichnis');
  const eintraegeXref = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n \n/g)].map((m) => Number(m[1]));
  eintraegeXref.forEach((pos, i) => assert.ok(text.slice(pos).startsWith(`${i + 1} 0 obj`), `Objekt ${i + 1} an Position ${pos}`));
  for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(text.slice(start + Number(m[1]), start + Number(m[1]) + 10), '\nendstream', 'Länge des Inhalts stimmt');
  }
  assert.ok(/\/Count 2 /.test(text), 'zwei Seiten (eine pro Person)');
  assert.ok([...bytes].every((b) => b < 128), 'Datei ist reines ASCII');
  mkdirSync('tests/ausgabe', { recursive: true });
  writeFileSync('tests/ausgabe/probe.pdf', bytes);
});

test('Umlaute, Klammern und Striche werden richtig kodiert', () => {
  const text = Buffer.from(erzeugen()).toString('latin1');
  // String.raw: der Backslash soll wörtlich im Suchtext stehen
  assert.ok(text.includes(String.raw`(Lena Kl\344ui)`), 'ä als \\344');
  assert.ok(text.includes(String.raw`(J\374rg M\374ller)`), 'ü als \\374');
  assert.ok(text.includes(String.raw`Notfall \(K\374che\) \226 Z\374rich`), 'Klammern und Gedankenstrich');
});

test('Breitenberechnung und Kürzen', () => {
  assert.equal(PDF.breite('a', 10), 5.56);
  assert.equal(PDF.breite('A', 10, true), 7.22);
  const lang = PDF.kuerzen('Sehr lange Bemerkung zur Baustelle in Winterthur', 60, 8);
  assert.ok(lang.endsWith('…') && PDF.breite(lang, 8) <= 60);
});

test('Dateiname', () => {
  assert.equal(Blatt.dateiname('2026-09-21', personen), 'Stempelkorrekturen_KW39_2026.pdf');
  assert.equal(Blatt.dateiname('2026-09-21', [personen[1]]), 'Stempelkorrekturen_KW39_2026_Jürg-Müller.pdf');
});
