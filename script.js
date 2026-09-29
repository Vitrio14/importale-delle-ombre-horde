// ===== IMPORTALE DELLE OMBRE Gestionale - Script =====
// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCqaMHpFiju7Igd3E23kVKFMStDoGk-eyk",
  authDomain: "importale-ombre-horde.firebaseapp.com",
  projectId: "importale-ombre-horde",
  storageBucket: "importale-ombre-horde.firebasestorage.app",
  messagingSenderId: "1024751178715",
  appId: "1:1024751178715:web:ff033d258044024de74dfe",
  measurementId: "G-2T5VCP76H8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Stato Globale
let currentUser = null;
let userRole = null; // 'gestore' | 'dipendente'
let currentEmployeeId = null; // id documento employee se staff
let currentEmployeeData = null;
let staffSession = null; // { id, name, login, roles, customPercentage }
let localCatalogYJ = {};
let localCatalogFen = {};
let localEmployees = {};
let localSalesYJ = {};
let localSalesFen = {};
let localSalariesStatus = {};
let localInventoryYJ = {};
let localInventoryYJLogs = [];
let localInventoryFen = {};
let localInventoryFenLogs = [];
let localStashes = {};
let localArchive = {};
let localItemImages = {};
let localBalance = { amount: 0, updatedAt: null, updatedBy: null };
let localBalanceLogs = [];

// DOM
const loginPage = document.getElementById('login-page');
const mainDashboard = document.getElementById('main-dashboard');
const roleBadge = document.getElementById('role-badge');

const navSalesYjBtn = document.getElementById('nav-sales-yj-btn');
const navSalesFenBtn = document.getElementById('nav-sales-fen-btn');
const navInventoryYjBtn = document.getElementById('nav-inventory-yj-btn');
const navInventoryFenBtn = document.getElementById('nav-inventory-fen-btn');
const navSaldoBtn = document.getElementById('nav-saldo-btn');
const navAdminBtn = document.getElementById('nav-admin-btn');

const salesYjSection = document.getElementById('sales-yj-section');
const salesFenSection = document.getElementById('sales-fen-section');
const inventoryYjSection = document.getElementById('inventory-yj-section');
const inventoryFenSection = document.getElementById('inventory-fen-section');
const saldoSection = document.getElementById('saldo-section');
const adminSection = document.getElementById('admin-section');

const logoutBtn = document.getElementById('logout-btn');
const adminEmployeeFilter = document.getElementById('admin-employee-filter');

// Gestione immagini logo
const imgLogin = document.getElementById('login-main-logo');
const imgNav = document.getElementById('nav-main-logo');
if (imgLogin) imgLogin.onerror = function() { this.style.display = 'none'; };
if (imgNav) imgNav.onerror = function() { this.style.display = 'none'; };


// --- UTILS ---
function formatValuta(valore) {
    if (valore === null || valore === undefined || isNaN(Number(valore))) valore = 0;
    return "€ " + Number(valore).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Numeri interi / quantità con separatore migliaia italiano (es. 10.000) */
function formatNumero(valore) {
    if (valore === null || valore === undefined || isNaN(Number(valore))) valore = 0;
    const n = Number(valore);
    // Se ha decimali, mostra fino a 2; altrimenti intero con punti migliaia
    if (Math.abs(n % 1) > 1e-9) {
        return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return Math.round(n).toLocaleString('it-IT');
}

function getStartOfCurrentWeek() {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
}

function getStashName(stashId) {
    if (localStashes[stashId]) return localStashes[stashId].name;
    return stashId || '—';
}

// --- TOAST ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    let bgClass = 'bg-emerald-600 border-emerald-500';
    let iconClass = 'fa-circle-check';
    if (type === 'error') { bgClass = 'bg-red-600 border-red-500'; iconClass = 'fa-circle-exclamation'; }
    else if (type === 'info') { bgClass = 'bg-indigo-600 border-indigo-500'; iconClass = 'fa-circle-info'; }
    else if (type === 'warning') { bgClass = 'bg-amber-500 border-amber-400 text-gray-900'; iconClass = 'fa-triangle-exclamation'; }

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-white ${bgClass} transform transition-all duration-300 translate-x-4 opacity-0 text-sm font-medium w-full`;
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} text-base shrink-0"></i>
        <div class="flex-1 leading-snug">${message}</div>
        <button type="button" class="ml-1 hover:opacity-70 transition text-current shrink-0 p-1" onclick="this.closest('div').remove()" aria-label="Chiudi"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-4', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        toast.classList.remove('opacity-100', 'translate-x-0');
        setTimeout(() => toast.remove(), 280);
    }, 4200);
}

// --- CONFIRM MODAL ---
let modalCallback = null;
function showConfirmModal(title, message, onConfirm, isDangerous = true) {
    const modal = document.getElementById('custom-modal');
    const box = document.getElementById('modal-box');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const icon = document.getElementById('modal-icon');
    if (isDangerous) {
        confirmBtn.className = "px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition";
        icon.className = "fa-solid fa-triangle-exclamation text-2xl text-red-400";
    } else {
        confirmBtn.className = "px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-900 rounded-xl font-bold text-sm transition";
        icon.className = "fa-solid fa-circle-question text-2xl text-amber-400";
    }
    modalCallback = onConfirm;
    modal.classList.remove('hidden');
    setTimeout(() => {
        box.classList.remove('scale-95', 'opacity-0');
        box.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeConfirmModal() {
    const modal = document.getElementById('custom-modal');
    const box = document.getElementById('modal-box');
    box.classList.remove('scale-100', 'opacity-100');
    box.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modalCallback = null;
    }, 200);
}

document.getElementById('modal-cancel-btn').addEventListener('click', closeConfirmModal);
document.getElementById('modal-confirm-btn').addEventListener('click', () => {
    if (modalCallback) modalCallback();
    closeConfirmModal();
});


window.setSmartInvAction = function(action) {
    const hidden = document.getElementById('smart-modal-action');
    if (hidden) hidden.value = action;
    const btnP = document.getElementById('smart-btn-preleva');
    const btnD = document.getElementById('smart-btn-deposita');
    if (btnP && btnD) {
        if (action === 'preleva') {
            btnP.className = 'py-3 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-2 border-amber-500 bg-amber-500/20 text-amber-400';
            btnD.className = 'py-3 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-2 border-gray-600 bg-gray-900 text-gray-400 hover:border-emerald-500 hover:text-emerald-400';
        } else {
            btnD.className = 'py-3 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-2 border-emerald-500 bg-emerald-500/20 text-emerald-400';
            btnP.className = 'py-3 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-2 border-gray-600 bg-gray-900 text-gray-400 hover:border-amber-500 hover:text-amber-400';
        }
    }
};

// --- SMART MODAL ---
window.openSmartModal = function(type, itemId) {
    const modal = document.getElementById('smart-action-modal');
    const box = document.getElementById('smart-modal-box');
    const empSelect = document.getElementById('smart-modal-employee');
    empSelect.innerHTML = '<option value="">-- Seleziona Operatore --</option>';
    Object.keys(localEmployees).forEach(key => {
        empSelect.innerHTML += `<option value="${key}">${localEmployees[key].name}</option>`;
    });

    document.getElementById('smart-modal-form').reset();
    if (userRole === 'dipendente' && currentEmployeeId) {
        empSelect.value = currentEmployeeId;
        empSelect.disabled = true;
    } else {
        empSelect.disabled = false;
    }
    document.getElementById('smart-modal-type').value = type;
    document.getElementById('smart-modal-item-id').value = itemId || '';
    document.getElementById('smart-modal-action-container').classList.add('hidden');
    document.getElementById('smart-modal-custom-name-container').classList.add('hidden');
    document.getElementById('smart-modal-price-container').classList.add('hidden');
    document.getElementById('smart-modal-reason-container').classList.add('hidden');
    const pctBox = document.getElementById('smart-modal-pct-container');
    if (pctBox) pctBox.classList.add('hidden');
    const freePreview = document.getElementById('smart-modal-free-preview');
    if (freePreview) freePreview.classList.add('hidden');

    const titleEl = document.getElementById('smart-modal-title');
    const submitBtn = document.getElementById('smart-modal-submit');
    const priceInput = document.getElementById('smart-modal-price');
    document.getElementById('smart-modal-quantity').value = "1";
    const freePctInput = document.getElementById('smart-modal-free-pct');
    if (freePctInput) freePctInput.value = '';

    if (type === 'inv_yj' || type === 'inv_fen') {
        const item = type === 'inv_yj' ? localInventoryYJ[itemId] : localInventoryFen[itemId];
        if (!item) return;
        titleEl.innerHTML = `<i class="fa-solid fa-boxes-stacked mr-2"></i> Gestisci: <span class="text-white">${item.name}</span>`;
        document.getElementById('smart-modal-action-container').classList.remove('hidden');
        document.getElementById('smart-modal-reason-container').classList.remove('hidden');
        if (typeof window.setSmartInvAction === 'function') window.setSmartInvAction('preleva');
        submitBtn.textContent = "Conferma Movimento";
        submitBtn.className = "w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition transform active:scale-95 shadow-lg mt-4";
    } else if (type === 'sale_catalog_yj' || type === 'sale_catalog_fen') {
        const catalog = type === 'sale_catalog_yj' ? localCatalogYJ : localCatalogFen;
        const item = catalog[itemId];
        if (!item) return;
        titleEl.innerHTML = `<i class="fa-solid fa-cash-register mr-2"></i> Vendi: <span class="text-white">${item.name}</span>`;
        document.getElementById('smart-modal-price-container').classList.remove('hidden');
        document.getElementById('smart-modal-price-label').textContent = "Prezzo Unitario (€)";
        priceInput.value = item.price;
        priceInput.disabled = true;
        submitBtn.textContent = "Registra Vendita";
        submitBtn.className = "w-full py-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-extrabold rounded-xl transition transform active:scale-95 shadow-lg mt-4";
    } else if (type === 'sale_custom_yj' || type === 'sale_custom_fen') {
        titleEl.innerHTML = `<i class="fa-solid fa-bolt mr-2"></i> Nuova Vendita Libera`;
        document.getElementById('smart-modal-custom-name-container').classList.remove('hidden');
        document.getElementById('smart-modal-price-container').classList.remove('hidden');
        document.getElementById('smart-modal-price-label').textContent = "Prezzo unitario (€)";
        priceInput.value = '';
        priceInput.disabled = false;
        submitBtn.textContent = "Registra Vendita";
        submitBtn.className = "w-full py-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-extrabold rounded-xl transition transform active:scale-95 shadow-lg mt-4";
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        box.classList.remove('scale-95', 'opacity-0');
        box.classList.add('scale-100', 'opacity-100');
    }, 10);
};

function updateFreeSalePreview() {
    const preview = document.getElementById('smart-modal-free-preview');
    if (!preview) return;
    const baseUnit = parseFloat(document.getElementById('smart-modal-price')?.value);
    const pct = parseFloat(document.getElementById('smart-modal-free-pct')?.value);
    const qty = parseInt(document.getElementById('smart-modal-quantity')?.value) || 1;
    if (isNaN(baseUnit) || baseUnit < 0 || isNaN(pct) || pct < 0) {
        preview.classList.add('hidden');
        return;
    }
    // % inserita = guadagno casa; stipendio = % personale dipendente
    const empId = document.getElementById('smart-modal-employee')?.value;
    let empPct = 40;
    if (empId && localEmployees[empId] && localEmployees[empId].customPercentage != null && localEmployees[empId].customPercentage !== '') {
        empPct = parseFloat(localEmployees[empId].customPercentage) || 40;
    } else if (userRole === 'dipendente' && currentEmployeeId && localEmployees[currentEmployeeId]?.customPercentage != null) {
        empPct = parseFloat(localEmployees[currentEmployeeId].customPercentage) || 40;
    }
    const priceWithoutPct = baseUnit * qty;
    const yellowGain = priceWithoutPct * (pct / 100);
    const totalPrice = priceWithoutPct + yellowGain;
    const employeeGain = yellowGain * (empPct / 100);
    const elBase = document.getElementById('preview-base');
    const elYellow = document.getElementById('preview-yellow');
    const elTotal = document.getElementById('preview-total');
    const elEmp = document.getElementById('preview-emp');
    if (elBase) elBase.textContent = formatValuta(priceWithoutPct);
    if (elYellow) elYellow.textContent = formatValuta(yellowGain) + ' (' + pct + '%)';
    if (elTotal) elTotal.textContent = formatValuta(totalPrice);
    if (elEmp) elEmp.textContent = formatValuta(employeeGain) + ' (su ' + empPct + '% pers.)';
    preview.classList.remove('hidden');
}

['smart-modal-price', 'smart-modal-free-pct', 'smart-modal-quantity', 'smart-modal-employee'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
        const box = document.getElementById('smart-modal-pct-container');
        if (box && !box.classList.contains('hidden')) updateFreeSalePreview();
    });
    if (el) el.addEventListener('change', () => {
        const box = document.getElementById('smart-modal-pct-container');
        if (box && !box.classList.contains('hidden')) updateFreeSalePreview();
    });
});

window.closeSmartModal = function() {
    const modal = document.getElementById('smart-action-modal');
    const box = document.getElementById('smart-modal-box');
    box.classList.remove('scale-100', 'opacity-100');
    box.classList.add('scale-95', 'opacity-0');
    setTimeout(() => { modal.classList.add('hidden'); }, 200);
};

document.getElementById('smart-modal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('smart-modal-type').value;
    const itemId = document.getElementById('smart-modal-item-id').value;
    const empId = document.getElementById('smart-modal-employee').value;
    const qty = parseInt(document.getElementById('smart-modal-quantity').value) || 1;

    if (!empId) {
        showToast("Seleziona il tuo nome prima di procedere!", "warning");
        return;
    }

    if (type === 'inv_yj' || type === 'inv_fen') {
        const action = document.getElementById('smart-modal-action').value;
        const reason = document.getElementById('smart-modal-reason').value.trim();
        const collectionItems = type === 'inv_yj' ? 'inventory_items' : 'fenici_items';
        const collectionLogs = type === 'inv_yj' ? 'inventory_logs' : 'fenici_logs';
        const localData = type === 'inv_yj' ? localInventoryYJ : localInventoryFen;
        const item = localData[itemId];
        if (!item) return;

        let newQty = item.quantity;
        if (action === 'preleva') {
            if (qty > item.quantity) {
                showToast(`Impossibile prelevare ${qty}, disponibile: ${item.quantity}.`, "error");
                return;
            }
            newQty -= qty;
        } else {
            newQty += qty;
        }

        const empName = localEmployees[empId] ? localEmployees[empId].name : 'Dipendente';
        const batch = db.batch();
        const itemRef = db.collection(collectionItems).doc(itemId);
        const logRef = db.collection(collectionLogs).doc();
        batch.update(itemRef, { quantity: newQty });
        batch.set(logRef, {
            timestamp: Date.now(),
            dateString: new Date().toLocaleString('it-IT'),
            employeeId: empId,
            employeeName: empName,
            itemId: itemId,
            itemName: item.name,
            action: action,
            quantity: qty,
            reason: reason
        });
        batch.commit().then(() => {
            closeSmartModal();
            showToast(`Movimento completato!`, "success");
        }).catch(err => showToast("Errore: " + err.message, "error"));

    } else if (type.startsWith('sale_')) {
        const isYJ = type.includes('_yj');
        const salesCollection = 'current_sales';
        const catalog = localCatalogYJ;

        let saleData = {
            timestamp: Date.now(),
            dateString: new Date().toLocaleString('it-IT'),
            employeeKey: empId,
            employeeName: localEmployees[empId].name,
            quantity: qty,
            activity: 'importale'
        };

        const empPct = localEmployees[empId].customPercentage ? parseFloat(localEmployees[empId].customPercentage) : 40;
        saleData.appliedPercentage = empPct;

        if (type.includes('custom')) {
            const name = document.getElementById('smart-modal-custom-name').value.trim();
            const unitPrice = parseFloat(document.getElementById('smart-modal-price').value);
            if (!name || isNaN(unitPrice) || unitPrice < 0) {
                showToast("Compila nome e prezzo.", "warning");
                return;
            }
            const finalTotalPrice = unitPrice * qty;
            const employeeGain = (finalTotalPrice * empPct) / 100;
            const yellowGain = finalTotalPrice - employeeGain;
            saleData.serviceName = "[LIBERO] " + name;
            saleData.totalPrice = finalTotalPrice;
            saleData.isFreeSale = true;
            saleData.yellowCost = 0;
            saleData.yellowGain = yellowGain;
            saleData.employeeGain = employeeGain;
            saleData.appliedPercentage = empPct;
        } else {
            const item = catalog[itemId];
            const finalTotalPrice = item.price * qty;
            const employeeGain = (finalTotalPrice * empPct) / 100;
            const yellowGain = finalTotalPrice - employeeGain;
            saleData.serviceName = item.name;
            saleData.totalPrice = finalTotalPrice;
            saleData.yellowCost = 0;
            saleData.yellowGain = yellowGain;
            saleData.employeeGain = employeeGain;
        }

        // Accredita sul saldo SOLO il guadagno azienda (yellowGain), non la spettanza dipendente
        const yellowGain = saleData.yellowGain || 0;
        const operatorName = localEmployees[empId]?.name || 'Dipendente';
        const now = Date.now();
        const batch = db.batch();
        const saleRef = db.collection(salesCollection).doc();
        batch.set(saleRef, saleData);

        if (yellowGain > 0) {
            const prev = (localBalance && typeof localBalance.amount === 'number') ? localBalance.amount : 0;
            const newAmount = prev + yellowGain;
            batch.set(db.collection('balance').doc('current'), {
                amount: newAmount,
                updatedAt: now,
                updatedBy: operatorName
            }, { merge: true });
            const qtyLabel = qty > 1 ? ' x' + qty : '';
            batch.set(db.collection('balance_logs').doc(), {
                timestamp: now,
                dateString: new Date(now).toLocaleString('it-IT'),
                operatorName: operatorName,
                employeeId: empId,
                type: 'vendita',
                prevAmount: prev,
                newAmount: newAmount,
                delta: yellowGain,
                note: 'Vendita: ' + saleData.serviceName + qtyLabel
            });
        }

        batch.commit()
            .then(() => {
                closeSmartModal();
                showToast("Vendita registrata!" + (yellowGain > 0 ? " (+ " + formatValuta(yellowGain) + " in cassa)" : ""), "success");
            })
            .catch(err => showToast("Errore: " + err.message, "error"));
    }
});

// --- MANUTENZIONE ---
(function() {
    const manutenzioneDiv = document.getElementById('schermata-manutenzione');
    function controllaStatoManutenzione() {
        fetch('status.txt?t=' + new Date().getTime())
            .then(response => {
                if (!response.ok) throw new Error('File status non trovato');
                return response.text();
            })
            .then(stato => {
                const statoPulito = stato.trim().toLowerCase();
                manutenzioneDiv.style.display = (statoPulito === 'on') ? 'flex' : 'none';
            })
            .catch(err => console.log('Errore controllo manutenzione:', err));
    }
    controllaStatoManutenzione();
    setInterval(controllaStatoManutenzione, 5000);
})();


const loginStaffForm = document.getElementById('login-staff-form');
const loginGestoreForm = document.getElementById('login-gestore-form');
const loginStaffPanel = document.getElementById('login-staff-panel');
const loginGestorePanel = document.getElementById('login-gestore-panel');

// Toggle pannelli login
document.getElementById('show-gestore-login')?.addEventListener('click', () => {
    loginStaffPanel.classList.add('hidden');
    loginGestorePanel.classList.remove('hidden');
});
document.getElementById('show-staff-login')?.addEventListener('click', () => {
    loginGestorePanel.classList.add('hidden');
    loginStaffPanel.classList.remove('hidden');
});

// --- LOGIN STAFF (nickname / login + password, SENZA auth anonima) ---
function applyStaffSession(session, employeeData) {
    staffSession = session;
    currentEmployeeId = session.id;
    currentEmployeeData = employeeData || null;
    userRole = 'dipendente';
    sessionStorage.setItem('fenici_staff_session', JSON.stringify(session));
    setupUIForRole();
    initDatabaseListeners();
    loginPage.classList.add('hidden');
    mainDashboard.classList.remove('hidden');
}

function tryRestoreStaffSession() {
    if (userRole === 'gestore') return false;
    const saved = sessionStorage.getItem('fenici_staff_session');
    if (!saved) return false;
    try {
        const session = JSON.parse(saved);
        if (!session || !session.id) return false;
        applyStaffSession(session, null);
        return true;
    } catch (_) {
        sessionStorage.removeItem('fenici_staff_session');
        return false;
    }
}

loginStaffForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nick = document.getElementById('staff-login').value.trim();
    const password = document.getElementById('staff-password').value;

    if (!nick || !password) {
        showToast("Inserisci nickname e password.", "warning");
        return;
    }

    const btn = loginStaffForm.querySelector('button[type="submit"]');
    const prevBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Accesso...';
    }

    try {
        // Nessuna Auth Firebase: lettura diretta employees (regole: allow read pubblici)
        const snap = await db.collection('employees').get();
        const nickLower = nick.toLowerCase();
        let found = null;
        let foundId = null;

        snap.forEach(doc => {
            const d = doc.data();
            const loginMatch = (d.login || '').trim().toLowerCase() === nickLower;
            const nameMatch = (d.name || '').trim().toLowerCase() === nickLower;
            if ((loginMatch || nameMatch) && String(d.password) === String(password)) {
                found = d;
                foundId = doc.id;
            }
        });

        if (!found) {
            showToast("Nickname o password non validi.", "error");
            if (btn) { btn.disabled = false; btn.innerHTML = prevBtnHtml; }
            return;
        }

        applyStaffSession({
            id: foundId,
            name: found.name,
            login: found.login || found.name,
            roles: found.roles || { salesYJ: true, invYJ: true },
            customPercentage: found.customPercentage || 40
        }, found);

        showToast(`Benvenuto, ${found.name}!`, "success");
        if (btn) { btn.disabled = false; btn.innerHTML = prevBtnHtml; }
    } catch (err) {
        console.error('Login staff error:', err);
        const msg = (err && String(err.code || err.message || '').includes('permission'))
            ? "Permesso negato su employees. Aggiorna le regole Firestore (read pubblico su employees)."
            : ("Errore di accesso: " + (err.message || err));
        showToast(msg, "error");
        if (btn) { btn.disabled = false; btn.innerHTML = prevBtnHtml; }
    }
});

// --- LOGIN GESTORE (Firebase Auth email) ---
loginGestoreForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('gestore-email').value.trim();
    const password = document.getElementById('gestore-password').value;

    if (email !== 'importaleombre.gestore@horde.it') {
        showToast("Accesso gestore non autorizzato.", "error");
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            staffSession = null;
            currentEmployeeId = null;
            sessionStorage.removeItem('fenici_staff_session');
            showToast("Accesso Gestore effettuato!", "success");
        })
        .catch(err => showToast("Errore di accesso: " + err.message, "error"));
});

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        // Solo gestore usa Firebase Auth (email)
        if (user.email === 'importaleombre.gestore@horde.it') {
            userRole = 'gestore';
            staffSession = null;
            currentEmployeeId = null;
            currentEmployeeData = null;
            sessionStorage.removeItem('fenici_staff_session');
            setupUIForRole();
            initDatabaseListeners();
            loginPage.classList.add('hidden');
            mainDashboard.classList.remove('hidden');
        } else if (user.isAnonymous) {
            // Non usiamo più auth anonima: esci e lascia il login staff senza Auth
            auth.signOut().catch(() => {});
        } else {
            auth.signOut();
            showToast("Accesso non autorizzato.", "error");
        }
    } else {
        currentUser = null;
        // Staff non ha Firebase Auth: ripristina sessione locale se presente
        if (tryRestoreStaffSession()) {
            return;
        }
        // Nessun gestore e nessuno staff → schermata login
        if (userRole !== 'dipendente') {
            userRole = null;
            staffSession = null;
            currentEmployeeId = null;
            currentEmployeeData = null;
            loginPage.classList.remove('hidden');
            mainDashboard.classList.add('hidden');
        }
    }
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('fenici_staff_session');
    staffSession = null;
    currentEmployeeId = null;
    currentEmployeeData = null;
    userRole = null;
    if (auth.currentUser) {
        auth.signOut().then(() => window.location.reload());
    } else {
        window.location.reload();
    }
});

// Ripristino staff al caricamento (prima che Auth risponda)
tryRestoreStaffSession();

function setupUIForRole() {
    const isGestore = userRole === 'gestore';

    if (isGestore) {
        roleBadge.textContent = 'GESTORE';
        roleBadge.className = "px-3 py-1 badge-gestore text-xs font-semibold rounded-full";
    } else {
        roleBadge.textContent = (staffSession?.name || 'STAFF').toUpperCase();
        roleBadge.className = "px-3 py-1 bg-purple-500/20 text-xs font-semibold rounded-full text-purple-300 border border-purple-500/30";
    }

    const show = (btn, visible) => {
        if (!btn) return;
        if (visible) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    };

    // Vendite + Inventario + Saldo per tutti; Gestione solo gestore
    show(navSalesYjBtn, true);
    show(navInventoryYjBtn, true);
    show(navSaldoBtn, true);
    show(navAdminBtn, isGestore);
    if (navSalesFenBtn) navSalesFenBtn.classList.add('hidden');
    if (navInventoryFenBtn) navInventoryFenBtn.classList.add('hidden');

    const adminYj = document.getElementById('admin-inventory-yj-controls');
    if (adminYj) adminYj.classList.toggle('hidden', !isGestore);

    if (inventoryYjSection) inventoryYjSection.classList.toggle('staff-centered', !isGestore);

    document.getElementById('manager-sales-archive-yj-section')?.classList.toggle('hidden', !isGestore);
    document.getElementById('sales-yj-employee-filter')?.classList.toggle('hidden', !isGestore);

    showSection('sales-yj');
}

// --- NAVIGAZIONE ---
navSalesYjBtn.addEventListener('click', () => showSection('sales-yj'));
if (navSalesFenBtn) navSalesFenBtn.addEventListener('click', () => showSection('sales-fen'));
navInventoryYjBtn.addEventListener('click', () => showSection('inventory-yj'));
if (navInventoryFenBtn) navInventoryFenBtn.addEventListener('click', () => showSection('inventory-fen'));
if (navSaldoBtn) navSaldoBtn.addEventListener('click', () => showSection('saldo'));
navAdminBtn.addEventListener('click', () => showSection('admin'));

let currentSectionId = 'sales-yj';

function isSectionVisible(section) {
    return currentSectionId === section;
}
function isAdminOpen() {
    return currentSectionId === 'admin' && userRole === 'gestore';
}
function scheduleUI(fn, delay) {
    const run = function () {
        try { fn(); } catch (e) { console.error(e); }
    };
    if (delay && delay > 0) {
        setTimeout(function () {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 600 });
            else run();
        }, delay);
    } else if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 400 });
    } else {
        setTimeout(run, 0);
    }
}

function refreshActiveSectionUI() {
    switch (currentSectionId) {
        case 'sales-yj':
            if (typeof renderQuickSalesYjGrid === 'function') renderQuickSalesYjGrid();
            if (typeof renderSalesYjTable === 'function') renderSalesYjTable();
            if (typeof renderSalesYjDropdowns === 'function') renderSalesYjDropdowns();
            if (typeof renderSalesArchiveWindowYJ === 'function') renderSalesArchiveWindowYJ(localArchive);
            break;
        case 'sales-fen':
            if (typeof renderQuickSalesFenGrid === 'function') renderQuickSalesFenGrid();
            if (typeof renderSalesFenTable === 'function') renderSalesFenTable();
            if (typeof renderSalesFenDropdowns === 'function') renderSalesFenDropdowns();
            if (typeof renderSalesArchiveWindowFen === 'function') renderSalesArchiveWindowFen(localArchive);
            break;
        case 'inventory-yj':
            if (typeof renderStashDropdowns === 'function') renderStashDropdowns();
            if (typeof renderInventoryYjGrid === 'function') renderInventoryYjGrid();
            if (typeof renderInventoryYjDropdowns === 'function') renderInventoryYjDropdowns();
            if (typeof renderInventoryYjLogs === 'function') renderInventoryYjLogs();
            break;
        case 'inventory-fen':
            if (typeof renderStashDropdowns === 'function') renderStashDropdowns();
            if (typeof renderInventoryFenGrid === 'function') renderInventoryFenGrid();
            if (typeof renderInventoryFenDropdowns === 'function') renderInventoryFenDropdowns();
            if (typeof renderInventoryFenLogs === 'function') renderInventoryFenLogs();
            break;
        case 'saldo':
            if (typeof renderSaldoUI === 'function') renderSaldoUI();
            break;
        case 'admin':
            if (typeof renderCatalogYJ === 'function') renderCatalogYJ();
            if (typeof renderSaldoUI === 'function') renderSaldoUI();
            if (typeof renderCatalogFen === 'function') renderCatalogFen();
            if (typeof renderEmployees === 'function') renderEmployees();
            if (typeof renderCustomStashesList === 'function') renderCustomStashesList();
            if (typeof calculateManagementData === 'function') calculateManagementData();
            if (typeof renderArchive === 'function') renderArchive(localArchive);
            if (typeof renderItemImagesLibrary === 'function') renderItemImagesLibrary();
            if (typeof renderItemImageSelects === 'function') renderItemImageSelects();
            break;
        default:
            break;
    }
}

function showSection(section) {
    currentSectionId = section;
    [salesYjSection, salesFenSection, inventoryYjSection, inventoryFenSection, saldoSection, adminSection].forEach(s => s && s.classList.add('hidden'));
    
    const inactiveClass = "px-3 py-2 rounded-xl bg-gray-700 text-gray-200 font-medium transition hover:bg-gray-600 text-sm";
    const activeClass = "px-3 py-2 rounded-xl nav-active font-medium transition text-sm";
    
    [navSalesYjBtn, navSalesFenBtn, navInventoryYjBtn, navInventoryFenBtn, navSaldoBtn, navAdminBtn].forEach(b => {
        if (!b) return;
        const wasHidden = b.classList.contains('hidden');
        b.className = inactiveClass + (wasHidden ? ' hidden' : '');
    });

    if (section === 'sales-yj') {
        salesYjSection.classList.remove('hidden');
        navSalesYjBtn.className = activeClass;
    } else if (section === 'sales-fen') {
        if (salesFenSection) salesFenSection.classList.remove('hidden');
        if (navSalesFenBtn) navSalesFenBtn.className = activeClass;
    } else if (section === 'inventory-yj') {
        inventoryYjSection.classList.remove('hidden');
        navInventoryYjBtn.className = activeClass;
    } else if (section === 'inventory-fen') {
        if (inventoryFenSection) inventoryFenSection.classList.remove('hidden');
        if (navInventoryFenBtn) navInventoryFenBtn.className = activeClass;
    } else if (section === 'saldo') {
        if (saldoSection) saldoSection.classList.remove('hidden');
        if (navSaldoBtn) navSaldoBtn.className = activeClass;
    } else if (section === 'admin') {
        adminSection.classList.remove('hidden');
        navAdminBtn.className = activeClass;
    }

    // Disegna solo la sezione aperta (dati già in memoria)
    scheduleUI(function () { refreshActiveSectionUI(); });
}

// --- LISTENERS FIRESTORE (avvio a fasi + render solo sezione attiva) ---
let listenersStarted = false;

function initDatabaseListeners() {
    if (listenersStarted) return;
    listenersStarted = true;

    // FASE 1: essenziali subito
    db.collection('employees').onSnapshot(snapshot => {
        localEmployees = {};
        snapshot.forEach(doc => { localEmployees[doc.id] = doc.data(); });
        scheduleUI(function () {
            if (typeof renderAllEmployeeDropdowns === 'function') renderAllEmployeeDropdowns();
            if (typeof renderAdminFilterDropdown === 'function') renderAdminFilterDropdown();
            if (isAdminOpen() && typeof renderEmployees === 'function') renderEmployees();
        });
    });

    
    db.collection('balance').doc('current').onSnapshot(doc => {
        if (doc.exists) {
            localBalance = doc.data() || { amount: 0 };
        } else {
            localBalance = { amount: 0, updatedAt: null, updatedBy: null };
        }
        scheduleUI(function () {
            if (typeof renderSaldoUI === 'function') renderSaldoUI();
        });
    }, err => console.warn('balance listener', err));

    db.collection('balance_logs').orderBy('timestamp', 'desc').limit(80).onSnapshot(snapshot => {
        localBalanceLogs = [];
        snapshot.forEach(doc => localBalanceLogs.push({ id: doc.id, ...doc.data() }));
        scheduleUI(function () {
            if (typeof renderSaldoUI === 'function') renderSaldoUI();
        });
    }, err => console.warn('balance_logs listener', err));

    db.collection('catalog').onSnapshot(snapshot => {
        localCatalogYJ = {};
        snapshot.forEach(doc => { localCatalogYJ[doc.id] = doc.data(); });
        scheduleUI(function () {
            if (isSectionVisible('sales-yj')) {
                if (typeof renderSalesYjDropdowns === 'function') renderSalesYjDropdowns();
                if (typeof renderQuickSalesYjGrid === 'function') renderQuickSalesYjGrid();
            }
            if (isAdminOpen() && typeof renderCatalogYJ === 'function') renderCatalogYJ();
        });
    });

    db.collection('catalog_fen').onSnapshot(snapshot => {
        localCatalogFen = {};
        snapshot.forEach(doc => { localCatalogFen[doc.id] = doc.data(); });
        scheduleUI(function () {
            if (isSectionVisible('sales-fen')) {
                if (typeof renderSalesFenDropdowns === 'function') renderSalesFenDropdowns();
                if (typeof renderQuickSalesFenGrid === 'function') renderQuickSalesFenGrid();
            }
            if (isAdminOpen() && typeof renderCatalogFen === 'function') renderCatalogFen();
        });
    });

    // FASE 2: vendite / depositi
    setTimeout(function () {
        db.collection('custom_stashes').onSnapshot(snapshot => {
            localStashes = {};
            snapshot.forEach(doc => { localStashes[doc.id] = doc.data(); });
            scheduleUI(function () {
                if (typeof renderStashDropdowns === 'function') renderStashDropdowns();
                if (isAdminOpen() && typeof renderCustomStashesList === 'function') renderCustomStashesList();
                if (isSectionVisible('inventory-yj') && typeof renderInventoryYjGrid === 'function') renderInventoryYjGrid();
                if (isSectionVisible('inventory-fen') && typeof renderInventoryFenGrid === 'function') renderInventoryFenGrid();
            });
        });

        db.collection('current_sales').onSnapshot(snapshot => {
            localSalesYJ = {};
            snapshot.forEach(doc => { localSalesYJ[doc.id] = doc.data(); });
            scheduleUI(function () {
                if (isSectionVisible('sales-yj') && typeof renderSalesYjTable === 'function') renderSalesYjTable();
                if (isAdminOpen() && typeof calculateManagementData === 'function') calculateManagementData();
            });
        });

        db.collection('current_sales_fen').onSnapshot(snapshot => {
            localSalesFen = {};
            snapshot.forEach(doc => { localSalesFen[doc.id] = doc.data(); });
            scheduleUI(function () {
                if (isSectionVisible('sales-fen') && typeof renderSalesFenTable === 'function') renderSalesFenTable();
                if (isAdminOpen() && typeof calculateManagementData === 'function') calculateManagementData();
            });
        });

        db.collection('current_salaries_status').onSnapshot(snapshot => {
            localSalariesStatus = {};
            snapshot.forEach(doc => { localSalariesStatus[doc.id] = doc.data().status || 'non_pagato'; });
            scheduleUI(function () {
                if (isAdminOpen() && typeof calculateManagementData === 'function') calculateManagementData();
            });
        });
    }, 80);

    // FASE 3: inventari
    setTimeout(function () {
        db.collection('inventory_items').onSnapshot(snapshot => {
            localInventoryYJ = {};
            snapshot.forEach(doc => { localInventoryYJ[doc.id] = doc.data(); });
            scheduleUI(function () {
                if (isSectionVisible('inventory-yj')) {
                    if (typeof renderInventoryYjGrid === 'function') renderInventoryYjGrid();
                    if (typeof renderInventoryYjDropdowns === 'function') renderInventoryYjDropdowns();
                }
            });
        });

        db.collection('inventory_logs').orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
            localInventoryYJLogs = [];
            snapshot.forEach(doc => { localInventoryYJLogs.push({ id: doc.id, ...doc.data() }); });
            scheduleUI(function () {
                if (isSectionVisible('inventory-yj') && typeof renderInventoryYjLogs === 'function') renderInventoryYjLogs();
            });
        });

        db.collection('fenici_items').onSnapshot(snapshot => {
            localInventoryFen = {};
            snapshot.forEach(doc => { localInventoryFen[doc.id] = doc.data(); });
            scheduleUI(function () {
                if (isSectionVisible('inventory-fen')) {
                    if (typeof renderInventoryFenGrid === 'function') renderInventoryFenGrid();
                    if (typeof renderInventoryFenDropdowns === 'function') renderInventoryFenDropdowns();
                }
            });
        });

        db.collection('fenici_logs').orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
            localInventoryFenLogs = [];
            snapshot.forEach(doc => { localInventoryFenLogs.push({ id: doc.id, ...doc.data() }); });
            scheduleUI(function () {
                if (isSectionVisible('inventory-fen') && typeof renderInventoryFenLogs === 'function') renderInventoryFenLogs();
            });
        });
    }, 200);

    // FASE 4: archivio + immagini (più pesanti)
    setTimeout(function () {
        db.collection('archive').onSnapshot(snapshot => {
            localArchive = {};
            snapshot.forEach(doc => { localArchive[doc.id] = doc.data(); });
            scheduleUI(function () {
                if (isSectionVisible('sales-yj') && typeof renderSalesArchiveWindowYJ === 'function') renderSalesArchiveWindowYJ(localArchive);
                if (isSectionVisible('sales-fen') && typeof renderSalesArchiveWindowFen === 'function') renderSalesArchiveWindowFen(localArchive);
                if (isAdminOpen() && typeof renderArchive === 'function') renderArchive(localArchive);
            });
        });

        db.collection('item_images').onSnapshot(snapshot => {
            localItemImages = {};
            snapshot.forEach(doc => { localItemImages[doc.id] = doc.data(); });
            scheduleUI(function () {
                if (typeof renderItemImageSelects === 'function') renderItemImageSelects();
                if (isAdminOpen() && typeof renderItemImagesLibrary === 'function') renderItemImagesLibrary();
                // se sei in inventario, rinfresca griglia (icone)
                if (isSectionVisible('inventory-yj') && typeof renderInventoryYjGrid === 'function') renderInventoryYjGrid();
                if (isSectionVisible('inventory-fen') && typeof renderInventoryFenGrid === 'function') renderInventoryFenGrid();
            }, 40);
        });
    }, 350);
}

// Protezione
document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function(e) {
    if (e.keyCode == 123) return false;
    if (e.ctrlKey && e.shiftKey && (e.keyCode == 'I'.charCodeAt(0) || e.keyCode == 'C'.charCodeAt(0) || e.keyCode == 'J'.charCodeAt(0))) return false;
    if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false;
};

// --- STASH DROPDOWNS ---
function renderStashDropdowns() {
    const yjAdmin = document.getElementById('inv-yj-admin-stash');
    const fenAdmin = document.getElementById('inv-fen-admin-stash');
    const yjFilter = document.getElementById('inv-yj-stash-filter');
    const fenFilter = document.getElementById('inv-fen-stash-filter');

    function optionsFor(activity) {
        // activity: 'yj' | 'fen'
        let opts = '';
        Object.keys(localStashes).forEach(key => {
            const s = localStashes[key];
            const showYJ = s.showYJ !== false; // default true se non specificato
            const showFen = s.showFen !== false;
            if (activity === 'yj' && !showYJ) return;
            if (activity === 'fen' && !showFen) return;
            opts += `<option value="${key}">${s.name}</option>`;
        });
        return opts;
    }

    if (yjAdmin) {
        const v = yjAdmin.value;
        const opts = optionsFor('yj');
        yjAdmin.innerHTML = opts || '<option value="">Nessun deposito</option>';
        if (v && [...yjAdmin.options].some(o => o.value === v)) yjAdmin.value = v;
    }
    if (fenAdmin) {
        const v = fenAdmin.value;
        const opts = optionsFor('fen');
        fenAdmin.innerHTML = opts || '<option value="">Nessun deposito</option>';
        if (v && [...fenAdmin.options].some(o => o.value === v)) fenAdmin.value = v;
    }
    if (yjFilter) {
        const v = yjFilter.value;
        yjFilter.innerHTML = '<option value="all">Tutti i Depositi</option>' + optionsFor('yj');
        if (v) yjFilter.value = v;
    }
    if (fenFilter) {
        const v = fenFilter.value;
        fenFilter.innerHTML = '<option value="all">Tutti i Depositi</option>' + optionsFor('fen');
        if (v) fenFilter.value = v;
    }
}

function renderCustomStashesList() {
    const list = document.getElementById('custom-stashes-list');
    if (!list) return;
    const keys = Object.keys(localStashes);
    if (keys.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-500 italic">Nessun deposito personalizzato. Creane uno sopra.</p>';
        return;
    }
    list.innerHTML = '';
    keys.forEach(key => {
        const s = localStashes[key];
        const name = s.name || key;
        const hasFlags = ('showYJ' in s) || ('showFen' in s);
        let badges = '';
        if (!hasFlags) {
            badges = '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">YJ</span> <span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">Fenici</span>';
        } else {
            if (s.showYJ) badges += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">YJ</span> ';
            if (s.showFen) badges += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">Fenici</span>';
        }
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-3 px-3 py-2 bg-gray-900/80 border border-gray-700 rounded-xl';
        row.innerHTML = `
            <div class="min-w-0 flex-1">
                <span class="text-sm text-gray-200 font-medium truncate block"><i class="fa-solid fa-warehouse text-amber-500/70 mr-2"></i></span>
                <div class="mt-1 flex flex-wrap gap-1">${badges}</div>
            </div>
            <button type="button" class="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition shrink-0" title="Elimina deposito">
                <i class="fa-solid fa-trash text-xs"></i>
            </button>`;
        row.querySelector('span.text-sm').appendChild(document.createTextNode(name));
        row.querySelector('button').addEventListener('click', () => window.deleteCustomStash(key, name));
        list.appendChild(row);
    });
}

window.deleteCustomStash = function(id, name) {
    showConfirmModal(
        "Elimina deposito",
        'Vuoi eliminare il deposito "' + name + '"? Gli oggetti già assegnati a questo deposito manterranno il riferimento, ma non comparirà più tra le opzioni.',
        () => {
            db.collection('custom_stashes').doc(id).delete()
                .then(() => showToast("Deposito eliminato.", "info"))
                .catch(err => showToast("Errore: " + err.message, "error"));
        },
        true
    );
};

const stashForm = document.getElementById('stash-form');
if (stashForm) {
    stashForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('stash-name').value.trim();
        if (!name) {
            showToast("Inserisci un nome per il deposito.", "warning");
            return;
        }
        const showYJ = true;
        const showFen = false;
        if (!showYJ && !showFen) {
            showToast("Seleziona almeno un inventario (YJ o Fenici).", "warning");
            return;
        }
        db.collection('custom_stashes').add({ name, showYJ, showFen })
            .then(() => {
                stashForm.reset();
                const yj = document.getElementById('stash-show-yj');
                const fen = document.getElementById('stash-show-fen');
                if (yj) yj.checked = true;
                if (fen) fen.checked = false;
                showToast("Deposito creato!", "success");
            })
            .catch(err => showToast("Errore: " + err.message, "error"));
    });
}

// --- LIBRERIA IMMAGINI ITEM (onclick sul bottone, niente form) ---
const MAX_ITEM_IMAGE_BYTES = 400 * 1024;

function renderItemImageSelects() {
    const opts = ['<option value="">— Nessuna / placeholder —</option>'];
    Object.keys(localItemImages).sort(function (a, b) {
        return (localItemImages[a].fileName || '').localeCompare(localItemImages[b].fileName || '', undefined, { sensitivity: 'base' });
    }).forEach(function (id) {
        opts.push('<option value="' + id + '">' + (localItemImages[id].fileName || id) + '</option>');
    });
    const htmlOpts = opts.join('');
    ['inv-yj-admin-img', 'inv-fen-admin-img'].forEach(function (selId) {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = htmlOpts;
        if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === prev; })) sel.value = prev;
    });
}

function renderItemImagesLibrary() {
    const grid = document.getElementById('item-images-grid');
    if (!grid) return;
    const keys = Object.keys(localItemImages);
    if (keys.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-xs text-gray-500 italic">Nessuna immagine caricata.</p>';
        return;
    }
    keys.sort(function (a, b) { return (localItemImages[b].createdAt || 0) - (localItemImages[a].createdAt || 0); });
    grid.innerHTML = '';
    keys.forEach(function (id) {
        const img = localItemImages[id];
        const name = img.fileName || 'file.png';
        const card = document.createElement('div');
        card.className = 'relative bg-gray-900 border border-gray-700 rounded-xl overflow-hidden group';
        card.innerHTML =
            '<div class="h-20 flex items-center justify-center bg-gray-950 p-2">' +
            '<img src="' + (img.dataUrl || '') + '" alt="" class="max-h-full max-w-full object-contain">' +
            '</div><div class="p-2 border-t border-gray-800">' +
            '<p class="text-[11px] text-amber-400 font-mono truncate">' + name + '</p></div>' +
            '<button type="button" class="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-lg text-[10px] opacity-0 group-hover:opacity-100 transition" title="Elimina"><i class="fa-solid fa-trash"></i></button>';
        card.querySelector('button').addEventListener('click', function () {
            showConfirmModal('Elimina immagine', 'Rimuovere "' + name + '" dalla libreria?', function () {
                db.collection('item_images').doc(id).delete()
                    .then(function () { showToast('Immagine rimossa.', 'info'); })
                    .catch(function (err) { showToast(err.message, 'error'); });
            }, true);
        });
        grid.appendChild(card);
    });
}

function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(new Error('Lettura fallita: ' + file.name)); };
        reader.readAsDataURL(file);
    });
}

window.uploadItemImagesFromInput = async function uploadItemImagesFromInput() {
    console.log('[Fenici] upload immagini avviato', { role: userRole });
    try {
        if (userRole !== 'gestore') {
            showToast('Solo il gestore può caricare immagini. Accedi come gestore.', 'error');
            return;
        }
        var fileInput = document.getElementById('item-image-file');
        var files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
        if (files.length === 0) {
            showToast('Seleziona uno o più file PNG prima di caricare.', 'warning');
            return;
        }

        var btn = document.getElementById('item-image-upload-btn');
        var statusEl = document.getElementById('item-image-status');
        var prevHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Carico...';
        }
        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.textContent = 'Caricamento in corso...';
        }

        var ok = 0, skip = 0, fail = 0;
        var existingNames = new Set(
            Object.values(localItemImages).map(function (i) { return (i.fileName || '').toLowerCase(); })
        );

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> ' + (i + 1) + '/' + files.length;
            if (statusEl) statusEl.textContent = 'Carico ' + (i + 1) + ' di ' + files.length + ': ' + file.name;

            var isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
            if (!isPng) { skip++; continue; }
            if (file.size > MAX_ITEM_IMAGE_BYTES) {
                showToast('"' + file.name + '" troppo grande (' + Math.round(file.size / 1024) + ' KB). Max 400 KB.', 'warning');
                skip++;
                continue;
            }
            var baseName = file.name.replace(/[^\w.\-()+ ]+/g, '_');
            if (existingNames.has(baseName.toLowerCase())) {
                showToast('"' + baseName + '" già in libreria, saltato.', 'info');
                skip++;
                continue;
            }
            try {
                var dataUrl = await readFileAsDataURL(file);
                await db.collection('item_images').add({
                    fileName: baseName,
                    dataUrl: dataUrl,
                    size: file.size,
                    createdAt: Date.now()
                });
                existingNames.add(baseName.toLowerCase());
                ok++;
            } catch (err) {
                fail++;
                console.error(err);
                var msg = (err && err.message) ? err.message : String(err);
                if (msg.indexOf('permission') !== -1 || (err && err.code === 'permission-denied')) {
                    showToast('Permesso negato su item_images. Controlla le regole Firestore e di essere loggato come gestore.', 'error');
                } else {
                    showToast('Errore su "' + file.name + '": ' + msg, 'error');
                }
            }
        }

        if (fileInput) fileInput.value = '';
        if (btn) { btn.disabled = false; btn.innerHTML = prevHtml; }
        if (statusEl) {
            statusEl.textContent = ok > 0
                ? ('Completato: ' + ok + ' caricate' + (skip ? ', ' + skip + ' saltate' : '') + '.')
                : 'Nessuna immagine nuova caricata.';
        }

        if (ok > 0) showToast('Caricate ' + ok + ' immagini' + (skip ? ' (' + skip + ' saltate)' : '') + '.', 'success');
        else if (skip > 0 && fail === 0) showToast('Nessuna nuova immagine (già presenti o non valide).', 'warning');
        else if (fail > 0) showToast('Caricamento fallito. Vedi console (F12).', 'error');
    } catch (err) {
        console.error('uploadItemImagesFromInput', err);
        showToast('Errore upload: ' + ((err && err.message) || err), 'error');
        var btn2 = document.getElementById('item-image-upload-btn');
        if (btn2) {
            btn2.disabled = false;
            btn2.innerHTML = '<i class="fa-solid fa-upload mr-1"></i> Carica PNG';
        }
    }
};


// --- EMPLOYEE DROPDOWNS ---
function renderAllEmployeeDropdowns() {
    let opts = '<option value="">-- Seleziona Operatore --</option>';
    Object.keys(localEmployees).forEach(key => {
        opts += `<option value="${key}">${localEmployees[key].name}</option>`;
    });
    ['sale-yj-employee', 'sale-fen-employee', 'inv-yj-emp-select', 'inv-fen-emp-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
    if (typeof fillSaldoMovEmployeeSelect === 'function') fillSaldoMovEmployeeSelect();
}

function renderAdminFilterDropdown() {
    const current = adminEmployeeFilter ? adminEmployeeFilter.value : 'all';
    if (adminEmployeeFilter) {
        adminEmployeeFilter.innerHTML = '<option value="all">📊 MOSTRA TUTTO LO STAFF</option>';
        Object.keys(localEmployees).forEach(key => {
            adminEmployeeFilter.innerHTML += `<option value="${key}">👤 ${localEmployees[key].name}</option>`;
        });
        adminEmployeeFilter.value = current;
    }
    // Filters for sales tables
    ['sales-yj-employee-filter', 'sales-fen-employee-filter', 'archive-window-yj-employee-filter', 'archive-window-fen-employee-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const cur = el.value;
            el.innerHTML = '<option value="all">📊 Tutti i Dipendenti</option>';
            Object.keys(localEmployees).forEach(key => {
                el.innerHTML += `<option value="${key}">👤 ${localEmployees[key].name}</option>`;
            });
            el.value = cur || 'all';
        }
    });
}

if (adminEmployeeFilter) adminEmployeeFilter.addEventListener('change', calculateManagementData);
document.getElementById('sales-yj-employee-filter')?.addEventListener('change', renderSalesYjTable);
document.getElementById('sales-fen-employee-filter')?.addEventListener('change', renderSalesFenTable);
document.getElementById('archive-window-yj-employee-filter')?.addEventListener('change', () => renderSalesArchiveWindowYJ(localArchive));
document.getElementById('archive-window-fen-employee-filter')?.addEventListener('change', () => renderSalesArchiveWindowFen(localArchive));

// --- QUICK SALES GRIDS ---
function renderQuickSalesYjGrid() {
    const container = document.getElementById('quick-sales-yj-grid');
    if (!container) return;
    container.innerHTML = `
        <div onclick="openSmartModal('sale_custom_yj', null)" class="bg-gray-800/80 border border-gray-600 rounded-xl p-4 cursor-pointer hover:border-amber-500 transition-all flex flex-col items-center justify-center text-center group min-h-[110px] shadow-lg">
            <div class="h-10 w-10 bg-amber-500/10 rounded-full flex items-center justify-center mb-2 group-hover:bg-amber-500 transition-colors">
                <i class="fa-solid fa-plus text-xl text-amber-500 group-hover:text-gray-900"></i>
            </div>
            <span class="font-extrabold text-amber-400 text-xs uppercase">Vendita Libera</span>
        </div>
    `;
    Object.keys(localCatalogYJ).forEach(key => {
        const item = localCatalogYJ[key];
        container.innerHTML += `
            <div onclick="openSmartModal('sale_catalog_yj', '${key}')" class="bg-gray-800/80 border border-gray-600 rounded-xl p-4 cursor-pointer hover:border-emerald-500 transition-all flex flex-col items-center justify-center text-center group min-h-[110px] shadow-lg">
                <i class="fa-solid fa-tag text-2xl text-gray-500 mb-2 group-hover:text-emerald-400"></i>
                <span class="font-bold text-gray-200 text-sm leading-tight">${item.name}</span>
                <span class="text-emerald-400 text-xs font-bold mt-1 bg-emerald-400/10 px-2 py-0.5 rounded">${formatValuta(item.price)}</span>
            </div>
        `;
    });
}

function renderQuickSalesFenGrid() {
    const container = document.getElementById('quick-sales-fen-grid');
    if (!container) return;
    container.innerHTML = `
        <div onclick="openSmartModal('sale_custom_fen', null)" class="bg-gray-800/80 border border-gray-600 rounded-xl p-4 cursor-pointer hover:border-amber-500 transition-all flex flex-col items-center justify-center text-center group min-h-[110px] shadow-lg">
            <div class="h-10 w-10 bg-amber-500/10 rounded-full flex items-center justify-center mb-2 group-hover:bg-amber-500 transition-colors">
                <i class="fa-solid fa-plus text-xl text-amber-500 group-hover:text-gray-900"></i>
            </div>
            <span class="font-extrabold text-amber-400 text-xs uppercase">Vendita Libera</span>
        </div>
    `;
    Object.keys(localCatalogFen).forEach(key => {
        const item = localCatalogFen[key];
        container.innerHTML += `
            <div onclick="openSmartModal('sale_catalog_fen', '${key}')" class="bg-gray-800/80 border border-gray-600 rounded-xl p-4 cursor-pointer hover:border-emerald-500 transition-all flex flex-col items-center justify-center text-center group min-h-[110px] shadow-lg">
                <i class="fa-solid fa-tag text-2xl text-gray-500 mb-2 group-hover:text-emerald-400"></i>
                <span class="font-bold text-gray-200 text-sm leading-tight">${item.name}</span>
                <span class="text-emerald-400 text-xs font-bold mt-1 bg-emerald-400/10 px-2 py-0.5 rounded">${formatValuta(item.price)}</span>
            </div>
        `;
    });
}

// --- SALES DROPDOWNS ---
function renderSalesYjDropdowns() {
    const sel = document.getElementById('sale-yj-service-select');
    if (!sel) return;
    sel.innerHTML = '<option value="custom">-- VENDITA LIBERA --</option>';
    Object.keys(localCatalogYJ).forEach(key => {
        const item = localCatalogYJ[key];
        sel.innerHTML += `<option value="${key}">${item.name} (${formatValuta(item.price)})</option>`;
    });
}

function renderSalesFenDropdowns() {
    const sel = document.getElementById('sale-fen-service-select');
    if (!sel) return;
    sel.innerHTML = '<option value="custom">-- VENDITA LIBERA --</option>';
    Object.keys(localCatalogFen).forEach(key => {
        const item = localCatalogFen[key];
        sel.innerHTML += `<option value="${key}">${item.name} (${formatValuta(item.price)})</option>`;
    });
}

// Custom name toggle for YJ
document.getElementById('sale-yj-service-select')?.addEventListener('change', (e) => {
    const field = document.getElementById('custom-name-field-yj');
    const price = document.getElementById('sale-yj-custom-price');
    const label = document.getElementById('price-label-text-yj');
    if (e.target.value === 'custom') {
        field.classList.remove('hidden');
        price.disabled = false;
        price.value = "";
        label.textContent = "Costo Totale (€)";
    } else {
        field.classList.add('hidden');
        price.disabled = true;
        label.textContent = "Costo Unitario Preimpostato (€)";
        const item = localCatalogYJ[e.target.value];
        if (item) price.value = item.price;
    }
});

document.getElementById('sale-fen-service-select')?.addEventListener('change', (e) => {
    const field = document.getElementById('custom-name-field-fen');
    const price = document.getElementById('sale-fen-custom-price');
    const label = document.getElementById('price-label-text-fen');
    if (e.target.value === 'custom') {
        field.classList.remove('hidden');
        price.disabled = false;
        price.value = "";
        label.textContent = "Costo Totale (€)";
    } else {
        field.classList.add('hidden');
        price.disabled = true;
        label.textContent = "Costo Unitario Preimpostato (€)";
        const item = localCatalogFen[e.target.value];
        if (item) price.value = item.price;
    }
});

// --- SALE FORMS ---
function handleSaleSubmit(e, isYJ) {
    e.preventDefault();
    const empSelect = document.getElementById(isYJ ? 'sale-yj-employee' : 'sale-fen-employee');
    const serviceSelect = document.getElementById(isYJ ? 'sale-yj-service-select' : 'sale-fen-service-select');
    const qtyInput = document.getElementById(isYJ ? 'sale-yj-quantity' : 'sale-fen-quantity');
    const customName = document.getElementById(isYJ ? 'sale-yj-custom-name' : 'sale-fen-custom-name');
    const customPrice = document.getElementById(isYJ ? 'sale-yj-custom-price' : 'sale-fen-custom-price');
    const catalog = isYJ ? localCatalogYJ : localCatalogFen;
    const collection = isYJ ? 'current_sales' : 'current_sales_fen';

    const empKey = empSelect.value;
    const serviceKey = serviceSelect.value;
    const quantity = parseInt(qtyInput.value) || 1;

    if (!empKey) {
        showToast("Seleziona un dipendente!", "warning");
        return;
    }

    let saleData = {
        timestamp: Date.now(),
        dateString: new Date().toLocaleString('it-IT'),
        employeeKey: empKey,
        employeeName: localEmployees[empKey].name,
        quantity: quantity,
        activity: 'importale'
    };

    const empPct = localEmployees[empKey].customPercentage ? parseFloat(localEmployees[empKey].customPercentage) : 40;
    saleData.appliedPercentage = empPct;

    if (serviceKey === 'custom') {
        const name = customName.value.trim();
        const totalCostInput = parseFloat(customPrice.value);
        if (!name || isNaN(totalCostInput)) {
            showToast("Compila nome e importo.", "warning");
            return;
        }
        const finalTotalPrice = totalCostInput * quantity;
        const yellowGain = finalTotalPrice;
        const employeeGain = (yellowGain * empPct) / 100;
        saleData.serviceName = "[LIBERO] " + name;
        saleData.totalPrice = finalTotalPrice;
        saleData.yellowCost = 0;
        saleData.yellowGain = yellowGain;
        saleData.employeeGain = employeeGain;
    } else {
        const item = catalog[serviceKey];
        const finalTotalPrice = item.price * quantity;
        const finalYellowCost = (item.cost || 0) * quantity;
        const yellowGain = finalTotalPrice - finalYellowCost;
        const employeeGain = (yellowGain * empPct) / 100;
        saleData.serviceName = item.name;
        saleData.totalPrice = finalTotalPrice;
        saleData.yellowCost = finalYellowCost;
        saleData.yellowGain = yellowGain;
        saleData.employeeGain = employeeGain;
    }

    db.collection(collection).add(saleData)
        .then(() => {
            e.target.reset();
            qtyInput.value = "1";
            showToast("Vendita registrata!", "success");
        })
        .catch(err => showToast("Errore: " + err.message, "error"));
}

document.getElementById('sale-yj-form')?.addEventListener('submit', (e) => handleSaleSubmit(e, true));
document.getElementById('sale-fen-form')?.addEventListener('submit', (e) => handleSaleSubmit(e, false));

// --- RENDER SALES TABLES ---
function renderSalesTableGeneric(tbodyId, salesObj, filterId, isYJ) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    const filterVal = document.getElementById(filterId)?.value || 'all';
    let salesArray = Object.keys(salesObj).map(k => ({ key: k, ...salesObj[k] }));
    if (filterVal !== 'all') salesArray = salesArray.filter(s => s.employeeKey === filterVal);
    salesArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (salesArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500 text-xs">Nessuna operazione in questa settimana.</td></tr>`;
        return;
    }

    salesArray.forEach(sale => {
        const totaleCell = `<span class="text-emerald-400 font-bold">${formatValuta(sale.totalPrice)}</span>`;
        const spettCell = `${formatValuta(sale.employeeGain)} <span class="text-[10px] text-gray-500">(${sale.appliedPercentage || 40}%)</span>`;
        tbody.innerHTML += `
            <tr class="hover:bg-gray-750/50 transition border-b border-gray-800">
                <td class="py-3 text-xs text-gray-400">${(sale.dateString || '').split(',')[0]}</td>
                <td class="py-3 font-semibold text-amber-400">${sale.employeeName}</td>
                <td class="py-3 text-gray-300 text-xs">${sale.serviceName} <span class="text-[10px] text-gray-500">x${formatNumero(sale.quantity || 1)}</span></td>
                <td class="py-3">${totaleCell}</td>
                <td class="py-3 text-indigo-400 font-semibold">${spettCell}</td>
                <td class="py-3 text-right">
                    <button onclick="window.deleteSaleItem('${sale.key}', true)" class="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600 hover:text-white transition" title="Elimina">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}


function renderSalesYjTable() {
    renderSalesTableGeneric('current-sales-yj-table', localSalesYJ, 'sales-yj-employee-filter', true);
}
function renderSalesFenTable() {
    renderSalesTableGeneric('current-sales-fen-table', localSalesFen, 'sales-fen-employee-filter', false);
}

window.deleteSaleItem = function(key, isYJ) {
    const sales = isYJ ? localSalesYJ : localSalesFen;
    const collection = isYJ ? 'current_sales' : 'current_sales_fen';
    const sale = sales[key];
    if (!sale) return;
    showConfirmModal("Elimina Vendita", `Eliminare la vendita di "${sale.serviceName}" di ${sale.employeeName}?`, () => {
        const yellowGain = sale.yellowGain || 0;
        const batch = db.batch();
        batch.delete(db.collection(collection).doc(key));
        // Storno dal saldo del solo guadagno azienda (se presente)
        if (yellowGain > 0) {
            const prev = (localBalance && typeof localBalance.amount === 'number') ? localBalance.amount : 0;
            const newAmount = Math.max(0, prev - yellowGain);
            const now = Date.now();
            const operatorName = sale.employeeName || 'Sistema';
            batch.set(db.collection('balance').doc('current'), {
                amount: newAmount,
                updatedAt: now,
                updatedBy: operatorName
            }, { merge: true });
            batch.set(db.collection('balance_logs').doc(), {
                timestamp: now,
                dateString: new Date(now).toLocaleString('it-IT'),
                operatorName: operatorName,
                employeeId: sale.employeeKey || null,
                type: 'storno',
                prevAmount: prev,
                newAmount: newAmount,
                delta: -yellowGain,
                note: 'Annullamento vendita: ' + (sale.serviceName || '—')
            });
        }
        batch.commit()
            .then(() => showToast("Vendita rimossa." + (yellowGain > 0 ? " Storno cassa: " + formatValuta(yellowGain) : ""), "info"))
            .catch(err => showToast(err.message, "error"));
    }, true);
};

// --- ARCHIVE WINDOWS ---
function renderSalesArchiveWindowGeneric(containerId, filterId, activityFilter) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const filterVal = document.getElementById(filterId)?.value || 'all';
    const items = Object.keys(localArchive).map(k => ({ key: k, ...localArchive[k] }));
    items.sort((a, b) => b.timestamp - a.timestamp);
    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-gray-500 text-xs">Nessun archivio.</div>`;
        return;
    }
    items.forEach(item => {
        let weekSales = Object.keys(item.sales || {}).map(sk => item.sales[sk]);
        if (filterVal !== 'all') weekSales = weekSales.filter(s => s.employeeKey === filterVal);
        if (weekSales.length === 0) return;
        weekSales.sort((a, b) => b.timestamp - a.timestamp);
        let rows = '';
        weekSales.forEach(sale => {
            rows += `<tr class="border-b border-gray-800 text-xs">
                <td class="py-1.5 px-2 text-gray-400">${(sale.dateString || '').split(',')[0]}</td>
                <td class="py-1.5 px-2 text-amber-400">${sale.employeeName || '-'}</td>
                <td class="py-1.5 px-2 text-gray-300">${sale.serviceName || '-'} x${formatNumero(sale.quantity || 1)}</td>
                <td class="py-1.5 px-2 text-emerald-400 font-semibold">${formatValuta(sale.totalPrice)}</td>
                <td class="py-1.5 px-2 text-indigo-400 font-semibold">${formatValuta(sale.employeeGain)} <span class="text-[9px] text-gray-500">(${sale.appliedPercentage || 40}%)</span></td>
            </tr>`;
        });
        container.innerHTML += `
            <div class="bg-gray-900/60 border border-gray-700 rounded-xl p-3">
                <p class="text-sm font-bold text-amber-400 mb-2">${item.title || 'Archivio'}</p>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-gray-500 text-[10px] uppercase border-b border-gray-700">
                                <th class="py-2 px-2">Data</th><th class="py-2 px-2">Dip.</th><th class="py-2 px-2">Servizio</th>
                                <th class="py-2 px-2">Lordo</th><th class="py-2 px-2">Spett. Staff</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    });
}


function renderSalesArchiveWindowYJ(archive) {
    renderSalesArchiveWindowGeneric('archive-window-yj-weeks-container', 'archive-window-yj-employee-filter', 'yellow_jack');
}
function renderSalesArchiveWindowFen(archive) {
    renderSalesArchiveWindowGeneric('archive-window-fen-weeks-container', 'archive-window-fen-employee-filter', 'fenici');
}

// --- CATALOGHI ---
function setupCatalogForm(formId, idField, nameField, priceField, costField, submitBtnId, collection, localObj, renderFn) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById(idField).value;
        const name = document.getElementById(nameField).value.trim();
        const price = parseFloat(document.getElementById(priceField).value);
        if (!name || isNaN(price)) { showToast("Nome e prezzo obbligatori.", "warning"); return; }
        const data = { name, price, cost: 0 };
        const btn = document.getElementById(submitBtnId);

        if (id) {
            db.collection(collection).doc(id).set(data)
                .then(() => { form.reset(); document.getElementById(idField).value = ''; btn.textContent = btn.textContent.replace('Salva Modifiche', 'Aggiungi al Catalogo'); showToast("Modificato!", "success"); })
                .catch(err => showToast(err.message, "error"));
        } else {
            db.collection(collection).add(data)
                .then(() => { form.reset(); showToast("Aggiunto al catalogo!", "success"); })
                .catch(err => showToast(err.message, "error"));
        }
    });
}

setupCatalogForm('catalog-yj-form', 'catalog-yj-id', 'catalog-yj-name', 'catalog-yj-price', null, 'catalog-yj-submit-btn', 'catalog', localCatalogYJ, renderCatalogYJ);


window.editCatalogItem = function(key, isYJ) {
    const item = localCatalogYJ[key];
    if (!item) return;
    document.getElementById('catalog-yj-id').value = key;
    document.getElementById('catalog-yj-name').value = item.name;
    document.getElementById('catalog-yj-price').value = item.price;
    const btn = document.getElementById('catalog-yj-submit-btn');
    if (btn) btn.textContent = "Salva Modifiche";
    showToast("Dati caricati. Modifica e salva.", "info");
};

window.deleteCatalogItem = function(key, isYJ) {
    showConfirmModal("Elimina dal Catalogo", `Rimuovere "${localCatalogYJ[key]?.name}"?`, () => {
        db.collection('catalog').doc(key).delete()
            .then(() => showToast("Rimosso.", "info"))
            .catch(err => showToast(err.message, "error"));
    }, true);
};

function renderCatalogYJ() {
    const tbody = document.getElementById('catalog-yj-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const keys = Object.keys(localCatalogYJ);
    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td class="p-3 text-center text-gray-500 text-xs" colspan="3">Nessun servizio in catalogo.</td></tr>`;
        return;
    }
    keys.forEach(key => {
        const item = localCatalogYJ[key];
        tbody.innerHTML += `
            <tr class="hover:bg-gray-700/50 border-b border-gray-700 text-xs">
                <td class="p-2 font-semibold text-amber-400">${item.name}</td>
                <td class="p-2 text-emerald-400 font-bold">${formatValuta(item.price)}</td>
                <td class="p-2 text-right space-x-1">
                    <button onclick="window.editCatalogItem('${key}', true)" class="p-1 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500 hover:text-gray-900" title="Modifica"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="window.deleteCatalogItem('${key}', true)" class="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600 hover:text-white" title="Elimina"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </td>
            </tr>
        `;
    });
}


function renderCatalogFen() {
    const tbody = document.getElementById('catalog-fen-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const keys = Object.keys(localCatalogFen);
    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td class="p-4 text-center text-gray-500 text-xs">Nessun servizio nel catalogo Fenici.</td></tr>`;
        return;
    }
    keys.forEach(key => {
        const item = localCatalogFen[key];
        tbody.innerHTML += `
            <tr class="hover:bg-gray-770/60 border-b border-gray-700">
                <td class="p-2 font-bold text-xs">${item.name}</td>
                <td class="p-2 text-emerald-400 text-xs">Prezzo: ${formatValuta(item.price)}</td>
                <td class="p-2 text-amber-500 text-xs">Costo: ${formatValuta(item.cost)}</td>
                <td class="p-2 text-right space-x-1">
                    <button onclick="window.editCatalogItem('${key}', false)" class="p-1 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500 hover:text-gray-900"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="window.deleteCatalogItem('${key}', false)" class="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600 hover:text-white"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </td>
            </tr>
        `;
    });
}

// --- INVENTARIO YJ ---
document.getElementById('inv-yj-search-filter')?.addEventListener('input', renderInventoryYjGrid);
document.getElementById('inv-yj-stash-filter')?.addEventListener('change', renderInventoryYjGrid);

function renderInventoryYjDropdowns() {
    const sel = document.getElementById('inv-yj-item-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Seleziona Oggetto --</option>';
    Object.keys(localInventoryYJ).forEach(key => {
        const item = localInventoryYJ[key];
        sel.innerHTML += `<option value="${key}">${item.name} (${getStashName(item.stash)}) - Disp: ${formatNumero(item.quantity)}</option>`;
    });
}

function renderInventoryYjGrid() {
    const grid = document.getElementById('inventory-yj-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const searchVal = (document.getElementById('inv-yj-search-filter')?.value || '').toLowerCase();
    const stashVal = document.getElementById('inv-yj-stash-filter')?.value || 'all';
    let items = Object.keys(localInventoryYJ).map(k => ({ id: k, ...localInventoryYJ[k] }));
    if (stashVal !== 'all') items = items.filter(i => i.stash === stashVal);
    if (searchVal) items = items.filter(i => i.name.toLowerCase().includes(searchVal));
    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-6 text-gray-500 text-sm">Nessun oggetto in inventario.</div>`;
        return;
    }
    items.forEach(item => {
        const stashLabel = getStashName(item.stash);
        const safeName = (item.name || '').replace(/'/g, "\\'");
        const delBtn = (userRole === 'gestore')
            ? `<button onclick="event.stopPropagation(); window.deleteInventoryItem('${item.id}', '${safeName}', true)" class="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg text-xs z-20 opacity-0 group-hover:opacity-100 transition" title="Rimuovi"><i class="fa-solid fa-trash"></i></button>`
            : '';
        grid.innerHTML += `
            <div onclick="openSmartModal('inv_yj', '${item.id}')" class="relative bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col group cursor-pointer hover:border-amber-500 transition-all">
                ${delBtn}
                <div class="h-32 w-full bg-gray-900/80 flex items-center justify-center p-3">
                    <img src="${item.imageUrl || 'https://via.placeholder.com/150?text=No+Immagine'}" alt="${item.name}" class="max-h-full max-w-full object-contain drop-shadow-md group-hover:scale-105 transition duration-200" onerror="this.src='https://via.placeholder.com/150?text=No+Immagine';">
                </div>
                <div class="p-3 pt-2 flex flex-col gap-1.5 border-t border-gray-700/60">
                    <h4 class="font-bold text-amber-400 text-sm leading-snug truncate" title="${item.name}">${item.name}</h4>
                    <div class="flex items-baseline gap-1.5">
                        <span class="text-[11px] text-gray-400 font-medium">Qta:</span>
                        <span class="text-emerald-400 font-bold text-sm tabular-nums">${formatNumero(item.quantity)}</span>
                    </div>
                    <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wide truncate">${stashLabel}</span>
                </div>
            </div>
        `;
    });
}

function renderInventoryYjLogs() {
    const tbody = document.getElementById('inventory-yj-logs-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (localInventoryYJLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500 text-xs">Nessun movimento.</td></tr>`;
        return;
    }
    localInventoryYJLogs.forEach(log => {
        const isDeposit = log.action === 'deposita';
        const badge = isDeposit
            ? `<span class="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-bold">📥 Deposita</span>`
            : `<span class="text-amber-500 bg-amber-500/10 px-2 py-1 rounded text-xs font-bold">📤 Preleva</span>`;
        tbody.innerHTML += `
            <tr class="hover:bg-gray-750/50 border-b border-gray-700">
                <td class="p-3 text-xs text-gray-400">${log.dateString}</td>
                <td class="p-3 font-semibold text-gray-200">${log.employeeName}</td>
                <td class="p-3">${badge}</td>
                <td class="p-3 text-gray-300 text-xs"><b>${log.itemName}</b> (x${formatNumero(log.quantity)})</td>
                <td class="p-3 text-gray-400 text-xs italic truncate max-w-[150px]">${log.reason || '-'}</td>
            </tr>
        `;
    });
}

document.getElementById('inventory-yj-admin-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('inv-yj-admin-name').value.trim();
    const imgId = document.getElementById('inv-yj-admin-img').value;
    const quantity = parseInt(document.getElementById('inv-yj-admin-qty').value) || 0;
    const stash = document.getElementById('inv-yj-admin-stash').value;
    if (!name) { showToast("Inserisci il nome dell'oggetto.", "warning"); return; }
    if (!stash) { showToast("Seleziona un deposito.", "warning"); return; }
    let imageUrl = 'https://via.placeholder.com/150?text=No+Immagine';
    let imageFileName = '';
    if (imgId && localItemImages[imgId]) {
        imageUrl = localItemImages[imgId].dataUrl || imageUrl;
        imageFileName = localItemImages[imgId].fileName || '';
    }
    db.collection('inventory_items').add({ name, imageUrl, imageFileName, quantity, stash, createdAt: Date.now() })
        .then(() => { e.target.reset(); document.getElementById('inv-yj-admin-qty').value = 0; showToast("Oggetto creato in inventario!", "success"); })
        .catch(err => showToast("Errore salvataggio: " + err.message, "error"));
});

window.deleteInventoryItem = function(id, name, isYJ) {
    const collection = isYJ ? 'inventory_items' : 'fenici_items';
    showConfirmModal("Elimina Oggetto", `Rimuovere "${name}"?`, () => {
        db.collection(collection).doc(id).delete()
            .then(() => showToast("Rimosso.", "info"))
            .catch(err => showToast(err.message, "error"));
    }, true);
};

document.getElementById('inventory-yj-transaction-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const empId = document.getElementById('inv-yj-emp-select').value;
    const itemId = document.getElementById('inv-yj-item-select').value;
    const action = document.getElementById('inv-yj-action').value;
    const qty = parseInt(document.getElementById('inv-yj-qty').value) || 1;
    const reason = document.getElementById('inv-yj-reason').value.trim();
    if (!empId || !itemId) { showToast("Seleziona dipendente e oggetto.", "warning"); return; }
    const item = localInventoryYJ[itemId];
    if (!item) { showToast("Oggetto non trovato.", "error"); return; }
    let newQty = item.quantity;
    if (action === 'preleva') {
        if (qty > item.quantity) { showToast(`Disponibili solo ${item.quantity}.`, "error"); return; }
        newQty -= qty;
    } else newQty += qty;
    const empName = localEmployees[empId]?.name || 'Dipendente';
    const batch = db.batch();
    batch.update(db.collection('inventory_items').doc(itemId), { quantity: newQty });
    batch.set(db.collection('inventory_logs').doc(), {
        timestamp: Date.now(), dateString: new Date().toLocaleString('it-IT'),
        employeeId: empId, employeeName: empName, itemId, itemName: item.name,
        action, quantity: qty, reason
    });
    batch.commit().then(() => {
        e.target.reset();
        document.getElementById('inv-yj-qty').value = 1;
        showToast("Movimento YJ registrato!", "success");
    }).catch(err => showToast(err.message, "error"));
});

// --- INVENTARIO FENICI (analogo) ---
document.getElementById('inv-fen-search-filter')?.addEventListener('input', renderInventoryFenGrid);
document.getElementById('inv-fen-stash-filter')?.addEventListener('change', renderInventoryFenGrid);

function renderInventoryFenDropdowns() {
    const sel = document.getElementById('inv-fen-item-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Seleziona Oggetto --</option>';
    Object.keys(localInventoryFen).forEach(key => {
        const item = localInventoryFen[key];
        sel.innerHTML += `<option value="${key}">${item.name} (${getStashName(item.stash)}) - Disp: ${formatNumero(item.quantity)}</option>`;
    });
}

function renderInventoryFenGrid() {
    const grid = document.getElementById('inventory-fen-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const searchVal = (document.getElementById('inv-fen-search-filter')?.value || '').toLowerCase();
    const stashVal = document.getElementById('inv-fen-stash-filter')?.value || 'all';
    let items = Object.keys(localInventoryFen).map(k => ({ id: k, ...localInventoryFen[k] }));
    if (stashVal !== 'all') items = items.filter(i => i.stash === stashVal);
    if (searchVal) items = items.filter(i => i.name.toLowerCase().includes(searchVal));
    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-6 text-gray-500 text-sm">Nessun oggetto in inventario Fenici.</div>`;
        return;
    }
    items.forEach(item => {
        grid.innerHTML += `
            <div onclick="openSmartModal('inv_fen', '${item.id}')" class="relative bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col group cursor-pointer hover:border-amber-500 transition-all">
                <button onclick="event.stopPropagation(); window.deleteInventoryItem('${item.id}', '${item.name.replace(/'/g, "\\'")}', false)" class="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg text-xs z-20" title="Rimuovi">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <div class="h-28 w-full bg-gray-900 flex items-center justify-center p-2">
                    <img src="${item.imageUrl}" alt="${item.name}" class="max-h-full max-w-full object-contain drop-shadow-md group-hover:scale-110 transition" onerror="this.src='https://via.placeholder.com/150?text=No+Immagine';">
                </div>
                <div class="p-3 flex-1 flex flex-col justify-between">
                    <h4 class="font-bold text-amber-400 text-sm truncate">${item.name}</h4>
                    <div class="mt-2 flex justify-between items-end">
                        <span class="text-[10px] text-gray-400 font-semibold bg-gray-700 px-2 py-0.5 rounded">${getStashName(item.stash)}</span>
                        <span class="text-emerald-400 font-bold text-sm">Qta: ${formatNumero(item.quantity)}</span>
                    </div>
                </div>
            </div>
        `;
    });
}

function renderInventoryFenLogs() {
    const tbody = document.getElementById('inventory-fen-logs-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (localInventoryFenLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500 text-xs">Nessun movimento.</td></tr>`;
        return;
    }
    localInventoryFenLogs.forEach(log => {
        const isDeposit = log.action === 'deposita';
        const badge = isDeposit
            ? `<span class="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded text-xs font-bold">📥 Deposita</span>`
            : `<span class="text-amber-500 bg-amber-500/10 px-2 py-1 rounded text-xs font-bold">📤 Preleva</span>`;
        tbody.innerHTML += `
            <tr class="hover:bg-gray-750/50 border-b border-gray-700">
                <td class="p-3 text-xs text-gray-400">${log.dateString}</td>
                <td class="p-3 font-semibold text-gray-200">${log.employeeName}</td>
                <td class="p-3">${badge}</td>
                <td class="p-3 text-gray-300 text-xs"><b>${log.itemName}</b> (x${formatNumero(log.quantity)})</td>
                <td class="p-3 text-gray-400 text-xs italic truncate max-w-[150px]">${log.reason || '-'}</td>
            </tr>
        `;
    });
}

document.getElementById('inventory-fen-admin-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('inv-fen-admin-name').value.trim();
    const imgId = document.getElementById('inv-fen-admin-img').value;
    const quantity = parseInt(document.getElementById('inv-fen-admin-qty').value) || 0;
    const stash = document.getElementById('inv-fen-admin-stash').value;
    if (!name) { showToast("Inserisci il nome dell'oggetto.", "warning"); return; }
    if (!stash) { showToast("Seleziona un deposito Fenici.", "warning"); return; }
    let imageUrl = 'https://via.placeholder.com/150?text=No+Immagine';
    let imageFileName = '';
    if (imgId && localItemImages[imgId]) {
        imageUrl = localItemImages[imgId].dataUrl || imageUrl;
        imageFileName = localItemImages[imgId].fileName || '';
    }
    db.collection('fenici_items').add({ name, imageUrl, imageFileName, quantity, stash, createdAt: Date.now() })
        .then(() => { e.target.reset(); document.getElementById('inv-fen-admin-qty').value = 0; showToast("Oggetto creato solo in inventario Fenici!", "success"); })
        .catch(err => showToast("Errore salvataggio: " + err.message, "error"));
});

document.getElementById('inventory-fen-transaction-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const empId = document.getElementById('inv-fen-emp-select').value;
    const itemId = document.getElementById('inv-fen-item-select').value;
    const action = document.getElementById('inv-fen-action').value;
    const qty = parseInt(document.getElementById('inv-fen-qty').value) || 1;
    const reason = document.getElementById('inv-fen-reason').value.trim();
    if (!empId || !itemId) { showToast("Seleziona dipendente e oggetto.", "warning"); return; }
    const item = localInventoryFen[itemId];
    if (!item) { showToast("Oggetto non trovato.", "error"); return; }
    let newQty = item.quantity;
    if (action === 'preleva') {
        if (qty > item.quantity) { showToast(`Disponibili solo ${item.quantity}.`, "error"); return; }
        newQty -= qty;
    } else newQty += qty;
    const empName = localEmployees[empId]?.name || 'Dipendente';
    const batch = db.batch();
    batch.update(db.collection('fenici_items').doc(itemId), { quantity: newQty });
    batch.set(db.collection('fenici_logs').doc(), {
        timestamp: Date.now(), dateString: new Date().toLocaleString('it-IT'),
        employeeId: empId, employeeName: empName, itemId, itemName: item.name,
        action, quantity: qty, reason
    });
    batch.commit().then(() => {
        e.target.reset();
        document.getElementById('inv-fen-qty').value = 1;
        showToast("Movimento registrato!", "success");
    }).catch(err => showToast(err.message, "error"));
});


// --- EMPLOYEES (con login, password, ruoli) ---
const employeeForm = document.getElementById('employee-form');
const empSubmitBtn = document.getElementById('emp-submit-btn');
const empCancelEditBtn = document.getElementById('emp-cancel-edit-btn');

function resetEmployeeForm() {
    if (!employeeForm) return;
    employeeForm.reset();
    document.getElementById('emp-id').value = '';
    if (empSubmitBtn) {
        empSubmitBtn.innerHTML = '<i class="fa-solid fa-user-plus mr-1"></i> Registra Nuovo Dipendente';
        empSubmitBtn.className = 'flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition';
    }
    if (empCancelEditBtn) empCancelEditBtn.classList.add('hidden');
}

empCancelEditBtn?.addEventListener('click', resetEmployeeForm);

if (employeeForm) {
    employeeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const empId = document.getElementById('emp-id').value;
        const name = document.getElementById('emp-name').value.trim();
        const rank = document.getElementById('emp-rank').value.trim();
        const login = document.getElementById('emp-login').value.trim();
        const password = document.getElementById('emp-password').value.trim();
        const customPercentage = document.getElementById('emp-percentage').value;

        if (!name || !rank || !login || !password) {
            showToast("Compila nome, grado, codice login e password.", "warning");
            return;
        }

        const empData = {
            name,
            rank,
            login,
            password,
            customPercentage: customPercentage !== "" ? parseInt(customPercentage) : null,
            roles: { salesYJ: true, invYJ: true },
            updatedAt: Date.now()
        };

        if (empId) {
            // Modifica esistente
            db.collection('employees').doc(empId).set(empData, { merge: true })
                .then(() => {
                    resetEmployeeForm();
                    showToast("Dipendente aggiornato con successo!", "success");
                })
                .catch(err => showToast(err.message, "error"));
        } else {
            // Nuovo
            empData.createdAt = Date.now();
            db.collection('employees').add(empData)
                .then(() => {
                    resetEmployeeForm();
                    showToast("Dipendente registrato con login e ruoli!", "success");
                })
                .catch(err => showToast(err.message, "error"));
        }
    });
}

window.editEmployee = function(key) {
    const emp = localEmployees[key];
    if (!emp) return;

    document.getElementById('emp-id').value = key;
    document.getElementById('emp-name').value = emp.name || '';
    document.getElementById('emp-rank').value = emp.rank || '';
    document.getElementById('emp-login').value = emp.login || '';
    document.getElementById('emp-password').value = emp.password || '';
    document.getElementById('emp-percentage').value = emp.customPercentage != null ? emp.customPercentage : '';

    if (empSubmitBtn) {
        empSubmitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Salva Modifiche';
        empSubmitBtn.className = 'flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold text-sm rounded-xl transition';
    }
    if (empCancelEditBtn) empCancelEditBtn.classList.remove('hidden');

    // Scroll al form
    employeeForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast("Dati caricati. Modifica e premi Salva.", "info");
};

window.deleteEmployee = function(key) {
    showConfirmModal(
        "Rimuovi Dipendente",
        `Rimuovere "${localEmployees[key]?.name}"?`,
        () => {
            db.collection('employees').doc(key).delete()
                .then(() => {
                    if (document.getElementById('emp-id').value === key) resetEmployeeForm();
                    showToast("Dipendente rimosso.", "info");
                })
                .catch(err => showToast(err.message, "error"));
        },
        true
    );
};

function renderEmployees() {
    const tbody = document.getElementById('employee-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const keys = Object.keys(localEmployees);
    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500 text-xs">Nessun dipendente.</td></tr>`;
        return;
    }
    keys.forEach(key => {
        const emp = localEmployees[key];
        const pct = emp.customPercentage ? `${emp.customPercentage}%` : '40%';
        tbody.innerHTML += `
            <tr class="border-b border-gray-700/80 hover:bg-gray-700/50 transition text-xs">
                <td class="p-2.5 font-bold text-amber-400">${emp.name || '-'}</td>
                <td class="p-2.5 text-gray-300">${emp.rank || '-'}</td>
                <td class="p-2.5 text-gray-300 font-mono">${emp.login || '-'}</td>
                <td class="p-2.5 text-gray-400 font-mono">${emp.password || '-'}</td>
                <td class="p-2.5 text-indigo-400">${pct}</td>
                <td class="p-2.5 text-right whitespace-nowrap space-x-1">
                    <button onclick="window.editEmployee('${key}')" class="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-gray-900 transition" title="Modifica">
                        <i class="fa-solid fa-pen text-[10px]"></i>
                    </button>
                    <button onclick="window.deleteEmployee('${key}')" class="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition" title="Elimina">
                        <i class="fa-solid fa-user-minus text-[10px]"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

window.updateSalaryStatus = function(employeeKey, statusValue) {
    db.collection('current_salaries_status').doc(employeeKey).set({ status: statusValue })
        .then(() => { showToast("Stato aggiornato.", "success"); calculateManagementData(); })
        .catch(err => showToast(err.message, "error"));
};

function calculateManagementData() {
    const filterValue = adminEmployeeFilter ? adminEmployeeFilter.value : "all";
    let totalSalesAmount = 0, totalYellowGain = 0, totalSalaries = 0, totalYellowItemCosts = 0;
    let staffStats = {};
    Object.keys(localEmployees).forEach(k => {
        staffStats[k] = {
            name: localEmployees[k].name,
            count: 0, salary: 0,
            pct: localEmployees[k].customPercentage || 40,
            status: localSalariesStatus[k] || 'non_pagato'
        };
    });

    const singleEmpTableBody = document.getElementById('single-employee-sales-table');
    const singleEmpCard = document.getElementById('single-employee-sales-card');
    const archiveSingleBtn = document.getElementById('archive-single-employee-btn');
    if (singleEmpTableBody) singleEmpTableBody.innerHTML = "";

    // Combina vendite YJ + Fenici
    const allSales = { ...localSalesYJ };
    Object.keys(localSalesFen).forEach(k => { allSales['fen_' + k] = localSalesFen[k]; });

    Object.keys(allSales).forEach(key => {
        const sale = allSales[key];
        const realKey = sale.employeeKey;
        if (!staffStats[realKey]) {
            staffStats[realKey] = {
                name: (sale.employeeName || 'Sconosciuto') + " (Rimosso)",
                count: 0, salary: 0, pct: sale.appliedPercentage || 40,
                status: localSalariesStatus[realKey] || 'non_pagato'
            };
        }
        staffStats[realKey].count += (sale.quantity || 1);
        staffStats[realKey].salary += sale.employeeGain;

        if (filterValue === 'all' || sale.employeeKey === filterValue) {
            totalSalesAmount += sale.totalPrice;
            totalYellowGain += sale.yellowGain;
            totalSalaries += sale.employeeGain;
            /* no item costs */
            if (filterValue !== 'all' && singleEmpTableBody) {
                const activityLabel = (sale.activity === 'fenici') ? 'Fenici' : 'YJ';
                singleEmpTableBody.innerHTML += `
                    <tr class="hover:bg-gray-800 border-b border-gray-800">
                        <td class="py-2 text-gray-400">${sale.dateString}</td>
                        <td class="py-2 text-xs text-gray-500">${activityLabel}</td>
                        <td class="py-2 font-bold text-amber-400">${sale.serviceName}</td>
                        <td class="py-2 text-center text-gray-300">${formatNumero(sale.quantity || 1)}</td>
                        <td class="py-2 text-emerald-400 font-semibold">${formatValuta(sale.totalPrice)}</td>
                        <td class="py-2 text-indigo-400 font-bold">${formatValuta(sale.employeeGain)}</td>
                    </tr>
                `;
            }
        }
    });

    if (filterValue !== 'all') {
        if (singleEmpCard) singleEmpCard.classList.remove('hidden');
        if (archiveSingleBtn) {
            archiveSingleBtn.classList.remove('hidden');
            archiveSingleBtn.textContent = `Archivia Settimana di ${localEmployees[filterValue]?.name || 'Dipendente'}`;
        }
        if (singleEmpTableBody && singleEmpTableBody.innerHTML === "") {
            singleEmpTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500 italic">Nessuna vendita non archiviata.</td></tr>`;
        }
    } else {
        if (singleEmpCard) singleEmpCard.classList.add('hidden');
        if (archiveSingleBtn) archiveSingleBtn.classList.add('hidden');
    }

    const totalExpenses = totalSalaries;
    document.getElementById('kpi-total').textContent = formatValuta(totalSalesAmount);
    document.getElementById('kpi-yellow').textContent = formatValuta(totalYellowGain);
    document.getElementById('kpi-stipendi').textContent = formatValuta(totalSalaries);
    document.getElementById('kpi-expenses').textContent = formatValuta(totalExpenses);

    const tbody = document.getElementById('salary-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const staffKeys = Object.keys(staffStats);
    if (staffKeys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500 text-xs border-b border-gray-700/50">Nessun dato stipendio.</td></tr>`;
        return;
    }
    staffKeys.forEach(k => {
        const s = staffStats[k];
        const highlight = (filterValue !== 'all' && k === filterValue) ? 'bg-amber-500/10' : '';
        tbody.innerHTML += `
            <tr class="border-b border-gray-700/80 hover:bg-gray-750/50 transition text-xs ${highlight}">
                <td class="p-3 font-semibold text-gray-200">${s.name}</td>
                <td class="p-3 text-gray-400">${formatNumero(s.count)} oggetti</td>
                <td class="p-3 text-amber-500 font-bold">${s.pct}%</td>
                <td class="p-3 font-bold text-emerald-400 text-sm">${formatValuta(s.salary)}</td>
                <td class="p-3 text-right">
                    <select onchange="window.updateSalaryStatus('${k}', this.value)" class="px-2.5 py-1.5 bg-gray-900 text-xs rounded-lg text-white border border-gray-600 focus:border-amber-500 focus:outline-none">
                        <option value="non_pagato" ${s.status === 'non_pagato' ? 'selected' : ''}>🔴 Non Pagato</option>
                        <option value="pagato" ${s.status === 'pagato' ? 'selected' : ''}>🟢 Pagato</option>
                    </select>
                </td>
            </tr>
        `;
    });
}

// --- ARCHIVIAZIONE ---
document.getElementById('archive-manual-btn')?.addEventListener('click', () => {
    const hasSales = Object.keys(localSalesYJ).length > 0 || Object.keys(localSalesFen).length > 0;
    if (!hasSales) {
        showToast("Nessun dato da archiviare.", "warning");
        return;
    }
    showConfirmModal("Archiviazione GENERALE", "Archiviare e azzerare i bilanci di TUTTI i dipendenti (YJ + Fenici)?", () => {
        archiveCurrentWeek();
    }, false);
});

function archiveCurrentWeek() {
    const archiveTitle = "Settimana conclusa il " + new Date().toLocaleDateString('it-IT');
    let finalStaffSalariesReport = {};
    Object.keys(localEmployees).forEach(k => {
        finalStaffSalariesReport[k] = {
            name: localEmployees[k].name,
            salary: 0,
            status: localSalariesStatus[k] || 'non_pagato'
        };
    });

    const allSales = { ...localSalesYJ };
    Object.keys(localSalesFen).forEach(k => { allSales['fen_' + k] = localSalesFen[k]; });

    Object.keys(allSales).forEach(sk => {
        const sale = allSales[sk];
        if (finalStaffSalariesReport[sale.employeeKey]) {
            finalStaffSalariesReport[sale.employeeKey].salary += sale.employeeGain;
        }
    });

    const archiveData = {
        title: archiveTitle,
        timestamp: Date.now(),
        sales: allSales,
        salariesReport: finalStaffSalariesReport
    };

    db.collection('archive').add(archiveData).then(() => {
        Object.keys(localSalesYJ).forEach(sk => db.collection('current_sales').doc(sk).delete());
        Object.keys(localSalesFen).forEach(sk => db.collection('current_sales_fen').doc(sk).delete());
        Object.keys(localSalariesStatus).forEach(ek => db.collection('current_salaries_status').doc(ek).delete());
        if (adminEmployeeFilter) adminEmployeeFilter.value = "all";
        showToast("Settimana archiviata e bilanci azzerati!", "success");
    }).catch(err => showToast(err.message, "error"));
}

document.getElementById('archive-single-employee-btn')?.addEventListener('click', () => {
    const empKey = adminEmployeeFilter.value;
    if (empKey === "all" || !empKey) return;
    const empName = localEmployees[empKey]?.name || "Dipendente";
    let singleSales = {};
    Object.keys(localSalesYJ).forEach(sk => {
        if (localSalesYJ[sk].employeeKey === empKey) singleSales[sk] = localSalesYJ[sk];
    });
    Object.keys(localSalesFen).forEach(sk => {
        if (localSalesFen[sk].employeeKey === empKey) singleSales['fen_' + sk] = localSalesFen[sk];
    });
    if (Object.keys(singleSales).length === 0) {
        showToast(`Nessuna vendita per ${empName}.`, "warning");
        return;
    }
    showConfirmModal(`Archiviazione: ${empName}`, `Archiviare SOLO le vendite di ${empName}?`, () => {
        const archiveTitle = `[SINGOLO] Settimana ${empName} - ` + new Date().toLocaleDateString('it-IT');
        let report = {};
        report[empKey] = {
            name: empName,
            salary: 0,
            status: localSalariesStatus[empKey] || 'non_pagato'
        };
        Object.keys(singleSales).forEach(sk => { report[empKey].salary += singleSales[sk].employeeGain; });
        db.collection('archive').add({
            title: archiveTitle, timestamp: Date.now(), sales: singleSales, salariesReport: report
        }).then(() => {
            Object.keys(localSalesYJ).forEach(sk => {
                if (localSalesYJ[sk].employeeKey === empKey) db.collection('current_sales').doc(sk).delete();
            });
            Object.keys(localSalesFen).forEach(sk => {
                if (localSalesFen[sk].employeeKey === empKey) db.collection('current_sales_fen').doc(sk).delete();
            });
            db.collection('current_salaries_status').doc(empKey).delete();
            if (adminEmployeeFilter) adminEmployeeFilter.value = "all";
            showToast(`Settimana di ${empName} archiviata!`, "success");
        }).catch(err => showToast(err.message, "error"));
    }, false);
});

window.deleteArchiveItem = function(key) {
    showConfirmModal("Elimina Archivio", "Eliminare definitivamente questo blocco di archivio?", () => {
        db.collection('archive').doc(key).delete()
            .then(() => showToast("Archivio rimosso.", "info"))
            .catch(err => showToast(err.message, "error"));
    }, true);
};

function renderArchive(archiveList) {
    const container = document.getElementById('archive-container');
    if (!container) return;
    container.innerHTML = '';
    const items = Object.keys(archiveList).map(k => ({ key: k, ...archiveList[k] }));
    items.sort((a, b) => b.timestamp - a.timestamp);
    if (items.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-500">Nessun archivio storico.</p>`;
        return;
    }
    items.forEach(item => {
        let archTotal = 0, archYellow = 0;
        const salesCount = Object.keys(item.sales || {}).length;
        Object.keys(item.sales || {}).forEach(sk => {
            archTotal += item.sales[sk].totalPrice;
            archYellow += item.sales[sk].yellowGain;
        });
        let salariesHtml = "";
        if (item.salariesReport) {
            salariesHtml = `<div class="mt-2 pt-2 border-t border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-gray-400">`;
            Object.keys(item.salariesReport).forEach(ek => {
                const empRep = item.salariesReport[ek];
                if (empRep.salary > 0) {
                    const badge = empRep.status === 'pagato'
                        ? `<span class="text-emerald-400 font-semibold">🟢 Pagato</span>`
                        : `<span class="text-red-400 font-semibold">🔴 Non Pagato</span>`;
                    salariesHtml += `<div>${empRep.name}: <b>${formatValuta(empRep.salary)}</b> → ${badge}</div>`;
                }
            });
            salariesHtml += `</div>`;
        }
        container.innerHTML += `
            <div class="p-4 bg-gray-750/80 rounded-xl border border-gray-700 text-xs text-gray-300 shadow-md">
                <div class="flex flex-wrap justify-between items-center gap-2">
                    <div>
                        <p class="font-bold text-sm text-gray-200">${item.title}</p>
                        <p class="text-gray-400 mt-1">Vendite: <span class="text-amber-400">${salesCount}</span></p>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-emerald-400">Entrate: <b>${formatValuta(archTotal)}</b></span>
                        <span class="text-amber-400">Netto: <b>${formatValuta(archYellow)}</b></span>
                        <button onclick="window.deleteArchiveItem('${item.key}')" class="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white" title="Elimina">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
                ${salariesHtml}
            </div>
        `;
    });
}


// --- SALDO CASSA ---
function renderSaldoUI() {
    if (typeof fillSaldoMovEmployeeSelect === 'function') fillSaldoMovEmployeeSelect();
    const amountEl = document.getElementById('saldo-amount-display');
    const updatedEl = document.getElementById('saldo-updated-at');
    const adminCurrent = document.getElementById('balance-admin-current');
    const amt = (localBalance && typeof localBalance.amount === 'number') ? localBalance.amount : 0;
    if (amountEl) amountEl.textContent = formatValuta(amt);
    if (adminCurrent) adminCurrent.textContent = formatValuta(amt);
    if (updatedEl) {
        if (localBalance && localBalance.updatedAt) {
            const d = new Date(localBalance.updatedAt);
            const by = localBalance.updatedBy || '—';
            updatedEl.textContent = 'Aggiornato il ' + d.toLocaleString('it-IT') + ' · da ' + by;
        } else {
            updatedEl.textContent = 'Nessun aggiornamento registrato';
        }
    }
    const tbody = document.getElementById('saldo-logs-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!localBalanceLogs || localBalanceLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500 text-xs">Nessun movimento saldo.</td></tr>';
        return;
    }
    localBalanceLogs.forEach(log => {
        const delta = log.delta != null ? log.delta : (log.newAmount - (log.prevAmount || 0));
        const isUp = delta >= 0;
        const deltaStr = (isUp ? '+' : '') + formatValuta(delta);
        let typeBadge;
        if (log.type === 'set') {
            typeBadge = '<span class="text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded text-xs font-bold">Impostato</span>';
        } else if (log.type === 'vendita') {
            typeBadge = '<span class="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs font-bold">💰 Vendita</span>';
        } else if (log.type === 'storno') {
            typeBadge = '<span class="text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-xs font-bold">↩️ Storno</span>';
        } else if (log.type === 'deposita' || (log.type !== 'preleva' && isUp)) {
            typeBadge = '<span class="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-xs font-bold">📥 Deposita</span>';
        } else {
            typeBadge = '<span class="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-xs font-bold">📤 Preleva</span>';
        }
        tbody.innerHTML += `
            <tr class="hover:bg-gray-750/50 border-b border-gray-700">
                <td class="p-3 text-xs text-gray-400 whitespace-nowrap">${log.dateString || '—'}</td>
                <td class="p-3 font-semibold text-gray-200 text-xs">${log.operatorName || '—'}</td>
                <td class="p-3">${typeBadge}</td>
                <td class="p-3 font-bold text-sm ${isUp ? 'text-emerald-400' : 'text-amber-400'}">${deltaStr}</td>
                <td class="p-3 text-gray-200 font-semibold text-sm">${formatValuta(log.newAmount)}</td>
                <td class="p-3 text-gray-400 text-xs italic truncate max-w-[180px]">${log.note || '—'}</td>
            </tr>
        `;
    });
}

document.getElementById('balance-admin-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (userRole !== 'gestore') {
        showToast('Solo il gestore può modificare il saldo.', 'error');
        return;
    }
    const val = parseFloat(document.getElementById('balance-admin-value').value);
    const note = (document.getElementById('balance-admin-note')?.value || '').trim();
    if (isNaN(val) || val < 0) {
        showToast('Inserisci un importo valido (≥ 0).', 'warning');
        return;
    }
    const prev = (localBalance && typeof localBalance.amount === 'number') ? localBalance.amount : 0;
    const operatorName = currentUser?.email || 'Gestore';
    const now = Date.now();
    const batch = db.batch();
    const balRef = db.collection('balance').doc('current');
    batch.set(balRef, {
        amount: val,
        updatedAt: now,
        updatedBy: operatorName
    }, { merge: true });
    const logRef = db.collection('balance_logs').doc();
    batch.set(logRef, {
        timestamp: now,
        dateString: new Date(now).toLocaleString('it-IT'),
        operatorName,
        type: 'set',
        prevAmount: prev,
        newAmount: val,
        delta: val - prev,
        note: note || 'Aggiornamento manuale saldo'
    });
    batch.commit()
        .then(() => {
            document.getElementById('balance-admin-value').value = '';
            document.getElementById('balance-admin-note').value = '';
            showToast('Saldo aggiornato!', 'success');
        })
        .catch(err => showToast('Errore: ' + err.message, 'error'));
});


window.setSaldoMovAction = function(action) {
    const hidden = document.getElementById('saldo-mov-action');
    if (hidden) hidden.value = action;
    const btnP = document.getElementById('saldo-btn-preleva');
    const btnD = document.getElementById('saldo-btn-deposita');
    if (btnP && btnD) {
        if (action === 'preleva') {
            btnP.className = 'py-2.5 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-1.5 border-amber-500 bg-amber-500/20 text-amber-400';
            btnD.className = 'py-2.5 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-1.5 border-gray-600 bg-gray-900 text-gray-400 hover:border-emerald-500 hover:text-emerald-400';
        } else {
            btnD.className = 'py-2.5 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-1.5 border-emerald-500 bg-emerald-500/20 text-emerald-400';
            btnP.className = 'py-2.5 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-1.5 border-gray-600 bg-gray-900 text-gray-400 hover:border-amber-500 hover:text-amber-400';
        }
    }
};

function fillSaldoMovEmployeeSelect() {
    const sel = document.getElementById('saldo-mov-employee');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">-- Seleziona --</option>';
    Object.keys(localEmployees).forEach(key => {
        sel.innerHTML += `<option value="${key}">${localEmployees[key].name}</option>`;
    });
    if (userRole === 'gestore') {
        sel.innerHTML += '<option value="__gestore__">Gestore</option>';
    }
    if (userRole === 'dipendente' && currentEmployeeId) {
        sel.value = currentEmployeeId;
        sel.disabled = true;
    } else {
        sel.disabled = false;
        if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
        else if (userRole === 'gestore') sel.value = '__gestore__';
    }
}

document.getElementById('saldo-movimento-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const empVal = document.getElementById('saldo-mov-employee')?.value;
    const action = document.getElementById('saldo-mov-action')?.value || 'preleva';
    const amount = parseFloat(document.getElementById('saldo-mov-amount')?.value);
    const note = (document.getElementById('saldo-mov-note')?.value || '').trim();

    if (!empVal) {
        showToast('Seleziona l\'operatore.', 'warning');
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showToast('Inserisci un importo valido maggiore di zero.', 'warning');
        return;
    }

    let operatorName = 'Operatore';
    if (empVal === '__gestore__') {
        operatorName = currentUser?.email || 'Gestore';
    } else if (localEmployees[empVal]) {
        operatorName = localEmployees[empVal].name;
    }

    const prev = (localBalance && typeof localBalance.amount === 'number') ? localBalance.amount : 0;
    let newAmount = prev;
    let delta = 0;
    if (action === 'preleva') {
        if (amount > prev) {
            showToast('Importo superiore al saldo disponibile (' + formatValuta(prev) + ').', 'error');
            return;
        }
        newAmount = prev - amount;
        delta = -amount;
    } else {
        newAmount = prev + amount;
        delta = amount;
    }

    const now = Date.now();
    const batch = db.batch();
    batch.set(db.collection('balance').doc('current'), {
        amount: newAmount,
        updatedAt: now,
        updatedBy: operatorName
    }, { merge: true });
    batch.set(db.collection('balance_logs').doc(), {
        timestamp: now,
        dateString: new Date(now).toLocaleString('it-IT'),
        operatorName,
        employeeId: empVal === '__gestore__' ? null : empVal,
        type: action === 'preleva' ? 'preleva' : 'deposita',
        prevAmount: prev,
        newAmount: newAmount,
        delta: delta,
        note: note || (action === 'preleva' ? 'Prelievo crediti' : 'Deposito crediti')
    });
    batch.commit()
        .then(() => {
            document.getElementById('saldo-mov-amount').value = '';
            document.getElementById('saldo-mov-note').value = '';
            if (typeof window.setSaldoMovAction === 'function') window.setSaldoMovAction('preleva');
            showToast(action === 'preleva' ? 'Prelievo registrato!' : 'Deposito registrato!', 'success');
        })
        .catch(err => {
            const msg = (err && String(err.message || err.code || '').includes('permission'))
                ? 'Permesso negato su balance/balance_logs. Aggiorna le regole Firestore.'
                : ('Errore: ' + (err.message || err));
            showToast(msg, 'error');
        });
});
