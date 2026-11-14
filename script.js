// FF SHOP frontend. Existing Cloudflare Worker authentication endpoints are preserved.
const API_BASE = "https://ffshop-auth.ggondalssab13.workers.dev";
const WHATSAPP_NUMBER = "923248201259";
const $ = id => document.getElementById(id);
let authMode = "login", sessionToken = sessionStorage.getItem("ffshop_session") || "";
let currentUser = null, activeFilter = "All", videos = [], liked = new Set(JSON.parse(localStorage.getItem("ffshop_likes") || "[]"));
const DB_NAME = "ffshop-local-videos", STORE = "videos";

function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2800); }
function api(path, body=null, token="") {
  const headers={"Content-Type":"application/json"}; if(token) headers.Authorization=`Bearer ${token}`;
  return fetch(API_BASE+path,{method:body===null?"GET":"POST",headers,...(body===null?{}:{body:JSON.stringify(body)})})
    .then(async r=>{let d={};try{d=await r.json()}catch{} if(!r.ok||d.success===false||d.ok===false)throw Error(d.error||d.message||`Request failed (${r.status})`);return d;});
}
function tokenOf(d){return d.token||d.sessionToken||d.accessToken||d.session?.token||"";}
function userOf(d){const u=d.user||d.account||d,role=String(u.role||d.role||"").toLowerCase();return{username:u.username||d.username||"User",isAdmin:role==="admin"||u.isAdmin===true||d.isAdmin===true};}
function setMode(mode){authMode=mode;$("authTitle").innerHTML=mode==="signup"?'Create your <em>account.</em>':'Welcome <em>back.</em>';$("authSubmit").innerHTML=mode==="signup"?'Create account <span>→</span>':'Sign in <span>→</span>';$("authSwitch").textContent=mode==="signup"?"Already have an account? Sign in":"New here? Create an account";$("authHint").textContent=mode==="signup"?"Choose a username and a password of at least 8 characters.":"Enter your username and password.";$("authPassword").autocomplete=mode==="signup"?"new-password":"current-password";$("authError").textContent="";}
function renderAccount(){
  const signed=!!currentUser;$("authPanel").hidden=signed;$("signedInPanel").hidden=!signed;
  $("accountStatus").textContent=signed?`Signed in as ${currentUser.username}`:"Sign in or create your account.";
  if(signed)$("adminStatus").textContent=currentUser.isAdmin?"Administrator access verified by the server.":"You are signed in as a customer.";
  $("adminPlus").hidden=!(signed&&currentUser.isAdmin);
  renderVideos();
}
async function restore(){if(!sessionToken){renderAccount();return;}try{currentUser=userOf(await api("/api/me",null,sessionToken));}catch{sessionStorage.removeItem("ffshop_session");sessionToken="";currentUser=null;toast("Session expired. Please sign in again.");}renderAccount();}
async function submitAuth(e){
  e.preventDefault();const username=$("authUsername").value.trim(),password=$("authPassword").value,err=$("authError"),btn=$("authSubmit");err.textContent="";
  if(!username||!password){err.textContent="Enter both username and password.";return;}
  if(authMode==="signup"&&(username.length<3||username.length>24)){err.textContent="Username must be 3 to 24 characters.";return;}
  if(password.length<8){err.textContent="Password must be at least 8 characters.";return;}
  btn.disabled=true;btn.textContent="Please wait...";
  try{let d,t;if(authMode==="signup"){d=await api("/api/register",{username,password});t=tokenOf(d);if(!t){d=await api("/api/login",{username,password});t=tokenOf(d);}}
    else{try{d=await api("/api/admin/login",{username,password});}catch(x){if(/failed to fetch|network|cors/i.test(x.message))throw x;d=await api("/api/login",{username,password});}t=tokenOf(d);}
    if(!t)throw Error("Server did not return a login token. Check Worker API response.");
    sessionToken=t;sessionStorage.setItem("ffshop_session",t);currentUser=userOf(await api("/api/me",null,t));$("authForm").reset();renderAccount();toast(authMode==="signup"?"Account created successfully.":"Signed in successfully.");
  }catch(x){err.textContent=x.message||"Could not connect. Please try again.";}finally{btn.disabled=false;setMode(authMode);}
}
function logout(){sessionStorage.removeItem("ffshop_session");sessionToken="";currentUser=null;renderAccount();toast("Signed out.");}
function go(page){
  document.querySelectorAll(".page").forEach(el=>el.classList.toggle("active",el.id===page+"Page"));
  document.querySelectorAll("[data-page]").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
  window.scrollTo({top:0,behavior:"smooth"});if(page==="tips")renderLiked();
}
function openWhatsApp(item,price){const msg=["Assalamualaikum bhai,","Mujhe ye item purchase karna hai:",`Item: ${item||"FF SHOP item"}`,`Price: ${price||"Please confirm"}`].join("\n");window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank","noopener,noreferrer");}

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:"id"});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function saveLocalVideo(video){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(video);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function loadVideos(){try{const db=await openDB();const rows=await new Promise((resolve,reject)=>{const req=db.transaction(STORE).objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});videos=rows.map(v=>({...v,src:v.fileBlob?URL.createObjectURL(v.fileBlob):"",thumb:v.thumbBlob?URL.createObjectURL(v.thumbBlob):""}));}catch{videos=[];}renderVideos();}
function escapeHTML(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function videoCard(v){
  const isLiked=liked.has(v.id),admin=!!(currentUser&&currentUser.isAdmin);
  return `<article class="video-card"><div class="video-frame">${v.thumb?`<img src="${v.thumb}" alt="">`:`<div class="video-placeholder">FF<span>SHOP</span></div>`}<video controls preload="metadata" src="${v.src}"></video>${admin?`<button class="more-button" data-delete="${v.id}" aria-label="Delete video">⋯</button>`:""}</div><div class="video-info"><span class="video-category">${escapeHTML(v.category)}</span><h3>${escapeHTML(v.title)}</h3><p>${escapeHTML(v.description||"")}</p><div class="video-actions"><button class="like-button ${isLiked?"liked":""}" data-like="${v.id}">♡ <span>${v.likes||0}</span></button><button class="comment-toggle" data-comments="${v.id}">Comments <span>${(v.comments||[]).length}</span></button></div><div class="comments" id="comments-${v.id}" hidden>${(v.comments||[]).map(c=>`<p>${escapeHTML(c)}</p>`).join("")}<form data-comment-form="${v.id}"><input maxlength="240" required placeholder="Write a comment..."><button>Send</button></form></div></div></article>`;
}
function emptyState(msg){return `<div class="empty-state">${msg}</div>`;}
function renderVideos(){
  const q=($("videoSearch")?.value||"").trim().toLowerCase();
  const filtered=videos.filter(v=>(activeFilter==="All"||v.category===activeFilter)&&(!q||(v.title+" "+v.description+" "+v.category).toLowerCase().includes(q)));
  const markup=filtered.length?filtered.map(videoCard).join(""):emptyState("No videos published yet.");
  $("videoGrid").innerHTML=markup;$("homeVideos").innerHTML=videos.slice(0,3).map(videoCard).join("")||emptyState("New videos will appear here.");
  renderLiked();
}
function renderLiked(){const list=videos.filter(v=>liked.has(v.id));$("likedGrid").innerHTML=list.length?list.map(videoCard).join(""):emptyState("You have not liked any videos yet.");}
function persistLikes(){localStorage.setItem("ffshop_likes",JSON.stringify([...liked]));}
async function deleteVideo(id){if(!currentUser?.isAdmin)return toast("Admin access required.");if(!confirm("Delete this video from this browser?"))return;const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});videos=videos.filter(v=>v.id!==id);renderVideos();toast("Video deleted from this browser.");}
function showUpload(){if(!currentUser?.isAdmin)return toast("Admin access required.");$("uploadModal").classList.add("open");$("uploadModal").setAttribute("aria-hidden","false");}
function hideUpload(){$("uploadModal").classList.remove("open");$("uploadModal").setAttribute("aria-hidden","true");}
async function uploadVideo(e){e.preventDefault();if(!currentUser?.isAdmin)return toast("Admin access required.");const file=$("videoFile").files[0],thumb=$("videoThumb").files[0];if(!file)return;
  const video={id:crypto.randomUUID(),title:$("videoTitle").value.trim(),description:$("videoDescription").value.trim(),category:$("videoCategory").value,fileBlob:file,thumbBlob:thumb||null,likes:0,comments:[],createdAt:Date.now(),localOnly:true,src:URL.createObjectURL(file),thumb:thumb?URL.createObjectURL(thumb):""};
  try{await saveLocalVideo(video);videos.unshift(video);renderVideos();$("uploadForm").reset();hideUpload();toast("Video added on this device.");}catch{toast("Could not save this video in browser storage.");}
}
document.addEventListener("click",async e=>{
  const buy=e.target.closest("[data-buy-now]");if(buy){openWhatsApp(buy.dataset.item,buy.dataset.price);}const page=e.target.closest("[data-page]");if(page){e.preventDefault();go(page.dataset.page);}
  const filter=e.target.closest("[data-filter]");if(filter){activeFilter=filter.dataset.filter;document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("selected",b===filter));renderVideos();}
  const like=e.target.closest("[data-like]");if(like){const id=like.dataset.like,v=videos.find(x=>x.id===id);if(v){if(liked.has(id)){liked.delete(id);v.likes=Math.max(0,(v.likes||0)-1);}else{liked.add(id);v.likes=(v.likes||0)+1;}persistLikes();renderVideos();}}
  const comments=e.target.closest("[data-comments]");if(comments){const box=$(`comments-${comments.dataset.comments}`);if(box)box.hidden=!box.hidden;}
  const del=e.target.closest("[data-delete]");if(del)await deleteVideo(del.dataset.delete);
});
document.addEventListener("submit",e=>{const form=e.target.closest("[data-comment-form]");if(!form)return;e.preventDefault();const v=videos.find(x=>x.id===form.dataset.commentForm),input=form.querySelector("input");if(v&&input.value.trim()){v.comments=v.comments||[];v.comments.push(input.value.trim());saveLocalVideo(v).then(()=>renderVideos());}});
$("authForm").addEventListener("submit",submitAuth);$("authSwitch").addEventListener("click",()=>setMode(authMode==="login"?"signup":"login"));$("logoutButton").addEventListener("click",logout);
$("videoSearch").addEventListener("input",renderVideos);$("adminPlus").addEventListener("click",showUpload);$("closeUpload").addEventListener("click",hideUpload);$("uploadModal").addEventListener("click",e=>{if(e.target===$("uploadModal"))hideUpload();});$("uploadForm").addEventListener("submit",uploadVideo);
setMode("login");renderAccount();loadVideos();restore();
let progress=0;const loadTimer=setInterval(()=>{progress=Math.min(100,progress+4+Math.random()*8);$("loadProgress").style.width=progress+"%";$("loadPercent").textContent=Math.floor(progress)+"%";if(progress>=100){clearInterval(loadTimer);setTimeout(()=>$("loader").classList.add("done"),220);}},65);
