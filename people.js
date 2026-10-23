(() => {
  "use strict";
  const config = window.MYGRAM_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
  const $ = id => document.getElementById(id);
  let me = null, myProfile = null, profiles = [];
  const escapeText = v => String(v ?? "");
  let toastTimer;
  function toast(message, kind="") {
    const el=$("toast"); el.textContent=message; el.className="toast show"+(kind?" "+kind:"");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.className="toast",3500);
  }
  function safeImage(url) {
    try { const u=new URL(url); return ["https:","http:"].includes(u.protocol) ? u.href : ""; } catch { return ""; }
  }
  function avatar(profile) {
    const el=document.createElement("div"); el.className="user-avatar";
    const url=safeImage(profile.avatar_url);
    if(url){const img=document.createElement("img");img.src=url;img.alt="";img.referrerPolicy="no-referrer";img.onerror=()=>{el.textContent=(profile.full_name||profile.username||"م")[0];};el.appendChild(img);}
    else el.textContent=(profile.full_name||profile.username||"م").trim()[0]||"م";
    return el;
  }
  function memberCard(profile, status, requestId) {
    const card=document.createElement("article");card.className="panel member-card";
    card.appendChild(avatar(profile));
    const details=document.createElement("div");details.className="member-details";
    const name=document.createElement("strong");name.textContent=profile.full_name||profile.username||"عضو MYGRAM";
    const handle=document.createElement("div");handle.className="muted";handle.textContent="@"+(profile.username||"member");
    const bio=document.createElement("p");bio.textContent=profile.bio||"لم يضف نبذة بعد.";
    details.append(name,handle,bio);
    const actions=document.createElement("div");actions.className="member-actions";
    if(status==="none"){
      const btn=document.createElement("button");btn.className="button";btn.textContent="إرسال طلب صداقة";
      btn.onclick=()=>sendRequest(profile.id,btn);actions.appendChild(btn);
    } else if(status==="incoming"){
      const accept=document.createElement("button");accept.className="button";accept.textContent="قبول";
      accept.onclick=()=>respond(requestId,"accepted",accept);
      const reject=document.createElement("button");reject.className="button button-secondary";reject.textContent="رفض";
      reject.onclick=()=>respond(requestId,"rejected",reject);actions.append(accept,reject);
    } else {
      const label=document.createElement("span");label.className="muted";
      label.textContent=status==="accepted"?"أصدقاء ✓":status==="outgoing"?"تم إرسال الطلب":"طلب بانتظار الرد";
      actions.appendChild(label);
    }
    details.appendChild(actions);card.appendChild(details);return card;
  }
  async function loadProfile() {
    const {data,error}=await client.from("users").select("id,username,email,full_name,bio,avatar_url").eq("id",me.id).maybeSingle();
    if(error) throw error;
    myProfile=data;
    $("fullName").value=data?.full_name||me.user_metadata?.full_name||"";
    $("username").value=data?.username||"";
    $("bio").value=data?.bio||"";
    $("avatarUrl").value=data?.avatar_url||"";
  }
  async function loadAllProfiles() {
    const {data,error}=await client.from("users").select("id,username,full_name,bio,avatar_url").neq("id",me.id).order("username").limit(200);
    if(error) throw error;
    profiles=data||[];
    await loadRequests();
    renderSearch();
  }
  async function loadRequests() {
    const {data,error}=await client.from("friend_requests").select("id,requester_id,receiver_id,status,created_at").or(`requester_id.eq.${me.id},receiver_id.eq.${me.id}`).order("created_at",{ascending:false}).limit(500);
    if(error) throw error;
    const reqs=data||[];
    const profileIds=[...new Set(reqs.map(r=>r.requester_id===me.id?r.receiver_id:r.requester_id))];
    let reqProfiles=[];
    if(profileIds.length){
      const result=await client.from("users").select("id,username,full_name,bio,avatar_url").in("id",profileIds);
      if(!result.error) reqProfiles=result.data||[];
    }
    const byId=new Map(reqProfiles.map(p=>[p.id,p]));
    $("incomingList").replaceChildren(); $("outgoingList").replaceChildren();
    let incoming=0,outgoing=0;
    reqs.forEach(r=>{
      const p=byId.get(r.requester_id===me.id?r.receiver_id:r.requester_id);
      if(!p)return;
      if(r.receiver_id===me.id && r.status==="pending"){ $("incomingList").appendChild(memberCard(p,"incoming",r.id));incoming++;}
      else if(r.requester_id===me.id && r.status==="pending"){ $("outgoingList").appendChild(memberCard(p,"outgoing",r.id));outgoing++;}
    });
    if(!incoming) $("incomingList").innerHTML='<p class="muted">لا توجد طلبات واردة حالياً.</p>';
    if(!outgoing) $("outgoingList").innerHTML='<p class="muted">لا توجد طلبات أرسلتها معلّقة.</p>';
  }
  function requestStatus(profileId) {
    return client.from("friend_requests").select("id,requester_id,receiver_id,status").or(`and(requester_id.eq.${me.id},receiver_id.eq.${profileId}),and(requester_id.eq.${profileId},receiver_id.eq.${me.id})`).limit(1).maybeSingle();
  }
  async function renderSearch() {
    const query=$("searchInput").value.trim().replace(/^@/,"").toLowerCase();
    const results=profiles.filter(p=>!query || (p.username||"").toLowerCase().includes(query)||(p.full_name||"").toLowerCase().includes(query));
    const list=$("membersList");list.replaceChildren();
    if(!results.length){list.innerHTML='<p class="muted">ما لقينا أعضاء مطابقين للبحث.</p>';return;}
    const reqResult=await client.from("friend_requests").select("id,requester_id,receiver_id,status").or(`requester_id.eq.${me.id},receiver_id.eq.${me.id}`).limit(500);
    if(reqResult.error){toast("تعذر تحميل حالة الصداقة: "+reqResult.error.message,"error");return;}
    const statuses=new Map();
    (reqResult.data||[]).forEach(r=>{
      const other=r.requester_id===me.id?r.receiver_id:r.requester_id;
      statuses.set(other,{status:r.status,direction:r.requester_id===me.id?"out":"in",id:r.id});
    });
    results.forEach(p=>{
      const s=statuses.get(p.id);
      let state="none",rid=null;
      if(s){rid=s.id;state=s.status==="accepted"?"accepted":s.direction==="out"?"outgoing":s.status==="pending"?"incoming":"none";}
      list.appendChild(memberCard(p,state,rid));
    });
  }
  async function sendRequest(receiverId,button) {
    button.disabled=true;
    const existing=await requestStatus(receiverId);
    if(existing.error){toast("تعذر التحقق من الطلب: "+existing.error.message,"error");button.disabled=false;return;}
    if(existing.data){
      if(existing.data.status==="rejected" && existing.data.requester_id===me.id){
        const {error}=await client.from("friend_requests").update({status:"pending",updated_at:new Date().toISOString()}).eq("id",existing.data.id);
        if(error){toast("تعذر إعادة إرسال الطلب: "+error.message,"error");button.disabled=false;return;}
      } else {toast("يوجد طلب سابق بينكما.");await loadAllProfiles();return;}
    } else {
      const {error}=await client.from("friend_requests").insert({requester_id:me.id,receiver_id:receiverId});
      if(error){toast("تعذر إرسال الطلب: "+error.message,"error");button.disabled=false;return;}
    }
    toast("تم إرسال طلب الصداقة ❤️");await loadAllProfiles();
  }
  async function respond(id,status,button) {
    button.disabled=true;
    const {error}=await client.from("friend_requests").update({status,updated_at:new Date().toISOString()}).eq("id",id);
    if(error){toast("تعذر تحديث الطلب: "+error.message,"error");button.disabled=false;return;}
    toast(status==="accepted"?"أصبحتما صديقين! 🤝":"تم رفض الطلب.");await loadAllProfiles();
  }
  $("profileForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const username=$("username").value.trim().toLowerCase();
    if(!/^[a-z0-9_]{3,30}$/.test(username)){toast("اسم المستخدم يجب أن يكون 3–30 حرفاً إنجليزياً أو رقماً أو _","error");return;}
    const btn=$("saveProfileButton");btn.disabled=true;
    const patch={full_name:$("fullName").value.trim(),username,bio:$("bio").value.trim(),avatar_url:safeImage($("avatarUrl").value.trim())||null,updated_at:new Date().toISOString()};
    const {error}=await client.from("users").update(patch).eq("id",me.id);
    btn.disabled=false;
    if(error){toast(error.code==="23505"?"اسم المستخدم مستخدم؛ اختر اسماً آخر.":"تعذر حفظ الملف: "+error.message,"error");return;}
    toast("تم حفظ ملفك الشخصي بنجاح.");await loadProfile();await loadAllProfiles();
  });
  $("searchInput").addEventListener("input",()=>{clearTimeout(window._searchTimer);window._searchTimer=setTimeout(renderSearch,180);});
  $("logoutButton").addEventListener("click",async()=>{await client.auth.signOut();location.href=config.loginUrl;});
  (async()=>{
    const {data,error}=await client.auth.getSession();
    if(error||!data.session){location.href=config.loginUrl;return;}
    me=data.session.user;
    try{await loadProfile();await loadAllProfiles();}
    catch(err){toast("تعذر تحميل البيانات. شغّل ملف phase2.sql في Supabase أولاً. "+(err.message||""),"error");}
  })();
})();