import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST only"},405);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return json({error:"Please sign in first."},401);
  const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  const secret=keys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!secret)return json({error:"Server key is not configured."},500);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await admin.auth.getUser(token);
  if(authError||!authData.user)return json({error:"Your session is invalid. Sign in again."},401);
  const user=authData.user;
  const {data:profile,error:profileError}=await admin.from("profiles").select("*").eq("id",user.id).single();
  if(profileError||!profile)return json({error:"Your profile is not ready yet. Please sign in again."},400);
  const body=await req.json().catch(()=>({}));
  if(body.action==="tap"){
   const {data,error}=await admin.rpc("newhub_claim_tap",{p_user_id:user.id});
   if(error)return json({error:error.message},400);
   return json({ok:true,result:data});
  }
  if(body.action==="withdraw"){
   const points=Number(body.points);
   if(!Number.isInteger(points)||points<=0)return json({error:"Enter a valid points amount."},400);
   const details={method:String(body.method||"Bank transfer").slice(0,40),account_name:String(body.account_name||"").slice(0,100),account_number:String(body.account_number||"").slice(0,40),bank_name:String(body.bank_name||"").slice(0,100)};
   if(!details.account_name||!details.account_number||!details.bank_name)return json({error:"Complete the payout details."},400);
   const {data,error}=await admin.rpc("newhub_request_withdrawal",{p_user_id:user.id,p_points:points,p_details:details});
   if(error)return json({error:error.message},400);
   return json({ok:true,request_id:data});
  }
  if(body.action==="dashboard"){
   const [ledger,withdrawals,referrals,settings,milestone]=await Promise.all([
    admin.from("point_ledger").select("id,points,reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
    admin.from("withdrawal_requests").select("id,points_requested,status,admin_note,created_at,reviewed_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
    admin.from("profiles").select("id,created_at",{count:"exact",head:true}).eq("referred_by",user.id),
    admin.from("app_settings").select("setting_key,setting_value"),
    admin.from("referral_milestones").select("referrer_id,referral_count,points_awarded,qualified_at").eq("referrer_id",user.id).maybeSingle()
   ]);
   if(ledger.error||withdrawals.error||referrals.error||settings.error||milestone.error)return json({error:"Could not load your account data."},500);
   const balance=(ledger.data||[]).reduce((sum,row)=>sum+Number(row.points),0);
   const {count:tapsToday}=await admin.from("tap_claims").select("*",{count:"exact",head:true}).eq("user_id",user.id).gte("claimed_at",new Date(new Date().setHours(0,0,0,0)).toISOString());
   const sm=Object.fromEntries((settings.data||[]).map(x=>[x.setting_key,x.setting_value]));
   return json({ok:true,profile:{display_name:profile.display_name,referral_code:profile.referral_code,role:profile.role,email:user.email},balance,ledger:ledger.data||[],withdrawals:withdrawals.data||[],referrals:referrals.count||0,taps_today:tapsToday||0,referral_milestone:milestone.data||null,settings:{tap_points:Number(sm.tap_points??2),tap_cooldown_seconds:Number(sm.tap_cooldown_seconds??10),tap_daily_limit:Number(sm.tap_daily_limit??600),withdrawal_min_points:Number(sm.withdrawal_min_points??4000),referral_milestone_count:Number(sm.referral_milestone_count??35),referral_milestone_points:Number(sm.referral_milestone_points??20000)}});
  }
  if(body.action==="admin"){
   if(profile.role!=="admin")return json({error:"Admin access required."},403);
   const [users,requests,ledger]=await Promise.all([admin.from("profiles").select("id,display_name,referral_code,created_at,role").order("created_at",{ascending:false}).limit(100),admin.from("withdrawal_requests").select("*").order("created_at",{ascending:false}).limit(100),admin.from("point_ledger").select("points")]);
   if(users.error||requests.error||ledger.error)return json({error:"Could not load admin data."},500);
   return json({ok:true,users:users.data||[],requests:requests.data||[],total_points_issued:(ledger.data||[]).filter(x=>x.points>0).reduce((s,x)=>s+x.points,0)});
  }
  if(body.action==="review_withdrawal"){
   if(profile.role!=="admin")return json({error:"Admin access required."},403);
   const {error}=await admin.rpc("newhub_admin_set_withdrawal",{p_withdrawal_id:body.request_id,p_status:body.status,p_note:String(body.note||"").slice(0,500)});
   if(error)return json({error:error.message},400);
   return json({ok:true});
  }
  return json({error:"Unknown action."},400);
 }catch(error){return json({error:error instanceof Error?error.message:"Unexpected server error."},500);}
});