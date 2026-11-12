import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://gwjajtiagesuzbyxmooq.supabase.co";
const SUPABASE_KEY = "sb_publishable_OLbgnp2TxUO-JW56tSryhA_BcRnpgGT";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
let state = { user:null, data:null, page:"dashboard" };
let localBalance=null, pendingTapCount=0, tapFlushTimer=null, tapFlushBusy=false;

function notice(message, type="info") {
  const el=$("notice"); el.textContent=message; el.className="notice show "+type;
  window.clearTimeout(notice.timer); notice.timer=window.setTimeout(()=>el.className="notice",5000);
}
function esc(value="") { return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmt(n) { return Number(n||0).toLocaleString("en-NG"); }
async function api(action, extra={}) {
  const {data:{session}}=await supabase.auth.getSession();
  if(!session) throw new Error("Please sign in again.");
  const {data,error}=await supabase.functions.invoke("newhub-api",{body:{action,...extra}});
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  return data;
}
async function loadDashboard() {
  state.data=await api("dashboard");
  $("accountName").textContent=state.data.profile.display_name||state.data.profile.email;
  $("accountEmail").textContent=state.data.profile.email||"";$("profileName").value=state.data.profile.display_name||"";$("profileEmail").value=state.data.profile.email||"";$("logoutBtn").hidden=false;
  localBalance=Number(state.data.balance||0);$("dashboardBalance").textContent=fmt(localBalance);$("walletBalance").textContent=fmt(localBalance);
  $("tapCount").textContent=fmt(state.data.taps_today);
  document.querySelectorAll("#refCount").forEach(el=>el.textContent=fmt(state.data.referrals));
  $("refCode").textContent=state.data.profile.referral_code;
  $("refLink").value="https://newhub-omega.vercel.app/?ref="+encodeURIComponent(state.data.profile.referral_code);
  $("tapReward").textContent=state.data.settings.tap_points+" coins per tap";
  if($("tapButton"))$("tapButton").title="Earn "+state.data.settings.tap_points+" coins per tap";
  if($("dailyLimit"))$("dailyLimit").textContent=state.data.settings.tap_daily_limit;
  const dailyCoins=Math.min(state.data.taps_today*state.data.settings.tap_points,1200);
  const dailyPct=Math.min(100,(dailyCoins/1200)*100);
  if($("dailyProgress"))$("dailyProgress").style.width=dailyPct+"%";
  if($("dailyProgressText"))$("dailyProgressText").textContent=fmt(dailyCoins)+" of 1,200 coins earned today";
  if($("tapCoinsToday"))$("tapCoinsToday").textContent=fmt(dailyCoins)+" / 1,200";
  if($("tapProgress"))$("tapProgress").style.width=dailyPct+"%";
  const inviteGoal=state.data.settings.referral_milestone_count||35;
  const inviteReward=state.data.settings.referral_milestone_points||20000;
  const invitePct=Math.min(100,(state.data.referrals/inviteGoal)*100);
  if($("inviteProgress"))$("inviteProgress").style.width=invitePct+"%";
  if($("inviteProgressLabel"))$("inviteProgressLabel").textContent=fmt(state.data.referrals)+" / "+fmt(inviteGoal)+" friends";
  if($("inviteProgressText"))$("inviteProgressText").textContent=state.data.referral_milestone?"Reward credited: "+fmt(state.data.referral_milestone.points_awarded)+" coins on "+new Date(state.data.referral_milestone.qualified_at).toLocaleDateString()+".":state.data.referrals>=inviteGoal?"Milestone reached. Reward processing status is being checked.":fmt(inviteGoal-state.data.referrals)+" more friends to reach your "+fmt(inviteReward)+"-coin reward milestone.";
  $("minWithdraw").textContent=fmt(state.data.settings.withdrawal_min_points);
  $("dashboardLedgerRows").innerHTML=state.data.ledger.length?state.data.ledger.map(x=>`<tr><td>${esc(x.reason.replaceAll("_"," "))}</td><td class="${x.points>0?"positive":"negative"}">${x.points>0?"+":""}${fmt(x.points)}</td><td>${new Date(x.created_at).toLocaleString()}</td></tr>`).join(""):'<tr><td colspan="3">No wallet activity yet.</td></tr>';
  $("walletLedgerRows").innerHTML=$("dashboardLedgerRows").innerHTML;
  $("withdrawRows").innerHTML=state.data.withdrawals.length?state.data.withdrawals.map(x=>`<tr><td>${fmt(x.points_requested)}</td><td><span class="status ${esc(x.status)}">${esc(x.status)}</span></td><td>${new Date(x.created_at).toLocaleDateString()}</td><td>${esc(x.admin_note||"—")}</td></tr>`).join(""):'<tr><td colspan="4">No withdrawal requests yet.</td></tr>';
  syncAdminVisibility();
}
async function showApp() {
  state.user=(await supabase.auth.getUser()).data.user;
  if(!state.user){$("authView").hidden=false;$("appView").hidden=true;$("logoutBtn").hidden=true;syncAdminVisibility();return;}
  $("authView").hidden=true;$("appView").hidden=false;
  await loadDashboard(); showPage(state.page==="admin"?"dashboard":state.page);
}
function syncAdminVisibility(){
 const allowed=!!state.user&&state.data?.profile?.role==="admin";
 let nav=$("adminNav");
 if(allowed&&!nav){nav=document.createElement("button");nav.id="adminNav";nav.className="navbtn";nav.dataset.nav="admin";nav.innerHTML=`<svg viewBox="0 0 24 24"><path d="M12 3 4 6v5c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></svg><span>Admin</span>`;document.querySelector("aside")?.appendChild(nav);nav.addEventListener("click",()=>showPage("admin"));}
 if(nav)nav.hidden=!allowed;
 const section=document.querySelector(`[data-page="admin"]`);
 if(section){section.classList.add("admin-only");section.style.setProperty("display",allowed?"block":"none","important");}
}
function showPage(page) {
  if(page==="admin"&&state.data?.profile?.role!=="admin")page="dashboard";
  state.page=page;
  document.querySelectorAll("[data-page]").forEach(x=>x.hidden=x.dataset.page!==page);
  document.querySelectorAll("[data-nav]").forEach(x=>{if(x.dataset.nav!=="admin")x.hidden=false;x.classList.toggle("active",x.dataset.nav===page);});
  $("pageTitle").textContent=({dashboard:"Home",tap:"Tap & Earn",invite:"Invite Friends",wallet:"My Wallet",withdraw:"Withdraw",profile:"My Profile",admin:"Admin Dashboard"})[page]||"NEWHUB";
  if(page==="admin") loadAdmin().catch(e=>notice(e.message,"error"));
}
async function loadAdmin(){
  const d=await api("admin");
  $("adminUsers").textContent=fmt(d.users.length);$("adminRequests").textContent=fmt(d.requests.filter(x=>x.status==="pending").length);$("adminPoints").textContent=fmt(d.total_points_issued);
  $("adminRows").innerHTML=d.requests.length?d.requests.map(x=>`<tr><td>${esc(x.user_id.slice(0,8))}</td><td>${fmt(x.points_requested)}</td><td>${esc(x.status)}</td><td>${new Date(x.created_at).toLocaleDateString()}</td><td>${x.status==="pending"?`<button class="mini success" data-review="${x.id}" data-status="approved">Approve</button> <button class="mini danger" data-review="${x.id}" data-status="rejected">Reject</button>`:"—"}</td></tr>`).join(""):'<tr><td colspan="5">No requests yet.</td></tr>';
}
document.querySelectorAll("[data-nav]").forEach(x=>x.addEventListener("click",()=>showPage(x.dataset.nav)));
$("signupForm").addEventListener("submit",async e=>{
 e.preventDefault(); const btn=$("signupBtn");btn.disabled=true;
 try{
  const name=$("signupName").value.trim(),email=$("signupEmail").value.trim(),password=$("signupPassword").value;
  const referral=$("signupReferral").value.trim().toUpperCase();
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name,referral_code:referral||null}}});
  if(error) throw error;
  if(data.session){notice("Account created. Welcome to NEWHUB!","success");await showApp();}
  else notice("Registration received. Please check your email for a confirmation link before signing in.","success");
 }catch(err){notice(err.message,"error");}finally{btn.disabled=false;}
});
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();try{const {error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)throw error;notice("You are signed in.","success");await showApp();}catch(err){notice(err.message,"error");}
});
$("showLogin").onclick=()=>{$("signupPanel").hidden=true;$("loginPanel").hidden=false;};
$("showSignup").onclick=()=>{$("loginPanel").hidden=true;$("signupPanel").hidden=false;};
$("logoutBtn").onclick=async()=>{await supabase.auth.signOut();state.user=null;showApp();notice("You have signed out.");};

$("homeTapButton")?.addEventListener("click",()=>showPage("tap"));
$("homeStartTap")?.addEventListener("click",()=>showPage("tap"));
function floatTap(x,y){const el=document.createElement("span");el.className="float-point";el.textContent="+"+fmt(state.data?.settings?.tap_points||2);el.style.left=x+"px";el.style.top=y+"px";document.body.appendChild(el);setTimeout(()=>el.remove(),800);}
function updateTapDisplay(){const amount=Number(state.data?.settings?.tap_points||2),taps=Number(state.data?.taps_today||0),coins=Math.min(taps*amount,1200),pct=Math.min(100,coins/1200*100);if($("dashboardBalance"))$("dashboardBalance").textContent=fmt(localBalance);if($("walletBalance"))$("walletBalance").textContent=fmt(localBalance);if($("tapCount"))$("tapCount").textContent=fmt(taps);["dailyProgress","tapProgress"].forEach(id=>{if($(id))$(id).style.width=pct+"%";});if($("dailyProgressText"))$("dailyProgressText").textContent=fmt(coins)+" of 1,200 coins earned today";if($("tapCoinsToday"))$("tapCoinsToday").textContent=fmt(coins)+" / 1,200";if($("tapStatus"))$("tapStatus").textContent=pendingTapCount||tapFlushBusy?"Saving taps securely…":"All taps saved";}
function scheduleTapFlush(delay=2500){clearTimeout(tapFlushTimer);tapFlushTimer=setTimeout(flushTapQueue,delay);}
async function flushTapQueue(){if(tapFlushBusy||pendingTapCount<1)return;tapFlushBusy=true;const batch=Math.min(pendingTapCount,25);pendingTapCount-=batch;try{const result=await api("tap_batch",{tap_count:batch}),saved=Number(result.result?.taps_awarded??batch),amount=Number(state.data?.settings?.tap_points||2);if(saved<batch){const lost=batch-saved;state.data.taps_today=Math.max(0,state.data.taps_today-lost);localBalance-=lost*amount;}const expected=batch*amount,awarded=Number(result.result?.points_awarded??expected);if(awarded!==expected)localBalance+=awarded-expected;state.data.balance=localBalance;}catch(err){const amount=Number(state.data?.settings?.tap_points||2);state.data.taps_today=Math.max(0,state.data.taps_today-batch);localBalance=Math.max(0,localBalance-batch*amount);notice(err.message||"Some taps could not be saved. Please try again.","error");}finally{tapFlushBusy=false;updateTapDisplay();if(pendingTapCount>0)scheduleTapFlush(2500);}}
function performTap(ev){if(!state.user||!state.data)return;const amount=Number(state.data.settings.tap_points||2),limit=Number(state.data.settings.tap_daily_limit||600);if(Number(state.data.taps_today||0)>=limit){notice("You have reached today's mining limit. Come back tomorrow.","error");return;}const rect=ev.currentTarget.getBoundingClientRect();floatTap(ev.clientX||rect.left+rect.width/2,ev.clientY||rect.top+rect.height/2);document.querySelectorAll(".tap-orb").forEach(o=>{o.classList.add("pressed");setTimeout(()=>o.classList.remove("pressed"),110);});pendingTapCount++;state.data.taps_today=Number(state.data.taps_today||0)+1;localBalance=(localBalance??Number(state.data.balance||0))+amount;state.data.balance=localBalance;updateTapDisplay();scheduleTapFlush(2500);}
$("tapButton").onclick=performTap;
document.querySelectorAll(".tap-orb").forEach(orb=>orb.addEventListener("click",performTap));
$("copyLink").onclick=async()=>{try{await navigator.clipboard.writeText($("refLink").value);notice("Invite link copied!","success");}catch{ $("refLink").select();document.execCommand("copy");notice("Invite link copied!","success");}};
$("withdrawForm").addEventListener("submit",async e=>{
 e.preventDefault();const b=$("withdrawBtn");b.disabled=true;
 try{await api("withdraw",{points:Number($("withdrawPoints").value),method:"Bank transfer",account_name:$("accountNameInput").value.trim(),account_number:$("accountNumberInput").value.trim(),bank_name:$("bankNameInput").value.trim()});notice("Withdrawal request submitted for admin review.","success");$("withdrawForm").reset();await loadDashboard();}
 catch(err){notice(err.message,"error");}finally{b.disabled=false;}
});
$("adminRows").addEventListener("click",async e=>{const b=e.target.closest("[data-review]");if(!b)return;try{await api("review_withdrawal",{request_id:b.dataset.review,status:b.dataset.status,note:"Reviewed by NEWHUB admin"});notice("Withdrawal request updated.","success");await loadAdmin();}catch(err){notice(err.message,"error");}});
$("profileName").addEventListener("change",async()=>notice("Profile name editing will be enabled after profile update policy is added."));
const params=new URLSearchParams(location.search);if(params.get("ref"))$("signupReferral").value=params.get("ref").toUpperCase();
supabase.auth.onAuthStateChange((_event,session)=>{if(session)showApp().catch(e=>notice(e.message,"error"));else{state.user=null;state.data=null;$("authView").hidden=false;$("appView").hidden=true;$("logoutBtn").hidden=true;syncAdminVisibility();}});
showApp().catch(e=>notice(e.message,"error"));
