// Zeichenfläche für die Unterschrift: mit Finger, Stift oder Maus auf einem <canvas> zeichnen.
// Gespeichert werden nicht Pixel, sondern die Striche als Punktlisten – das ist klein (passt gut in den
// Handy-Speicher) und bleibt im PDF gestochen scharf (pdf.js zeichnet sie als Linien nach).
// Format: { b, h, striche: [[x1, y1, x2, y2, …], …] } in Pixeln der Zeichenfläche, y von oben.
// Normales Skript (kein «Modul»), damit die App auch per Doppelklick auf index.html läuft.
// Alles Nötige wird unten unter dem Namen «Unterschrift» bereitgestellt.

(() => {
function zeichenflaeche(canvas) {
  let striche = [];
  let aktuell = null;
  const ctx = canvas.getContext('2d');

  // Die Fläche passt sich der Breite an; gezeichnet wird in CSS-Pixeln, scharf auch auf Retina-Bildschirmen
  function groesse() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    neuZeichnen();
  }

  function neuZeichnen() {
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    // Hilfslinie, auf der man unterschreibt (kommt nicht ins PDF)
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--linie').trim() || '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, r.height * 0.75);
    ctx.lineTo(r.width - 16, r.height * 0.75);
    ctx.stroke();

    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of striche) {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      if (s.length === 2) ctx.lineTo(s[0] + 0.5, s[1]);
      for (let i = 2; i < s.length; i += 2) ctx.lineTo(s[i], s[i + 1]);
      ctx.stroke();
    }
  }

  function punkt(ereignis) {
    const r = canvas.getBoundingClientRect();
    return [Math.round((ereignis.clientX - r.left) * 10) / 10, Math.round((ereignis.clientY - r.top) * 10) / 10];
  }

  canvas.addEventListener('pointerdown', (ereignis) => {
    ereignis.preventDefault();
    canvas.setPointerCapture(ereignis.pointerId);
    aktuell = punkt(ereignis);
    striche.push(aktuell);
    neuZeichnen();
  });
  canvas.addEventListener('pointermove', (ereignis) => {
    if (!aktuell) return;
    const [x, y] = punkt(ereignis);
    // Punkte, die fast aufeinander liegen, weglassen – das spart Platz
    if (Math.hypot(x - aktuell.at(-2), y - aktuell.at(-1)) < 1.5) return;
    aktuell.push(x, y);
    neuZeichnen();
  });
  const ende = () => {
    aktuell = null;
  };
  canvas.addEventListener('pointerup', ende);
  canvas.addEventListener('pointercancel', ende);

  return {
    // Beim Öffnen des Blatts aufrufen (vorher hat die Fläche noch keine Grösse)
    start(vorhanden) {
      striche = structuredClone(vorhanden?.striche ?? []);
      groesse();
    },
    leeren() {
      striche = [];
      neuZeichnen();
    },
    // Weniger als ein paar Punkte zählt nicht als Unterschrift (z. B. nur aus Versehen angetippt)
    istLeer: () => striche.flat().length < 12,
    daten() {
      const r = canvas.getBoundingClientRect();
      return { b: Math.round(r.width), h: Math.round(r.height), striche: structuredClone(striche) };
    },
  };
}

// Kleines Vorschaubild als SVG (für Einstellungen und Senden-Blatt)
function svg(unterschrift) {
  const punkte = unterschrift.striche.flat();
  const xs = punkte.filter((_, i) => i % 2 === 0);
  const ys = punkte.filter((_, i) => i % 2 === 1);
  const rand = 3;
  const box = [Math.min(...xs) - rand, Math.min(...ys) - rand, Math.max(...xs) - Math.min(...xs) + 2 * rand, Math.max(...ys) - Math.min(...ys) + 2 * rand];
  const pfade = unterschrift.striche
    .map((s) => {
      const p = s.length === 2 ? [...s, s[0] + 0.5, s[1]] : s;
      return `<polyline points="${p.join(' ')}"/>`;
    })
    .join('');
  return `<svg class="unterschrift-bild" viewBox="${box.join(' ')}" aria-label="Gespeicherte Unterschrift" role="img"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${pfade}</g></svg>`;
}

const vorhanden = (unterschrift) => Boolean(unterschrift?.striche?.length);

globalThis.Unterschrift = {
  zeichenflaeche,
  svg,
  vorhanden,
};
})();
