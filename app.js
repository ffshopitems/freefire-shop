// FF SHOP starter front-end.
// Set API_BASE after your Cloudflare Worker endpoints are finalized.
const API_BASE = ""; // Example: "https://your-worker.workers.dev"
const $ = (s) => document.querySelector(s);
const grid = $("#videoGrid");
const empty = $("#emptyState");
$("#year").textContent = new Date().getFullYear();

function openModal(id){$("#"+id).classList.add("open");}
function closeModal(id){$("#"+id).classList.remove("open");}
$("#adminBtn").addEventListener("click",()=>openModal("adminModal"));
$("#loginBtn").addEventListener("click",()=>openModal("loginModal"));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("open")}));
$("#menuBtn").addEventListener("click",()=>$("#mainNav").classList.toggle("show"));

let selectedCategory="all";
function applyFilters(){
  const q=$("#searchInput").value.toLowerCase().trim();
  let visible=0;
  grid.querySelectorAll(".video-card").forEach(card=>{
    const category=card.dataset.category||"other";
    const text=card.textContent.toLowerCase();
    const show=(selectedCategory==="all"||category===selectedCategory)&&text.includes(q);
    card.hidden=!show;if(show)visible++;
  });
  empty.hidden=visible!==0;
}
$("#searchInput").addEventListener("input",applyFilters);
$("#categoryFilter").addEventListener("change",e=>{selectedCategory=e.target.value;applyFilters()});
document.querySelectorAll("[data-filter]").forEach(a=>a.addEventListener("click",()=>{
  selectedCategory=a.dataset.filter;$("#categoryFilter").value=selectedCategory;applyFilters();
}));
document.querySelectorAll("[data-notice]").forEach(b=>b.addEventListener("click",()=>alert(b.dataset.notice)));

function makeVideoCard({title,category,description,url,thumbUrl}){
  const names={accounts:"FF Accounts",topup:"Diamond Top-Up",events:"FF Events",other:"Others"};
  const card=document.createElement("article");card.className="video-card";card.dataset.category=category;
  const thumb=document.createElement("div");thumb.className="video-thumb thumb-blue";
  if(thumbUrl){thumb.style.backgroundImage=`linear-gradient(#06152a55,#06152a55),url("${thumbUrl}")`;thumb.style.backgroundSize="cover";thumb.style.backgroundPosition="center"}
  const play=document.createElement("span");play.className="play";play.textContent="▶";thumb.append(play);
  const info=document.createElement("div");info.className="video-info";
  const pill=document.createElement("span");pill.className="pill";pill.textContent=names[category]||"Others";
  const h=document.createElement("h3");h.textContent=title;
  const p=document.createElement("p");p.textContent=description||"FF SHOP video";
  info.append(pill,h,p);card.append(thumb,info);
  if(url){card.style.cursor="pointer";card.addEventListener("click",()=>window.open(url,"_blank","noopener"))}
  return card;
}

$("#uploadForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget;const data=new FormData(form);
  const video=data.get("video");const thumb=data.get("thumbnail");
  if(!video||!video.size){$("#formStatus").textContent="Please select a video file.";return}
  const localVideo=URL.createObjectURL(video);
  const localThumb=thumb&&thumb.size?URL.createObjectURL(thumb):"";
  const title=String(data.get("title")||"New video");
  const category=String(data.get("category")||"other");
  const description=String(data.get("description")||"");
  const card=makeVideoCard({title,category,description,url:localVideo,thumbUrl:localThumb});
  grid.prepend(card);selectedCategory="all";$("#categoryFilter").value="all";$("#searchInput").value="";applyFilters();
  $("#formStatus").textContent="Video preview added on this device only. To publish it for all visitors, connect the Cloudflare/Backblaze upload API.";
  form.reset();
});

$("#loginForm").addEventListener("submit",e=>{
  e.preventDefault();
  $("#loginStatus").textContent="Login is not connected yet. The existing login Worker must be connected here; do not share your password in chat.";
});
