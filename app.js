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
  $("accountName")&&($("accountName").textContent=state.data.profile.display_name||state.data.profile.email);
  $("accountEmail").textContent=state.data.profile.email||"";$("profileName").value=state.data.profile.display_name||"";$("profileEmail").value=state.data.profile.email||"";$("logoutBtn").hidden=false;
  localBalance=Number(state.data.balance||0);$("dashboardBalance").textContent=fmt(localBalance);$("walletBalance").textContent=fmt(localBalance);
  $("tapCount").textContent=fmt(state.data.taps_today);
  document.querySelectorAll("#refCount").forEach(el=>el.textContent=fmt(state.data.referrals));
  $("refCode").textContent=state.data.profile.referral_code;
  $("refLink").value="https://newhub-omega.vercel.app/?ref="+encodeURIComponent(state.data.profile.referral_code);
  $("tapReward").textContent=state.data.settings.tap_points+" coins per tap";
  if($("tapButton"))$("tapButton").title="Earn "+state.data.settings.tap_points+" coins per tap";
  if($("dailyLimit"))$("dailyLimit").textContent=state.data.settings.tap_daily_limit;
  const dailyLimit=Number(state.data.settings.tap_daily_limit||2800),dailyCap=dailyLimit*Number(state.data.settings.tap_points||2);
  const dailyCoins=Math.min(state.data.taps_today*state.data.settings.tap_points,dailyCap);
  const dailyPct=Math.min(100,(dailyCoins/dailyCap)*100);
  if($("dailyProgress"))$("dailyProgress").style.width=dailyPct+"%";
  if($("dailyProgressText"))$("dailyProgressText").textContent=fmt(dailyCoins)+" / "+fmt(dailyCap)+" points mined today";
  if($("tapCoinsToday"))$("tapCoinsToday").textContent=fmt(dailyCoins)+" / "+fmt(dailyCap);
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
 e.preventDefault();const btn=$("loginForm").querySelector("button");if(btn)btn.disabled=true;try{const email=$("loginEmail").value.trim().toLowerCase(),password=$("loginPassword").value;const {error}=await supabase.auth.signInWithPassword({email,password});if(error){if(/invalid login credentials/i.test(error.message))throw new Error("Email ko password bai dace ba. Ka danna Forgot password? domin ka saita sabon password ta email.");throw error;}notice("An shiga account cikin nasara.","success");await showApp();}catch(err){notice(err.message,"error");}finally{if(btn)btn.disabled=false;}
});
function setAuthTab(tab){
 $("loginPanel").hidden=tab!=="login";$("signupPanel").hidden=tab!=="signup";$("resetPanel").hidden=tab!=="reset";
 [["authTabLogin","login"],["authTabSignup","signup"],["authTabReset","reset"]].forEach(([id,key])=>$(id)?.classList.toggle("active",key===tab));
 if(tab==="reset"){$("verifyResetCodeForm").hidden=true;$("sendResetCodeForm").hidden=false;}
}
$("authTabLogin").onclick=()=>setAuthTab("login");
$("authTabSignup").onclick=()=>setAuthTab("signup");
$("authTabReset").onclick=()=>{const email=$("loginEmail").value.trim().toLowerCase();if(email)$("resetEmail").value=email;setAuthTab("reset");};
$("showLogin").onclick=()=>setAuthTab("login");
$("forgotPassword").onclick=()=>{const email=$("loginEmail").value.trim().toLowerCase();$("resetEmail").value=email;setAuthTab("reset");};
$("sendResetCodeForm").addEventListener("submit",async e=>{e.preventDefault();const email=$("resetEmail").value.trim().toLowerCase(),b=$("sendResetCodeBtn");b.disabled=true;try{const {error}=await supabase.auth.resetPasswordForEmail(email);if(error)throw error;$("verifyResetCodeForm").hidden=false;$("sendResetCodeForm").hidden=true;notice("An aika recovery code zuwa Gmail. Duba Inbox da Spam.","success");$("resetCode").focus();}catch(err){notice(err.message||"Ba a iya aika code ba. Ka sake gwadawa.","error");}finally{b.disabled=false;}});
$("verifyResetCodeForm").addEventListener("submit",async e=>{e.preventDefault();const email=$("resetEmail").value.trim().toLowerCase(),token=$("resetCode").value.trim(),password=$("newPassword").value,confirm=$("confirmNewPassword").value,b=$("saveNewPasswordBtn");if(password!==confirm){notice("Sabon password da tabbatarwa ba su yi daidai ba.","error");return;}if(!/^\\d{6}$/.test(token)){notice("Shigar da code mai lambobi 6 daga Gmail.","error");return;}b.disabled=true;try{const {data,error}=await supabase.auth.verifyOtp({email,token,type:"recovery"});if(error)throw error;if(!data.session)throw new Error("Code bai tabbatar da session ba. Ka sake neman sabon code.");const {error:updateError}=await supabase.auth.updateUser({password});if(updateError)throw updateError;notice("An canza password cikin nasara. Yanzu ka shiga da sabon password.","success");$("verifyResetCodeForm").reset();$("resetPanel").hidden=true;$("signupPanel").hidden=true;$("loginPanel").hidden=false;$("loginEmail").value=email;$("loginPassword").value="";await supabase.auth.signOut();}catch(err){notice(err.message||"Code bai yi aiki ba ko ya kare. Ka nemi sabon code.","error");}finally{b.disabled=false;}});
$("backToLogin").onclick=()=>setAuthTab("login");
$("showSignup").onclick=()=>setAuthTab("signup");
$("logoutBtn").onclick=async()=>{await supabase.auth.signOut();state.user=null;state.data=null;showApp();notice("You have signed out.");};
$("profileAdminBtn").onclick=()=>showPage("admin");

$("homeTapButton")?.addEventListener("click",()=>showPage("tap"));
$("homeStartTap")?.addEventListener("click",()=>showPage("tap"));
function floatTap(x,y){const el=document.createElement("span");el.className="float-point";el.textContent="+"+fmt(state.data?.settings?.tap_points||2);el.style.left=x+"px";el.style.top=y+"px";document.body.appendChild(el);setTimeout(()=>el.remove(),900);}
function updateTapDisplay(){const amount=Number(state.data?.settings?.tap_points||2),limit=Number(state.data?.settings?.tap_daily_limit||2800),taps=Number(state.data?.taps_today||0),cap=limit*amount,coins=Math.min(taps*amount,cap),pct=Math.min(100,coins/cap*100);if($("dashboardBalance"))$("dashboardBalance").textContent=fmt(localBalance);if($("walletBalance"))$("walletBalance").textContent=fmt(localBalance);if($("tapCount"))$("tapCount").textContent=fmt(taps);["dailyProgress","tapProgress"].forEach(id=>{if($(id))$(id).style.width=pct+"%";});if($("dailyProgressText"))$("dailyProgressText").textContent=fmt(coins)+" / "+fmt(cap)+" points mined today";if($("tapCoinsToday"))$("tapCoinsToday").textContent=fmt(coins)+" / "+fmt(cap);if($("tapStatus"))$("tapStatus").textContent=pendingTapCount||tapFlushBusy?"Saving taps securely…":"All taps saved";}
function scheduleTapFlush(delay=2500){clearTimeout(tapFlushTimer);tapFlushTimer=setTimeout(flushTapQueue,delay);}
async function flushTapQueue(){if(tapFlushBusy||pendingTapCount<1)return;tapFlushBusy=true;const batch=Math.min(pendingTapCount,25);pendingTapCount-=batch;try{const result=await api("tap_batch",{tap_count:batch}),saved=Number(result.result?.taps_awarded??batch),amount=Number(state.data?.settings?.tap_points||2);if(saved<batch){const lost=batch-saved;state.data.taps_today=Math.max(0,state.data.taps_today-lost);localBalance-=lost*amount;}const expected=batch*amount,awarded=Number(result.result?.points_awarded??expected);if(awarded!==expected)localBalance+=awarded-expected;state.data.balance=localBalance;}catch(err){const amount=Number(state.data?.settings?.tap_points||2);state.data.taps_today=Math.max(0,state.data.taps_today-batch);localBalance=Math.max(0,localBalance-batch*amount);notice(err.message||"Some taps could not be saved. Please try again.","error");}finally{tapFlushBusy=false;updateTapDisplay();if(pendingTapCount>0)scheduleTapFlush(2500);}}
function performTap(ev){if(!state.user||!state.data)return;if(navigator.vibrate)navigator.vibrate(15);const amount=Number(state.data.settings.tap_points||2),limit=Number(state.data.settings.tap_daily_limit||2800);if(Number(state.data.taps_today||0)>=limit){notice("You have reached today's mining limit. Come back tomorrow.","error");return;}const rect=ev.currentTarget.getBoundingClientRect();floatTap(ev.clientX||rect.left+rect.width/2,ev.clientY||rect.top+rect.height/2);document.querySelectorAll(".tap-orb").forEach(o=>{o.classList.add("pressed");setTimeout(()=>o.classList.remove("pressed"),110);});pendingTapCount++;state.data.taps_today=Number(state.data.taps_today||0)+1;localBalance=(localBalance??Number(state.data.balance||0))+amount;state.data.balance=localBalance;updateTapDisplay();scheduleTapFlush(2500);}
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
