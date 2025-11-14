const $ = id => document.getElementById(id);
const money = n => (n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

let ownerVisible = false;

const model = {
  inputs: {
    clientName: '',
    projectAddress: '',
    crewRate: 55,
    markup: 15,
    tax: 0,
    travelFees: 0,
    disposalFee: 0,
    discount: 0,
    wastePct: 5,
    clientMode: false // when true, factor is locked and baked into line totals on sheets
  },
  sheets: [
    {
      name: 'Interior Paint', sheetRate: null, useGlobalRate: true, lines: [
        { desc: 'Walls (sq ft)', unit: 'sqft', qty: 0, matUnit: 1.25, hoursPerQty: 0.0015, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Ceilings (sq ft)', unit: 'sqft', qty: 0, matUnit: 0.85, hoursPerQty: 0.0012, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Trim (linear ft)', unit: 'lft', qty: 0, matUnit: 0.65, hoursPerQty: 0.0009, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Doors (each)', unit: 'ea', qty: 0, matUnit: 18, hoursPerQty: 0.25, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Custom item', unit: 'ea', qty: 0, matUnit: 0, hoursPerQty: 0, rateType: 'custom', rate: 55, custom: true, notes: '', dimL: 0, dimW: 0, useDims: false }
      ]
    },
    {
      name: 'Exterior Paint', sheetRate: null, useGlobalRate: true, lines: [
        { desc: 'Siding (sq ft)', unit: 'sqft', qty: 0, matUnit: 1.8, hoursPerQty: 0.002, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Trim (linear ft)', unit: 'lft', qty: 0, matUnit: 0.9, hoursPerQty: 0.001, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Custom item', unit: 'ea', qty: 0, matUnit: 0, hoursPerQty: 0, rateType: 'custom', rate: 55, custom: true, notes: '', dimL: 0, dimW: 0, useDims: false }
      ]
    },
    {
      name: 'Flooring', sheetRate: null, useGlobalRate: true, lines: [
        { desc: 'LVP install (sq ft)', unit: 'sqft', qty: 0, matUnit: 2.2, hoursPerQty: 0.002, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Carpet install (sq ft)', unit: 'sqft', qty: 0, matUnit: 1.5, hoursPerQty: 0.0015, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Floor prep (sq ft)', unit: 'sqft', qty: 0, matUnit: 0.6, hoursPerQty: 0.001, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Custom item', unit: 'ea', qty: 0, matUnit: 0, hoursPerQty: 0, rateType: 'custom', rate: 55, custom: true, notes: '', dimL: 0, dimW: 0, useDims: false }
      ]
    },
    {
      name: 'Finishing', sheetRate: null, useGlobalRate: true, lines: [
        { desc: 'Baseboard (linear ft)', unit: 'lft', qty: 0, matUnit: 1.8, hoursPerQty: 0.0012, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Caulk/patch (room)', unit: 'ea', qty: 0, matUnit: 12, hoursPerQty: 0.4, rateType: 'crew', notes: '', dimL: 0, dimW: 0, useDims: false, custom:false },
        { desc: 'Custom item', unit: 'ea', qty: 0, matUnit: 0, hoursPerQty: 0, rateType: 'custom', rate: 55, custom: true, notes: '', dimL: 0, dimW: 0, useDims: false }
      ]
    }
  ]
};

// Deep copy for reset and standard-line templates
const initialModel = JSON.parse(JSON.stringify(model));

function getStandardLinesForSheet(sheetName){
  const baseSheet = initialModel.sheets.find(s => s.name === sheetName);
  if(!baseSheet) return [];
  return baseSheet.lines.filter(l => !l.custom);
}

function effectiveSheetRate(sheet) {
  return sheet.useGlobalRate ? Number(model.inputs.crewRate || 0) : Number(sheet.sheetRate || 0);
}

function calcLine(line, sheet) {
  if (line.dimL === undefined) line.dimL = 0;
  if (line.dimW === undefined) line.dimW = 0;
  if (line.useDims === undefined) line.useDims = false;

  const wastePct = Number(model.inputs.wastePct || 0);
  const rate = (line.rateType === 'crew') ? effectiveSheetRate(sheet) : Number(line.rate || 0) || effectiveSheetRate(sheet);

  if (line.useDims && (line.unit || '').toLowerCase() === 'sqft') {
    const area = Number(line.dimL || 0) * Number(line.dimW || 0);
    line.qty = area;
  }

  const qty = Number(line.qty || 0);
  const materials = qty * Number(line.matUnit || 0) * (1 + wastePct / 100);
  const labor = qty * Number(line.hoursPerQty || 0) * rate;
  const total = materials + labor;
  return { materials, labor, total, rate };
}

function calcSheet(sheet) {
  return sheet.lines.reduce((a, l) => {
    const c = calcLine(l, sheet);
    a.materials += c.materials;
    a.labor += c.labor;
    a.total += c.total;
    return a;
  }, { materials: 0, labor: 0, total: 0 });
}

function calcAll() {
  let subtotal = 0;
  const per = model.sheets.map(s => {
    const t = calcSheet(s);
    subtotal += t.total;
    return { name: s.name, totals: t, sheet: s };
  });
  const m = model.inputs;
  const markupAmt = subtotal * (Number(m.markup || 0) / 100);
  const travelAmt = Number(m.travelFees || 0);
  const disposalAmt = Number(m.disposalFee || 0);
  const discountAmt = Number(m.discount || 0);
  const taxBase = subtotal + markupAmt + travelAmt + disposalAmt - discountAmt;
  const taxAmt = taxBase * (Number(m.tax || 0) / 100);
  const grand = taxBase + taxAmt;
  return { per, subtotal, markupAmt, travelAmt, disposalAmt, discountAmt, taxAmt, grand };
}

// --- UI helpers ---

function applyClientModeUI() {
  const wrap = $('markupWrap');
  const isClient = !!model.inputs.clientMode;
  if (wrap) wrap.style.display = isClient ? 'none' : '';
}

function displayLineTotal(line, sheet) {
  const c = calcLine(line, sheet);
  let total = c.total;
  if (model.inputs.clientMode) {
    const mp = Number(model.inputs.markup || 0) / 100;
    total = total * (1 + mp);
  }
  return { base: c.total, display: total };
}

// Render Inputs / Settings
function mountInputs() {
  ['clientName', 'projectAddress', 'crewRate', 'markup', 'tax', 'travelFees', 'disposalFee', 'discount', 'wastePct'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.value = model.inputs[id] ?? (
      id === 'crewRate' ? 55 :
      id === 'markup' ? 15 :
      id === 'wastePct' ? 5 : 0
    );
    el.oninput = e => {
      const val = ['clientName', 'projectAddress'].includes(id) ? e.target.value : Number(e.target.value || 0);
      model.inputs[id] = val;
      if (id === 'crewRate') renderSheets();
      renderSummary();
      renderQuote();
      updateAllLineTotals();
      saveLocal();
    };
  });

  const clientMode = $('clientMode');
  if (clientMode) {
    clientMode.checked = !!model.inputs.clientMode;
    clientMode.onchange = e => {
      model.inputs.clientMode = e.target.checked;
      applyClientModeUI();
      renderSummary();
      renderQuote();
      updateAllLineTotals();
      saveLocal();
    };
  }

  applyClientModeUI();
}

function sheetHeaderControls(sheet, stdOptionsHtml) {
  return `<div class="row-help">
    <span class="chip"><input type="checkbox" ${sheet.useGlobalRate ? 'checked' : ''} data-ctl="useGlobal"> Use global crew rate (${money(model.inputs.crewRate)})</span>
    <span class="chip"><label>Sheet labor rate <input type="number" step="1" value="${sheet.sheetRate ?? model.inputs.crewRate}" data-ctl="sheetRate" ${sheet.useGlobalRate ? 'disabled' : ''} style="width:110px"></label></span>
    <span class="chip adv"><input type="checkbox" data-ctl="adv"> Advanced</span>
    <button class="btn" data-ctl="addCustom">Add custom line</button>
    ${stdOptionsHtml}
  </div>`;
}

function makeSheetTable(sheet) {
  const card = $('tab-' + sheet.name);
  if (!card) return;

  const stdLines = getStandardLinesForSheet(sheet.name);
  const options = stdLines.map((l, idx) => `<option value="${idx}">${l.desc}</option>`).join('');
  const stdHtml = stdLines.length
    ? `<span class="chip"><label>Standard line
         <select data-ctl="addStd">
           <option value="">Select…</option>${options}
         </select>
       </label></span>`
    : '';

  card.innerHTML = `<h2>${sheet.name}</h2>${sheetHeaderControls(sheet, stdHtml)}
  <table class="table">
    <thead><tr>
      <th>Description</th><th>Unit</th><th>Qty</th>
      <th class="advcol">Mat $/unit</th><th class="advcol">Hours/qty</th><th class="advcol">Rate</th>
      <th>Notes</th><th>Line total</th><th></th>
    </tr></thead>
    <tbody id="tb-${sheet.name}"></tbody>
  </table>`;

  const tb = $('tb-' + sheet.name);
  tb.innerHTML = "";

  sheet.lines.forEach((l, i) => {
    if (l.dimL === undefined) l.dimL = 0;
    if (l.dimW === undefined) l.dimW = 0;
    if (l.useDims === undefined) l.useDims = false;

    const totals = displayLineTotal(l, sheet);
    const tr = document.createElement('tr');

    const canUseDims = (l.unit || '').toLowerCase() === 'sqft';

    tr.innerHTML = `
      <td style="text-align:left">
        <input value="${l.desc || ''}" data-i="${i}" data-f="desc" class="advcol" style="width:100%">
        <span class="adv-placeholder">${l.desc || ''}</span>
      </td>
      <td>
        <input value="${l.unit || ''}" data-i="${i}" data-f="unit" class="advcol" style="width:80px;text-align:right">
        <span class="adv-placeholder">${l.unit || ''}</span>
      </td>
      <td>
        <div class="qty-wrap">
          <input type="number" step="1" value="${l.qty || 0}" data-i="${i}" data-f="qty" style="width:100px;text-align:right">
          ${canUseDims ? `
          <div class="dims">
            <label class="dims-toggle">
              <input type="checkbox" data-i="${i}" data-dimtoggle="1" ${l.useDims ? 'checked' : ''}>
              Use L×W
            </label>
            <div class="dims-inputs" ${l.useDims ? '' : 'style="display:none"'}>
              <input type="number" step="0.01" placeholder="L" value="${l.dimL || ''}" data-i="${i}" data-f="dimL">
              <span>×</span>
              <input type="number" step="0.01" placeholder="W" value="${l.dimW || ''}" data-i="${i}" data-f="dimW">
            </div>
          </div>` : ''}
        </div>
      </td>
      <td class="advcol"><input type="number" step="0.01" value="${l.matUnit || 0}" data-i="${i}" data-f="matUnit" style="width:110px;text-align:right"></td>
      <td class="advcol"><input type="number" step="0.001" value="${l.hoursPerQty || 0}" data-i="${i}" data-f="hoursPerQty" style="width:110px;text-align:right"></td>
      <td class="advcol"><input type="number" step="1" value="${l.rateType === 'crew' ? '' : (l.rate || '')}" data-i="${i}" data-f="rate" placeholder="${effectiveSheetRate(sheet)}" style="width:110px;text-align:right"></td>
      <td style="min-width:180px"><textarea data-i="${i}" data-f="notes" placeholder="Add notes…">${l.notes || ''}</textarea></td>
      <td class="right linetotal-cell">${money(totals.display)}</td>
      <td>
        <button class="btn" data-i="${i}" data-dup="1">Duplicate</button>
        <button class="btn" data-i="${i}" data-del="1">Delete</button>
      </td>`;

    tb.appendChild(tr);
  });

  const advToggle = card.querySelector('[data-ctl="adv"]');
  const useGlobal = card.querySelector('[data-ctl="useGlobal"]');
  const sheetRate = card.querySelector('[data-ctl="sheetRate"]');
  const addCustom = card.querySelector('[data-ctl="addCustom"]');
  const addStd = card.querySelector('[data-ctl="addStd"]');

  function setAdvanced(on) {
    card.querySelectorAll('.advcol').forEach(el => el.style.display = on ? 'table-cell' : 'none');
    card.querySelectorAll('.adv-placeholder').forEach(el => el.style.display = on ? 'none' : 'inline');
  }
  if (advToggle) advToggle.onchange = e => setAdvanced(e.target.checked);
  setAdvanced(false);

  if (useGlobal) {
    useGlobal.onchange = e => {
      sheet.useGlobalRate = e.target.checked;
      sheetRate.disabled = sheet.useGlobalRate;
      renderSummary();
      renderQuote();
      renderSheets();
      saveLocal();
    };
  }
  if (sheetRate) {
    sheetRate.oninput = e => {
      sheet.sheetRate = Number(e.target.value || 0);
      renderSummary();
      renderQuote();
      updateLineTotals(sheet, card);
      saveLocal();
    };
  }
  if (addCustom) {
    addCustom.onclick = () => {
      sheet.lines.push({
        desc: 'Custom item',
        unit: 'ea',
        qty: 0,
        matUnit: 0,
        hoursPerQty: 0,
        rateType: 'custom',
        rate: effectiveSheetRate(sheet),
        custom: true,
        notes: '',
        dimL: 0,
        dimW: 0,
        useDims: false
      });
      renderSheets();
      renderSummary();
      renderQuote();
      saveLocal();
    };
  }
  if (addStd) {
    addStd.onchange = e => {
      const idx = e.target.value;
      if (idx === '') return;
      const tmpl = getStandardLinesForSheet(sheet.name)[Number(idx)];
      if (!tmpl) return;
      sheet.lines.push(JSON.parse(JSON.stringify(tmpl)));
      e.target.value = '';
      renderSheets();
      renderSummary();
      renderQuote();
      saveLocal();
    };
  }

  // Field bindings
  tb.querySelectorAll('input, textarea').forEach(inp => {
    const i = Number(inp.dataset.i);
    const f = inp.dataset.f;
    if (!f) return;
    inp.oninput = e => {
      let val = e.target.value;
      if (['qty', 'matUnit', 'hoursPerQty', 'rate', 'dimL', 'dimW'].includes(f)) {
        val = Number(val || 0);
      }
      sheet.lines[i][f] = val;

      if (f === 'dimL' || f === 'dimW') {
        const line = sheet.lines[i];
        const area = Number(line.dimL || 0) * Number(line.dimW || 0);
        line.qty = area;
        const row = tb.querySelectorAll('tr')[i];
        if (row) {
          const qtyInput = row.querySelector('input[data-f="qty"]');
          if (qtyInput) qtyInput.value = area || 0;
        }
      }

      if (f === 'rate') sheet.lines[i].rateType = 'custom';

      renderSummary();
      renderQuote();
      updateLineTotals(sheet, card);
      saveLocal();
    };
  });

  // Dimension toggle handlers
  tb.querySelectorAll('[data-dimtoggle="1"]').forEach(chk => {
    const i = Number(chk.dataset.i);
    chk.onchange = e => {
      const on = e.target.checked;
      sheet.lines[i].useDims = on;
      const row = tb.querySelectorAll('tr')[i];
      if (!row) return;
      const dimBox = row.querySelector('.dims-inputs');
      if (dimBox) dimBox.style.display = on ? 'flex' : 'none';
      saveLocal();
    };
  });

  // Delete / duplicate
  tb.querySelectorAll('[data-del="1"]').forEach(btn => {
    const i = Number(btn.dataset.i);
    btn.onclick = () => {
      sheet.lines.splice(i, 1);
      renderSheets();
      renderSummary();
      renderQuote();
      saveLocal();
    };
  });
  tb.querySelectorAll('[data-dup="1"]').forEach(btn => {
    const i = Number(btn.dataset.i);
    btn.onclick = () => {
      const clone = JSON.parse(JSON.stringify(sheet.lines[i]));
      sheet.lines.splice(i + 1, 0, clone);
      renderSheets();
      renderSummary();
      renderQuote();
      saveLocal();
    };
  });

  updateLineTotals(sheet, card);
}

function updateLineTotals(sheet, card) {
  const rows = card.querySelectorAll('tbody tr');
  rows.forEach((tr, i) => {
    const l = sheet.lines[i];
    const totals = displayLineTotal(l, sheet);
    const cell = tr.querySelector('.linetotal-cell');
    if (cell) cell.textContent = money(totals.display);
  });
}

function updateAllLineTotals() {
  model.sheets.forEach(sheet => {
    const card = $('tab-' + sheet.name);
    if (card) updateLineTotals(sheet, card);
  });
}

function renderSheets() {
  model.sheets.forEach(makeSheetTable);
}

// Internal Summary
function renderSummary() {
  const { per, subtotal, markupAmt, travelAmt, disposalAmt, discountAmt, taxAmt, grand } = calcAll();
  $('summaryTable').innerHTML = `<table class="table">
    <thead><tr><th>Service</th><th>Materials</th><th>Labor</th><th>Total (pre-factor)</th></tr></thead>
    <tbody>${per.map(s => `<tr><td style="text-align:left">${s.name}</td><td>${money(s.totals.materials)}</td><td>${money(s.totals.labor)}</td><td>${money(s.totals.total)}</td></tr>`).join('')}</tbody>
  </table>`;
  $('subtotal').textContent = money(subtotal);
  $('markupAmt').textContent = money(markupAmt);
  $('travelAmt').textContent = money(travelAmt);
  $('disposalAmt').textContent = money(disposalAmt);
  $('discountAmt').textContent = `(${money(discountAmt)})`;
  $('taxAmt').textContent = money(taxAmt);
  $('grandTotal').textContent = money(grand);
}

// Client-facing quote
function renderQuote() {
  const { per, subtotal, markupAmt, travelAmt, disposalAmt, discountAmt, taxAmt, grand } = calcAll();
  $('pDate').textContent = new Date().toLocaleDateString();
  $('pClient').textContent = "Client: " + (model.inputs.clientName || '');
  $('pAddress').textContent = "Address: " + (model.inputs.projectAddress || '');

  const allLines = [];
  per.forEach(group => {
    group.sheet.lines.forEach(line => {
      const c = calcLine(line, group.sheet);
      if (c.total > 0) {
        allLines.push({
          service: group.name,
          desc: line.desc,
          unit: line.unit,
          qty: line.qty,
          notes: line.notes || '',
          base: c.total
        });
      }
    });
  });

  const markedLines = allLines.map(l => {
    const share = subtotal > 0 ? (l.base / subtotal) : 0;
    const withMarkup = l.base + markupAmt * share;
    return { ...l, total: withMarkup };
  });

  $('quoteBody').innerHTML = `<table class="table">
    <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
    <tbody>
      ${markedLines.map(l => `
        <tr>
          <td style="text-align:left">
            <div><strong>${l.service} – ${l.desc}</strong></div>
            ${l.notes ? `<div class="muted small">${l.notes}</div>` : ''}
          </td>
          <td>${l.qty || 0}</td>
          <td>${l.unit || ''}</td>
          <td>${money(l.total)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;

  $('quoteTotals').innerHTML = `
    <div class="sumrow"><span>Travel / fees</span><span>${money(travelAmt)}</span></div>
    <div class="sumrow"><span>Disposal fee</span><span>${money(disposalAmt)}</span></div>
    <div class="sumrow"><span>Discount</span><span>(${money(discountAmt)})</span></div>
    <div class="sumrow"><span>Tax</span><span>${money(taxAmt)}</span></div>
    <div class="sumrow grand"><span>Total</span><span>${money(grand)}</span></div>`;
}

// Tabs
function setActive(tab) {
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach(d => d.style.display = 'none');
  const el = $('tab-' + tab); if (el) el.style.display = 'block';
}

// Save/Load/CSV/Print
document.getElementById('saveBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cwc_project_builder_v2_5.json'; a.click();
};
document.getElementById('loadBtn').onclick = () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = e => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const incoming = JSON.parse(r.result);
        Object.assign(model, incoming);
        boot(true);
      } catch (e) { alert('Invalid file'); }
    };
    r.readAsText(e.target.files[0]);
  };
  inp.click();
};
document.getElementById('csvBtn').onclick = () => {
  let rows = [["Sheet", "Description", "Unit", "Qty", "MatUnit", "Hours/Qty", "Rate/Type", "Notes", "Materials", "Labor", "LineTotalPreFactor"]];
  model.sheets.forEach(s => {
    s.lines.forEach(l => {
      const c = calcLine(l, s);
      rows.push([s.name, l.desc, l.unit, l.qty, l.matUnit, l.hoursPerQty, (l.rateType === 'crew' ? 'crew@' + (s.useGlobalRate ? model.inputs.crewRate : s.sheetRate) : ('custom@' + (l.rate || ''))), l.notes || '', c.materials.toFixed(2), c.labor.toFixed(2), c.total.toFixed(2)]);
    });
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'cwc_project_builder_v2_5.csv'; a.click();
};
document.getElementById('printBtn').onclick = () => { setActive('Client Quote'); setTimeout(() => window.print(), 200); };

// Local storage
function saveLocal() { try { localStorage.setItem('cwc_project_builder_v2_5', JSON.stringify(model)); } catch (e) { } }
function loadLocal() { try { const d = JSON.parse(localStorage.getItem('cwc_project_builder_v2_5') || 'null'); if (d) Object.assign(model, d); } catch (e) { } }

function boot(skipLoad) {
  if (!skipLoad) loadLocal();
  mountInputs();
  ['Interior Paint', 'Exterior Paint', 'Flooring', 'Finishing'].forEach(n => makeSheetTable(model.sheets.find(s => s.name === n)));
  renderSheets();
  renderSummary();
  renderQuote();
  setActive('Interior Paint');

  document.querySelectorAll('.navbtn').forEach(b => b.onclick = () => setActive(b.dataset.tab));

  const ownerToggle = document.getElementById('ownerToggle');
  if (ownerToggle) {
    ownerToggle.onclick = () => {
      const code = prompt('Enter settings code:');
      if (code !== 'Joeyhenny8') return;
      ownerVisible = !ownerVisible;
      document.querySelectorAll('.owner-nav').forEach(btn => {
        btn.style.display = ownerVisible ? 'block' : 'none';
      });
    };
  }

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (!confirm('Reset everything to the blank template? This cannot be undone.')) return;
      const fresh = JSON.parse(JSON.stringify(initialModel));
      model.inputs = fresh.inputs;
      model.sheets = fresh.sheets;
      saveLocal();
      boot(true);
    };
  }

  saveLocal();
}

boot(false);
