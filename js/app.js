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

async function addCustomer(name, days, dayTimes, price) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, days, day_times: dayTimes, start_time: '00:00', end_time: '00:00', price_per_session: price })
    .select();
  if (error) throw error;
  return data;
}

async function updateCustomer(id, name, days, dayTimes, price) {
  const { error } = await supabase
    .from('customers')
    .update({ name, days, day_times: dayTimes, start_time: '00:00', end_time: '00:00', price_per_session: price })
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
              <input type="checkbox" value="${d}" onchange="this.closest('.day-block').querySelector('.day-times').style.display=this.checked?'flex':'none'"> ${d}
            </label>
            <div class="day-times" style="display:none">
              <input type="time" class="day-start" value="15:00">
              <span>-</span>
              <input type="time" class="day-end" value="17:00">
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
      return `
      <tr>
        <td>${c.name}</td>
        <td>${(c.days || []).join(', ')}</td>
        <td colspan="2">${timeHtml}</td>
        <td>Rp ${Number(c.price_per_session).toLocaleString('id-ID')}</td>
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
    blocks.forEach(b => {
      const cb = b.querySelector('input[type="checkbox"]');
      if (!cb.checked) return;
      days.push(cb.value);
      const start = b.querySelector('.day-start').value;
      const end = b.querySelector('.day-end').value;
      if (start && end) dayTimes[cb.value] = { start, end };
    });

    if (!name) return alert('Nama pelanggan harus diisi');
    if (days.length === 0) return alert('Pilih minimal satu hari');
    if (Object.keys(dayTimes).length === 0) return alert('Jam harus diisi untuk hari yang dipilih');
    if (!price || price <= 0) return alert('Harga harus diisi dengan benar');

    try {
      await addCustomer(name, days, dayTimes, price);
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
  const editDays = document.getElementById('edit-days');
  editDays.innerHTML = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map(d => {
    const checked = (customer.days || []).includes(d);
    const t = dayTimes[d] || {};
    const start = t.start || customer.start_time?.slice(0,5) || '15:00';
    const end = t.end || customer.end_time?.slice(0,5) || '17:00';
    return `
      <div class="day-block">
        <label class="day-check">
          <input type="checkbox" value="${d}" ${checked ? 'checked' : ''} onchange="this.closest('.day-block').querySelector('.day-times').style.display=this.checked?'flex':'none'"> ${d}
        </label>
        <div class="day-times" style="display:${checked ? 'flex' : 'none'}">
          <input type="time" class="day-start" value="${start}">
          <span>-</span>
          <input type="time" class="day-end" value="${end}">
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
    blocks.forEach(b => {
      const cb = b.querySelector('input[type="checkbox"]');
      if (!cb.checked) return;
      days.push(cb.value);
      const start = b.querySelector('.day-start').value;
      const end = b.querySelector('.day-end').value;
      if (start && end) dayTimes[cb.value] = { start, end };
    });

    if (!name) return alert('Nama harus diisi');
    if (days.length === 0) return alert('Pilih minimal satu hari');
    if (Object.keys(dayTimes).length === 0) return alert('Jam harus diisi');
    if (!price || price <= 0) return alert('Harga harus diisi');

    try {
      await updateCustomer(id, name, days, dayTimes, price);
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
  if (e.target.classList.contains('modal')) closeEditModal();
});

// ============ CALENDAR ============

function getDayNumber(dayName) {
  const map = { 'Senin':0,'Selasa':1,'Rabu':2,'Kamis':3,'Jumat':4,'Sabtu':5,'Minggu':6 };
  return map[dayName];
}

async function loadCalendarData() {
  const { data: customers } = await supabase.from('customers').select('*');
  calendarCustomers = customers || [];
  const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
  const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
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

    let cellContent = `<div class="cal-day-number ${isToday ? 'today' : ''}">${d}</div>`;

    sessionsToday.forEach(c => {
      const att = attendanceToday.find(a => a.customer_id === c.id);
      const status = att ? att.status : null;
      cellContent += `
        <div class="cal-session ${status ? (status === 'hadir' ? 'hadir' : 'alpha') : ''}"
             onclick="toggleAttendance('${c.id}', '${dateStr}', '${c.name}', '${status || 'none'}')">
          ${c.name}
          ${status ? (status === 'hadir' ? '✓' : '✗') : '○'}
        </div>
      `;
    });

    grid.innerHTML += `<div class="cal-day">${cellContent}</div>`;
  }
}

window.toggleAttendance = async function(customerId, date, customerName, currentStatus) {
  const action = currentStatus === 'hadir' ? 'alpha' : 'hadir';
  if (currentStatus === 'none') {
    if (!confirm(`Tandai ${customerName} hadir pada ${date}?`)) return;
  } else if (currentStatus === 'hadir') {
    if (!confirm(`Ubah ${customerName} menjadi alpha pada ${date}?`)) return;
  } else {
    if (!confirm(`Ubah ${customerName} menjadi hadir pada ${date}?`)) return;
  }

  try {
    if (currentStatus === 'none') {
      await supabase.from('attendance').insert({
        customer_id: customerId,
        date: date,
        status: 'hadir'
      });
    } else {
      await supabase.from('attendance').upsert({
        customer_id: customerId,
        date: date,
        status: action
      }, { onConflict: 'customer_id, date' });
    }
    await renderCalendar();
  } catch (err) {
    alert('Gagal: ' + err.message);
  }
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
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

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
  const totalPrice = totalSessions * Number(customer.price_per_session);

  const receiptDiv = document.getElementById('receipt-output');
  const monthName = `${MONTHS_INDO[month - 1]} ${year}`;

  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  const sessionsHtml = hadirSessions.map(a => {
    const d = new Date(a.date + 'T00:00:00');
    const dayName = dayNames[d.getDay()];
    const t = getDayTime(customer, dayName);
    return `
      <tr>
        <td>${a.date}</td>
        <td>${dayName}</td>
        <td>${t.start?.slice(0,5)} - ${t.end?.slice(0,5)}</td>
        <td>Rp ${Number(customer.price_per_session).toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  receiptDiv.innerHTML = `
    <div id="receipt-content">
      <div class="receipt-header">
        <h2>Sumber Jaya Private Course</h2>
        <p>Bimbingan Belajar Profesional</p>
      </div>
      <div class="receipt-body">
        <table class="receipt-info">
          <tr><td>Nama Siswa</td><td>: <strong>${customer.name}</strong></td></tr>
          <tr><td>Periode</td><td>: <strong>${monthName}</strong></td></tr>
          <tr><td>Jam Les</td><td>: ${getTimeDisplay(customer)}</td></tr>
          <tr><td>Harga/Sesi</td><td>: Rp ${Number(customer.price_per_session).toLocaleString('id-ID')}</td></tr>
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
              <td><strong>Rp ${totalPrice.toLocaleString('id-ID')}</strong></td>
            </tr>
          </tfoot>
        </table>
        <div class="receipt-footer">
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
    link.download = `struk-sumber-jaya-${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    alert('Gagal mengunduh: ' + err.message);
  }

  receipt.style.width = origWidth;
  receipt.style.maxWidth = origMaxW;
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
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

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
      return sum + (c ? Number(c.price_per_session) : 0);
    }, 0);

    const yearIncome = (yearAttendance || []).reduce((sum, a) => {
      const c = customers.find(c => c.id === a.customer_id);
      return sum + (c ? Number(c.price_per_session) : 0);
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
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

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
        return sum + (c ? Number(c.price_per_session) : 0);
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
          backgroundColor: 'rgba(26, 115, 232, 0.7)',
          borderColor: 'rgba(26, 115, 232, 1)',
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
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

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
      const totalBill = totalSessions * Number(c.price_per_session);
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

// ============ TAB SWITCHING ============

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'calendar') renderCalendar();
  if (tabName === 'reports') renderReports();
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  setupCustomerForm();
  setupEditForm();
  await renderCustomers();
  populateMonthSelect();
  await loadCustomerSelects();
  renderCalendar();
});
