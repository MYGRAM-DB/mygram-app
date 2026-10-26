(() => {
  "use strict";
  const config = window.MYGRAM_CONFIG;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
  const $ = id => document.getElementById(id);
  const form = $("discoverForm"), queryInput = $("discoverQuery"), submit = $("discoverSubmit");
  const peopleBox = $("peopleResults"), postsBox = $("postResults"), status = $("discoverStatus");
  let activeUser = null, sequence = 0;
  const safeUrl = value => { try { const url = new URL(value); return ["https:","http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
  function setStatus(message, kind="") { status.textContent = window.MYGRAM_TRANSLATE_TEXT ? window.MYGRAM_TRANSLATE_TEXT(message) : message; status.dataset.kind = kind; }
  function empty(box, message) { const el=document.createElement("div");el.className="discover-empty";el.textContent=message;box.replaceChildren(el); }
  function avatar(profile) {
    const el=document.createElement("div");el.className="discover-avatar";
    const url=safeUrl(profile.avatar_url);
    if(url){const img=document.createElement("img");img.src=url;img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";img.onerror=()=>{el.textContent=(profile.full_name||profile.username||"م").trim()[0]||"م";};el.appendChild(img);}
    else el.textContent=(profile.full_name||profile.username||"م").trim()[0]||"م";
    return el;
  }
  function personCard(profile) {
    const card=document.createElement("article");card.className="discover-person";card.appendChild(avatar(profile));
    const info=document.createElement("div");info.className="discover-person-info";
    const name=document.createElement("strong");name.textContent=profile.full_name||profile.username||"عضو MYGRAM";
    const handle=document.createElement("div");handle.className="discover-handle";handle.textContent="@"+(profile.username||"member");
    const bio=document.createElement("p");bio.className="discover-bio";bio.textContent=profile.bio||"لم يضف نبذة بعد.";
    const actions=document.createElement("div");actions.className="discover-person-actions";
    const link=document.createElement("a");link.href="people.html?search="+encodeURIComponent(profile.username||"");link.textContent="عرض ضمن الأصدقاء";
    actions.appendChild(link);info.append(name,handle,bio,actions);card.appendChild(info);return card;
  }
  function postCard(post, author) {
    const card=document.createElement("article");card.className="discover-post";
    const head=document.createElement("div");head.className="discover-post-head";
    const who=document.createElement("strong");who.textContent=author||"عضو MYGRAM";
    const date=document.createElement("time");date.textContent=post.created_at ? new Intl.DateTimeFormat(document.documentElement.lang||"ar",{dateStyle:"medium"}).format(new Date(post.created_at)) : "";
    head.append(who,date);
    const body=document.createElement("div");body.className="discover-post-content";body.textContent=post.content||"";
    card.append(head,body);
    const mediaUrl=safeUrl(post.media_url);
    if(mediaUrl && post.media_type){const media=document.createElement(post.media_type==="video"?"video":"img");media.className="discover-post-media";media.src=mediaUrl;if(media.tagName==="VIDEO"){media.controls=true;media.preload="metadata";media.playsInline=true;}else{media.alt="مرفق المنشور";media.loading="lazy";}card.appendChild(media);}
    const link=document.createElement("a");link.className="discover-post-link";link.href="home.html#post-"+encodeURIComponent(post.id);link.textContent="فتح المنشور في الموجز ←";card.appendChild(link);return card;
  }
  async function runSearch(event) {
    event?.preventDefault();
    const query=queryInput.value.trim().replace(/^@/,"").replace(/[%,()]/g," ").replace(/\s+/g," ").slice(0,100);
    if(query.length<2){setStatus("اكتب حرفين على الأقل للبحث.");return;}
    const mySequence=++sequence;submit.disabled=true;submit.textContent="جارٍ البحث…";
    empty(peopleBox,"جارٍ البحث عن الأشخاص…");empty(postsBox,"جارٍ البحث عن المنشورات…");setStatus("نبحث في الأشخاص والمنشورات المتاحة لحسابك…");
    try {
      const pattern="%"+query+"%";
      const [peopleResult,postsResult]=await Promise.all([
        client.from("profiles").select("id,username,full_name,bio,avatar_url").or("username.ilike."+pattern+",full_name.ilike."+pattern).neq("id",activeUser.id).limit(12),
        client.from("posts").select("id,user_id,content,media_url,media_type,created_at").ilike("content",pattern).order("created_at",{ascending:false}).limit(12)
      ]);
      if(mySequence!==sequence)return;
      if(peopleResult.error)throw new Error("تعذّر البحث عن الأشخاص: "+peopleResult.error.message);
      if(postsResult.error && !/column .*media_url.* does not exist|column .*media_type.* does not exist/i.test(postsResult.error.message))throw new Error("تعذّر البحث عن المنشورات: "+postsResult.error.message);
      const people=peopleResult.data||[];
      people.length ? peopleBox.replaceChildren(...people.map(personCard)) : empty(peopleBox,"ما لقينا أشخاصاً مطابقين. جرّب اسماً أو اسم مستخدم آخر.");
      let posts=postsResult.data||[];
      if(postsResult.error){const fallback=await client.from("posts").select("id,user_id,content,created_at").ilike("content",pattern).order("created_at",{ascending:false}).limit(12);if(fallback.error)throw new Error("تعذّر تحميل المنشورات.");posts=fallback.data||[];}
      const ids=[...new Set(posts.map(p=>p.user_id).filter(Boolean))];let profiles=[];
      if(ids.length){const result=await client.from("profiles").select("id,username,full_name").in("id",ids);if(!result.error)profiles=result.data||[];}
      const names=new Map(profiles.map(p=>[p.id,p.full_name||("@"+(p.username||"member"))]));
      posts.length ? postsBox.replaceChildren(...posts.map(p=>postCard(p,names.get(p.user_id)))) : empty(postsBox,"ما لقينا منشورات نصية مطابقة يمكنك الوصول إليها.");
      setStatus("انتهى البحث عن «"+query+"»: "+people.length+" أشخاص و"+posts.length+" منشورات.", "success");
    } catch(error) {
      if(mySequence!==sequence)return;
      empty(peopleBox,"تعذّر تحميل نتائج الأشخاص.");empty(postsBox,"تعذّر تحميل نتائج المنشورات.");
      setStatus(error.message||"صار خطأ أثناء البحث. حاول مرة ثانية.","error");
    } finally {if(mySequence===sequence){submit.disabled=false;submit.textContent="اكتشف";}}
  }
  form.addEventListener("submit",runSearch);
  queryInput.addEventListener("keydown",event=>{if(event.key==="Escape"){queryInput.value="";empty(peopleBox,"ستظهر نتائج الأشخاص هنا.");empty(postsBox,"ستظهر نتائج المنشورات هنا.");setStatus("اكتب كلمتين على الأقل للبدء بالبحث.");}});
  client.auth.getSession().then(({data,error})=>{if(error||!data?.session?.user){location.replace("login.html");return;}activeUser=data.session.user;const params=new URLSearchParams(location.search);const initial=params.get("q");if(initial){queryInput.value=initial;runSearch();}});
})();