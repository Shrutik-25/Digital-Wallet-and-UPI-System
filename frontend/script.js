const APP_API_BASE = "http://localhost:8080";

function pageName() {
    const current = window.location.pathname.split("/").pop();
    return current || "index.html";
}

function getStoredUser() {
    return localStorage.getItem("user") || "";
}

function getStoredPassword() {
    return localStorage.getItem("password") || "";
}

function normalizeUpi(value) {
    const text = (value || "").trim();
    if (!text) {
        return "";
    }
    return text.includes("@upi") ? text : `${text}@upi`;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.innerText = value;
    }
}

function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.innerHTML = value;
    }
}

function initialsFromUser(user) {
    const base = (user || "U").split("@")[0].trim();
    return (base.charAt(0) || "U").toUpperCase();
}

function populateTopbarUser() {
    const user = getStoredUser();
    if (!user) {
        return;
    }

    setText("usernameText", user.split("@")[0]);
    setText("upiText", user);
    setText("upiId", user);

    const avatarText = initialsFromUser(user);
    document.querySelectorAll(".avatar, #avatar, #bigAvatar").forEach((node) => {
        node.innerText = avatarText;
    });
}

async function parseJsonResponse(res) {
    const text = await res.text();

    if (!text) {
        return { status: "empty_response", httpStatus: res.status };
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        return { status: "invalid_response", httpStatus: res.status, raw: text };
    }
}

async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    return parseJsonResponse(res);
}

const nativeAlert = window.alert.bind(window);
let appPopupTimer = null;

function ensureAppPopup() {
    if (!document.head || !document.body) {
        return null;
    }

    if (!document.getElementById("appPopupStyles")) {
        const style = document.createElement("style");
        style.id = "appPopupStyles";
        style.textContent = `
            .app-popup-overlay {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(4, 10, 20, 0.38);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.18s ease;
                z-index: 99999;
            }
            .app-popup-overlay.visible {
                opacity: 1;
            }
            .app-popup-card {
                min-width: 260px;
                max-width: min(420px, calc(100vw - 32px));
                padding: 18px 22px;
                border-radius: 18px;
                background: linear-gradient(180deg, #16233d, #101b31);
                border: 1px solid rgba(79, 140, 255, 0.35);
                box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
                color: white;
                text-align: center;
                font-size: 15px;
                line-height: 1.45;
                transform: translateY(10px) scale(0.98);
                transition: transform 0.18s ease;
            }
            .app-popup-overlay.visible .app-popup-card {
                transform: translateY(0) scale(1);
            }
        `;
        document.head.appendChild(style);
    }

    let overlay = document.getElementById("appPopupOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "appPopupOverlay";
        overlay.className = "app-popup-overlay";
        overlay.innerHTML = `<div class="app-popup-card" id="appPopupMessage"></div>`;
        document.body.appendChild(overlay);
    }

    return overlay;
}

function showAppPopup(message, duration = 4000) {
    const text = String(message || "").trim();
    if (!text) {
        return;
    }

    const overlay = ensureAppPopup();
    if (!overlay) {
        nativeAlert(text);
        return;
    }

    const messageBox = document.getElementById("appPopupMessage");
    if (!messageBox) {
        nativeAlert(text);
        return;
    }

    messageBox.textContent = text;
    overlay.classList.add("visible");

    if (appPopupTimer) {
        clearTimeout(appPopupTimer);
    }

    appPopupTimer = setTimeout(() => {
        overlay.classList.remove("visible");
    }, duration);
}

window.alert = showAppPopup;

function showLogin() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");

    if (!loginForm || !registerForm || !loginTab || !registerTab) {
        return;
    }

    loginForm.style.display = "block";
    registerForm.style.display = "none";
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
}

function showRegister() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");

    if (!loginForm || !registerForm || !loginTab || !registerTab) {
        return;
    }

    loginForm.style.display = "none";
    registerForm.style.display = "block";
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
}

function setError(id, message) {
    const element = document.getElementById(id);
    if (element) {
        element.innerText = message;
    }
}

function clearSignupErrors() {
    ["nameError", "upiError", "emailError", "phoneError", "balanceError", "pinError", "confirmError"].forEach((id) => {
        setError(id, "");
    });
}

function validateSignupForm() {
    const name = (document.getElementById("name")?.value || "").trim();
    const username = (document.getElementById("username")?.value || "").trim();
    const email = (document.getElementById("email")?.value || "").trim();
    const phone = (document.getElementById("phone")?.value || "").trim();
    const initialBalance = (document.getElementById("initialBalance")?.value || "").trim();
    const password = (document.getElementById("password")?.value || "").trim();
    const confirm = (document.getElementById("confirmPassword")?.value || "").trim();

    clearSignupErrors();

    let valid = true;

    if (!name) {
        setError("nameError", "Enter your name");
        valid = false;
    }

    if (!username || username.includes("@")) {
        setError("upiError", "Use only the handle name");
        valid = false;
    }

    if (!email || !email.includes("@")) {
        setError("emailError", "Enter a valid email");
        valid = false;
    }

    if (!/^\d{10}$/.test(phone)) {
        setError("phoneError", "Enter a 10-digit phone");
        valid = false;
    }

    if (initialBalance === "" || Number(initialBalance) < 0) {
        setError("balanceError", "Enter a valid balance");
        valid = false;
    }

    if (!/^\d{4}$/.test(password)) {
        setError("pinError", "PIN must be 4 digits");
        valid = false;
    }

    if (confirm !== password) {
        setError("confirmError", "PINs do not match");
        valid = false;
    }

    const signupBtn = document.getElementById("signupBtn");
    if (signupBtn) {
        signupBtn.disabled = !valid;
    }

    return valid;
}

async function login() {
    let username = (document.getElementById("loginUsername")?.value || "").trim();
    const password = (document.getElementById("loginPassword")?.value || "").trim();

    if (!username || !password) {
        alert("Please fill all fields");
        return;
    }

    username = normalizeUpi(username);

    const data = await fetchJson(`${APP_API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    }).catch(() => ({ status: "network_error" }));

    if (data.status === "success") {
        localStorage.setItem("user", username);
        localStorage.setItem("password", password);
        localStorage.setItem("balance", data.balance);
        window.location.href = "dashboard.html";
        return;
    }

    alert(data.status === "network_error" ? "Backend not responding" : "Invalid UPI ID or PIN");
}

async function signup() {
    if (!validateSignupForm()) {
        return;
    }

    const payload = {
        name: document.getElementById("name").value.trim(),
        username: normalizeUpi(document.getElementById("username").value.trim()),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        initialBalance: Number(document.getElementById("initialBalance").value),
        password: document.getElementById("password").value.trim()
    };

    const data = await fetchJson(`${APP_API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(() => ({ status: "network_error" }));

    if (data.status === "success") {
        alert("Account created successfully");
        showLogin();
        return;
    }

    if (data.status === "exists") {
        setError("upiError", "This UPI handle already exists");
        return;
    }

    alert(data.status === "network_error" ? "Backend not responding" : "Signup failed");
}

function goDashboard() { window.location.href = "dashboard.html"; }
function goSend() { window.location.href = "send.html"; }
function goRequest() { window.location.href = "request.html"; }
function goHistory() { window.location.href = "history.html"; }
function goProfile() { window.location.href = "profile.html"; }

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

function requireAuth() {
    if (pageName() === "index.html" || pageName() === "signup.html") {
        return true;
    }

    if (!getStoredUser()) {
        window.location.href = "index.html";
        return false;
    }

    return true;
}

function extractAmount(text) {
    const match = String(text).match(/(\d+)/);
    return match ? Number(match[1]) : 0;
}

function setPopupDisplay(id, visible) {
    const popup = document.getElementById(id);
    if (popup) {
        popup.style.display = visible ? "flex" : "none";
    }
}

function showDailyLimitAlert(data, attemptedAmount) {
    const dailySpent = Number(data?.daily_spent || 0);
    const dailyLimit = Number(data?.daily_limit || 10000);
    const remaining = Math.max(dailyLimit - dailySpent, 0);
    const message = remaining > 0
        ? `Daily limit of Rs.${dailyLimit} reached. You can spend only Rs.${remaining} more today, so this Rs.${attemptedAmount} transaction is blocked.`
        : `Daily limit of Rs.${dailyLimit} reached. You cannot make more outgoing payments today.`;

    alert(message);
}

async function refreshStoredBalance() {
    const user = getStoredUser();
    const password = getStoredPassword();

    if (!user || !password) {
        return null;
    }

    const data = await fetchJson(`${APP_API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password })
    }).catch(() => ({ status: "network_error" }));

    if (data.status === "success") {
        localStorage.setItem("balance", data.balance);
        return data.balance;
    }

    return null;
}

async function initDashboardPage() {
    const user = getStoredUser();
    const password = getStoredPassword();
    const fallbackName = user.split("@")[0];

    const profileData = await fetchJson(`${APP_API_BASE}/profile/${user}`).catch(() => ({ status: "network_error" }));
    const accountHolderName = profileData?.name || fallbackName;
    setText("dashboardGreeting", `Hi, ${accountHolderName}`);

    const loginData = await fetchJson(`${APP_API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password })
    }).catch(() => ({ status: "network_error" }));

    if (loginData.status === "success") {
        setText("balance", loginData.balance);
        localStorage.setItem("balance", loginData.balance);
    }

    const historyData = await fetchJson(`${APP_API_BASE}/history/${user}`).catch(() => []);
    const historyList = document.getElementById("historyList");

    if (!Array.isArray(historyData) || !historyList) {
        return;
    }

    historyList.innerHTML = "";

    let sent = 0;
    let received = 0;
    let todaySpent = 0;
    const today = new Date().toDateString().split(" ").slice(0, 3).join(" ");

    historyData.slice().reverse().slice(0, 6).forEach((item) => {
        const li = document.createElement("li");
        li.innerText = item;
        applyHistoryDirectionClass(li, item);
        historyList.appendChild(li);
    });

    historyData.forEach((item) => {
        const amount = extractAmount(item);
        const lower = String(item).toLowerCase();

        if (lower.includes("sent") || lower.includes("paid")) {
            sent += amount;
            if (String(item).includes(today)) {
                todaySpent += amount;
            }
        }

        if (lower.includes("received") || lower.includes("added")) {
            received += amount;
        }
    });

    setText("totalSent", `Rs.${sent}`);
    setText("totalReceived", `Rs.${received}`);
    setText("totalTxns", historyData.length);
    setText("todaySpent", `₹${todaySpent}`);
    setText("txnCount", historyData.length);
}

function extractContactFromHistory(item) {
    const text = String(item || "");
    const onMatch = text.match(/(?:to|from)\s+([^\s]+)\s+on/i);
    if (onMatch) {
        return normalizeUpi(onMatch[1]);
    }

    const fallbackMatch = text.match(/(?:to|from)\s+([^\s]+)/i);
    if (fallbackMatch) {
        return normalizeUpi(fallbackMatch[1]);
    }

    return "";
}

function applyHistoryDirectionClass(element, item) {
    if (!element) {
        return;
    }

    const lower = String(item || "").toLowerCase();
    element.classList.toggle("received", lower.includes("received") || lower.includes("added"));
    element.classList.toggle("outgoing", lower.includes("sent") || lower.includes("paid"));
}

function buildContactCard(user, historyItem = "") {
    const card = document.createElement("div");
    card.className = "user-card";
    const recentLabel = historyItem ? `<br><small>${historyItem}</small>` : `<br><small>${user.username}</small>`;
    card.innerHTML = `<b>${user.name || user.username}</b>${recentLabel}`;
    card.onclick = () => {
        const receiver = document.getElementById("receiver");
        if (receiver) {
            receiver.value = user.username;
        }
    };
    return card;
}

async function loadUserDirectory() {
    const usersList = document.getElementById("usersList");
    if (!usersList) {
        return;
    }

    const currentUser = getStoredUser();
    const users = await fetchJson(`${APP_API_BASE}/users`).catch(() => []);
    const history = await fetchJson(`${APP_API_BASE}/history/${currentUser}`).catch(() => []);

    usersList.innerHTML = "";

    if (!Array.isArray(users)) {
        usersList.innerHTML = "<p>Could not load users.</p>";
        return;
    }

    const availableUsers = users.filter((user) => user.username && user.username !== currentUser);
    const userMap = new Map(availableUsers.map((user) => [user.username, user]));
    const chosenUsers = [];
    const seen = new Set();

    if (Array.isArray(history)) {
        history.slice().reverse().forEach((item) => {
            const contact = extractContactFromHistory(item);
            const fallbackContact = contact.replace(/@upi$/, "");
            const matchedUser = userMap.get(contact) || userMap.get(fallbackContact);

            if (!contact || contact === currentUser || seen.has(contact) || !matchedUser || chosenUsers.length >= 3) {
                return;
            }

            chosenUsers.push({ user: matchedUser, item });
            seen.add(contact);
        });
    }

    availableUsers.forEach((user) => {
        if (chosenUsers.length >= 3 || seen.has(user.username)) {
            return;
        }

        chosenUsers.push({ user, item: "" });
        seen.add(user.username);
    });

    if (chosenUsers.length === 0) {
        usersList.innerHTML = "<p>No contacts available.</p>";
        return;
    }

    chosenUsers.slice(0, 3).forEach(({ user, item }) => {
        usersList.appendChild(buildContactCard(user, item));
    });
}

function closePopup() {
    setPopupDisplay("pinPopup", false);
}

function sendMoney() {
    const receiverInput = document.getElementById("receiver");
    const amountInput = document.getElementById("amount");

    if (!receiverInput || !amountInput) {
        return;
    }

    const receiver = normalizeUpi(receiverInput.value);
    const amount = Number(amountInput.value);

    if (!receiver || !amount || amount <= 0) {
        alert("Enter valid details");
        return;
    }

    if (receiver === getStoredUser()) {
        alert("You cannot send money to yourself");
        return;
    }

    localStorage.setItem("tempReceiver", receiver);
    localStorage.setItem("tempAmount", String(amount));
    const pinInput = document.getElementById("upiPin");
    if (pinInput) {
        pinInput.value = "";
    }
    setPopupDisplay("pinPopup", true);
}

async function confirmSendPayment() {
    const user = getStoredUser();
    const receiver = localStorage.getItem("tempReceiver") || "";
    const amount = Number(localStorage.getItem("tempAmount") || "0");
    const pin = (document.getElementById("upiPin")?.value || "").trim();

    if (!pin) {
        alert("Please enter your UPI PIN");
        return;
    }

    setPopupDisplay("pinPopup", false);
    setPopupDisplay("loadingScreen", true);

    const data = await fetchJson(`${APP_API_BASE}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: user, receiver, amount, pin })
    }).catch(() => ({ status: "network_error" }));

    setPopupDisplay("loadingScreen", false);

    if (data.status === "success") {
        localStorage.setItem("balance", data.balance);
        setText("successText", `Rs.${amount} sent to ${receiver}`);
        document.getElementById("receiver").value = "";
        document.getElementById("amount").value = "";
        document.getElementById("remark").value = "";
        setPopupDisplay("successScreen", true);
        return;
    }

    if (data.status === "invalid_pin") {
        alert("Incorrect UPI PIN");
        return;
    }

    if (data.status === "low_balance") {
        alert("Not enough balance");
        return;
    }

    if (data.status === "daily_limit_exceeded") {
        showDailyLimitAlert(data, amount);
        return;
    }

    if (data.status === "invalid_user") {
        alert("Receiver not found");
        return;
    }

    if (data.status === "self_transfer") {
        alert("You cannot send money to yourself");
        return;
    }

    alert(data.status === "network_error" ? "Backend not responding" : "Payment failed");
}

async function initHistoryPage() {
    const user = getStoredUser();
    const data = await fetchJson(`${APP_API_BASE}/history/${user}`).catch(() => []);

    const historyList = document.getElementById("historyList");
    const emptyState = document.getElementById("emptyState");

    if (!historyList || !emptyState) {
        return;
    }

    historyList.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
        emptyState.style.display = "block";
        historyList.style.display = "none";
        return;
    }

    emptyState.style.display = "none";
    historyList.style.display = "block";

    data.slice().reverse().forEach((item) => {
        const li = document.createElement("li");
        li.innerText = item;
        applyHistoryDirectionClass(li, item);
        historyList.appendChild(li);
    });
}

async function initProfilePage() {
    const user = getStoredUser();
    const profile = await fetchJson(`${APP_API_BASE}/profile/${user}`).catch(() => ({ status: "network_error" }));

    if (profile.status && profile.status !== "success" && profile.status !== undefined) {
        setText("name", user.split("@")[0]);
        setText("name2", user.split("@")[0]);
        setText("userId", user.split("@")[0]);
        setText("upi", user);
        setText("email", "-");
        setText("phone", "-");
        setText("balance", localStorage.getItem("balance") || "0");
        const editName = document.getElementById("editName");
        const editEmail = document.getElementById("editEmail");
        const editPhone = document.getElementById("editPhone");
        if (editName) editName.value = user.split("@")[0];
        if (editEmail) editEmail.value = "";
        if (editPhone) editPhone.value = "";
        return;
    }

    setText("name", profile.name || user.split("@")[0]);
    setText("name2", profile.name || user.split("@")[0]);
    setText("userId", (profile.username || user).split("@")[0]);
    setText("upi", profile.username || user);
    setText("email", profile.email || "-");
    setText("phone", profile.phone || "-");
    setText("balance", profile.balance ?? localStorage.getItem("balance") ?? "0");

    const editName = document.getElementById("editName");
    const editEmail = document.getElementById("editEmail");
    const editPhone = document.getElementById("editPhone");
    if (editName) editName.value = profile.name || user.split("@")[0];
    if (editEmail) editEmail.value = profile.email || "";
    if (editPhone) editPhone.value = profile.phone || "";
}

function openPinModal() {
    const modal = document.getElementById("pinModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function closePinModal() {
    const modal = document.getElementById("pinModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function openEditProfileModal() {
    const modal = document.getElementById("editProfileModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function closeEditProfileModal() {
    const modal = document.getElementById("editProfileModal");
    if (modal) {
        modal.style.display = "none";
    }
}

async function saveProfileDetails() {
    const username = getStoredUser();
    const name = (document.getElementById("editName")?.value || "").trim();
    const email = (document.getElementById("editEmail")?.value || "").trim();
    const phone = (document.getElementById("editPhone")?.value || "").trim();

    if (!name) {
        alert("Enter your name");
        return;
    }

    if (email && !email.includes("@")) {
        alert("Enter a valid email");
        return;
    }

    if (phone && !/^\d{10}$/.test(phone)) {
        alert("Enter a valid 10-digit phone number");
        return;
    }

    const data = await fetchJson(`${APP_API_BASE}/update_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, email, phone })
    }).catch(() => ({ status: "network_error" }));

    if (data.status === "network_error" || data.status === "error" || data.status === "invalid_user") {
        alert(data.status === "network_error" ? "Backend not responding" : "Could not update profile");
        return;
    }

    setText("name", data.name || name);
    setText("name2", data.name || name);
    setText("userId", (data.username || username).split("@")[0]);
    setText("upi", data.username || username);
    setText("email", data.email || "-");
    setText("phone", data.phone || "-");
    setText("usernameText", (data.name || name).split(" ")[0]);
    closeEditProfileModal();
    alert("Profile updated successfully");
}

async function changePin() {
    const username = getStoredUser();
    const oldPin = (document.getElementById("oldPin")?.value || "").trim();
    const newPin = (document.getElementById("newPin")?.value || "").trim();

    if (!/^\d{4}$/.test(newPin)) {
        alert("New PIN must be 4 digits");
        return;
    }

    const data = await fetchJson(`${APP_API_BASE}/change_pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, oldPin, newPin })
    }).catch(() => ({ status: "network_error" }));

    if (data.status === "success") {
        localStorage.setItem("password", newPin);
        closePinModal();
        document.getElementById("oldPin").value = "";
        document.getElementById("newPin").value = "";
        alert("UPI PIN changed successfully");
        return;
    }

    alert(data.status === "invalid_pin" ? "Old PIN is incorrect" : "Could not change PIN");
}

function addMoney() {
    const amount = Number(document.getElementById("amount")?.value || "0");
    if (!amount || amount <= 0) {
        alert("Enter a valid amount");
        return;
    }

    const pinInput = document.getElementById("upiPin");
    if (pinInput) {
        pinInput.value = "";
    }
    setPopupDisplay("pinPopup", true);
}

function initAuthPage() {
    const signupFields = ["name", "username", "email", "phone", "initialBalance", "password", "confirmPassword"];
    signupFields.forEach((id) => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener("input", validateSignupForm);
        }
    });
    validateSignupForm();
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!requireAuth()) {
        return;
    }

    populateTopbarUser();

    switch (pageName()) {
        case "index.html":
            initAuthPage();
            break;
        case "dashboard.html":
            await initDashboardPage();
            break;
        case "send.html":
            await loadUserDirectory();
            setPopupDisplay("pinPopup", false);
            setPopupDisplay("loadingScreen", false);
            setPopupDisplay("successScreen", false);
            break;
        case "history.html":
            await initHistoryPage();
            break;
        case "profile.html":
            await initProfilePage();
            break;
        default:
            break;
    }
});
