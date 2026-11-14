// FF SHOP — redesigned frontend. Existing Worker authentication URL and routes are preserved.
const CONFIG = {
  API_BASE: "https://ffshop-auth.ggondalssab13.workers.dev",
  // Replace with your WhatsApp number in international format, digits only (Pakistan: 92XXXXXXXXXX).
  WHATSAPP_NUMBER: "92XXXXXXXXXX",
  // Video API routes below are a proposed contract; add them to the existing Worker before uploads can work.
  VIDEO_LIST_PATH: "/api/videos",
  VIDEO_UPLOAD_PATH: "/api/videos",
  VIDEO_DELETE_PATH: id => `/api/videos/${encodeURIComponent(id)}`
};
const $ = id => document.getElementById(id);
const CATEGORIES = ["Free Fire Account Videos","Diamond Top-Up Videos","Free Fire Events Videos","Others","Gameplay and Highlights","Tips and Tricks"];
let authMode="login", sessionToken=sessionStorage.getItem("ffshop_session")||"", currentUser=null, videos=[], activeCategory="All";
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove("show"),3000)}
async function api(path, body=null, token=""){
  const headers={}; if(token)headers.Authorization=`Bearer ${token}`;
  const options={method:body===null?"GET":"POST",headers};
  if(body instanceof FormData) options.body=body;
  else if(body!==null){headers["Content-Type"]="application/json";options.body=JSON.stringify(body)}
  const response=await fetch(CONFIG.API_BASE+path,options);let data={};
  try{data=await response.json()}catch{}
  if(!response.ok||data.success===false||data.ok===false)throw Error(data.error||data.message||`Request failed (${response.status})`);
  return data;
}
function tokenOf(d){return d.token||d.sessionToken||d.accessToken||d.session?.token||""}
function userOf(d){const u=d.user||d.account||d,role=String(u.role||d.role||"").toLowerCase();return{username:u.username||d.username||"User",isAdmin:role==="admin"||u.isAdmin===true||d.isAdmin===true}}
function setMode(mode){authMode=mode;$("authTitle").textContent=mode==="signup"?"Create your account":"Welcome back";$("authSubmit").textContent=mode==="signup"?"Create account ↗":"Sign in ↗";$("authSwitch").textContent=mode==="signup"?"Already registered? Sign in":"New here? Create an account";$("authHint").textContent=mode==="signup"?"Choose a username and a password of at least 8 characters.":"Use your existing account credentials.";$("authPassword").autocomplete=mode==="signup"?"new-password":"current-password";$("authError").textContent=""}
function renderAccount(){
  if(!currentUser){$("accountStatus").textContent="Sign in to continue.";$("authPanel").hidden=false;$("signedInPanel").hidden=true;return}
  $("accountStatus").textContent=`Signed in as ${currentUser.username}`;$("authPanel").hidden=true;$("signedInPanel").hidden=false;
  $("adminStatus").textContent=currentUser.isAdmin?"Administrator account verified by the server. Your dashboard is available.":"You are signed in as a customer.";
  if(currentUser.isAdmin){$("adminNav")?.remove();const b=document.createElement("button");b.id="adminNav";b.dataset.page="admin";b.textContent="Admin";document.querySelector(".desktop-nav").append(b);loadAdminVideos()}
  else $("adminNav")?.remove();
}
async function restore(){if(!sessionToken){renderAccount();return}try{currentUser=userOf(await api("/api/me",null,sessionToken))}catch{sessionStorage.removeItem("ffshop_session");sessionToken="";currentUser=null;toast("Session expired. Please sign in again.")}renderAccount()}
async function submitAuth(e){
  e.preventDefault();const username=$("authUsername").value.trim(),password=$("authPassword").value,err=$("authError"),btn=$("authSubmit");err.textContent="";
  if(!username||!password){err.textContent="Enter both username and password.";return}
  if(authMode==="signup"&&(username.length<3||username.length>24)){err.textContent="Username must be 3 to 24 characters.";return}
  if(password.length<8){err.textContent="Password must be at least 8 characters.";return}
  btn.disabled=true;btn.textContent="Please wait…";
  try{let data,token;if(authMode==="signup"){data=await api("/api/register",{username,password});token=tokenOf(data);if(!token){data=await api("/api/login",{username,password});token=tokenOf(data)}}else{try{data=await api("/api/admin/login",{username,password})}catch(error){if(/failed to fetch|network|cors/i.test(error.message))throw error;data=await api("/api/login",{username,password})}token=tokenOf(data)}
    if(!token)throw Error("Worker did not return a session token. Check its existing API response.");sessionToken=token;sessionStorage.setItem("ffshop_session",token);currentUser=userOf(await api("/api/me",null,token));$("authForm").reset();renderAccount();toast(authMode==="signup"?"Account created.":"Signed in successfully.");go(currentUser.isAdmin?"admin":"home");
  }catch(error){err.textContent=error.message||"Could not connect to the server."}finally{btn.disabled=false;setMode(authMode)}
}
function logout(){sessionStorage.removeItem("ffshop_session");sessionToken="";currentUser=null;$("adminNav")?.remove();renderAccount();go("home");toast("Signed out.")}
function go(page){const target=$(page+"Page");if(!target)return;document.querySelectorAll(".page").forEach(el=>el.classList.toggle("active",el===target));document.querySelectorAll("[data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===page));$("mobileMenu").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"})}
function waLink(message){const number=CONFIG.WHATSAPP_NUMBER.replace(/\D/g,"");return `https://wa.me/${number}?text=${encodeURIComponent(message)}`}
function setupWhatsApp(){const msg="Assalamualaikum bhai, mujhe FF SHOP ke baare mein maloomat chahiye.";["heroWhatsApp","footerWhatsApp"].forEach(id=>$(id).href=waLink(msg));if(CONFIG.WHATSAPP_NUMBER.includes("X")){["heroWhatsApp","footerWhatsApp"].forEach(id=>$(id).addEventListener("click",e=>{e.preventDefault();toast("Please add your WhatsApp number in script.js first.")}))}}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function videoCard(v){const thumb=v.thumbnailUrl||v.thumbnail||"";const title=esc(v.title||"Untitled video"),desc=esc(v.description||"");return `<article class="video-card"><button class="thumb-button" data-watch="${esc(v.id||"")}" aria-label="Watch ${title}">${thumb?`<img src="${esc(thumb)}" alt="">`:`<span class="thumb-placeholder">FF<span>▶</span></span>`}<span class="play">▶</span></button><div class="video-meta"><span>${esc(v.category||"FF SHOP")}</span><small>${esc(v.date||"FF SHOP")}</small></div><h3>${title}</h3><p>${desc}</p></article>`}
function paintGrid(id,list,emptyText="No videos published yet."){$(id).innerHTML=list.length?list.map(videoCard).join(""):`<div class="empty-state">${emptyText}</div>`}
function renderVideos(){
  const q=($("videoSearch")?.value||"").trim().toLowerCase();
  const filtered=videos.filter(v=>(activeCategory==="All"||v.category===activeCategory)&&(!q||`${v.title||""} ${v.description||""} ${v.category||""}`.toLowerCase().includes(q)));
  paintGrid("videoGrid",filtered,"No videos match this search or category.");
  paintGrid("featuredGrid",videos.slice(0,3),"New videos will appear here when published.");
  paintGrid("tipsGrid",videos.filter(v=>v.category==="Tips and Tricks"),"No tips videos published yet.");
  paintGrid("othersGrid",videos.filter(v=>v.category==="Others"),"No extra videos published yet.");
  $("categoryPills").querySelectorAll("button").forEach(b=>b.classList.toggle("selected",b.dataset.category===activeCategory));
}
async function loadVideos(){try{const data=await api(CONFIG.VIDEO_LIST_PATH);videos=Array.isArray(data)?data:(data.videos||data.items||[])}catch(error){videos=[];console.warn("Video listing endpoint is not configured yet:",error.message)}renderVideos()}
function showVideo(id){const v=videos.find(x=>String(x.id)===String(id));if(!v)return;const src=v.videoUrl||v.url||v.src||"";$("modalMedia").innerHTML=src?`<video controls playsinline autoplay src="${esc(src)}"></video>`:`<div class="media-unavailable">Video source is not available.</div>`;$("modalCategory").textContent=v.category||"FF SHOP";$("modalTitle").textContent=v.title||"";$("modalDescription").textContent=v.description||"";$("videoModal").classList.add("open");$("videoModal").setAttribute("aria-hidden","false")}
function closeModal(){$("videoModal").classList.remove("open");$("videoModal").setAttribute("aria-hidden","true");$("modalMedia").innerHTML=""}
async function loadAdminVideos(){if(!currentUser?.isAdmin)return;$("adminVideoList").textContent="Loading…";try{const data=await api(CONFIG.VIDEO_LIST_PATH,null,sessionToken);const list=Array.isArray(data)?data:(data.videos||data.items||[]);$("adminVideoList").innerHTML=list.length?list.map(v=>`<div class="admin-row"><span>${esc(v.title||"Untitled")}<small>${esc(v.category||"")}</small></span><button class="delete-btn" data-delete="${esc(v.id)}">Delete</button></div>`).join(""):"No published videos yet."}catch(error){$("adminVideoList").textContent=`Video API is not connected yet: ${error.message}`}}
async function uploadVideo(e){e.preventDefault();if(!currentUser?.isAdmin){toast("Administrator access required.");return}const form=e.currentTarget,button=form.querySelector("button[type=submit]"),data=new FormData();data.append("title",$("videoTitle").value.trim());data.append("description",$("videoDescription").value.trim());data.append("category",$("videoCategory").value);data.append("video",$("videoFile").files[0]);if($("thumbnailFile").files[0])data.append("thumbnail",$("thumbnailFile").files[0]);button.disabled=true;$("uploadStatus").textContent="Uploading…";try{await api(CONFIG.VIDEO_UPLOAD_PATH,data,sessionToken);form.reset();$("uploadStatus").textContent="Video uploaded.";toast("Video published.");await loadVideos();await loadAdminVideos()}catch(error){$("uploadStatus").textContent=`Upload failed: ${error.message}. The Worker must implement the video upload route described in README.`}finally{button.disabled=false}}
async function deleteVideo(id){if(!currentUser?.isAdmin)return;if(!confirm("Delete this video?"))return;try{await api(CONFIG.VIDEO_DELETE_PATH(id),{},sessionToken);toast("Video deleted.");await loadVideos();await loadAdminVideos()}catch(error){toast(`Delete failed: ${error.message}`)}}
document.addEventListener("click",e=>{
  const page=e.target.closest("[data-page]");if(page){e.preventDefault();go(page.dataset.page)}
  const watch=e.target.closest("[data-watch]");if(watch)showVideo(watch.dataset.watch);
  const category=e.target.closest("[data-category]");if(category){activeCategory=category.dataset.category;renderVideos()}
  const del=e.target.closest("[data-delete]");if(del)deleteVideo(del.dataset.delete);
  if(e.target.closest("[data-close-modal]"))closeModal();
});
$("authForm").addEventListener("submit",submitAuth);$("authSwitch").addEventListener("click",()=>setMode(authMode==="login"?"signup":"login"));$("logoutButton").addEventListener("click",logout);
$("videoSearch").addEventListener("input",renderVideos);$("uploadForm").addEventListener("submit",uploadVideo);
$("searchJump").addEventListener("click",()=>{go("videos");$("videoSearch").focus()});$("menuToggle").addEventListener("click",()=>$("mobileMenu").classList.toggle("open"));
$("year").textContent=new Date().getFullYear();document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
setupWhatsApp();setMode("login");renderVideos();restore();loadVideos();
