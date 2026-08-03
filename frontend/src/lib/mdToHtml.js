/**
 * Minimal GFM-ish markdown → HTML (grammar MD ushın jetkilikli).
 * Tashqı paket kerak emes.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(md) {
  let t = escapeHtml(md);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  t = t.replace(/_([^_]+)_/g, '<em>$1</em>');
  t = t.replace(
    /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>'
  );
  return t;
}

function isTableSep(line) {
  return /^\s*\|?[\s-:|]+\|\s*$/.test(line) || /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*$/.test(line);
}

function splitRow(line) {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return t.split('|').map((c) => c.trim());
}

export function mdToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const flushPara = (buf) => {
    if (!buf.length) return;
    out.push(`<p>${inline(buf.join(' '))}</p>`);
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      out.push('<hr />');
      i += 1;
      continue;
    }

    const hm = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hm) {
      const level = hm[1].length;
      out.push(`<h${level}>${inline(hm[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      out.push('<ul>');
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        out.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push('</ul>');
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        out.push(`<li>${inline(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      out.push('</ol>');
      continue;
    }

    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSep(lines[i + 1])
    ) {
      const headers = splitRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().includes('|') && !isTableSep(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      out.push('<table><thead><tr>');
      headers.forEach((h) => out.push(`<th>${inline(h)}</th>`));
      out.push('</tr></thead><tbody>');
      rows.forEach((row) => {
        out.push('<tr>');
        row.forEach((c) => out.push(`<td>${inline(c)}</td>`));
        out.push('</tr>');
      });
      out.push('</tbody></table>');
      continue;
    }

    const para = [trimmed];
    i += 1;
    while (i < lines.length) {
      const n = lines[i].trim();
      if (
        !n ||
        n.startsWith('#') ||
        n.startsWith('>') ||
        /^[-*]\s+/.test(n) ||
        /^\d+\.\s+/.test(n) ||
        /^---+$/.test(n) ||
        (n.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))
      ) {
        break;
      }
      para.push(n);
      i += 1;
    }
    flushPara(para);
  }

  return out.join('\n');
}
