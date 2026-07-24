const DAYS_INDONESIAN = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_ENGLISH = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

async function loadCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

async function addCustomer(name, days, startTime, endTime, price) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, days, start_time: startTime, end_time: endTime, price_per_session: price })
    .select();
  if (error) throw error;
  return data;
}

async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}

async function updateCustomer(id, updates) {
  const { error } = await supabase.from('customers').update(updates).eq('id', id);
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
      <label>Hari Les</label>
      <div class="days-grid">
        ${['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map(d => `
          <label class="day-check">
            <input type="checkbox" value="${d}"> ${d}
          </label>
        `).join('')}
      </div>
    </div>
    <div class="form-row time-row">
      <div>
        <label>Jam Mulai</label>
        <input type="time" id="cust-start" value="15:00" required>
      </div>
      <div>
        <label>Jam Selesai</label>
        <input type="time" id="cust-end" value="17:00" required>
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
    tbody.innerHTML = customers.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${(c.days || []).join(', ')}</td>
        <td>${c.start_time?.slice(0,5)}</td>
        <td>${c.end_time?.slice(0,5)}</td>
        <td>Rp ${Number(c.price_per_session).toLocaleString('id-ID')}</td>
        <td class="actions">
          <button class="btn-danger btn-sm" onclick="deleteCustomerHandler('${c.id}')">Hapus</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading error">Gagal memuat: ${err.message}</td></tr>`;
  }
}

async function deleteCustomerHandler(id) {
  if (!confirm('Yakin ingin menghapus pelanggan ini? Semua data absen juga akan terhapus.')) return;
  try {
    await deleteCustomer(id);
    await renderCustomers();
  } catch (err) {
    alert('Gagal menghapus: ' + err.message);
  }
}

async function setupCustomerForm() {
  showCustomerForm();
  const form = document.getElementById('customer-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cust-name').value.trim();
    const days = [...document.querySelectorAll('#customer-form .days-grid input:checked')].map(cb => cb.value);
    const startTime = document.getElementById('cust-start').value;
    const endTime = document.getElementById('cust-end').value;
    const price = parseInt(document.getElementById('cust-price').value);

    if (!name) return alert('Nama pelanggan harus diisi');
    if (days.length === 0) return alert('Pilih minimal satu hari');
    if (!startTime || !endTime) return alert('Jam harus diisi');
    if (!price || price <= 0) return alert('Harga harus diisi dengan benar');

    try {
      await addCustomer(name, days, startTime, endTime, price);
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
