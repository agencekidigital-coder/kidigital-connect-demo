/* Structured text, range formatting and shared canvas layout. No stored HTML. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NaiteaRichText = api;
})(globalThis, function () {
  const clamp = (n, lo, hi, fallback) => Number.isFinite(+n) ? Math.max(lo, Math.min(hi, +n)) : fallback;
  function color(value, fallback = "#5B3A48") {
    if (/^#[\da-f]{6}$/i.test(value || "")) return value;
    if (/^#[\da-f]{3}$/i.test(value || "")) return "#" + value.slice(1).split("").map(c => c + c).join("");
    const rgb = String(value || "").match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
    return rgb ? "#" + rgb.slice(1, 4).map(n => Math.min(255, +n).toString(16).padStart(2, "0")).join("") : fallback;
  }
  function style(value = {}, fallback = {}) {
    return {
      font: String(value.font || fallback.font || "DM Sans").replace(/["'<>;\\]/g, "").slice(0, 100),
      size: clamp(value.size ?? fallback.size, 8, 480, 24),
      weight: clamp(value.weight ?? fallback.weight, 100, 900, 400),
      italic: Boolean(value.italic ?? fallback.italic),
      underline: Boolean(value.underline ?? fallback.underline),
      highlight: value.highlight === '' ? '' : (value.highlight || fallback.highlight ? color(value.highlight || fallback.highlight, '#F3D893') : ''),
      effect: ['none', 'shadow', 'outline'].includes(value.effect) ? value.effect : (['shadow', 'outline'].includes(fallback.effect) ? fallback.effect : 'none'),
      color: color(value.color, color(fallback.color)),
      letterSpacing: clamp(value.letterSpacing ?? fallback.letterSpacing, -5, 30, 0),
    };
  }
  const signature = value => JSON.stringify(style(value));
  function merge(input) {
    const result = [];
    for (const run of input) {
      if (!run.text) continue;
      const next = { text: String(run.text), ...style(run) };
      if (result.length && signature(result.at(-1)) === signature(next)) result.at(-1).text += next.text;
      else result.push(next);
    }
    return result;
  }
  function runs(layer) {
    const base = style(layer);
    const stored = Array.isArray(layer.runs) && layer.runs.map(r => r.text).join("") === String(layer.text || "") ? layer.runs : [{ text: String(layer.text || "") }];
    return merge(stored.map(r => ({ text: String(r.text || ""), ...style(r, base) })));
  }
  function slice(input, start, end) {
    let position = 0;
    const result = [];
    for (const run of input) {
      const a = Math.max(0, start - position), b = Math.min(run.text.length, end - position);
      if (b > a) result.push({ ...run, text: run.text.slice(a, b) });
      position += run.text.length;
    }
    return result;
  }
  function at(layer, position = 0) {
    const list = runs(layer);
    let length = 0;
    for (const run of list) { length += run.text.length; if (position < length) return style(run); }
    return style(list.at(-1) || layer);
  }
  function apply(layer, start, end, patch) {
    const text = String(layer.text || ""), input = runs(layer);
    start = clamp(start, 0, text.length, 0); end = clamp(end, start, text.length, text.length);
    if (start === end) { start = 0; end = text.length; }
    const changed = slice(input, start, end).map(run => ({ ...run, ...style({ ...run, ...patch }) }));
    const next = { ...layer, runs: merge([...slice(input, 0, start), ...changed, ...slice(input, end, text.length)]) };
    if (start === 0 && end === text.length) Object.assign(next, style({ ...style(layer), ...patch }));
    return next;
  }
  function replace(layer, start, end, value, insertionStyle) {
    const text = String(layer.text || ""), input = runs(layer);
    const inserted = value ? [{ text: String(value), ...style(insertionStyle || at(layer, start)) }] : [];
    return { ...layer, text: text.slice(0, start) + value + text.slice(end), runs: merge([...slice(input, 0, start), ...inserted, ...slice(input, end, text.length)]) };
  }
  function setText(layer, value) {
    const before = String(layer.text || ""), after = String(value || "");
    let a = 0, b = 0;
    while (a < before.length && a < after.length && before[a] === after[a]) a++;
    while (b < before.length - a && b < after.length - a && before.at(-1 - b) === after.at(-1 - b)) b++;
    return replace(layer, a, before.length - b, after.slice(a, after.length - b));
  }
  function readDOM(root, layer) {
    const result = [], base = style(layer);
    function visit(node, inherited) {
      if (node.nodeType === 3) { result.push({ text: node.nodeValue.replaceAll("\u00a0", " "), ...inherited }); return; }
      if (node.nodeType !== 1 && node !== root) return;
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.nodeName)) return;
      if (node.nodeName === "BR") { if (!node.dataset.placeholder) result.push({ text: "\n", ...inherited }); return; }
      const next = { ...inherited }, css = node.style || {};
      if (css.fontWeight) next.weight = css.fontWeight === "bold" ? 700 : clamp(css.fontWeight, 100, 900, next.weight);
      if (css.fontStyle) next.italic = css.fontStyle === "italic";
      if (css.textDecoration || css.textDecorationLine) next.underline = (css.textDecorationLine || css.textDecoration).includes("underline");
      if (node.dataset?.runColor) next.color = color(node.dataset.runColor, next.color);
      else if (css.color) next.color = color(css.color, next.color);
      if (node.dataset?.runHighlight !== undefined) next.highlight = node.dataset.runHighlight;
      if (node.dataset?.runEffect) next.effect = node.dataset.runEffect;
      if (css.fontFamily) next.font = css.fontFamily.replace(/^["']|["']$/g, "");
      if (node.dataset?.runSize) next.size = +node.dataset.runSize;
      else if (css.fontSize) next.size = css.fontSize.endsWith("%") ? next.size * parseFloat(css.fontSize) / 100 : parseFloat(css.fontSize);
      if (node.dataset?.runSpacing) next.letterSpacing = +node.dataset.runSpacing;
      if (["B", "STRONG"].includes(node.nodeName)) next.weight = 700;
      if (["I", "EM"].includes(node.nodeName)) next.italic = true;
      if (node.nodeName === "U") next.underline = true;
      const block = node !== root && ["DIV", "P", "LI"].includes(node.nodeName);
      if (block && result.length && !result.at(-1).text.endsWith("\n")) result.push({ text: "\n", ...next });
      for (const child of node.childNodes) visit(child, style(next));
      if (block && node.nextSibling && result.length && !result.at(-1).text.endsWith("\n")) result.push({ text: "\n", ...next });
    }
    for (const node of root.childNodes) visit(node, base);
    const normalized = merge(result);
    return { text: normalized.map(r => r.text).join(""), runs: normalized };
  }
  function writeDOM(root, layer) {
    const document = root.ownerDocument;
    const fragment = document.createDocumentFragment();
    for (const run of runs(layer)) {
      const span = document.createElement("span");
      span.textContent = run.text;
      span.dataset.runSize = run.size;
      span.dataset.runSpacing = run.letterSpacing;
      span.dataset.runColor = run.color;
      span.dataset.runHighlight = run.highlight;
      span.dataset.runEffect = run.effect;
      Object.assign(span.style, { fontFamily: JSON.stringify(run.font), fontSize: run.size / style(layer).size * 100 + "%", fontWeight: String(run.weight), fontStyle: run.italic ? "italic" : "normal", textDecoration: run.underline ? "underline" : "none", color: run.color, letterSpacing: run.letterSpacing / run.size + "em" });
      if (run.highlight) span.style.backgroundColor = run.highlight;
      if (run.effect === 'shadow') span.style.textShadow = '.05em .06em .08em #59042566';
      if (run.effect === 'outline') { span.style.webkitTextStroke = '.025em ' + run.color; span.style.color = 'transparent'; }
      fragment.append(span);
    }
    root.replaceChildren(fragment);
    root.style.lineHeight = String(clamp(layer.lineHeight, 0.8, 3.5, 1.35));
    root.style.whiteSpace = "pre-wrap";
    root.style.overflowWrap = "break-word";
    root.style.fontKerning = "none";
    root.style.fontVariantLigatures = "none";
  }
  function selection(root) {
    const selected = root.ownerDocument.getSelection();
    if (!selected?.rangeCount) return null;
    const range = selected.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const prefix = range.cloneRange(); prefix.selectNodeContents(root); prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    return { start, end: start + range.toString().length };
  }
  function restore(root, offsets) {
    if (!offsets) return;
    const doc = root.ownerDocument, walker = doc.createTreeWalker(root, 4), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if (!nodes.length) { root.append(doc.createTextNode("")); nodes.push(root.firstChild); }
    const point = offset => {
      for (const node of nodes) { if (offset <= node.nodeValue.length) return [node, offset]; offset -= node.nodeValue.length; }
      return [nodes.at(-1), nodes.at(-1).nodeValue.length];
    };
    const range = doc.createRange(), [a, x] = point(offsets.start), [b, y] = point(offsets.end);
    range.setStart(a, x); range.setEnd(b, y);
    const selected = doc.getSelection(); selected.removeAllRanges(); selected.addRange(range);
  }
  function layout(layer, width, measure) {
    const glyphs = [];
    for (const run of runs(layer)) for (const character of run.text) glyphs.push({ text: character, style: style(run) });
    const tokens = [];
    for (const glyph of glyphs) {
      const kind = glyph.text === "\n" ? "break" : /\s/u.test(glyph.text) ? "space" : "word";
      if (kind !== "break" && tokens.at(-1)?.kind === kind) tokens.at(-1).glyphs.push(glyph);
      else tokens.push({ kind, glyphs: [glyph] });
    }
    const lines = [], base = style(layer), lineHeight = clamp(layer.lineHeight, 0.8, 3.5, 1.35);
    let line = [], used = 0, top = 0;
    const glyphWidth = g => Math.max(0, measure(g.text, g.style) + g.style.letterSpacing);
    const flush = () => {
      const maxSize = Math.max(base.size, ...line.map(g => g.style.size)), height = maxSize * lineHeight;
      let x = 0;
      const segments = [];
      for (const glyph of line) {
        const key = signature(glyph.style), last = segments.at(-1), w = glyphWidth(glyph);
        if (last?.key === key) { last.text += glyph.text; last.width += w; }
        else segments.push({ key, text: glyph.text, style: glyph.style, x, width: w });
        x += w;
      }
      lines.push({ y: top, height, maxSize, segments }); top += height; line = []; used = 0;
    };
    for (const token of tokens) {
      if (token.kind === "break") { flush(); continue; }
      const tokenWidth = token.glyphs.reduce((sum, g) => sum + glyphWidth(g), 0);
      if (token.kind === "word" && used && used + tokenWidth > width) flush();
      if (token.kind === "space" && used + tokenWidth > width) { flush(); continue; }
      for (const glyph of token.glyphs) {
        const w = glyphWidth(glyph);
        if (used && used + w > width) flush();
        line.push(glyph); used += w;
      }
    }
    if (line.length || !lines.length || glyphs.at(-1)?.text === "\n") flush();
    return lines;
  }
  function font(run) { return `${run.italic ? "italic " : ""}${run.weight} ${run.size}px ${JSON.stringify(run.font)}`; }
  function draw(ctx, layer, x, y, width) {
    ctx.save(); ctx.fontKerning = "none";
    const lines = layout(layer, width, (text, run) => { ctx.font = font(run); return ctx.measureText(text).width; });
    ctx.textBaseline = "top";
    for (const line of lines) for (const segment of line.segments) {
      const run = segment.style;
      ctx.font = font(run); ctx.fillStyle = run.color;
      const top = y + line.y + (line.height - line.maxSize) / 2;
      let left = x + segment.x;
      if (run.highlight) { ctx.fillStyle = run.highlight; ctx.fillRect(left, y + line.y, segment.width, line.height); ctx.fillStyle = run.color; }
      if (run.effect === 'shadow') { ctx.shadowColor = '#59042566'; ctx.shadowOffsetX = run.size * .05; ctx.shadowOffsetY = run.size * .06; ctx.shadowBlur = run.size * .08; }
      for (const character of segment.text) {
        if (run.effect === 'outline') { ctx.strokeStyle = run.color; ctx.lineWidth = Math.max(.6, run.size * .025); ctx.strokeText(character, left, top + line.maxSize - run.size); }
        else ctx.fillText(character, left, top + line.maxSize - run.size);
        const w = ctx.measureText(character).width + run.letterSpacing;
        if (run.underline && character !== "\n") ctx.fillRect(left, top + line.maxSize + run.size * .06, Math.max(w, 0), Math.max(1, run.size * .05));
        left += Math.max(0, w);
      }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    }
    ctx.restore();
    return lines;
  }
  function toggleBullets(layer, start = 0, end = String(layer.text || '').length) {
    const text = String(layer.text || ''), first = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const after = text.indexOf('\n', Math.max(start, end - 1)), last = after < 0 ? text.length : after;
    const lines = text.slice(first, last).split('\n'), remove = lines.filter(line => line.trim()).every(line => line.startsWith('• '));
    let offset = first; const edits = [];
    for (const line of lines) { if (line.trim()) edits.push({ start: offset, end: offset + (remove && line.startsWith('• ') ? 2 : 0), text: remove ? '' : line.startsWith('• ') ? '' : '• ' }); offset += line.length + 1; }
    let result = layer;
    for (const edit of edits.reverse()) if (edit.end !== edit.start || edit.text) result = replace(result, edit.start, edit.end, edit.text);
    return result;
  }
  return { style, runs, merge, at, apply, replace, setText, readDOM, writeDOM, selection, restore, layout, draw, color, toggleBullets };
});
