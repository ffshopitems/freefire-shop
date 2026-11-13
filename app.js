/* FF SHOP - front-end demo.
   Change these values before testing your own admin and WhatsApp contact.
   IMPORTANT: This static demo is not secure for a public production store.
   Real admin security, accounts and shared uploads require a backend. */

const CONFIG = {
  adminUsername: "admin",
  adminPassword: "FFShop@123",
  whatsappNumber: "", // Example Pakistan format: 923001234567 (digits only)
  storageLimitBytes: 500 * 1024 * 1024
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE_KEY = "ffshop_posts_v1";
const USERS_KEY = "ffshop_users_v1";
const SESSION_KEY = "ffshop_session_v1";
const DB_NAME = "ffshop_media_db";
const DB_STORE = "media";

let currentUser = null;
let activeCategory = "All";
let currentCommentPostId = null;
let authMode = "login";
let toastTimer = null;

const seedPosts = [
  { id: "sample-diamonds", title: "1000 Diamonds Available", description: "Quick order · Message us on WhatsApp for details.", category: "Diamonds", price: 399, type: "photo", artwork: "art-blue", icon: "💎", label: "DIAMONDS", likes: [], comments: [], mediaId: null, mediaSize: 0, sample: true },
  { id: "sample-pass", title: "Elite Pass Season", description: "Check the latest pass and available rewards.", category: "Passes", price: 299, type: "photo", artwork: "art-gold", icon: "🏅", label: "ELITE PASS", likes: [], comments: [], mediaId: null, mediaSize: 0, sample: true },
  { id: "sample-skins", title: "Rare Gun Skins", description: "Ask us about available skins and offers.", category: "Free Fire", price: 199, type: "photo", artwork: "art-red", icon: "🎁", label: "GUN SKINS", likes: [], comments: [], mediaId: null, mediaSize: 0, sample: true },
  { id: "sample-account", title: "Free Fire Account", description: "Account details and screenshots available on request.", category: "Accounts", price: 1499, type: "photo", artwork: "art-cyan", icon: "🎮", label: "ACCOUNT", likes: [], comments: [], mediaId: null, mediaSize: 0, sample: true },
  { id: "sample-rank", title: "Rank Push Tips", description: "Watch tips and tricks from the community.", category: "Free Fire", price: 0, type: "video", artwork: "art-purple", icon: "🏆", label: "RANK TIPS", likes: [], comments: [], mediaId: null, mediaSize: 0, sample: true },
  { id: "sample-event", title: "Upcoming Free Fire Events", description: "Keep an eye on new events and announcements.", category: "Events", price: 33, type: "photo", artwork: "art-blue", icon: "📅", label: "EVENTS", likes: [], comments: [], mediaId: null, mediaSize: 0, sample: true }
];

function readPosts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(saved) ? saved : structuredClone(seedPosts);
  } catch {
    return structuredClone(seedPosts);
  }
}
let posts = readPosts();

function savePosts() {
  localStorage.setItem(STORE_KEY, JSON.stringify(posts));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openModal(id) {
  $("#" + id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal(modal) {
  modal.classList.add("hidden");
  if (!$$(".modal").some(item => !item.classList.contains("hidden"))) document.body.style.overflow = "";
}
$$("[data-close-modal]").forEach(button => button.addEventListener("click", () => closeModal(button.closest(".modal"))));
$$(".modal").forEach(modal => modal.addEventListener("click", event => {
  if (event.target === modal) closeModal(modal);
}));

function openAuth(mode = "login") {
  setAuthMode(mode);
  $("#authMessage").textContent = "";
  $("#authForm").reset();
  openModal("authModal");
}
function setAuthMode(mode) {
  authMode = mode;
  $$(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.authMode === mode));
  $("#authTitle").textContent = mode === "login" ? "Welcome back" : "Create your account";
  $("#authSubtitle").textContent = mode === "login" ? "Login with your username and password." : "Choose a username and password to join FF Shop.";
  $("#authSubmit").textContent = mode === "login" ? "Login" : "Create account";
  $("#authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
}
$$("[data-auth-mode]").forEach(tab => tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode)));
$$("[data-open-auth]").forEach(button => button.addEventListener("click", () => openAuth(button.dataset.openAuth)));

async function hashPassword(password) {
  if (window.crypto && crypto.subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(password)));
}
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch { return {}; }
}
function setSession(user) {
  currentUser = user;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  renderAccount();
  renderFeed();
  renderStorage();
}
function clearSession() {
  currentUser = null;
  sessionStorage.removeItem(SESSION_KEY);
  renderAccount();
  renderFeed();
  renderStorage();
}

$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const username = $("#authUsername").value.trim();
  const password = $("#authPassword").value;
  const message = $("#authMessage");
  message.textContent = "";

  if (username.toLowerCase() === CONFIG.adminUsername.toLowerCase() && password === CONFIG.adminPassword) {
    setSession({ username: CONFIG.adminUsername, role: "admin" });
    closeModal($("#authModal"));
    showToast("Admin login successful.");
    return;
  }

  if (authMode === "signup") {
    if (username.length < 3) { message.textContent = "Username must be at least 3 characters."; return; }
    if (password.length < 6) { message.textContent = "Password must be at least 6 characters."; return; }
    if (username.toLowerCase() === CONFIG.adminUsername.toLowerCase()) { message.textContent = "This username is reserved."; return; }
    const users = getUsers();
    const key = username.toLowerCase();
    if (users[key]) { message.textContent = "That username is already taken."; return; }
    users[key] = { username, passwordHash: await hashPassword(password) };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    setSession({ username, role: "user" });
    closeModal($("#authModal"));
    showToast("Account created. Welcome to FF Shop!");
    return;
  }

  const user = getUsers()[username.toLowerCase()];
  if (!user || user.passwordHash !== await hashPassword(password)) {
    message.textContent = "Incorrect username or password.";
    return;
  }
  setSession({ username: user.username, role: "user" });
  closeModal($("#authModal"));
  showToast("You are now logged in.");
});

function renderAccount() {
  const isAdmin = currentUser?.role === "admin";
  $("#authPanel").classList.toggle("hidden", !!currentUser);
  $("#signedPanel").classList.toggle("hidden", !currentUser);
  $("#uploadNav").classList.toggle("hidden", !isAdmin);
  $("#adminNote").classList.toggle("hidden", !isAdmin);
  if (currentUser) {
    $("#sideUsername").textContent = currentUser.username;
    $("#sideRole").textContent = isAdmin ? "ADMIN" : "USER";
    $("#profileName").textContent = currentUser.username;
    $("#profileHandle").textContent = "@" + currentUser.username;
  } else {
    $("#profileName").textContent = "Guest";
    $("#profileHandle").textContent = "@browse_guest";
  }
}

function money(value) {
  const amount = Number(value) || 0;
  return amount <= 0 ? "Free" : "Rs. " + amount.toLocaleString("en-PK");
}
function isLiked(post) {
  return !!currentUser && Array.isArray(post.likes) && post.likes.includes(currentUser.username.toLowerCase());
}
function postMatches(post) {
  const query = $("#searchInput").value.trim().toLowerCase();
  const categoryMatch = activeCategory === "All" || post.category === activeCategory;
  const searchMatch = !query || [post.title, post.description, post.category].join(" ").toLowerCase().includes(query);
  return categoryMatch && searchMatch;
}

async function getMedia(mediaId) {
  if (!mediaId) return null;
  const db = await openMediaDB();
  return new Promise(resolve => {
    const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(mediaId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}
function openMediaDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveMedia(file) {
  const db = await openMediaDB();
  const id = "media_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put({ id, blob: file, name: file.name, type: file.type, size: file.size });
    transaction.oncomplete = () => resolve(id);
    transaction.onerror = () => reject(transaction.error);
  });
}
async function deleteMedia(mediaId) {
  if (!mediaId) return;
  const db = await openMediaDB();
  return new Promise(resolve => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).delete(mediaId);
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
}

function artworkMarkup(post) {
  return `<div class="artwork ${escapeHtml(post.artwork || "art-purple")}">
    <span class="artwork-icon">${escapeHtml(post.icon || "🎮")}</span>
    <span class="artwork-label">${escapeHtml(post.label || post.category || "FF SHOP")}</span>
  </div>`;
}
async function renderFeed() {
  const grid = $("#feedGrid");
  const filtered = posts.filter(postMatches).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("#emptyState").classList.toggle("hidden", filtered.length !== 0);
  grid.innerHTML = "";
  const isAdmin = currentUser?.role === "admin";

  for (const post of filtered) {
    const card = document.createElement("article");
    card.className = "post-card";
    const likes = Array.isArray(post.likes) ? post.likes.length : 0;
    const comments = Array.isArray(post.comments) ? post.comments.length : 0;
    card.innerHTML = `
      <div class="post-media" id="media-${escapeHtml(post.id)}">
        ${artworkMarkup(post)}
        <span class="media-badge">${post.type === "video" ? "VIDEO" : "PHOTO"}</span>
      </div>
      <div class="post-body">
        <h3 class="post-title">${escapeHtml(post.title)}</h3>
        <p class="post-description">${escapeHtml(post.description || "Free Fire content and offers on FF Shop.")}</p>
        <div class="post-meta">
          <span class="price ${Number(post.price) <= 0 ? "free" : ""}">${escapeHtml(money(post.price))}</span>
          <button class="buy-button" data-buy="${escapeHtml(post.id)}"><span>◉</span> Buy Now</button>
        </div>
        <div class="post-actions">
          <button class="action-button ${isLiked(post) ? "liked" : ""}" data-like="${escapeHtml(post.id)}">♡ ${likes}</button>
          <button class="action-button" data-comments="${escapeHtml(post.id)}">☷ ${comments}</button>
          <span class="action-spacer"></span>
          ${isAdmin ? `<button class="action-button delete-button" data-delete="${escapeHtml(post.id)}">Delete</button>` : ""}
        </div>
      </div>`;
    grid.appendChild(card);

    if (post.mediaId) {
      const media = await getMedia(post.mediaId);
      const mediaBox = card.querySelector(".post-media");
      if (media?.blob) {
        const url = URL.createObjectURL(media.blob);
        mediaBox.innerHTML = post.type === "video"
          ? `<video src="${url}" controls playsinline preload="metadata"></video><span class="media-badge">VIDEO</span>`
          : `<img src="${url}" alt="${escapeHtml(post.title)}"><span class="media-badge">PHOTO</span>`;
      }
    }
  }
  renderStorage();
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function renderStorage() {
  const used = posts.reduce((sum, post) => sum + (Number(post.mediaSize) || 0), 0);
  const limit = CONFIG.storageLimitBytes;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const fill = $("#storageFill");
  fill.style.width = percent + "%";
  fill.style.background = percent >= 90 ? "#ff4d61" : percent >= 60 ? "#f4c542" : "#16c766";
  $("#storageUsed").textContent = formatBytes(used) + " used";
  $("#storageTotal").textContent = "of " + formatBytes(limit);
  const status = $("#storageStatus");
  status.textContent = percent >= 90 ? "Storage almost full" : percent >= 60 ? "Storage filling up" : "Storage available";
  status.style.color = percent >= 90 ? "#ff7888" : percent >= 60 ? "#f4d36b" : "#49e58c";
  status.style.background = percent >= 90 ? "rgba(255,77,97,.13)" : percent >= 60 ? "rgba(244,197,66,.13)" : "rgba(17,199,98,.14)";
}

$("#feedGrid").addEventListener("click", async event => {
  const buyButton = event.target.closest("[data-buy]");
  const likeButton = event.target.closest("[data-like]");
  const commentButton = event.target.closest("[data-comments]");
  const deleteButton = event.target.closest("[data-delete]");

  if (buyButton) {
    const post = posts.find(item => item.id === buyButton.dataset.buy);
    if (!post) return;
    if (!CONFIG.whatsappNumber || CONFIG.whatsappNumber.includes("X")) {
      showToast("Add your WhatsApp number in app.js first.");
      return;
    }
    const text = `Assalam-o-Alaikum! I am interested in: ${post.title}. Price: ${money(post.price)}.`;
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  if (likeButton) {
    if (!currentUser) { openAuth("login"); showToast("Login to like a post."); return; }
    const post = posts.find(item => item.id === likeButton.dataset.like);
    if (!post) return;
    post.likes ||= [];
    const key = currentUser.username.toLowerCase();
    post.likes = post.likes.includes(key) ? post.likes.filter(item => item !== key) : [...post.likes, key];
    savePosts();
    renderFeed();
  }

  if (commentButton) {
    if (!currentUser) { openAuth("login"); showToast("Login to comment."); return; }
    currentCommentPostId = commentButton.dataset.comments;
    renderComments();
    openModal("commentsModal");
  }

  if (deleteButton) {
    if (currentUser?.role !== "admin") return;
    const post = posts.find(item => item.id === deleteButton.dataset.delete);
    if (!post) return;
    if (!confirm(`Delete "${post.title}"?`)) return;
    await deleteMedia(post.mediaId);
    posts = posts.filter(item => item.id !== post.id);
    savePosts();
    renderFeed();
    showToast("Post deleted.");
  }
});

function renderComments() {
  const post = posts.find(item => item.id === currentCommentPostId);
  if (!post) return;
  $("#commentsTitle").textContent = "Comments · " + post.title;
  const list = $("#commentsList");
  list.innerHTML = "";
  const comments = post.comments || [];
  if (!comments.length) {
    list.innerHTML = '<p class="muted">No comments yet. Be the first to comment.</p>';
    return;
  }
  comments.forEach(comment => {
    const item = document.createElement("div");
    item.className = "comment-item";
    item.innerHTML = `<b>${escapeHtml(comment.username)}</b><p>${escapeHtml(comment.text)}</p>`;
    list.appendChild(item);
  });
}
$("#commentForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!currentUser) { openAuth("login"); return; }
  const post = posts.find(item => item.id === currentCommentPostId);
  const text = $("#commentInput").value.trim();
  if (!post || !text) return;
  post.comments ||= [];
  post.comments.push({ username: currentUser.username, text, createdAt: Date.now() });
  savePosts();
  $("#commentInput").value = "";
  renderComments();
  renderFeed();
});

$("#uploadNav").addEventListener("click", () => {
  if (currentUser?.role !== "admin") { showToast("Admin access only."); return; }
  $("#uploadForm").reset();
  $("#uploadMessage").textContent = "";
  openModal("uploadModal");
});
$("#uploadForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (currentUser?.role !== "admin") { showToast("Admin access only."); return; }
  const file = $("#postFile").files[0];
  const message = $("#uploadMessage");
  if (!file) { message.textContent = "Choose a video or photo."; return; }
  if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) { message.textContent = "Only video and image files are supported."; return; }
  const used = posts.reduce((sum, post) => sum + (Number(post.mediaSize) || 0), 0);
  if (used + file.size > CONFIG.storageLimitBytes) { message.textContent = "Storage limit reached. Remove an old upload or increase the demo limit in app.js."; return; }
  if (file.size > 100 * 1024 * 1024) { message.textContent = "For this demo, each file must be under 100 MB."; return; }

  message.textContent = "Saving your file...";
  try {
    const mediaId = await saveMedia(file);
    const type = file.type.startsWith("video/") ? "video" : "photo";
    posts.unshift({
      id: "post_" + Date.now(),
      title: $("#postTitle").value.trim(),
      description: $("#postDescription").value.trim(),
      category: $("#postCategory").value,
      price: Number($("#postPrice").value) || 0,
      type, mediaId, mediaSize: file.size, likes: [], comments: [], createdAt: Date.now()
    });
    savePosts();
    closeModal($("#uploadModal"));
    renderFeed();
    showToast("Your post has been published.");
  } catch (error) {
    message.textContent = "Could not save the file in this browser. Try a smaller file.";
  }
});

$$("[data-category]").forEach(button => button.addEventListener("click", () => {
  activeCategory = button.dataset.category;
  $$(".category-chip").forEach(chip => chip.classList.toggle("active", chip === button));
  $("#feedTitle").textContent = activeCategory === "All" ? "Explore FF Shop" : activeCategory;
  renderFeed();
}));
$("#searchInput").addEventListener("input", renderFeed);
$("#searchNav").addEventListener("click", () => {
  $("#searchInput").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$$('[data-page="home"]').forEach(button => button.addEventListener("click", () => {
  activeCategory = "All";
  $$(".category-chip").forEach(chip => chip.classList.toggle("active", chip.dataset.category === "All"));
  $("#feedTitle").textContent = "Explore FF Shop";
  renderFeed();
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.page === "home"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}));
function openProfile() {
  if (!currentUser) { openAuth("login"); return; }
  showToast("You are signed in as " + currentUser.username + ".");
}
$$('[data-page="profile"], #topProfileButton, #sideProfileButton').forEach(button => button.addEventListener("click", openProfile));
$$('[data-page="likes"]').forEach(button => button.addEventListener("click", () => {
  if (!currentUser) { openAuth("login"); return; }
  const liked = posts.filter(post => (post.likes || []).includes(currentUser.username.toLowerCase()));
  $("#feedTitle").textContent = "My Likes";
  activeCategory = "All";
  $("#feedGrid").innerHTML = "";
  const previous = posts;
  posts = liked;
  renderFeed().finally(() => { posts = previous; });
}));
$$('[data-page="comments"]').forEach(button => button.addEventListener("click", () => {
  if (!currentUser) { openAuth("login"); return; }
  const mine = posts.flatMap(post => (post.comments || []).filter(comment => comment.username === currentUser.username).map(comment => ({...comment, postTitle: post.title})));
  if (!mine.length) { showToast("You have not commented yet."); return; }
  showToast(`You have ${mine.length} comment(s) on FF Shop.`);
}));
$("#settingsButton").addEventListener("click", () => showToast("Demo settings: update admin and WhatsApp details in app.js."));
$("#logoutButton").addEventListener("click", () => { clearSession(); showToast("Logged out."); });

function restoreSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (session && (session.role === "admin" || session.role === "user")) currentUser = session;
  } catch { currentUser = null; }
}
function startLoader() {
  const bar = $("#loaderBar");
  const percent = $("#loaderPercent");
  let value = 0;
  const timer = setInterval(() => {
    value = Math.min(100, value + Math.ceil(Math.random() * 8));
    bar.style.width = value + "%";
    percent.textContent = value + "%";
    if (value >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        $("#loader").classList.add("done");
        $("#app").classList.remove("hidden");
      }, 220);
    }
  }, 45);
}

restoreSession();
renderAccount();
renderStorage();
renderFeed();
startLoader();
