// LifeDrop — combined frontend-only version.
// All records are stored in this browser with localStorage. There is no backend.

const STORAGE_KEYS = {
    donors: "lifedrop_donors_v2",
    appointments: "lifedrop_appointments_v2",
    units: "lifedrop_units_v2"
};

const camps = [
    { id: "camp1", name: "Campus Care Donation Day", date: "2026-11-14", venue: "Central Seminar Hall", time: "9:00 AM - 1:00 PM" },
    { id: "camp2", name: "Red Cross Youth Drive", date: "2026-11-22", venue: "City Community Centre", time: "10:00 AM - 3:00 PM" },
    { id: "camp3", name: "One Drop, One Hope", date: "2026-12-06", venue: "College Sports Complex", time: "9:30 AM - 2:00 PM" }
];

const sampleInventory = [
    ["A+", 5], ["A-", 2], ["B+", 4], ["B-", 2],
    ["AB+", 2], ["AB-", 1], ["O+", 8], ["O-", 3]
];

const $ = id => document.getElementById(id);

function readData(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function formatDate(dateString) {
    return new Date(dateString + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
    });
}

function showMessage(id, message, success = true) {
    const element = $(id);
    if (!element) return;
    element.textContent = message;
    element.style.color = success ? "green" : "#b91c1c";
}

// UPCOMING CAMPS + SEARCH
function renderCamps(searchText = "") {
    const filtered = camps.filter(camp =>
        (camp.name + " " + camp.venue).toLowerCase().includes(searchText.toLowerCase())
    );

    $("campList").innerHTML = filtered.length ? filtered.map(camp => {
        const date = new Date(camp.date + "T00:00:00");
        return `
            <article class="camp-card">
                <div class="camp-top">
                    <div class="camp-date"><small>${date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</small>${date.getDate()}</div>
                    <span class="status-tag">Open for interest</span>
                </div>
                <div class="camp-body">
                    <h3>${escapeHTML(camp.name)}</h3>
                    <p>📍 ${escapeHTML(camp.venue)}</p>
                    <p>🕒 ${escapeHTML(camp.time)}</p>
                    <p>Organized by campus volunteers.</p>
                    <button type="button" class="choose-camp" data-camp="${camp.id}">Choose this camp</button>
                </div>
            </article>`;
    }).join("") : '<p class="empty-state">No matching camps found.</p>';

    document.querySelectorAll(".choose-camp").forEach(button => {
        button.addEventListener("click", () => {
            const selected = camps.find(camp => camp.id === button.dataset.camp);
            if (!selected) return;
            $("appointmentName").value = $("name").value.trim();
            $("appointmentDate").value = selected.date;
            $("appointment").scrollIntoView({ behavior: "smooth" });
        });
    });
}

$("campSearch").addEventListener("input", event => renderCamps(event.target.value));

// DONOR REGISTRATION
$("donorForm").addEventListener("submit", event => {
    event.preventDefault();

    const donor = {
        id: Date.now(),
        name: $("name").value.trim(),
        age: Number($("age").value),
        weight: Number($("weight").value),
        bloodGroup: $("bloodGroup").value,
        phone: $("phone").value.trim(),
        email: $("email").value.trim(),
        registeredAt: new Date().toISOString()
    };

    if (!event.currentTarget.reportValidity()) return;
    if (!donor.name || donor.age < 18 || donor.age > 65 || donor.weight <= 0 ||
        !/^[0-9]{10}$/.test(donor.phone) || !donor.bloodGroup ||
        !$("donorConsent").checked) {
        showMessage("registrationMessage", "Please check your details. Age must be 18–65 and phone number must contain 10 digits.", false);
        return;
    }

    const donors = readData(STORAGE_KEYS.donors);
    donors.push(donor);
    writeData(STORAGE_KEYS.donors, donors);

    showMessage("registrationMessage", "Registration successful! Welcome to LifeDrop ❤️");
    event.currentTarget.reset();
    renderOrganizer();
});

// ELIGIBILITY SELF-CHECK
$("eligibilityForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const passed = $("weightCheck").value === "yes" &&
        $("tattooCheck").value === "no" &&
        $("hbCheck").value === "yes" &&
        $("healthCheck").value === "yes";

    $("eligibilityResult").textContent = passed
        ? "You pass this preliminary self-check! Final medical screening is required."
        : "You do not pass this preliminary self-check. Please consult medical staff.";
    $("eligibilityResult").style.color = passed ? "green" : "red";
});

// APPOINTMENT BOOKING
$("appointmentDate").min = new Date().toISOString().split("T")[0];

$("appointmentForm").addEventListener("submit", event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const appointment = {
        id: Date.now(),
        name: $("appointmentName").value.trim(),
        date: $("appointmentDate").value,
        time: $("timeSlot").value
    };

    const selectedDate = new Date(appointment.date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!appointment.name || selectedDate < today) {
        showMessage("appointmentMessage", "Please enter a donor name and select today or a future date.", false);
        return;
    }

    const appointments = readData(STORAGE_KEYS.appointments);
    const slotTaken = appointments.some(item =>
        item.date === appointment.date && item.time === appointment.time
    );

    if (slotTaken) {
        showMessage("appointmentMessage", "Sorry! This demo time slot is already booked.", false);
        return;
    }

    appointments.push(appointment);
    writeData(STORAGE_KEYS.appointments, appointments);
    showMessage("appointmentMessage", "Appointment booked successfully! ❤️");
    event.currentTarget.reset();
    $("appointmentDate").min = new Date().toISOString().split("T")[0];
    renderOrganizer();
});

// BLOOD COLLECTION PROGRESS
let units = Number(localStorage.getItem(STORAGE_KEYS.units)) || 0;
const target = 100;

function updateProgress() {
    units = Math.max(0, Math.min(target, units));
    $("units").textContent = units;
    $("donationCount").textContent = units;
    $("progressBar").style.width = (units / target * 100) + "%";
}

$("collectBtn").addEventListener("click", () => {
    if (units >= target) {
        alert("Collection target reached!");
        return;
    }
    units += 1;
    localStorage.setItem(STORAGE_KEYS.units, String(units));
    updateProgress();
});

// BLOOD GROUP INVENTORY
function renderInventory() {
    $("inventory").innerHTML = sampleInventory.map(([group, count]) => `
        <p><strong>${group}</strong>: ${count} sample units</p>
    `).join("");
}

// ORGANIZER DASHBOARD
function renderOrganizer() {
    const donors = readData(STORAGE_KEYS.donors);
    const appointments = readData(STORAGE_KEYS.appointments);

    $("memberCount").textContent = donors.length;

    $("donorList").innerHTML = donors.length ? donors.slice().reverse().map(donor => `
        <div class="donor-row">
            <div><strong>${escapeHTML(donor.name)}</strong>
            <small>${escapeHTML(donor.bloodGroup)} · Age ${donor.age} · ${escapeHTML(donor.email)} · ${escapeHTML(donor.phone)}</small></div>
            <span class="status-tag">Demo registration</span>
        </div>
    `).join("") : '<p class="empty-state">No registrations yet.</p>';

    $("appointmentList").innerHTML = appointments.length ? appointments.slice().reverse().map(item => `
        <div class="donor-row">
            <div><strong>${escapeHTML(item.name)}</strong>
            <small>${formatDate(item.date)} · ${escapeHTML(item.time)}</small></div>
            <span class="status-tag">Demo appointment</span>
        </div>
    `).join("") : '<p class="empty-state">No appointments yet.</p>';
}

$("exportBtn").addEventListener("click", () => {
    const donors = readData(STORAGE_KEYS.donors);
    const appointments = readData(STORAGE_KEYS.appointments);

    if (!donors.length && !appointments.length) {
        alert("There is no demo data to export yet.");
        return;
    }

    const rows = [["Record Type", "Name", "Age", "Weight (kg)", "Blood Group", "Phone", "Email", "Date", "Time"]];
    donors.forEach(d => rows.push(["Donor", d.name, d.age, d.weight, d.bloodGroup, d.phone, d.email, "", ""]));
    appointments.forEach(a => rows.push(["Appointment", a.name, "", "", "", "", "", a.date, a.time]));

    const csv = rows.map(row => row.map(value =>
        '"' + String(value ?? "").replace(/"/g, '""') + '"'
    ).join(",")).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lifedrop-demo-records.csv";
    link.click();
    URL.revokeObjectURL(url);
});

$("clearData").addEventListener("click", () => {
    if (!confirm("Clear all donor registrations and appointments saved for this LifeDrop demo?")) return;
    localStorage.removeItem(STORAGE_KEYS.donors);
    localStorage.removeItem(STORAGE_KEYS.appointments);
    renderOrganizer();
});

// INITIAL PAGE RENDER
$("campCount").textContent = camps.length;
renderCamps();
renderInventory();
renderOrganizer();
updateProgress();
