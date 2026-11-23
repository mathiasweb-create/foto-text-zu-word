// Korrektur offensichtlicher Erkennungsfehler mit einer deutschen (österreichischen) Wortliste.
// Ersetzt nur eindeutige Fälle. Zahlen, Kennzeichen, Abkürzungen und unbekannte Namen bleiben unverändert.
(function (root) {
  'use strict';

  // typische Verwechslungen der Texterkennung: [falsch erkannt, richtig]
  const CONFUSIONS = [
    ['rn', 'm'], ['m', 'rn'], ['ii', 'ü'], ['ii', 'li'], ['li', 'h'], ['cl', 'd'], ['vv', 'w'], ['nn', 'm'],
    ['l', 'I'], ['I', 'l'], ['1', 'l'], ['1', 'I'], ['0', 'o'], ['0', 'O'], ['ı', 'i'], ['i', 'l'], ['l', 'i'], ['l', 't'],
    ['a', 'ä'], ['o', 'ö'], ['u', 'ü'], ['A', 'Ä'], ['O', 'Ö'], ['U', 'Ü'], ['ä', 'a'], ['ö', 'o'], ['ü', 'u'],
    ['B', 'ß'], ['ß', 'B'], ['c', 'e'], ['e', 'c'], ['n', 'u'], ['u', 'n'], ['fi', 'fl'], ['fl', 'fi'],
    ['t', 'f'], ['f', 't'], ['h', 'b'], ['b', 'h'], ['s', 'ß'], ['ss', 'ß'], ['ß', 'b'], ['l', 'll'],
  ];
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyzäöüß';
  const isCap = (w) => /^\p{Lu}/u.test(w);
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const decap = (w) => w.charAt(0).toLowerCase() + w.slice(1);

  function makeCorrector(words) {
    const set = words instanceof Set ? words : new Set(words.split('\n'));
    // österreichische Wörter, die im Wörterbuch fehlen
    for (const w of ['Kassier', 'Kassiers', 'Kassiere', 'Kassieren', 'Kassierin', 'Kassierinnen', 'Obfrau', 'Obmann', 'Obmanns', 'Obleute']) set.add(w);
    const cache = new Map();

    // Zusammengesetzte Wörter: Haupt|versammlung, Übung|s|leitung, hell|blau
    function compound(w, depth) {
      if (depth > 2 || w.length < 7) return false;
      const noun = isCap(w);
      for (let i = 3; i <= w.length - 4; i++) {
        const head = w.slice(0, i), rest = w.slice(i).toLowerCase();
        const tail = noun ? cap(rest) : rest;
        if (!(set.has(tail) || compound(tail, depth + 1))) continue;
        const hl = head.toLowerCase(), hc = cap(hl);
        const stems = [hc, hl];
        for (const f of ['s', 'n', 'en', 'es', 'er', 'e']) if (hl.endsWith(f) && hl.length - f.length >= 3) stems.push(cap(hl.slice(0, -f.length)), hl.slice(0, -f.length));
        // kurze Vorderteile nur, wenn es Hauptwörter sind (verhindert Zufallstreffer)
        if (stems.some((s) => set.has(s) && (s.length >= 4 || isCap(s)))) return true;
      }
      return false;
    }
    function isWord(w, atStart) {
      const key = w + (atStart ? '|1' : '|0');
      if (cache.has(key)) return cache.get(key);
      const ok = set.has(w) || (atStart && isCap(w) && set.has(decap(w))) ||
        compound(w, 0) || (atStart && isCap(w) && compound(decap(w), 0));
      cache.set(key, ok);
      return ok;
    }

    function candidates(w) {
      const conf = new Set(), edit = new Set();
      for (const [a, b] of CONFUSIONS) {
        let i = w.indexOf(a);
        while (i >= 0) { conf.add(w.slice(0, i) + b + w.slice(i + a.length)); i = w.indexOf(a, i + 1); }
      }
      const lower = w.toLowerCase();
      for (let i = 0; i <= w.length; i++) {
        if (i < w.length) edit.add(w.slice(0, i) + w.slice(i + 1));
        if (i < w.length - 1) edit.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
        for (const ch of ALPHABET) {
          const c = i === 0 && isCap(w) ? ch.toUpperCase() : ch;
          if (i < w.length && lower[i] !== ch) edit.add(w.slice(0, i) + c + w.slice(i + 1));
          edit.add(w.slice(0, i) + c + w.slice(i));
        }
      }
      conf.delete(w); edit.delete(w);
      return { conf: [...conf], edit: [...edit] };
    }

    // Liefert das korrigierte Wort oder null. conf: Sicherheit der Erkennung für dieses Wort (0–100).
    function fixWord(w, atStart, conf = 70) {
      if (w.length < 3) return null;
      if (/^[\p{Lu}\d]+$/u.test(w)) return null;                 // ABKÜRZUNG, Kennzeichen
      if (!/^[\p{L}01]+$/u.test(w)) return null;
      if (/[01]/.test(w) && (!/\p{L}{2}/u.test(w) || /^[01]|\d{2}/.test(w))) return null;
      const suspicious = /[01ı]/.test(w);
      if (!suspicious && isWord(w, atStart)) return null;
      const valid = (c) => /^\p{L}+$/u.test(c) && isWord(c, atStart) && isCap(c) === isCap(w);
      if (!suspicious && conf >= 92) {
        // sicher gelesen, aber unbekannt: nur fehlende Umlaut-Punkte ergänzen (Anderung -> Änderung)
        const um = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' }, cs = new Set();
        for (let i = 0; i < w.length; i++) if (um[w[i]]) cs.add(w.slice(0, i) + um[w[i]] + w.slice(i + 1));
        const ok = [...cs].filter(valid);
        return ok.length === 1 ? ok[0] : null;
      }
      const { conf: cc, edit } = candidates(w);
      const c0 = cc.filter(valid);
      if (c0.length === 1) return c0[0];
      if (c0.length > 1) return null;                              // nicht eindeutig
      if (w.length < 6 || conf >= 80) return null;                 // sonst nur typische Verwechslungen
      if (isCap(w) && !atStart) return null;                       // Großgeschriebenes (Namen!) nur bei typischen Verwechslungen
      const c1 = edit.filter(valid);
      return c1.length === 1 ? c1[0] : null;
    }

    // Text korrigieren. confOf(wort) liefert die Sicherheit der Erkennung (oder undefined).
    // Rückgabe: Liste von Teilen {text} oder {text, orig}
    function fixText(text, confOf) {
      const parts = [];
      const re = /[\p{L}01ı]+(?:-[\p{L}01ı]+)*/gu;
      let last = 0, m;
      while ((m = re.exec(text))) {
        const tok = m[0];
        const before = text.slice(0, m.index);
        const atStart = before.trim() === '' || /[.!?:]["“”]?\s*$/.test(before) || /[„"(]\s*$/.test(before);
        const prev = text[m.index - 1] || '', next = text[m.index + tok.length] || '';
        let changed = false, out = tok;
        // Teil von Zahlen, Mail-Adressen oder Internetadressen: nicht anfassen
        if (!/[\d@/_.]/.test(prev) && !/^[\d@/_]$/.test(next) && !(next === '.' && /\p{L}/u.test(text[m.index + tok.length + 1] || ''))) {
          const c = confOf ? confOf(tok) : undefined;
          out = tok.split('-').map((p, k) => {
            const f = fixWord(p, atStart && k === 0, c === undefined ? 70 : c);
            if (f) { changed = true; return f; }
            return p;
          }).join('-');
        }
        if (m.index > last) parts.push({ text: text.slice(last, m.index) });
        parts.push(changed ? { text: out, orig: tok } : { text: tok });
        last = m.index + tok.length;
      }
      if (last < text.length) parts.push({ text: text.slice(last) });
      return parts;
    }

    // sichere Zeichensetzung: kein Leerzeichen vor Satzzeichen, keine doppelten Leerzeichen
    const tidyPunct = (t) => t.replace(/ +([,;!?])/g, '$1').replace(/(\p{L}) +\.(?=\s|$)/gu, '$1.').replace(/ {2,}/g, ' ');

    return { isWord, fixWord, fixText, tidyPunct };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { makeCorrector };
  else root.makeCorrector = makeCorrector;
})(typeof window !== 'undefined' ? window : globalThis);
