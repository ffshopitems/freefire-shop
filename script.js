// FF SHOP frontend connected to the single Cloudflare Worker.
const API_BASE = "https://video-auth-worker.ggondalssab13.workers.dev";
const $ = id => document.getElementById(id);
let authMode = "login";
let sessionToken = sessionStorage.getItem("ffshop_session") || "";
let currentUser = null;
let filter = "All";

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.style.display = "none", 3000);
}

async function api(path, body = null, token = "") {
  const headers = {};
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(API_BASE + path, {
    method: body === null ? "GET" : "POST",
    headers,
    ...(body === null ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) })
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }
  return data;
}

function tokenOf(data) { return data.token || ""; }
function userOf(data) {
  const user = data.user || data;
  return {
    id: user.id,
    username: user.username || "User",
    isAdmin: data.isAdmin === true || user.isAdmin === true
  };
}
function setMode(mode) {
  authMode = mode;
  $("authTitle").textContent = mode === "signup" ? "Create your account" : "Welcome back";
  $("authSubmit").textContent = mode === "signup" ? "Create account →" : "Sign in →";
  $("authSwitch").textContent = mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account";
  $("authHint").textContent = mode === "signup"
    ? "Enter your email, username and a password of at least 8 characters."
    : "Enter your username and password.";
  $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("authEmail").hidden = mode !== "signup";
  $("authEmailLabel").hidden = mode !== "signup";
  $("authEmail").required = mode === "signup";
  $("authError").textContent = "";
}
function renderAccount() {
  if (!currentUser) {
    $("accountStatus").textContent = "Create an account or sign in.";
    $("authPanel").hidden = false;
    $("signedInPanel").hidden = true;
    $("adminPanel").hidden = true;
    $("mobilePlus").hidden = true;
    $("uploadAccess").hidden = true;
    $("uploadDenied").hidden = true;
    return;
  }
  $("accountStatus").textContent = `Signed in as ${currentUser.username}`;
  $("authPanel").hidden = true;
  $("signedInPanel").hidden = false;
  $("adminStatus").textContent = currentUser.isAdmin
    ? "Administrator account verified by the server."
    : "You are signed in as a customer.";
  $("adminPanel").hidden = !currentUser.isAdmin;
  $("mobilePlus").hidden = !currentUser.isAdmin;
  $("uploadAccess").hidden = !currentUser.isAdmin;
  $("uploadDenied").hidden = currentUser.isAdmin;
  if (currentUser.isAdmin) refreshStorage();
}
async function restore() {
  if (!sessionToken) { renderAccount(); return; }
  try {
    const data = await api("/api/me", null, sessionToken);
    currentUser = userOf(data);
  } catch {
    sessionStorage.removeItem("ffshop_session");
    sessionToken = "";
    currentUser = null;
    toast("Session expired. Please sign in again.");
  }
  renderAccount();
}
async function submit(event) {
  event.preventDefault();
  const username = $("authUsername").value.trim();
  const password = $("authPassword").value;
  const email = $("authEmail").value.trim();
  const error = $("authError");
  const button = $("authSubmit");
  error.textContent = "";
  if (!username || !password) { error.textContent = "Enter both username and password."; return; }
  if (authMode === "signup" && (username.length < 3 || username.length > 24)) {
    error.textContent = "Username must be 3 to 24 characters."; return;
  }
  if (password.length < 8) { error.textContent = "Password must be at least 8 characters."; return; }
  if (authMode === "signup" && !email) { error.textContent = "Enter your email address."; return; }

  button.disabled = true;
  button.textContent = "Please wait...";
  try {
    let data;
    if (authMode === "signup") {
      data = await api("/api/register", { username, email, password });
    } else {
      try {
        data = await api("/api/admin/login", { username, password });
      } catch (error) {
        if (/failed to fetch|network|cors/i.test(error.message)) throw error;
        data = await api("/api/login", { username, password });
      }
    }
    const token = tokenOf(data);
    if (!token) throw new Error("Worker did not return a login token.");
    sessionToken = token;
    sessionStorage.setItem("ffshop_session", token);
    currentUser = userOf(await api("/api/me", null, token));
    $("authForm").reset();
    renderAccount();
    toast(authMode === "signup" ? "Account created successfully." : "Signed in successfully.");
  } catch (error) {
    $("authError").textContent = error.message || "Could not connect. Please try again.";
  } finally {
    button.disabled = false;
    setMode(authMode);
  }
}
function logout() {
  sessionStorage.removeItem("ffshop_session");
  sessionToken = "";
  currentUser = null;
  renderAccount();
  toast("Signed out.");
}
function go(page) {
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === page + "Page"));
  document.querySelectorAll("[data-page]").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "search") $("searchInput").focus();
  if (page === "videos") renderVideos();
}
function empty(id, category = "All") {
  const el = $(id);
  if (el) el.innerHTML = `<div class="empty"><strong>No published items${category === "All" ? "" : ` in ${safe(category)}`} yet</strong><p>Published store items will appear here.</p></div>`;
}
function filterNow() {
  document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("selected", button.dataset.filter === filter));
  empty("shopItems", filter);
  empty("homeItems");
}
function search() {
  const query = $("searchInput").value.trim();
  $("searchResults").innerHTML = query
    ? `<div class="empty"><strong>No matching published items</strong><p>No current catalog items match “${safe(query)}”.</p></div>`
    : '<div class="empty"><strong>Search the store</strong><p>Enter a search term to look for published items.</p></div>';
}
const DEFAULT_WA = "923248201259";
function waNumber() { return (localStorage.getItem("ffshop_wa_number") || DEFAULT_WA).replace(/\D/g, ""); }
function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function normalizeVideo(video) {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    category: video.category,
    pricePKR: video.price_pkr ?? video.pricePKR ?? 0,
    videoUrl: video.video_url || video.videoUrl || "",
    thumbnailUrl: video.thumbnail_url || video.thumbnailUrl || "",
    likeCount: video.likes_count ?? video.likeCount ?? 0,
    commentCount: video.comments_count ?? video.commentCount ?? 0
  };
}
function videoCard(video) {
  const v = normalizeVideo(video);
  return `<article class="video-card">
    <div class="video-frame">${v.videoUrl
      ? `<video controls playsinline preload="metadata" src="${safe(v.videoUrl)}" poster="${safe(v.thumbnailUrl)}"></video>`
      : '<div class="video-placeholder">FF SHOP</div>'}</div>
    <div class="video-info">
      <small>${safe(v.category || "Gaming")}</small>
      <h3>${safe(v.title)}</h3><p>${safe(v.description || "")}</p>
      <strong class="price">${Number(v.pricePKR) > 0 ? "PKR " + Number(v.pricePKR).toLocaleString() : "Price on request"}</strong>
      <div class="video-actions">
        <button data-like="${safe(v.id)}">♥ <span>${Number(v.likeCount)}</span></button>
        <button data-comments="${safe(v.id)}">Comments ${Number(v.commentCount)}</button>
        <button class="buy-now" data-buy="${safe(v.id)}" data-title="${safe(v.title)}" data-price="${Number(v.pricePKR) || 0}">Buy Now ↗</button>
      </div>
      <div class="comment-area" id="comments-${safe(v.id)}">
        <form data-comment-form="${safe(v.id)}"><input name="comment" maxlength="300" required placeholder="Write a comment..."><button type="submit">Send</button></form>
        <div class="comment-list"></div>
      </div>
    </div></article>`;
}
async function renderVideos() {
  const query = ($("videoSearch")?.value || "").toLowerCase();
  const category = $("videoCategory")?.value || "All";
  const grid = $("videoGrid");
  try {
    const data = await api("/api/videos");
    const items = (data.videos || data.items || []).map(normalizeVideo);
    const shown = items.filter(video =>
      (category === "All" || video.category === category) &&
      `${video.title || ""} ${video.description || ""}`.toLowerCase().includes(query)
    );
    grid.innerHTML = shown.length ? shown.map(videoCard).join("") :
      '<div class="empty"><strong>No videos published yet</strong><p>Published videos will appear here.</p></div>';
    if ($("homeVideos")) $("homeVideos").innerHTML = shown.slice(0, 3).map(videoCard).join("") || grid.innerHTML;
  } catch (error) {
    grid.innerHTML = `<div class="empty"><strong>Videos could not be loaded</strong><p>${safe(error.message)}</p></div>`;
    if ($("homeVideos")) $("homeVideos").innerHTML = grid.innerHTML;
  }
}
async function refreshStorage() {
  refreshStorageVideoCount();
  try {
    const data = await api("/api/storage/usage", null, sessionToken);
    const mb = Number(data.mb || 0);
    const gb = Number(data.gb || 0);
    $("storageUsed").textContent = mb >= 1024 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
    $("storageUsedDetail").textContent = `${Number(data.bytes || 0).toLocaleString()} bytes`;
    $("storageObjects").textContent = `${Number(data.objects || 0).toLocaleString()} stored objects`;
    $("storageAvailable").textContent = "Not reported";
    const pct = Math.min(100, mb / 10240 * 100);
    $("storageRing").style.background = `conic-gradient(#bd48ff 0 ${pct}%, #382347 ${pct}% 100%)`;
  } catch (error) {
    $("storageUsed").textContent = "Unavailable";
    $("storageUsedDetail").textContent = "Storage API unavailable";
    $("storageObjects").textContent = error.message;
    $("storageAvailable").textContent = "—";
  }
}
async function refreshStorageVideoCount() {
  const el = $("storageVideoCount");
  if (!el) return;
  try {
    const data = await api("/api/videos");
    const videos = data.videos || data.items || [];
    el.textContent = String(videos.length);
    $("storageRecentFiles").innerHTML = videos.slice(0, 5).map(video => `
      <div class="fsd-file"><i>▶</i><b>${safe(video.title)}<small>${safe(video.created_at || "")}</small></b><span>Video</span><em>Published</em></div>
    `).join("") || '<p class="fsd-note">No videos uploaded yet.</p>';
  } catch { el.textContent = "—"; }
}
function openWhatsApp(title, price) {
  const number = waNumber();
  if (!number) { toast("Set a WhatsApp number in Admin Account."); return; }
  const message = `Assalamualaikum bhai, mujhe yeh account pasand aaya hai, mujhe chahiye. Item: ${title}. Price: PKR ${price || "Please confirm"}.`;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");
  const gotoButton = event.target.closest("[data-goto]");
  if (pageButton) { event.preventDefault(); go(pageButton.dataset.page); }
  if (gotoButton) go(gotoButton.dataset.goto);
  if (event.target.closest("#mobilePlus")) { go("upload"); $("videoTitle").focus(); }
});
$("passwordToggle").addEventListener("click", () => {
  const field = $("authPassword"), button = $("passwordToggle");
  const show = field.type === "password";
  field.type = show ? "text" : "password";
  button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  button.setAttribute("aria-pressed", String(show));
  button.innerHTML = show
    ? '<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><path d="m4 4 16 16"></path></svg><span>Hide</span>'
    : '<svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>Show</span>';
});
$("authForm").addEventListener("submit", submit);
$("authSwitch").addEventListener("click", () => setMode(authMode === "login" ? "signup" : "login"));
$("logoutButton").addEventListener("click", logout);
$("searchInput").addEventListener("input", search);
$("headerSearch").addEventListener("click", () => go("search"));
$("saveNumber").addEventListener("click", () => {
  const number = $("adminWhatsApp").value.replace(/\D/g, "");
  if (number.length < 10) { toast("Enter a valid number with country code."); return; }
  localStorage.setItem("ffshop_wa_number", number);
  toast("WhatsApp number saved in this browser.");
});

document.addEventListener("click", async event => {
  const like = event.target.closest("[data-like]");
  const buy = event.target.closest("[data-buy]");
  const comments = event.target.closest("[data-comments]");
  const commentLike = event.target.closest("[data-comment-like]");
  if (commentLike) {
    try {
      const data = await api(`/api/comments/${encodeURIComponent(commentLike.dataset.commentLike)}/like`, {}, sessionToken);
      commentLike.textContent = `♥ ${data.count ?? 0}`;
      commentLike.classList.toggle("liked", data.liked === true);
    } catch (error) { toast(error.message); }
    return;
  }
  if (buy) { openWhatsApp(buy.dataset.title, buy.dataset.price); return; }
  if (comments) {
    const box = $("comments-" + comments.dataset.comments);
    box.classList.toggle("expanded");
    if (box.classList.contains("expanded")) {
      try {
        const data = await api(`/api/videos/${encodeURIComponent(comments.dataset.comments)}/comments`);
        const list = data.comments || [];
        box.querySelector(".comment-list").innerHTML = list.map(comment =>
          `<p class="comment-entry"><span class="comment-avatar">${safe((comment.username || "U").slice(0, 1).toUpperCase())}</span><b>${safe(comment.username || "User")}</b> ${safe(comment.comment_text || comment.comment || "")}<button type="button" data-comment-like="${safe(comment.id)}">♥ ${Number(comment.likes_count || 0)}</button></p>`
        ).join("") || "<small>No comments yet.</small>";
      } catch (error) { toast(error.message); }
    }
    return;
  }
  if (like) {
    try {
      const data = await api(`/api/videos/${encodeURIComponent(like.dataset.like)}/like`, {}, sessionToken);
      like.querySelector("span").textContent = data.count ?? 0;
      like.classList.toggle("liked", data.liked === true);
    } catch (error) { toast(error.message); }
  }
});
document.addEventListener("submit", async event => {
  const form = event.target.closest("[data-comment-form]");
  if (!form) return;
  event.preventDefault();
  const input = form.elements.comment;
  try {
    await api(`/api/videos/${encodeURIComponent(form.dataset.commentForm)}/comments`, { comment: input.value }, sessionToken);
    input.value = "";
    toast("Comment posted.");
    const button = form.closest(".video-info").querySelector("[data-comments]");
    if (button) {
      const count = Number((button.textContent.match(/\d+/) || ["0"])[0]) + 1;
      button.textContent = `Comments ${count}`;
    }
    form.closest(".comment-area").classList.add("expanded");
    const data = await api(`/api/videos/${encodeURIComponent(form.dataset.commentForm)}/comments`);
    form.closest(".comment-area").querySelector(".comment-list").innerHTML = (data.comments || []).map(comment =>
      `<p class="comment-entry"><span class="comment-avatar">${safe((comment.username || "U").slice(0, 1).toUpperCase())}</span><b>${safe(comment.username || "User")}</b> ${safe(comment.comment_text || "")}<button type="button" data-comment-like="${safe(comment.id)}">♥ ${Number(comment.likes_count || 0)}</button></p>`
    ).join("");
  } catch (error) { toast(error.message); }
});

$("videoSearch").addEventListener("input", renderVideos);
$("videoCategory").addEventListener("change", renderVideos);
$("videoForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("videoForm").querySelector('button[type="submit"]');
  const file = $("videoFile").files[0];
  if (!file) { toast("Choose a video file."); return; }
  const form = new FormData();
  form.append("title", $("videoTitle").value.trim());
  form.append("description", $("videoDescription").value.trim());
  form.append("category", $("videoType").value);
  form.append("price_pkr", $("videoPrice").value || "0");
  form.append("video", file);
  const thumbnail = $("videoThumb").files[0];
  if (thumbnail) form.append("thumbnail", thumbnail);
  button.disabled = true;
  button.textContent = "Uploading...";
  try {
    await api("/api/videos", form, sessionToken);
    $("videoForm").reset();
    toast("Video uploaded and published.");
    await renderVideos();
    await refreshStorage();
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = "Publish video"; }
});

$("year").textContent = new Date().getFullYear();
$("adminWhatsApp").value = localStorage.getItem("ffshop_wa_number") || DEFAULT_WA;
empty("homeItems");
filterNow();
search();
setMode("login");
renderAccount();
restore();
renderVideos();

window.addEventListener("load", () => {
  let progress = 0;
  const bar = $("loadBar"), text = $("loadText"), loader = $("loader");
  const timer = setInterval(() => {
    progress = Math.min(100, progress + 4);
    bar.style.width = progress + "%";
    text.textContent = "LOADING " + progress + "%";
    if (progress >= 100) {
      clearInterval(timer);
      setTimeout(() => loader.classList.add("done"), 180);
    }
  }, 22);
});
