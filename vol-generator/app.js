'use strict';

/* ---------- state ---------- */

const state = {
  workbook: null,
  sheetRows: [],       // raw rows of the selected sheet, as arrays
  headerRow: [],       // header cell values of the selected sheet
  mapping: null,       // { id, object, date, days, oil, water, gas, winj, bhp }
  combinedId: true,
  records: [],         // parsed per-row records: {well, object, date, days, oil, water, gas, winj, bhp}
  objects: [],         // distinct object names found
  densities: {},        // object -> density (т/м3)
  wells: [],            // final aggregated per-well series, ready for .vol
};

/* ---------- helpers: DOM ---------- */

const $ = (id) => document.getElementById(id);

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function showStep(id) {
  $(id).classList.remove('hidden');
}

/* ---------- step 1: upload ---------- */

$('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

$('fileDrop').addEventListener('dragover', (e) => e.preventDefault());
$('fileDrop').addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  $('fileDropLabel').textContent = file.name;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      // cellDates:false — we read raw values and parse dates ourselves,
      // because Access exports mix real dates and dd.mm.yyyy text depending on column formatting.
      state.workbook = XLSX.read(data, { type: 'array', raw: true });
      populateSheetSelect();
      setStatus($('uploadStatus'), `Файл загружен: ${file.name}`, 'ok');
      showStep('step-mapping');
    } catch (err) {
      setStatus($('uploadStatus'), 'Не удалось прочитать файл: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function populateSheetSelect() {
  const sel = $('sheetSelect');
  sel.innerHTML = '';
  state.workbook.SheetNames.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  sel.onchange = () => loadSheet(sel.value);
  loadSheet(sel.value);
}

/* ---------- step 2: column mapping ---------- */

const REQUIRED_FIELDS = [
  { key: 'id',    label: 'Скважина (или скважина:объект)', required: true },
  { key: 'object',label: 'Объект (если отдельной колонкой)', required: false },
  { key: 'date',  label: 'Дата', required: true },
  { key: 'days',  label: 'Отработанные дни (DAYS)', required: true },
  { key: 'oil',   label: 'Нефть, т', required: true },
  { key: 'water', label: 'Вода, м³', required: false },
  { key: 'gas',   label: 'Газ, м³', required: false },
  { key: 'winj',  label: 'Закачка воды, м³', required: false },
  { key: 'bhp',   label: 'Забойное давление', required: false },
];

function loadSheet(sheetName) {
  const ws = state.workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  state.sheetRows = rows;
  state.headerRow = (rows[0] || []).map((h) => (h === null ? '' : String(h)));
  buildMappingUI();
}

function buildMappingUI() {
  const grid = $('mappingGrid');
  grid.innerHTML = '';
  const headers = state.headerRow;

  REQUIRED_FIELDS.forEach((field) => {
    const wrap = document.createElement('div');
    wrap.className = 'map-field';

    const label = document.createElement('label');
    label.textContent = field.label + (field.required ? ' *' : '');
    wrap.appendChild(label);

    const select = document.createElement('select');
    select.dataset.field = field.key;

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— не использовать —';
    select.appendChild(emptyOpt);

    headers.forEach((h, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = h || `(колонка ${idx + 1})`;
      select.appendChild(opt);
    });

    // best-effort auto-match by header name
    const guessIdx = guessColumn(headers, field.key);
    if (guessIdx !== -1) select.value = String(guessIdx);

    wrap.appendChild(select);
    grid.appendChild(wrap);
  });
}

function guessColumn(headers, key) {
  const patterns = {
    id: /^uniqueid$|^well$|скваж/i,
    object: /object|объект/i,
    date: /^date$|дата/i,
    days: /days|дни|сутк/i,
    oil: /^oil$|нефт/i,
    water: /^water$|вода/i,
    gas: /^gas$|газ/i,
    winj: /winj|inj|закач/i,
    bhp: /bhp|pressure|давлен/i,
  };
  const re = patterns[key];
  if (!re) return -1;
  return headers.findIndex((h) => h && re.test(h));
}

$('applyMappingBtn').addEventListener('click', () => {
  const grid = $('mappingGrid');
  const mapping = {};
  grid.querySelectorAll('select').forEach((sel) => {
    mapping[sel.dataset.field] = sel.value === '' ? null : Number(sel.value);
  });
  state.combinedId = $('combinedIdCheckbox').checked;

  if (mapping.id === null || mapping.date === null || mapping.oil === null) {
    setStatus($('mappingStatus'), 'Укажите как минимум колонки: скважина, дата, нефть.', 'error');
    return;
  }
  if (!state.combinedId && mapping.object === null) {
    setStatus($('mappingStatus'), 'Снимите галочку только если указали отдельную колонку "Объект".', 'error');
    return;
  }

  state.mapping = mapping;
  try {
    parseRecords();
    setStatus(
      $('mappingStatus'),
      `Разобрано строк: ${state.records.length}. Скважин: ${new Set(state.records.map(r => r.well)).size}. Объектов: ${state.objects.length}.`,
      'ok'
    );
    buildDensityUI();
    showStep('step-density');
  } catch (err) {
    setStatus($('mappingStatus'), 'Ошибка разбора данных: ' + err.message, 'error');
  }
});

/* ---------- parsing raw rows into records ---------- */

function parseRecords() {
  const m = state.mapping;
  const rows = state.sheetRows.slice(1); // skip header
  const records = [];

  rows.forEach((row) => {
    if (!row || row[m.id] === null || row[m.id] === undefined || row[m.id] === '') return;

    const idRaw = String(row[m.id]).trim();
    let well, object;
    if (state.combinedId) {
      const parsed = parseCombinedId(idRaw);
      well = parsed.well;
      object = parsed.object;
    } else {
      well = idRaw;
      object = m.object !== null ? String(row[m.object] ?? 'default').trim() : 'default';
    }

    const date = parseDateCell(row[m.date]);
    if (!date) return; // skip rows we cannot date — cannot place them in the .vol series

    records.push({
      well,
      object,
      date,
      days: toNumber(row[m.days]),
      oil: toNumber(row[m.oil]),
      water: m.water !== null ? toNumber(row[m.water]) : 0,
      gas: m.gas !== null ? toNumber(row[m.gas]) : 0,
      winj: m.winj !== null ? toNumber(row[m.winj]) : 0,
      bhp: m.bhp !== null ? toNumber(row[m.bhp]) : 0,
    });
  });

  state.records = records;
  state.objects = Array.from(new Set(records.map((r) => r.object))).sort();
}

// "UVN_1:PT_1" -> well "1" (field UVN), object "PT_1".
// The well number is the part after the last underscore before the colon;
// everything after the colon is the object code, kept as-is.
function parseCombinedId(idRaw) {
  const colonIdx = idRaw.indexOf(':');
  if (colonIdx === -1) {
    return { well: idRaw, object: 'default' };
  }
  const leftPart = idRaw.slice(0, colonIdx);
  const objectPart = idRaw.slice(colonIdx + 1);
  const lastUnderscore = leftPart.lastIndexOf('_');
  const well = lastUnderscore === -1 ? leftPart : leftPart.slice(lastUnderscore + 1);
  return { well, object: objectPart };
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Handles: Excel date serials (number), "dd.mm.yyyy" text, "yyyy-mm-dd" text, JS Date objects.
// Returns a normalized JS Date at UTC midnight, or null if unparseable.
function parseDateCell(v) {
  if (v === null || v === undefined || v === '') return null;

  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }

  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  const s = String(v).trim();
  let mtch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (mtch) {
    return new Date(Date.UTC(Number(mtch[3]), Number(mtch[2]) - 1, Number(mtch[1])));
  }
  mtch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mtch) {
    return new Date(Date.UTC(Number(mtch[1]), Number(mtch[2]) - 1, Number(mtch[3])));
  }
  return null;
}

/* ---------- step 3: density per object ---------- */

function buildDensityUI() {
  const tbody = $('densityTableBody');
  tbody.innerHTML = '';

  state.objects.forEach((obj) => {
    const rowsForObj = state.records.filter((r) => r.object === obj);
    const wellCount = new Set(rowsForObj.map((r) => r.well)).size;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(obj)}</td>
      <td>${wellCount}</td>
      <td>${rowsForObj.length}</td>
      <td><input type="number" step="0.001" min="0.01" max="2" placeholder="напр. 0.79" data-object="${escapeHtml(obj)}"></td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

$('applyDensityBtn').addEventListener('click', () => {
  const inputs = $('densityTableBody').querySelectorAll('input[data-object]');
  const densities = {};
  let hasError = false;

  inputs.forEach((inp) => {
    const val = parseFloat(inp.value.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) {
      inp.style.borderColor = 'var(--danger)';
      hasError = true;
    } else {
      inp.style.borderColor = '';
      densities[inp.dataset.object] = val;
    }
  });

  if (hasError) {
    setStatus($('densityStatus'), 'Укажите корректную плотность (> 0) для всех объектов.', 'error');
    return;
  }

  state.densities = densities;
  aggregateWells();
  renderPreview();
  setStatus($('densityStatus'), 'Готово. Проверьте таблицу ниже перед выгрузкой.', 'ok');
  showStep('step-preview');
});

/* ---------- aggregation: rows -> per-well monthly series ---------- */

function aggregateWells() {
  const daysRule = $('daysRule').value; // 'max' or 'sum'

  // key: well|dateISO -> accumulated values
  const buckets = new Map();

  state.records.forEach((r) => {
    const density = state.densities[r.object];
    const oilM3 = r.oil / density;
    const dateKey = r.date.toISOString().slice(0, 10);
    const key = r.well + '|' + dateKey;

    if (!buckets.has(key)) {
      buckets.set(key, {
        well: r.well, date: r.date,
        oil: 0, water: 0, gas: 0, winj: 0, bhp: 0, days: 0,
      });
    }
    const b = buckets.get(key);
    b.oil += oilM3;
    b.water += r.water;
    b.gas += r.gas;
    b.winj += r.winj;
    b.bhp = Math.max(b.bhp, r.bhp);
    b.days = daysRule === 'sum' ? b.days + r.days : Math.max(b.days, r.days);
  });

  const byWell = new Map();
  buckets.forEach((b) => {
    if (!byWell.has(b.well)) byWell.set(b.well, []);
    byWell.get(b.well).push(b);
  });

  const wells = Array.from(byWell.entries()).map(([well, rows]) => {
    rows.sort((a, b) => a.date - b.date);
    return { well, rows };
  });

  // numeric well names sort numerically, everything else falls back to text sort
  wells.sort((a, b) => {
    const na = Number(a.well), nb = Number(b.well);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a.well).localeCompare(String(b.well));
  });

  state.wells = wells;
}

/* ---------- step 4: preview + download ---------- */

function renderPreview() {
  const totalRows = state.wells.reduce((s, w) => s + w.rows.length, 0);
  $('summaryBox').innerHTML = `
    <span>Скважин: <b>${state.wells.length}</b></span>
    <span>Месяцев (строк) всего: <b>${totalRows}</b></span>
  `;

  const table = $('previewTable');
  const head = ['Скважина', 'Дата', 'Нефть, м³', 'Вода, м³', 'Газ, м³', 'Закачка, м³', 'Дни', 'BHP'];
  let html = '<thead><tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';

  const PREVIEW_LIMIT = 300;
  let shown = 0;
  outer:
  for (const w of state.wells) {
    for (const r of w.rows) {
      if (shown >= PREVIEW_LIMIT) break outer;
      html += `<tr>
        <td>${escapeHtml(w.well)}</td>
        <td>${formatDate(r.date)}</td>
        <td>${formatNumber(r.oil)}</td>
        <td>${formatNumber(r.water)}</td>
        <td>${formatNumber(r.gas)}</td>
        <td>${formatNumber(r.winj)}</td>
        <td>${r.days}</td>
        <td>${formatNumber(r.bhp)}</td>
      </tr>`;
      shown++;
    }
  }
  html += '</tbody>';
  table.innerHTML = html;
  if (totalRows > PREVIEW_LIMIT) {
    $('summaryBox').innerHTML += `<span>Показаны первые ${PREVIEW_LIMIT} строк из ${totalRows}.</span>`;
  }
}

function formatDate(d) {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// Matches the precision Petrel's own .vol exports use: up to 7 decimals, no trailing zeros.
function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}

$('downloadBtn').addEventListener('click', () => {
  try {
    const text = buildVolText(state.wells);
    const fileName = $('outFileName').value.trim() || 'output.vol';
    downloadTextFile(fileName, text);
    setStatus($('downloadStatus'), `Файл ${fileName} сформирован и скачан.`, 'ok');
  } catch (err) {
    setStatus($('downloadStatus'), 'Ошибка при формировании файла: ' + err.message, 'error');
  }
});

// Builds the Petrel .vol text: tab-separated, CRLF line endings, one *NAME block per well.
// Every line — including *METRIC and *NAME — has exactly 7 tab-separated fields,
// matching the fixed column layout (*DATE *OIL *WATER *GAS *WINJ *DAYS *BHP).
function buildVolText(wells) {
  const CRLF = '\r\n';
  const lines = [];
  lines.push(['*METRIC', '', '', '', '', '', ''].join('\t'));
  lines.push(['*DATE', '*OIL', '*WATER', '*GAS', '*WINJ', '*DAYS', '*BHP'].join('\t'));

  wells.forEach((w) => {
    lines.push(['*NAME', String(w.well), '', '', '', '', ''].join('\t'));
    w.rows.forEach((r) => {
      lines.push([
        formatDate(r.date),
        formatNumber(r.oil),
        formatNumber(r.water),
        formatNumber(r.gas),
        formatNumber(r.winj),
        formatNumber(r.days),
        formatNumber(r.bhp),
      ].join('\t'));
    });
  });

  return lines.join(CRLF) + CRLF;
}

function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
