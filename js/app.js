import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aiucajvmyrqvfubyhksx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdWNhanZteXJxdmZ1Ynloa3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MjY2NjEsImV4cCI6MjA5ODUwMjY2MX0.21nEyPBW7VUXurWbWrBCNeFXJdsCgNr5Sp_xb2RGUrs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const MONTHS_INDO = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAY_HEADERS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

function getDayTime(customer, dayName) {
  const dayTimes = customer.day_times || {};
  if (dayTimes[dayName]) {
    return { start: dayTimes[dayName].start, end: dayTimes[dayName].end };
  }
  return { start: customer.start_time, end: customer.end_time };
}

function getTimeDisplay(customer) {
  const dayTimes = customer.day_times || {};
  const days = customer.days || [];
  if (days.length === 0) return '-';
  const times = days.map(d => {
    const t = dayTimes[d];
    if (t && t.start && t.end) return `${t.start.slice(0,5)}-${t.end.slice(0,5)}`;
    return null;
  });
  const unique = [...new Set(times.filter(Boolean))];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) return 'Bervariasi';
  return `${customer.start_time?.slice(0,5)}-${customer.end_time?.slice(0,5)}`;
}

function getDayPrice(customer, dayName) {
  const dayPrices = customer.day_prices || {};
  if (dayPrices[dayName] != null) return Number(dayPrices[dayName]);
  return Number(customer.price_per_session || 0);
}

function getPriceForDate(customer, dateStr) {
  const dayName = DAY_HEADERS[new Date(dateStr + 'T00:00:00').getDay()];
  return getDayPrice(customer, dayName);
}

function getPriceDisplay(customer) {
  const days = customer.days || [];
  if (days.length === 0) return 'Rp ' + Number(customer.price_per_session || 0).toLocaleString('id-ID');
  const prices = days.map(d => getDayPrice(customer, d));
  const unique = [...new Set(prices)];
  if (unique.length === 1) return 'Rp ' + unique[0].toLocaleString('id-ID');
  return 'Bervariasi';
}

function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let calendarCustomers = [];
let incomeChartInstance = null;

// ============ CUSTOMERS ============

async function loadCustomers() {
  const { data, error } = await supabase.from('customers').select('*').order('name');
  if (error) throw error;
  return data || [];
}

async function addCustomer(name, days, dayTimes, dayPrices, price) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, days, day_times: dayTimes, day_prices: dayPrices, start_time: '00:00', end_time: '00:00', price_per_session: price })
    .select();
  if (error) throw error;
  return data;
}

async function updateCustomer(id, name, days, dayTimes, dayPrices, price) {
  const { error } = await supabase
    .from('customers')
    .update({ name, days, day_times: dayTimes, day_prices: dayPrices, start_time: '00:00', end_time: '00:00', price_per_session: price })
    .eq('id', id);
  if (error) throw error;
}

async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

function showCustomerForm() {
  const form = document.getElementById('customer-form');
  form.innerHTML = `
    <h3>Tambah Pelanggan Baru</h3>
    <div class="form-row">
      <label>Nama Pelanggan</label>
      <input type="text" id="cust-name" placeholder="Cth: Budi Santoso" required>
    </div>
    <div class="form-row">
      <label>Hari & Jam Les</label>
      <div class="days-grid">
        ${['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map(d => `
          <div class="day-block">
            <label class="day-check">
              <input type="checkbox" value="${d}" onchange="const b=this.closest('.day-block');b.querySelector('.day-times').style.display=this.checked?'flex':'none';const gp=document.getElementById('cust-price');const dp=b.querySelector('.day-price');if(this.checked&&gp&&gp.value&&!dp.value)dp.value=gp.value;"> ${d}
            </label>
            <div class="day-times" style="display:none">
              <input type="time" class="day-start" value="15:00">
              <span>-</span>
              <input type="time" class="day-end" value="17:00">
              <input type="number" class="day-price" placeholder="Harga" min="0">
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="form-row">
      <label>Harga per Pertemuan (Rp)</label>
      <input type="number" id="cust-price" placeholder="Cth: 100000" min="0" required>
    </div>
    <button type="submit" class="btn-primary">Simpan Pelanggan</button>
  `;
}

async function renderCustomers() {
  const tbody = document.getElementById('customers-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Memuat data...</td></tr>';
  try {
    const customers = await loadCustomers();
    if (customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">Belum ada pelanggan. Tambahkan pelanggan baru di atas.</td></tr>';
      return;
    }
    tbody.innerHTML = customers.map(c => {
      const timeDisplay = getTimeDisplay(c);
      const timeHtml = timeDisplay === 'Bervariasi'
        ? `<span title="${(c.days||[]).map(d => { const t=getDayTime(c,d); return d+': '+t.start?.slice(0,5)+'-'+t.end?.slice(0,5); }).join('\n')}" style="cursor:help;border-bottom:1px dotted var(--text-muted)">Bervariasi &#9432;</span>`
        : timeDisplay;
      const priceDisplay = getPriceDisplay(c);
      const priceHtml = priceDisplay === 'Bervariasi'
        ? `<span title="${(c.days||[]).map(d => d+': Rp '+getDayPrice(c,d).toLocaleString('id-ID')).join('\n')}" style="cursor:help;border-bottom:1px dotted var(--text-muted)">Bervariasi &#9432;</span>`
        : priceDisplay;
      return `
      <tr>
        <td>${c.name}</td>
        <td>${(c.days || []).join(', ')}</td>
        <td colspan="2">${timeHtml}</td>
        <td>${priceHtml}</td>
        <td class="actions">
          <button class="btn-primary btn-sm" style="background:var(--warning);color:white" onclick="showEditModal('${c.id}')">Edit</button>
          <button class="btn-danger btn-sm" onclick="deleteCustomerHandler('${c.id}')">Hapus</button>
        </td>
      </tr>
    `}).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading error">Gagal memuat: ${err.message}</td></tr>`;
  }
}

window.deleteCustomerHandler = async function(id) {
  if (!confirm('Yakin ingin menghapus pelanggan ini? Semua data absen juga akan terhapus.')) return;
  try {
    await deleteCustomer(id);
    await renderCustomers();
    await loadCustomerSelects();
  } catch (err) {
    alert('Gagal menghapus: ' + err.message);
  }
};

function setupCustomerForm() {
  showCustomerForm();
  const form = document.getElementById('customer-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cust-name').value.trim();
    const price = parseInt(document.getElementById('cust-price').value);
    const blocks = document.querySelectorAll('#customer-form .day-block');
    const days = [];
    const dayTimes = {};
    const dayPrices = {};
    blocks.forEach(b => {
      const cb = b.querySelector('input[type="checkbox"]');
      if (!cb.checked) return;
      days.push(cb.value);
      const start = b.querySelector('.day-start').value;
      const end = b.querySelector('.day-end').value;
      if (start && end) dayTimes[cb.value] = { start, end };
      const p = parseInt(b.querySelector('.day-price').value);
      if (p && p > 0) dayPrices[cb.value] = p;
    });

    if (!name) return alert('Nama pelanggan harus diisi');
    if (days.length === 0) return alert('Pilih minimal satu hari');
    if (Object.keys(dayTimes).length === 0) return alert('Jam harus diisi untuk hari yang dipilih');
    if (!price || price <= 0) return alert('Harga harus diisi dengan benar');

    try {
      await addCustomer(name, days, dayTimes, dayPrices, price);
      form.reset();
      showCustomerForm();
      await renderCustomers();
      await loadCustomerSelects();
      alert('Pelanggan berhasil ditambahkan!');
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    }
  });
}

// ============ EDIT CUSTOMER ============

window.showEditModal = async function(id) {
  const { data: customer, error } = await supabase.from('customers').select('*').eq('id', id).single();
  if (error || !customer) return alert('Pelanggan tidak ditemukan');

  document.getElementById('edit-id').value = customer.id;
  document.getElementById('edit-name').value = customer.name;
  document.getElementById('edit-price').value = customer.price_per_session;

  const dayTimes = customer.day_times || {};
  const dayPrices = customer.day_prices || {};
  const editDays = document.getElementById('edit-days');
  editDays.innerHTML = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map(d => {
    const checked = (customer.days || []).includes(d);
    const t = dayTimes[d] || {};
    const start = t.start || customer.start_time?.slice(0,5) || '15:00';
    const end = t.end || customer.end_time?.slice(0,5) || '17:00';
    const price = dayPrices[d] != null ? dayPrices[d] : (customer.price_per_session || '');
    return `
      <div class="day-block">
        <label class="day-check">
          <input type="checkbox" value="${d}" ${checked ? 'checked' : ''} onchange="this.closest('.day-block').querySelector('.day-times').style.display=this.checked?'flex':'none'"> ${d}
        </label>
        <div class="day-times" style="display:${checked ? 'flex' : 'none'}">
          <input type="time" class="day-start" value="${start}">
          <span>-</span>
          <input type="time" class="day-end" value="${end}">
          <input type="number" class="day-price" placeholder="Harga" min="0" value="${price}">
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('editModal').style.display = 'flex';
};

window.closeEditModal = function() {
  document.getElementById('editModal').style.display = 'none';
};

function setupEditForm() {
  const form = document.getElementById('edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const name = document.getElementById('edit-name').value.trim();
    const price = parseInt(document.getElementById('edit-price').value);

    const blocks = document.querySelectorAll('#edit-days .day-block');
    const days = [];
    const dayTimes = {};
    const dayPrices = {};
    blocks.forEach(b => {
      const cb = b.querySelector('input[type="checkbox"]');
      if (!cb.checked) return;
      days.push(cb.value);
      const start = b.querySelector('.day-start').value;
      const end = b.querySelector('.day-end').value;
      if (start && end) dayTimes[cb.value] = { start, end };
      const p = parseInt(b.querySelector('.day-price').value);
      if (p && p > 0) dayPrices[cb.value] = p;
    });

    if (!name) return alert('Nama harus diisi');
    if (days.length === 0) return alert('Pilih minimal satu hari');
    if (Object.keys(dayTimes).length === 0) return alert('Jam harus diisi');
    if (!price || price <= 0) return alert('Harga harus diisi');

    try {
      await updateCustomer(id, name, days, dayTimes, dayPrices, price);
      closeEditModal();
      await renderCustomers();
      alert('Data pelanggan berhasil diperbarui!');
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    }
  });
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    closeEditModal();
    closeDayAttendance();
    closeMateriModal();
  }
});

// ============ CALENDAR ============

function getDayNumber(dayName) {
  const map = { 'Senin':0,'Selasa':1,'Rabu':2,'Kamis':3,'Jumat':4,'Sabtu':5,'Minggu':6 };
  return map[dayName];
}

async function loadCalendarData() {
  const { data: customers } = await supabase.from('customers').select('*');
  calendarCustomers = customers || [];
  const startDate = formatLocalDate(new Date(currentYear, currentMonth, 1));
  const endDate = formatLocalDate(new Date(currentYear, currentMonth + 1, 0));
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);
  return attendance || [];
}

async function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-title');
  if (!grid) return;

  title.textContent = `${MONTHS_INDO[currentMonth]} ${currentYear}`;
  grid.innerHTML = '';

  const attendance = await loadCalendarData();
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7;

  grid.innerHTML = DAY_HEADERS.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  for (let i = 0; i < firstDayOfWeek; i++) {
    grid.innerHTML += `<div class="cal-day cal-day-empty"></div>`;
  }

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayOfWeek = (firstDayOfWeek + d - 1) % 7;
    const dayName = DAY_HEADERS[dayOfWeek];
    const today = new Date();
    const isToday = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

    const sessionsToday = calendarCustomers.filter(c => (c.days || []).includes(dayName));
    const attendanceToday = attendance.filter(a => a.date === dateStr);

    let cellContent = `<div class="cal-day-number ${isToday ? 'today' : ''}" onclick="showDayAttendance('${dateStr}','${dayName}')">${d}</div>`;

    sessionsToday.forEach(c => {
      const att = attendanceToday.find(a => a.customer_id === c.id);
      const status = att ? att.status : null;
      cellContent += `
        <div class="cal-session ${status ? (status === 'hadir' ? 'hadir' : 'alpha') : ''}">
          ${c.name}
          ${status ? (status === 'hadir' ? '✓' : '✗') : '○'}
        </div>
      `;
    });

    grid.innerHTML += `<div class="cal-day">${cellContent}</div>`;
  }
}

async function doToggleAttendance(customerId, date, currentStatus, newStatus) {
  try {
    if (currentStatus === 'none' || currentStatus === null) {
      await supabase.from('attendance').insert({
        customer_id: customerId,
        date: date,
        status: newStatus
      });
    } else {
      await supabase.from('attendance').upsert({
        customer_id: customerId,
        date: date,
        status: newStatus
      }, { onConflict: 'customer_id, date' });
    }
    await renderCalendar();
  } catch (err) {
    alert('Gagal: ' + err.message);
  }
}

window.showDayAttendance = async function(dateStr, dayName) {
  const sessions = calendarCustomers.filter(c => (c.days || []).includes(dayName));
  if (sessions.length === 0) return;

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('date', dateStr);

  const todayAtt = attendance || [];

  const dateObj = new Date(dateStr + 'T00:00:00');
  const formatted = `${dateObj.getDate()} ${MONTHS_INDO[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  const modal = document.getElementById('dayAttendanceModal');
  const list = document.getElementById('day-attendance-list');
  list.innerHTML = sessions.map(c => {
    const att = todayAtt.find(a => a.customer_id === c.id);
    const status = att ? att.status : 'none';
    const t = getDayTime(c, dayName);
    return `
      <div class="attendance-item" data-cid="${c.id}" data-status="${status}">
        <div class="attendance-info">
          <strong>${c.name}</strong>
          <span class="attendance-time">${t.start?.slice(0,5)}-${t.end?.slice(0,5)} · Rp ${getDayPrice(c, dayName).toLocaleString('id-ID')}</span>
        </div>
        <div class="attendance-actions">
          <button class="att-btn ${status === 'hadir' ? 'active' : ''}" data-action="hadir" onclick="attendanceAction('${c.id}','${dateStr}','${status}','hadir')">Hadir</button>
          <button class="att-btn ${status === 'alpha' ? 'active' : ''}" data-action="alpha" onclick="attendanceAction('${c.id}','${dateStr}','${status}','alpha')">Alpha</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('day-attendance-date').textContent = formatted;
  document.getElementById('day-attendance-day').textContent = dayName;
  modal.style.display = 'flex';
};

window.attendanceAction = async function(customerId, date, currentStatus, newStatus) {
  await doToggleAttendance(customerId, date, currentStatus, newStatus);
  const { data: updatedAttendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('date', date);

  const todayAtt = updatedAttendance || [];
  const sessions = calendarCustomers.filter(c => (c.days || []).includes(DAY_HEADERS[new Date(date + 'T00:00:00').getDay()]));

  const list = document.getElementById('day-attendance-list');
  list.innerHTML = sessions.map(c => {
    const att = todayAtt.find(a => a.customer_id === c.id);
    const status = att ? att.status : 'none';
    const dayName = DAY_HEADERS[new Date(date + 'T00:00:00').getDay()];
    const t = getDayTime(c, dayName);
    return `
      <div class="attendance-item" data-cid="${c.id}" data-status="${status}">
        <div class="attendance-info">
          <strong>${c.name}</strong>
          <span class="attendance-time">${t.start?.slice(0,5)}-${t.end?.slice(0,5)} · Rp ${getDayPrice(c, dayName).toLocaleString('id-ID')}</span>
        </div>
        <div class="attendance-actions">
          <button class="att-btn ${status === 'hadir' ? 'active' : ''}" data-action="hadir" onclick="attendanceAction('${c.id}','${date}','${status}','hadir')">Hadir</button>
          <button class="att-btn ${status === 'alpha' ? 'active' : ''}" data-action="alpha" onclick="attendanceAction('${c.id}','${date}','${status}','alpha')">Alpha</button>
        </div>
      </div>
    `;
  }).join('');
};

window.closeDayAttendance = function() {
  document.getElementById('dayAttendanceModal').style.display = 'none';
};

window.prevMonth = function() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
};

window.nextMonth = function() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
};

// ============ RECEIPT ============

async function loadCustomerSelects() {
  const customers = await loadCustomers();
  const sel = document.getElementById('receipt-customer');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' +
    customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function populateMonthSelect() {
  const sel = document.getElementById('receipt-month');
  if (!sel) return;
  sel.innerHTML = '';
  const now = new Date();
  for (let i = -6; i <= 1; i++) {
    const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`;
    const label = `${MONTHS_INDO[m.getMonth()]} ${m.getFullYear()}`;
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

window.generateReceipt = async function() {
  const customerId = document.getElementById('receipt-customer').value;
  const monthVal = document.getElementById('receipt-month').value;
  if (!customerId || !monthVal) return alert('Pilih pelanggan dan bulan');

  const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).single();
  if (!customer) return alert('Pelanggan tidak ditemukan');

  const [year, month] = monthVal.split('-').map(Number);
  const startDate = `${monthVal}-01`;
      const endDate = formatLocalDate(new Date(year, month, 0));

  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'hadir')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  const hadirSessions = attendance || [];
  const totalSessions = hadirSessions.length;
  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const totalPrice = hadirSessions.reduce((sum, a) => {
    const d = new Date(a.date + 'T00:00:00');
    return sum + getDayPrice(customer, dayNames[d.getDay()]);
  }, 0);

  const receiptDiv = document.getElementById('receipt-output');
  const monthName = `${MONTHS_INDO[month - 1]} ${year}`;

  const sessionsHtml = hadirSessions.map(a => {
    const d = new Date(a.date + 'T00:00:00');
    const dayName = dayNames[d.getDay()];
    const t = getDayTime(customer, dayName);
    const price = getDayPrice(customer, dayName);
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <tr>
        <td>${dateStr}</td>
        <td>${dayName}</td>
        <td>${t.start?.slice(0,5)} - ${t.end?.slice(0,5)}</td>
        <td style="text-align:right">Rp ${price.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  receiptDiv.innerHTML = `
    <div id="receipt-content">
      <div class="receipt-header">
        <h2>NewSantara Private Course</h2>
        <p>Bimbingan Belajar Profesional</p>
      </div>
      <div class="receipt-body">
        <table class="receipt-info">
          <tr><td>Nama Siswa</td><td>: <strong>${customer.name}</strong></td></tr>
          <tr><td>Periode</td><td>: <strong>${monthName}</strong></td></tr>
          <tr><td>Jam Les</td><td>: ${getTimeDisplay(customer)}</td></tr>
          <tr><td>Harga/Sesi</td><td>: ${getPriceDisplay(customer)}</td></tr>
        </table>
        <table class="receipt-sessions">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Hari</th>
              <th>Jam</th>
              <th>Biaya</th>
            </tr>
          </thead>
          <tbody>
            ${sessionsHtml || '<tr><td colspan="4" style="text-align:center">Tidak ada pertemuan bulan ini</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3"><strong>Total ${totalSessions} Pertemuan</strong></td>
              <td style="text-align:right"><strong>Rp ${totalPrice.toLocaleString('id-ID')}</strong></td>
            </tr>
          </tfoot>
        </table>
        <div class="receipt-footer">
          <div class="receipt-bank">
            <p><strong>Pembayaran dapat dilakukan melalui:</strong></p>
            <p>Bank BLU by BCA &nbsp;|&nbsp; No. Rek. 004358009909</p>
            <p>a.n. MOKHAMAD ARIFIN ZAKARIYA</p>
          </div>
          <p>Terima kasih telah mempercayakan pendidikan putra/putri kepada kami</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('download-receipt').style.display = 'inline-block';
};

window.downloadReceiptPNG = async function() {
  const receipt = document.getElementById('receipt-content');
  if (!receipt) return;

  const origWidth = receipt.style.width;
  const origMaxW = receipt.style.maxWidth;

  receipt.style.width = '500px';
  receipt.style.maxWidth = '500px';

  try {
    const canvas = await html2canvas(receipt, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });
    const link = document.createElement('a');
    link.download = `struk-newsantara-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    alert('Gagal mengunduh: ' + err.message);
  }

  receipt.style.width = origWidth;
  receipt.style.maxWidth = origMaxW;
};

// ============ MODULES ============

async function loadModuleCovers() {
  const { data, error } = await supabase.from('modules').select('jilid, cover_url');
  if (error) return {};
  const map = {};
  (data || []).forEach(m => { map[m.jilid] = m.cover_url; });
  return map;
}

function getCoverSrc(covers, jilid) {
  return covers[jilid] || `img/covers/jilid${jilid}.jpg`;
}

async function renderModules() {
  const grid = document.getElementById('modules-grid');
  if (!grid) return;

  const covers = await loadModuleCovers();

  grid.innerHTML = MODULES_DATA.map(m => {
    return `
      <div class="jilid-card ${m.class}" data-jilid="${m.jilid}" onclick="showPertemuan(${m.jilid})">
        <div class="jilid-card-cover">
          <img src="${getCoverSrc(covers, m.jilid)}" alt="Jilid ${m.jilid}" loading="lazy">
        </div>
        <div class="jilid-card-body">
          <div class="jilid-topics">
            ${m.topics.map(t => `
              <span class="jilid-topic ${m.core.includes(t) ? 'core' : ''}">${t}</span>
            `).join('')}
          </div>
          <div class="jilid-meta">
            <span><strong>${m.pertemuan.length}</strong> pertemuan</span>
            <span>${m.range}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function showPertemuan(jilid) {
  const m = MODULES_DATA.find(x => x.jilid === jilid);
  if (!m) return;

  const section = document.getElementById('pertemuan-section');
  const titleEl = document.getElementById('pertemuan-title');
  const descEl = document.getElementById('pertemuan-desc');
  const list = document.getElementById('pertemuan-list');

  const colors = { 1: '#0d9488', 2: '#1e3a5f', 3: '#c9a84c', 4: '#0d9488' };
  const c = colors[m.jilid];

  document.querySelectorAll('.jilid-card').forEach(el => el.classList.remove('active'));
  const card = document.querySelector(`.jilid-card[data-jilid="${jilid}"]`);
  if (card) card.classList.add('active');

  titleEl.innerHTML = `<span style="background:${c}">${m.jilid}</span> Jilid ${m.jilid}: ${m.title}`;
  descEl.textContent = m.desc;

  list.innerHTML = m.pertemuan.map(p => `
    <div class="pertemuan-item">
      <div class="pertemuan-header" onclick="togglePertemuan(this)">
        <div class="pertemuan-header-left">
          <div class="pertemuan-num" style="background:${c}">${p.num}</div>
          <span class="pertemuan-title">${p.title}</span>
        </div>
        <svg class="pertemuan-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="pertemuan-body">
        <div class="pertemuan-details">
          <span class="label">Tujuan</span>
          <span class="value">${p.tujuan}</span>
          <span class="label">Kosakata Inti</span>
          <span class="value">${p.kosakata}</span>
          <span class="label">Ekspresi</span>
          <span class="value"><em>${p.ekspresi}</em></span>
          <span class="label">Grammar</span>
          <span class="value">${p.grammar}</span>
          <span class="label">Aktivitas</span>
          <span class="value">${p.aktivitas}</span>
          <span class="label">Latihan</span>
          <span class="value">${p.latihan}</span>
          <span class="label">PR</span>
          <span class="value">${p.pr}</span>
          ${p.materi ? `
          <span class="label section-label">Materi Pokok</span>
          <span class="value materi-value">${p.materi}</span>` : ''}
          ${p.contoh_kalimat ? `
          <span class="label section-label">Contoh Kalimat</span>
          <span class="value contoh-value">${p.contoh_kalimat.replace(/\n/g,'<br>')}</span>` : ''}
          ${p.contoh_percakapan ? `
          <span class="label section-label">Contoh Percakapan</span>
          <span class="value contoh-value">${p.contoh_percakapan.replace(/\n/g,'<br>')}</span>` : ''}
          ${p.latihan_soal ? `
          <span class="label section-label">Latihan Soal</span>
          <span class="value soal-value">${p.latihan_soal.replace(/\n/g,'<br>')}</span>` : ''}
          ${p.tips ? `
          <span class="label section-label">Tips Mengajar</span>
          <span class="value tips-value">${p.tips}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  section.classList.add('active');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function togglePertemuan(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('.pertemuan-arrow');
  const isOpen = body.classList.contains('open');

  document.querySelectorAll('.pertemuan-body.open').forEach(el => {
    el.classList.remove('open');
    el.previousElementSibling.querySelector('.pertemuan-arrow').classList.remove('open');
  });

  if (!isOpen) {
    body.classList.add('open');
    arrow.classList.add('open');
  }
}

// Expose module functions to global for onclick handlers
window.showPertemuan = showPertemuan;
window.togglePertemuan = togglePertemuan;

// ============ PAPER GENERATOR ============

const PAPER_TOPICS = {
  1: ['Greetings','Introduction','Alphabet','Numbers','Colors','Shapes','Classroom Objects','Classroom Commands','Days','Family','Body Parts','Five Senses'],
  2: ['Animals','Wild & Farm Animals','Food','Drinks','Fruits','Vegetables','Likes & Dislikes','Clothes','Weather','Seasons'],
  3: ['My House','Rooms','Furniture','Prepositions','Daily Activities','Time','Morning – Night','Simple Routine','Transportation','Places in Town','Jobs'],
  4: ['Opposites','Adjectives','Feelings','Simple Sentences','There is / There are','I Have / We Have','Can / Can\'t','Reading Practice','Conversation']
};

function updatePaperTopics() {
  const jilid = document.getElementById('paper-jilid').value;
  const topicSelect = document.getElementById('paper-topic');
  const topics = PAPER_TOPICS[jilid] || [];
  topicSelect.innerHTML = topics.map(t => `<option value="${t}">${t}</option>`).join('');
}

window.updatePaperTopics = updatePaperTopics;

async function generatePaper() {
  const btn = document.getElementById('paper-gen-btn');
  const result = document.getElementById('paper-result');
  const content = document.getElementById('paper-content');
  const jilid = document.getElementById('paper-jilid').value;
  const topic = document.getElementById('paper-topic').value;

  if (!topic) { alert('Pilih tema terlebih dahulu!'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;animation:spin 1s linear infinite">&#9696;</span> Membuat modul, mohon tunggu ±1 menit...';

  try {
    const res = await fetch('/api/generate-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jilid: `Jilid ${jilid}`,
        topic: topic,
        title: `${topic} — Jilid ${jilid}`
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const inline = (s) => s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

    const lines = (data.content || '').split('\n');
    let html = '';
    let inTable = false;
    let tableHeader = false;
    let inList = false;

    const closeList = () => {
      if (inList) { html += '</ul>'; inList = false; }
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (line.startsWith('|') && line.endsWith('|')) {
        const stripped = line.replace(/\|/g, '').trim();
        const isSep = stripped !== '' && [...stripped].every(ch => ch === '-' || ch === ':' || ch === ' ');
        if (!inTable) {
          inTable = true;
          tableHeader = true;
          closeList();
          html += '<table class="vocab-table">';
        }
        if (isSep) continue;
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length === 0) continue;
        if (tableHeader) {
          tableHeader = false;
          html += `<tr>${cells.map(c => `<th>${inline(c)}</th>`).join('')}</tr>`;
        } else {
          html += `<tr>${cells.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`;
        }
        continue;
      } else if (inTable) {
        inTable = false;
        html += '</table>';
      }

      if (/^#+\s/.test(line)) {
        closeList();
        const level = Math.min(line.match(/^#+/)[0].length, 3);
        if (level === 1) continue;
        const text = line.replace(/^#+\s*/, '');
        const tag = level === 2 ? 'h2' : 'h3';
        html += `<${tag}>${inline(text)}</${tag}>`;
      } else if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
        closeList();
        html += '<hr>';
      } else if (line.startsWith('> ')) {
        closeList();
        html += `<div class="reading-box">${inline(line.slice(2))}</div>`;
      } else if (line.startsWith('- ')) {
        if (!inList) { inList = true; html += '<ul>'; }
        html += `<li>${inline(line.slice(2))}</li>`;
      } else if (/^\d+[\.\)]\s/.test(line)) {
        closeList();
        html += `<p><span class="soal-num">${line.match(/^\d+[\.\)]/)[0]}</span>${inline(line.replace(/^\d+[\.\)]\s*/, ''))}</p>`;
      } else {
        closeList();
        html += `<p>${inline(line)}</p>`;
      }
    }
    closeList();
    if (inTable) html += '</table>';

    content.innerHTML = `
      <div class="paper-a4">
        <h1>${topic}</h1>
        <div class="paper-meta">Jilid ${jilid} — NewSantara Private Course</div>
        ${html}
      </div>
    `;

    result.style.display = 'block';
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    alert('Gagal generate: ' + err.message);
  }

  btn.disabled = false;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Generate &amp; Cetak PDF';
}

window.generatePaper = generatePaper;

function setPageStyle(size) {
  let el = document.getElementById('page-size-style');
  if (!el) {
    el = document.createElement('style');
    el.id = 'page-size-style';
    document.head.appendChild(el);
  }
  el.textContent = `@page { size: ${size}; margin: 0; }`;
}

function printPaper() {
  const area = document.getElementById('progress-print-area');
  const prevArea = area ? area.style.display : '';
  if (area) area.style.display = 'none';
  setPageStyle('A4 landscape');
  window.print();
  if (area) area.style.display = prevArea;
}

window.printPaper = printPaper;

function closePaper() {
  document.getElementById('paper-result').style.display = 'none';
}

window.closePaper = closePaper;

// Initialize paper topics on tab switch
const origSwitchTab = window.switchTab || switchTab;
const switchTabWithPaper = function(tabName) {
  if (tabName === 'modules') {
    setTimeout(updatePaperTopics, 100);
  }
};
// Hook into existing switchTab
const origSwitchTab2 = switchTab;
switchTab = function(tabName) {
  origSwitchTab2(tabName);
  if (tabName === 'modules') setTimeout(updatePaperTopics, 50);
};

// ============ REPORTS / STATISTICS ============

async function renderReports() {
  renderStatisticsSummary();
  renderIncomeChart();
  renderCustomerActivity();
}

async function renderStatisticsSummary() {
  const container = document.getElementById('stats-summary');
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const startOfYear = `${now.getFullYear()}-01-01`;
  const endDate = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  try {
    const { data: customers } = await supabase.from('customers').select('*');
    if (!customers || customers.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary)">Belum ada data pelanggan.</p>';
      return;
    }

    const customerIds = customers.map(c => c.id);

    const { data: monthAttendance } = await supabase
      .from('attendance')
      .select('*')
      .in('customer_id', customerIds)
      .eq('status', 'hadir')
      .gte('date', startOfMonth)
      .lte('date', endDate);

    const { data: yearAttendance } = await supabase
      .from('attendance')
      .select('*')
      .in('customer_id', customerIds)
      .eq('status', 'hadir')
      .gte('date', startOfYear);

    const monthIncome = (monthAttendance || []).reduce((sum, a) => {
      const c = customers.find(c => c.id === a.customer_id);
      return sum + (c ? getPriceForDate(c, a.date) : 0);
    }, 0);

    const yearIncome = (yearAttendance || []).reduce((sum, a) => {
      const c = customers.find(c => c.id === a.customer_id);
      return sum + (c ? getPriceForDate(c, a.date) : 0);
    }, 0);

    const monthSessions = (monthAttendance || []).length;
    const yearSessions = (yearAttendance || []).length;

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">Rp ${monthIncome.toLocaleString('id-ID')}</div>
        <div class="stat-label">Pemasukan Bulan Ini</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">Rp ${yearIncome.toLocaleString('id-ID')}</div>
        <div class="stat-label">Pemasukan Tahun ${now.getFullYear()}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">${monthSessions}</div>
        <div class="stat-label">Pertemuan Bulan Ini</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${customers.length}</div>
        <div class="stat-label">Total Pelanggan</div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger)">Gagal memuat: ${err.message}</p>`;
  }
}

async function renderIncomeChart() {
  const canvas = document.getElementById('incomeChart');
  if (!canvas) return;

  const now = new Date();
  const labels = [];
  const data = [];

  try {
    const { data: customers } = await supabase.from('customers').select('*');
    if (!customers || customers.length === 0) return;

    const customerIds = customers.map(c => c.id);

    for (let i = 11; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = m.getFullYear();
      const month = m.getMonth() + 1;
      const monthStr = `${String(month).padStart(2,'0')}`;
      const startDate = `${year}-${monthStr}-01`;
  const endDate = formatLocalDate(new Date(year, month, 0));

      labels.push(`${MONTHS_INDO[month-1].slice(0,3)} ${String(year).slice(2)}`);

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .in('customer_id', customerIds)
        .eq('status', 'hadir')
        .gte('date', startDate)
        .lte('date', endDate);

      const total = (attendance || []).reduce((sum, a) => {
        const c = customers.find(c => c.id === a.customer_id);
        return sum + (c ? getPriceForDate(c, a.date) : 0);
      }, 0);

      data.push(total);
    }

    if (incomeChartInstance) incomeChartInstance.destroy();

    incomeChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Pemasukan (Rp)',
          data,
          backgroundColor: 'rgba(13, 148, 136, 0.7)',
          borderColor: 'rgba(13, 148, 136, 1)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: v => 'Rp' + v.toLocaleString('id-ID')
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Chart error:', err);
  }
}

async function renderCustomerActivity() {
  const tbody = document.getElementById('activity-body');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Memuat data...</td></tr>';

  try {
    const { data: customers } = await supabase.from('customers').select('*');
    if (!customers || customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">Belum ada data pelanggan.</td></tr>';
      return;
    }

    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const endOfMonth = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const customerIds = customers.map(c => c.id);

    const { data: allAttendance } = await supabase
      .from('attendance')
      .select('*')
      .in('customer_id', customerIds)
      .eq('status', 'hadir')
      .order('date', { ascending: false });

    const { data: monthAttendance } = await supabase
      .from('attendance')
      .select('*')
      .in('customer_id', customerIds)
      .eq('status', 'hadir')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    const rows = customers.map(c => {
      const totalSessions = (allAttendance || []).filter(a => a.customer_id === c.id).length;
      const monthSessions = (monthAttendance || []).filter(a => a.customer_id === c.id).length;
      const lastSession = (allAttendance || []).find(a => a.customer_id === c.id);
      const lastDate = lastSession ? lastSession.date : '-';
      const totalBill = (allAttendance || []).filter(a => a.customer_id === c.id).reduce((sum, a) => sum + getPriceForDate(c, a.date), 0);
      const isActive = monthSessions > 0;

      return `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td>${totalSessions}</td>
          <td>${monthSessions}</td>
          <td>${lastDate}</td>
          <td>Rp ${totalBill.toLocaleString('id-ID')}</td>
          <td><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Aktif' : 'Tidak Aktif'}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = rows.join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading error">Gagal memuat: ${err.message}</td></tr>`;
  }
}

// ============ PROGRESS REPORT (LOCAL) ============

const PROGRESS_LS_KEY = 'sjc_progress_reports';
let progressCurrentKey = null;

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadProgressReports() {
  try {
    const raw = localStorage.getItem(PROGRESS_LS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function saveProgressReportsList(list) {
  localStorage.setItem(PROGRESS_LS_KEY, JSON.stringify(list));
}

function progressKeyOf(child, month, year) {
  return `${child.trim().toLowerCase()}|${year}-${String(Number(month) + 1).padStart(2, '0')}`;
}

function getProgressRecordByKey(key) {
  return loadProgressReports().find(r => r.key === key) || null;
}

function getOrCreateProgressRecord(child, month, year) {
  const list = loadProgressReports();
  const key = progressKeyOf(child, month, year);
  let rec = list.find(r => r.key === key);
  if (!rec) {
    rec = {
      key,
      child: child.trim(),
      month: Number(month),
      year: Number(year),
      sessionsTotal: '',
      sessionsHadir: '',
      understanding: '',
      notes: '',
      parentNotes: '',
      updatedAt: '',
      materials: []
    };
    list.push(rec);
    saveProgressReportsList(list);
  }
  return rec;
}

function updateProgressRecord(rec) {
  const list = loadProgressReports();
  const idx = list.findIndex(r => r.key === rec.key);
  rec.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = rec;
  else list.push(rec);
  saveProgressReportsList(list);
}

function calcOverallProgress(rec) {
  const materials = rec.materials || [];
  if (materials.length === 0) return 0;
  const sum = materials.reduce((s, m) => s + (Number(m.progress) || 0), 0);
  return Math.round(sum / materials.length);
}

function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS_INDO[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function formatDateTimeID(iso) {
  if (!iso) return 'Belum pernah disimpan';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_INDO[d.getMonth()].slice(0, 3)} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

function fillProgressSelectors() {
  const monthSel = document.getElementById('progress-month');
  const yearSel = document.getElementById('progress-year');
  if (monthSel.options.length === 0) {
    monthSel.innerHTML = MONTHS_INDO.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    monthSel.value = String(new Date().getMonth());
  }
  if (yearSel.options.length === 0) {
    const nowYear = new Date().getFullYear();
    const years = [];
    for (let y = nowYear - 2; y <= nowYear + 1; y++) years.push(y);
    yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSel.value = String(nowYear);
  }
}

async function renderProgressChildSuggestions() {
  const dl = document.getElementById('progress-child-list');
  if (!dl) return;
  const names = new Set(loadProgressReports().map(r => r.child));
  try {
    const { data: customers } = await supabase.from('customers').select('name');
    (customers || []).forEach(c => { if (c.name) names.add(c.name); });
  } catch (err) { /* mode lokal: saran dari data tersimpan saja */ }
  dl.innerHTML = [...names].sort().map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
}

function renderProgressTab() {
  fillProgressSelectors();
  fillPrintSelectors();
  renderProgressChildSuggestions();
  fillPrintMuridOptions();
  renderProgressList();
}

window.openProgressReport = function() {
  const child = document.getElementById('progress-child').value.trim();
  if (!child) return alert('Nama anak harus diisi');
  const month = parseInt(document.getElementById('progress-month').value);
  const year = parseInt(document.getElementById('progress-year').value);
  const rec = getOrCreateProgressRecord(child, month, year);
  progressCurrentKey = rec.key;
  fillPrintMuridOptions();
  renderProgressReport();
  const card = document.getElementById('progress-report-card');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  fillSessionRecap(rec);
};

function renderProgressReport() {
  const rec = getProgressRecordByKey(progressCurrentKey);
  if (!rec) return;

  document.getElementById('progress-title').textContent = `Laporan Progres ${rec.child}`;
  document.getElementById('progress-subtitle').textContent =
    `${MONTHS_INDO[rec.month]} ${rec.year} • Terakhir diubah: ${formatDateTimeID(rec.updatedAt)}`;

  const overall = calcOverallProgress(rec);
  document.getElementById('progress-overall-value').textContent = `${overall}%`;
  document.getElementById('progress-overall-fill').style.width = `${overall}%`;

  renderProgressMateri(rec);
  renderProgressStats(rec);

  document.getElementById('progress-sessions-total').value = rec.sessionsTotal || '';
  document.getElementById('progress-sessions-hadir').value = rec.sessionsHadir || '';
  document.getElementById('progress-understanding').value = rec.understanding || '';
  document.getElementById('progress-notes').value = rec.notes || '';
  document.getElementById('progress-parent-notes').value = rec.parentNotes || '';

  renderProgressList();
}

function materiStatusBadge(status) {
  if (status === 'Selesai') return 'active';
  if (status === 'Berjalan') return 'progress';
  return 'plain';
}

function renderProgressMateri(rec) {
  const tbody = document.getElementById('progress-materi-body');
  const materials = rec.materials || [];
  if (materials.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Belum ada materi. Klik "+ Tambah Materi" untuk menambahkan materi bulan ini.</td></tr>';
    return;
  }
  tbody.innerHTML = materials.map((m, i) => {
    const p = Math.max(0, Math.min(100, Number(m.progress) || 0));
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(m.title)}</strong></td>
        <td class="materi-desc">${m.learned ? escapeHtml(m.learned) : '-'}</td>
        <td>${formatDateID(m.date)}</td>
        <td><span class="status-badge ${materiStatusBadge(m.status)}">${escapeHtml(m.status || 'Rencana')}</span></td>
        <td>
          <div class="materi-progress-cell">
            <input type="range" min="0" max="100" value="${p}" oninput="previewMateriProgress(this)" onchange="commitMateriProgress('${m.id}', this.value)">
            <span class="materi-progress-label" id="mp-${m.id}">${p}%</span>
          </div>
        </td>
        <td class="actions">
          <button class="btn-primary btn-sm" style="background:var(--warning);color:white" onclick="showMateriModal('${m.id}')">Edit</button>
          <button class="btn-danger btn-sm" onclick="deleteMateriHandler('${m.id}')">Hapus</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderProgressStats(rec) {
  const container = document.getElementById('progress-stats');
  const materials = rec.materials || [];
  const selesai = materials.filter(m => m.status === 'Selesai').length;
  const avg = calcOverallProgress(rec);
  const hadir = rec.sessionsHadir === '' || rec.sessionsHadir == null ? '-' : rec.sessionsHadir;
  const total = rec.sessionsTotal === '' || rec.sessionsTotal == null ? '-' : rec.sessionsTotal;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${materials.length}</div>
      <div class="stat-label">Total Materi</div>
    </div>
    <div class="stat-card green">
      <div class="stat-value">${selesai}</div>
      <div class="stat-label">Materi Selesai</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-value">${avg}%</div>
      <div class="stat-label">Rata-rata Progres</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${hadir}<span style="font-size:0.9rem;color:var(--text-muted)">/${total}</span></div>
      <div class="stat-label">Kehadiran</div>
    </div>
  `;
}

window.previewMateriProgress = function(input) {
  const label = input.parentElement.querySelector('.materi-progress-label');
  if (label) label.textContent = `${input.value}%`;
};

window.commitMateriProgress = function(id, value) {
  const rec = getProgressRecordByKey(progressCurrentKey);
  if (!rec) return;
  const m = (rec.materials || []).find(x => x.id === id);
  if (!m) return;
  let p = parseInt(value);
  if (isNaN(p)) p = 0;
  m.progress = Math.max(0, Math.min(100, p));
  updateProgressRecord(rec);
  renderProgressReport();
};

window.showMateriModal = function(id) {
  if (!progressCurrentKey) return alert('Buka laporan bulanan terlebih dahulu.');
  const form = document.getElementById('materi-form');
  form.reset();
  document.getElementById('materi-id').value = '';
  document.getElementById('materi-progress').value = 0;
  document.getElementById('materi-status').value = 'Selesai';
  document.getElementById('materi-modal-title').textContent = 'Tambah Materi';

  if (id) {
    const rec = getProgressRecordByKey(progressCurrentKey);
    const m = rec && (rec.materials || []).find(x => x.id === id);
    if (m) {
      document.getElementById('materi-id').value = m.id;
      document.getElementById('materi-title').value = m.title || '';
      document.getElementById('materi-learned').value = m.learned || '';
      document.getElementById('materi-date').value = m.date || '';
      document.getElementById('materi-status').value = m.status || 'Rencana';
      document.getElementById('materi-progress').value = Number(m.progress) || 0;
      document.getElementById('materi-modal-title').textContent = 'Edit Materi';
    }
  }
  document.getElementById('materiModal').style.display = 'flex';
};

window.closeMateriModal = function() {
  document.getElementById('materiModal').style.display = 'none';
};

function setupMateriForm() {
  document.getElementById('materi-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const rec = getProgressRecordByKey(progressCurrentKey);
    if (!rec) return alert('Buka laporan bulanan terlebih dahulu.');

    const id = document.getElementById('materi-id').value;
    const title = document.getElementById('materi-title').value.trim();
    if (!title) return alert('Nama materi harus diisi');

    let progress = parseInt(document.getElementById('materi-progress').value);
    if (isNaN(progress)) progress = 0;
    progress = Math.max(0, Math.min(100, progress));

    const data = {
      title,
      learned: document.getElementById('materi-learned').value.trim(),
      date: document.getElementById('materi-date').value,
      status: document.getElementById('materi-status').value,
      progress
    };

    if (id) {
      const m = (rec.materials || []).find(x => x.id === id);
      if (!m) return alert('Materi tidak ditemukan.');
      Object.assign(m, data);
    } else {
      rec.materials = rec.materials || [];
      rec.materials.push({ id: 'm' + Date.now() + Math.random().toString(36).slice(2, 7), ...data });
    }

    updateProgressRecord(rec);
    closeMateriModal();
    renderProgressReport();
  });
}

window.deleteMateriHandler = function(id) {
  if (!confirm('Yakin ingin menghapus materi ini?')) return;
  const rec = getProgressRecordByKey(progressCurrentKey);
  if (!rec) return;
  rec.materials = (rec.materials || []).filter(m => m.id !== id);
  updateProgressRecord(rec);
  renderProgressReport();
};

window.saveProgressAssessment = function() {
  const rec = getProgressRecordByKey(progressCurrentKey);
  if (!rec) return alert('Buka laporan bulanan terlebih dahulu.');
  rec.sessionsTotal = document.getElementById('progress-sessions-total').value;
  rec.sessionsHadir = document.getElementById('progress-sessions-hadir').value;
  rec.understanding = document.getElementById('progress-understanding').value;
  rec.notes = document.getElementById('progress-notes').value;
  rec.parentNotes = document.getElementById('progress-parent-notes').value;
  updateProgressRecord(rec);
  renderProgressReport();
  alert('Catatan progres berhasil disimpan!');
};

function renderProgressList() {
  const tbody = document.getElementById('progress-list-body');
  if (!tbody) return;
  const list = loadProgressReports().slice().sort((a, b) => {
    const ta = a.updatedAt || '';
    const tb = b.updatedAt || '';
    return tb.localeCompare(ta);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Belum ada laporan tersimpan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const overall = calcOverallProgress(r);
    return `
      <tr>
        <td><strong>${escapeHtml(r.child)}</strong></td>
        <td>${MONTHS_INDO[r.month]} ${r.year}</td>
        <td>${(r.materials || []).length}</td>
        <td>
          <div class="materi-progress-cell">
            <div class="progress-bar progress-bar-sm"><div class="progress-fill" style="width:${overall}%"></div></div>
            <span class="materi-progress-label">${overall}%</span>
          </div>
        </td>
        <td>${formatDateTimeID(r.updatedAt)}</td>
        <td class="actions">
          <button class="btn-primary btn-sm" style="background:var(--warning);color:white" onclick="openProgressReportByKey('${r.key}')">Buka</button>
          <button class="btn-danger btn-sm" onclick="deleteProgressReportHandler('${r.key}')">Hapus</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.openProgressReportByKey = function(key) {
  const rec = getProgressRecordByKey(key);
  if (!rec) return alert('Laporan tidak ditemukan.');
  fillProgressSelectors();
  document.getElementById('progress-child').value = rec.child;
  document.getElementById('progress-month').value = String(rec.month);
  document.getElementById('progress-year').value = String(rec.year);
  progressCurrentKey = rec.key;
  fillPrintMuridOptions();
  renderProgressReport();
  const card = document.getElementById('progress-report-card');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  fillSessionRecap(rec);
};

window.deleteProgressReportHandler = function(key) {
  if (!confirm('Yakin ingin menghapus laporan ini? Semua materi dan catatannya akan terhapus.')) return;
  const list = loadProgressReports().filter(r => r.key !== key);
  saveProgressReportsList(list);
  if (progressCurrentKey === key) {
    progressCurrentKey = null;
    document.getElementById('progress-report-card').style.display = 'none';
  }
  renderProgressList();
  renderProgressChildSuggestions();
  fillPrintMuridOptions();
};

function fillPrintSelectors() {
  const monthSel = document.getElementById('print-month');
  const yearSel = document.getElementById('print-year');
  if (monthSel.options.length === 0) {
    monthSel.innerHTML = MONTHS_INDO.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    monthSel.value = String(new Date().getMonth());
  }
  if (yearSel.options.length === 0) {
    const nowYear = new Date().getFullYear();
    const years = [];
    for (let y = nowYear - 2; y <= nowYear + 1; y++) years.push(y);
    yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSel.value = String(nowYear);
  }
}

async function fillPrintMuridOptions() {
  const sel = document.getElementById('print-murid');
  if (!sel) return;
  const apply = (names) => {
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Pilih Murid --</option>' +
      [...names].sort().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    if (prev) sel.value = prev;
  };
  const names = new Set(loadProgressReports().map(r => r.child));
  apply(names);
  try {
    const { data: customers } = await supabase.from('customers').select('name');
    (customers || []).forEach(c => { if (c.name) names.add(c.name); });
    apply(names);
  } catch (err) { /* mode lokal */ }
}

function buildPrintReportHtml(rec) {
  const materials = rec.materials || [];
  const overall = calcOverallProgress(rec);
  const selesai = materials.filter(m => m.status === 'Selesai').length;
  const today = new Date();
  const printedAt = `${today.getDate()} ${MONTHS_INDO[today.getMonth()]} ${today.getFullYear()}`;

  const rows = materials.length
    ? materials.map((m, i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td><strong>${escapeHtml(m.title)}</strong></td>
          <td>${m.learned ? escapeHtml(m.learned) : '-'}</td>
          <td style="text-align:center;white-space:nowrap">${formatDateID(m.date)}</td>
          <td style="text-align:center;white-space:nowrap">${escapeHtml(m.status || 'Rencana')}</td>
          <td style="text-align:center;white-space:nowrap">${Math.max(0, Math.min(100, Number(m.progress) || 0))}%</td>
        </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#888;padding:18px">Tidak ada materi pada bulan ini</td></tr>';

  const notes = rec.notes && rec.notes.trim() ? escapeHtml(rec.notes) : '<span style="color:#999">-</span>';
  const parentNotes = rec.parentNotes && rec.parentNotes.trim() ? escapeHtml(rec.parentNotes) : '<span style="color:#999">-</span>';
  const hadir = rec.sessionsHadir === '' || rec.sessionsHadir == null ? '-' : rec.sessionsHadir;
  const totalSess = rec.sessionsTotal === '' || rec.sessionsTotal == null ? '-' : rec.sessionsTotal;

  return `
    <div class="report-head">
      <div style="display:flex;align-items:center;gap:10px">
        <img src="sql/logo.png" alt="Logo" style="height:44px;width:auto;object-fit:contain">
        <div>
          <div class="report-brand">NewSantara Private Course</div>
          <div class="report-brand-sub">Bimbingan Belajar Profesional</div>
        </div>
      </div>
      <div class="report-head-right">
        <div>Tanggal Cetak: <strong>${printedAt}</strong></div>
        <div>Dokumen: LP/${rec.year}/${String(rec.month + 1).padStart(2, '0')}/NS</div>
      </div>
    </div>

    <h1 class="report-title">LAPORAN PROGRES &amp; PERKEMBANGAN ANAK</h1>
    <div class="report-period">Periode Bulan ${MONTHS_INDO[rec.month]} ${rec.year}</div>

    <div class="report-info">
      <div class="report-info-row"><span>Nama Anak / Siswa</span><strong>${escapeHtml(rec.child)}</strong></div>
      <div class="report-info-row"><span>Bulan Laporan</span><strong>${MONTHS_INDO[rec.month]} ${rec.year}</strong></div>
      <div class="report-info-row"><span>Tingkat Pemahaman</span><strong>${rec.understanding ? escapeHtml(rec.understanding) : '-'}</strong></div>
      <div class="report-info-row"><span>Kehadiran</span><strong>${hadir} dari ${totalSess} pertemuan</strong></div>
    </div>

    <div class="report-summary">
      <div class="report-stat"><div class="v">${materials.length}</div><div class="l">Total Materi</div></div>
      <div class="report-stat"><div class="v">${selesai}</div><div class="l">Materi Selesai</div></div>
      <div class="report-stat"><div class="v">${overall}%</div><div class="l">Progres Keseluruhan</div></div>
      <div class="report-stat"><div class="v">${rec.understanding ? escapeHtml(rec.understanding) : '-'}</div><div class="l">Pemahaman</div></div>
    </div>

    <div class="report-bar-label"><span>Progres Pembelajaran Bulan ${MONTHS_INDO[rec.month]}</span><strong>${overall}%</strong></div>
    <div class="progress-bar report-bar"><div class="progress-fill" style="width:${overall}%"></div></div>

    <h2>Materi yang Dipelajari</h2>
    <table class="report-table">
      <thead>
        <tr>
          <th style="width:36px">No</th>
          <th style="width:20%">Materi</th>
          <th>Apa yang Dipelajari</th>
          <th style="width:90px">Tanggal</th>
          <th style="width:80px">Status</th>
          <th style="width:64px">Progres</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="report-notes-grid">
      <div class="report-note-box">
        <h3>Catatan Perkembangan Anak</h3>
        <p>${notes}</p>
      </div>
      <div class="report-note-box">
        <h3>Kendala &amp; Catatan untuk Orang Tua</h3>
        <p>${parentNotes}</p>
      </div>
    </div>

    <div class="report-footer-quote">"Belajar bukan hanya tentang seberapa tinggi nilai yang diraih,<br>tetapi tentang tumbuhnya rasa ingin tahu, keberanian untuk mencoba, dan semangat untuk terus belajar."</div>
  `;
}

window.buildPrintReport = function() {
  const child = document.getElementById('print-murid').value;
  if (!child) return alert('Pilih murid terlebih dahulu');
  const month = parseInt(document.getElementById('print-month').value);
  const year = parseInt(document.getElementById('print-year').value);
  const rec = getProgressRecordByKey(progressKeyOf(child, month, year));
  if (!rec) {
    return alert(`Laporan ${MONTHS_INDO[month]} ${year} untuk ${child} belum ada. Buka laporan terlebih dahulu lewat tombol "Buka Laporan".`);
  }
  document.getElementById('progress-print-content').innerHTML = buildPrintReportHtml(rec);
  const area = document.getElementById('progress-print-area');
  area.style.display = 'block';
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.printProgressReport = function() {
  const src = document.getElementById('progress-print-content');
  if (!src || !src.innerHTML.trim()) return alert('Buat laporan terlebih dahulu');

  const root = document.getElementById('print-root');
  root.innerHTML = `<div class="report-print-sheet">${src.innerHTML}</div>`;
  document.body.classList.add('printing-report');
  setPageStyle('330mm 420mm');
  window.print();
  document.body.classList.remove('printing-report');
  root.innerHTML = '';
  setPageStyle('A4 landscape');
};

window.closePrintReport = function() {
  document.getElementById('progress-print-area').style.display = 'none';
};

function countScheduledSessions(days, month, year) {
  const list = (days || []).map(d => DAY_HEADERS.indexOf(d)).filter(i => i >= 0);
  if (list.length === 0) return 0;
  const lastDate = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDate; d++) {
    const dow = (new Date(year, month, d).getDay() + 6) % 7;
    if (list.includes(dow)) count++;
  }
  return count;
}

async function loadSessionRecap(child, month, year) {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = formatLocalDate(new Date(year, month + 1, 0));

  let customer = null;
  try {
    const { data } = await supabase.from('customers').select('*').eq('name', child);
    customer = (data || [])[0] || null;
  } catch (err) { customer = null; }

  let attendance = [];
  try {
    let query = supabase.from('attendance').select('*').gte('date', startDate).lte('date', endDate);
    if (customer) query = query.eq('customer_id', customer.id);
    const { data, error } = await query;
    if (error) throw error;
    attendance = data || [];
  } catch (err) {
    return null;
  }

  const hadir = attendance.filter(a => a.status === 'hadir').length;
  const alpha = attendance.filter(a => a.status === 'alpha').length;
  const scheduled = customer ? countScheduledSessions(customer.days, month, year) : 0;
  const total = Math.max(scheduled, hadir + alpha);

  return { total, hadir, alpha, hasCustomer: !!customer };
}

async function fillSessionRecap(rec) {
  const source = document.getElementById('recap-source');
  if (!rec) return;
  if (source) source.textContent = 'Mengambil data rekap absen...';
  const recap = await loadSessionRecap(rec.child, rec.month, rec.year);
  if (progressCurrentKey !== rec.key) return;
  if (!recap) {
    if (source) source.textContent = 'Gagal mengambil rekap absen. Isi manual atau klik "Ambil dari Rekap".';
    return;
  }  const changed = String(rec.sessionsTotal) !== String(recap.total) || String(rec.sessionsHadir) !== String(recap.hadir);
  rec.sessionsTotal = recap.total;
  rec.sessionsHadir = recap.hadir;
  if (changed) updateProgressRecord(rec);
  if (source) {
    source.textContent = `Terisi otomatis dari rekap absen ${MONTHS_INDO[rec.month]} ${rec.year}: ${recap.hadir} hadir dari ${recap.total} pertemuan` +
      (recap.alpha ? `, ${recap.alpha} alpha` : '') +
      (recap.hasCustomer ? ' (jadwal + absen).' : ' (rekap absen).');
  }
  renderProgressReport();
}

window.refreshSessionRecap = function() {
  const rec = getProgressRecordByKey(progressCurrentKey);
  if (!rec) return alert('Buka laporan bulanan terlebih dahulu.');
  const source = document.getElementById('recap-source');
  if (source) source.textContent = 'Mengambil data rekap absen...';
  fillSessionRecap(rec);
};

// ============ TAB SWITCHING ============

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'calendar') renderCalendar();
  if (tabName === 'modules') renderModules();
  if (tabName === 'reports') renderReports();
  if (tabName === 'progress') renderProgressTab();
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  setupCustomerForm();
  setupEditForm();
  setupMateriForm();
  await renderCustomers();
  populateMonthSelect();
  await loadCustomerSelects();
  renderCalendar();
});
