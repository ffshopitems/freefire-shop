// FF Shop frontend: account requests are sent to the Cloudflare Worker.
const API_BASE="https://ffshop-auth.ggondalssab13.workers.dev";const VIDEO_API_BASE="https://ffshop-video-api.ggondalssab13.workers.dev";const MAX_VIDEO_BYTES=500*1024*1024;const PART_SIZE=8*1024*1024;const $=id=>document.getElementById(id);let authMode="login",sessionToken=sessionStorage.getItem("ffshop_session")||"",currentUser=null,filter="All";
function toast(m){const e=$("toast");e.textContent=m;e.style.display="block";clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>e.style.display="none",2600)}
async function api(path,body=null,token=""){const headers={"Content-Type":"application/json"};if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(API_BASE+path,{method:body===null?"GET":"POST",headers,...(body===null?{}:{body:JSON.stringify(body)})});let d={};try{d=await r.json()}catch{}if(!r.ok||d.success===false||d.ok===false)throw Error(d.error||d.message||`Request failed (${r.status})`);return d}
async function videoApi(path,body=null,token=sessionToken){
 const headers={};if(token)headers.Authorization=`Bearer ${token}`;
 if(body!==null)headers["Content-Type"]="application/json";
 const r=await fetch(VIDEO_API_BASE+path,{method:body===null?"GET":"POST",headers,...(body===null?{}:{body:JSON.stringify(body)})});
 let d={};try{d=await r.json()}catch{}
 if(!r.ok||d.success===false)throw Error(d.error||d.message||`Video API request failed (${r.status})`);
 return d;
}
function setUploadProgress(done,total,label){
 const wrap=$("uploadProgressWrap"),bar=$("uploadProgressBar"),pct=$("uploadProgressPercent"),txt=$("uploadProgressText");
 if(!wrap)return;wrap.hidden=false;const n=total?Math.min(100,Math.round(done/total*100)):0;
 bar.style.width=n+"%";pct.textContent=n+"%";txt.textContent=label||"Uploading…";
}
function tokenOf(d){return d.token||d.sessionToken||d.accessToken||d.session?.token||""}function userOf(d){const u=d.user||d.account||d,role=String(u.role||d.role||"").toLowerCase();return{username:u.username||d.username||"User",isAdmin:role==="admin"||u.isAdmin===true||d.isAdmin===true}}
function setMode(m){authMode=m;$("authTitle").textContent=m==="signup"?"Create your account":"Welcome back";$("authSubmit").textContent=m==="signup"?"Create account →":"Sign in →";$("authSwitch").textContent=m==="signup"?"Already have an account? Sign in":"New here? Create an account";$("authHint").textContent=m==="signup"?"Choose a unique username and a password of at least 8 characters.":"Enter your username and password.";$("authPassword").autocomplete=m==="signup"?"new-password":"current-password";$("authError").textContent=""}
function renderAccount(){if(!currentUser){$("accountStatus").textContent="Create an account or sign in.";$("authPanel").hidden=false;$("signedInPanel").hidden=true;$("adminPanel").hidden=true;$("mobilePlus").hidden=true;$("uploadAccess").hidden=true;$("uploadDenied").hidden=true;return}$("accountStatus").textContent=`Signed in as ${currentUser.username}`;$("authPanel").hidden=true;$("signedInPanel").hidden=false;$("adminStatus").textContent=currentUser.isAdmin?"Administrator account verified by the server.":"You are signed in as a customer.";$("adminPanel").hidden=!currentUser.isAdmin;$("mobilePlus").hidden=!currentUser.isAdmin;$("uploadAccess").hidden=!currentUser.isAdmin;$("uploadDenied").hidden=currentUser.isAdmin;if(currentUser.isAdmin)refreshStorage();}
async function restore(){if(!sessionToken){renderAccount();return}try{currentUser=userOf(await api("/api/me",null,sessionToken))}catch{sessionStorage.removeItem("ffshop_session");sessionToken="";currentUser=null;toast("Session expired. Please sign in again.")}renderAccount()}
async function submit(e){e.preventDefault();const username=$("authUsername").value.trim(),password=$("authPassword").value,err=$("authError"),btn=$("authSubmit");err.textContent="";if(!username||!password){err.textContent="Enter both username and password.";return}if(authMode==="signup"&&(username.length<3||username.length>24)){err.textContent="Username must be 3 to 24 characters.";return}if(password.length<8){err.textContent="Password must be at least 8 characters.";return}btn.disabled=true;btn.textContent="Please wait...";try{let d,t;if(authMode==="signup"){d=await api("/api/register",{username,password});t=tokenOf(d);if(!t){d=await api("/api/login",{username,password});t=tokenOf(d)}}else{try{d=await api("/api/admin/login",{username,password})}catch(x){if(/failed to fetch|network|cors/i.test(x.message))throw x;d=await api("/api/login",{username,password})}t=tokenOf(d)}if(!t)throw Error("Server did not return a login token. Check Worker API response.");sessionToken=t;sessionStorage.setItem("ffshop_session",t);currentUser=userOf(await api("/api/me",null,t));$("authForm").reset();renderAccount();toast(authMode==="signup"?"Account created successfully.":"Signed in successfully.")}catch(x){err.textContent=x.message||"Could not connect. Please try again."}finally{btn.disabled=false;setMode(authMode)}}

function logout(){sessionStorage.removeItem("ffshop_session");sessionToken="";currentUser=null;renderAccount();toast("Signed out.")}
function go(p){document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===p+"Page"));document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===p));window.scrollTo({top:0,behavior:"smooth"});if(p==="search")$("searchInput").focus();if(p==="videos")renderVideos();}
function empty(id,c="All"){const e=$(id);if(e)e.innerHTML=`<div class="empty"><strong>No published items${c==="All"?"":` in ${c}`} yet</strong><p>Store listings will appear here when connected to the publishing backend.</p></div>`}
function filterNow(){document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("selected",b.dataset.filter===filter));empty("shopItems",filter);empty("homeItems");}
function search(){const q=$("searchInput").value.trim().replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));$("searchResults").innerHTML=q?`<div class="empty"><strong>No matching published items</strong><p>No current catalog items match “${q}”.</p></div>`:'<div class="empty"><strong>Search the store</strong><p>Enter a search term to look for published items.</p></div>'}
const DEFAULT_WA="923248201259";
function waNumber(){return (localStorage.getItem("ffshop_wa_number")||DEFAULT_WA).replace(/\D/g,"")}
function safe(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function renderVideos(){const q=($('videoSearch')?.value||'').toLowerCase(),cat=$('videoCategory')?.value||'All',grid=$('videoGrid');try{const data=await videoApi('/api/videos');const items=Array.isArray(data)?data:(data.videos||data.items||[]);const shown=items.filter(v=>(cat==='All'||v.category===cat)&&(`${v.title||''} ${v.description||''}`).toLowerCase().includes(q));const card=v=>`<article class="video-card"><div class="video-frame">${v.videoUrl?`<video controls playsinline src="${safe(v.videoUrl)}" poster="${safe(v.thumbnailUrl||'')}"></video>`:`<div class="video-placeholder">FF SHOP</div>`}</div><div class="video-info"><small>${safe(v.category||'Gaming')}</small><h3>${safe(v.title)}</h3><p>${safe(v.description||'')}</p><strong class="price">${Number(v.pricePKR)>0?'PKR '+Number(v.pricePKR).toLocaleString():'Price on request'}</strong><div class="video-actions"><button data-like="${safe(v.id)}">♥ <span>${Number(v.likeCount)||0}</span></button><button data-comments="${safe(v.id)}">Comments ${Number(v.commentCount)||0}</button><button class="buy-now" data-buy="${safe(v.id)}" data-title="${safe(v.title)}" data-price="${Number(v.pricePKR)||0}">Buy Now ↗</button></div><div class="comment-area" id="comments-${safe(v.id)}"><form data-comment-form="${safe(v.id)}"><input name="comment" maxlength="300" required placeholder="Write a comment..."><button type="submit">Send</button></form><div class="comment-list"></div></div></div></article>`;grid.innerHTML=shown.length?shown.map(card).join(''):'<div class="empty"><strong>No videos published yet</strong><p>When the shared Worker video service is connected, published videos will appear here for every visitor.</p></div>';if($('homeVideos'))$('homeVideos').innerHTML=shown.slice(0,3).map(card).join('')||grid.innerHTML;}catch{grid.innerHTML='<div class="empty"><strong>Shared video service not connected</strong><p>The shared video service is unavailable. Check the video Worker deployment and configuration.</p></div>';if($('homeVideos'))$('homeVideos').innerHTML=grid.innerHTML;}}
function refreshStorage(){try{let used=0;for(let k in localStorage){if(Object.prototype.hasOwnProperty.call(localStorage,k))used+=(localStorage[k].length+k.length)*2}const limit=5*1024*1024,remaining=Math.max(0,limit-used),pct=Math.min(100,Math.round(used/limit*100)),fmt=n=>n>=1024*1024?(n/1024/1024).toFixed(2)+" MB":(n/1024).toFixed(1)+" KB";$("storageFill").style.width=pct+"%";$("storageFill").style.background=pct>=90?"#ff4d67":pct>=70?"#f5c84b":"#39d98a";$("storageLabel").textContent=pct+"% full";$("storageDetail").textContent=`Used: ${fmt(used)} · Remaining: ${fmt(remaining)} · Estimated limit: 5.00 MB (this browser only; not Cloudflare/R2 storage).`;}catch{}}
function openWhatsApp(title,price){const n=waNumber();if(!n){toast("Set a WhatsApp number in Admin Account.");return}const msg=`Assalamualaikum bhai, mujhe yeh account pasand aaya hai, mujhe chahiye. Item: ${title}. Price: PKR ${price||"Please confirm"}.`;window.open(`https://wa.me/${n}?text=${encodeURIComponent(msg)}`,"_blank","noopener");}
document.addEventListener("click",e=>{const p=e.target.closest("[data-page]"),g=e.target.closest("[data-goto]");if(p){e.preventDefault();go(p.dataset.page)}if(g)go(g.dataset.goto);if(e.target.closest("#mobilePlus")){go("upload");$("videoTitle").focus()}});
$("authForm").addEventListener("submit",submit);$("authSwitch").addEventListener("click",()=>setMode(authMode==="login"?"signup":"login"));$("logoutButton").addEventListener("click",logout);$("searchInput").addEventListener("input",search);$("headerSearch").addEventListener("click",()=>go("search"));
$("saveNumber").addEventListener("click",()=>{const n=$("adminWhatsApp").value.replace(/\D/g,"");if(n.length<10){toast("Enter a valid number with country code.");return}localStorage.setItem("ffshop_wa_number",n);toast("WhatsApp number saved in this browser.");});
document.addEventListener('click',async e=>{const like=e.target.closest('[data-like]'),buy=e.target.closest('[data-buy]'),comments=e.target.closest('[data-comments]');if(buy){openWhatsApp(buy.dataset.title,buy.dataset.price);return}if(comments){const box=$('comments-'+comments.dataset.comments);box.classList.toggle('expanded');if(box.classList.contains('expanded')){try{const d=await videoApi('/api/videos/'+encodeURIComponent(comments.dataset.comments)+'/comments');const list=Array.isArray(d)?d:(d.comments||[]);box.querySelector('.comment-list').innerHTML=list.map(c=>`<p><b>${safe(c.username||'User')}</b> ${safe(c.text||c.comment)}</p>`).join('')||'<small>No comments yet.</small>'}catch{toast('Comments API is not connected yet.')}}return}if(like){try{const d=await videoApi('/api/videos/'+encodeURIComponent(like.dataset.like)+'/like',{},sessionToken);like.querySelector('span').textContent=d.likeCount??(Number(like.querySelector('span').textContent)+1);like.classList.add('liked')}catch{toast('Like service is not connected yet.')}}});
document.addEventListener('submit',async e=>{const form=e.target.closest('[data-comment-form]');if(!form)return;e.preventDefault();const input=form.elements.comment;try{await videoApi('/api/videos/'+encodeURIComponent(form.dataset.commentForm)+'/comments',{text:input.value},sessionToken);input.value='';toast('Comment posted.');renderVideos()}catch{toast('Comment service is not connected yet.')}});
$("videoSearch").addEventListener("input",renderVideos);$("videoCategory").addEventListener("change",renderVideos);
$("videoForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const form=$("videoForm"),btn=$("publishVideoButton"),file=$("videoFile").files[0],thumb=$("videoThumb").files[0];
 if(!sessionToken){toast("Please sign in as administrator first.");return}
 if(!file){toast("Select a video file.");return}
 if(file.size>MAX_VIDEO_BYTES){toast("Video exceeds the 500 MB limit.");return}
 if(!file.type.startsWith("video/")){toast("Select a valid video file.");return}
 const title=$("videoTitle").value.trim(),price=Number($("videoPrice").value||0);
 if(!title||title.length>90||!Number.isFinite(price)||price<0){toast("Check the title and price.");return}
 if(thumb&&(thumb.size>5*1024*1024||!thumb.type.startsWith("image/"))){toast("Thumbnail must be an image under 5 MB.");return}
 btn.disabled=true;btn.textContent="Preparing…";
 let uploadId=null;
 try{
  const init=await videoApi("/api/uploads/init",{
   title,description:$("videoDescription").value.trim(),category:$("videoType").value,
   pricePKR:price,fileName:file.name,fileSize:file.size,mimeType:file.type||"video/mp4"
  });
  uploadId=init.uploadId;
  const totalParts=Math.ceil(file.size/PART_SIZE),parts=[];
  for(let partNumber=1;partNumber<=totalParts;partNumber++){
   const start=(partNumber-1)*PART_SIZE,end=Math.min(start+PART_SIZE,file.size),chunk=file.slice(start,end);
   setUploadProgress(start,file.size,`Uploading part ${partNumber} of ${totalParts}…`);
   const signed=await videoApi("/api/uploads/part-url",{uploadId,partNumber});
   const put=await fetch(signed.url,{method:"PUT",body:chunk});
   if(!put.ok)throw Error(`Storage rejected upload part ${partNumber} (${put.status}). Check B2 bucket CORS settings.`);
   const etag=put.headers.get("ETag");
   if(!etag)throw Error("B2 did not expose the ETag header. Update the bucket CORS rules and retry.");
   parts.push({partNumber,etag:etag.replace(/^"|"$/g,"")});
   setUploadProgress(end,file.size,`Uploaded part ${partNumber} of ${totalParts}…`);
  }
  btn.textContent="Finalizing…";
  const done=await videoApi("/api/uploads/complete",{uploadId,parts,thumbnail:!!thumb});
  if(thumb){
   const fd=new FormData();fd.append("thumbnail",thumb);
   const tr=await fetch(VIDEO_API_BASE+"/api/videos/"+encodeURIComponent(done.id)+"/thumbnail",{method:"POST",headers:{Authorization:"Bearer "+sessionToken},body:fd});
   if(!tr.ok){let td={};try{td=await tr.json()}catch{};throw Error(td.error||"Video published, but thumbnail upload failed.");}
  }
  setUploadProgress(file.size,file.size,"Video published successfully.");
  form.reset();toast("Video published successfully.");await renderVideos();
 }catch(err){
  if(uploadId){try{await videoApi("/api/uploads/abort",{uploadId})}catch{}}
  toast(err.message||"Video upload failed.");
  setUploadProgress(0,1,"Upload failed — "+(err.message||"please try again"));
 }finally{btn.disabled=false;btn.textContent="Publish video";}
});
$("year").textContent=new Date().getFullYear();$("adminWhatsApp").value=localStorage.getItem("ffshop_wa_number")||DEFAULT_WA;empty("homeItems");filterNow();search();renderVideos();setMode("login");renderAccount();restore();
window.addEventListener("load",()=>{let n=0;const bar=$("loadBar"),txt=$("loadText"),loader=$("loader");const t=setInterval(()=>{n=Math.min(100,n+4);bar.style.width=n+"%";txt.textContent="LOADING "+n+"%";if(n>=100){clearInterval(t);setTimeout(()=>loader.classList.add("done"),180)}},22);});
