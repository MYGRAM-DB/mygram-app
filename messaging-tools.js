(() => {
  'use strict';
  const cfg = window.MYGRAM_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const $ = id => document.getElementById(id);
  let context = { source:null, spaceId:null, userId:null, chatType:'group' };
  let activeTopicId = null, replyTarget = null, panel = null, panelBody = null, currentPanel = null, topics = [];
  const reactionCache = new Map();
  const tableForSource = source => source === 'direct' ? 'direct_messages' : source === 'whatsmygram' ? 'whatsmygram_messages' : 'chat_messages';
  const messageText = m => m && m.body ? String(m.body) : (m && m.attachment_type ? '['+m.attachment_type+']' : 'رسالة');
  function notice(message, kind) {
    const isError = kind === true || kind === 'error';
    const id = context.source === 'whatsmygram' ? 'waToast' : 'chatToast';
    const el = $(id);
    if (el) {
      el.textContent = message; el.hidden = false;
      if (context.source === 'whatsmygram') el.className = 'wa-toast show' + (isError ? ' error' : '');
      else { el.classList.remove('error'); if (isError) el.classList.add('error'); el.classList.add('show'); }
      setTimeout(() => { if (context.source === 'whatsmygram') el.classList.remove('show'); else el.classList.remove('show'); }, 3500);
    } else window.alert(message);
    if (window.MYGRAM_SOUNDS) window.MYGRAM_SOUNDS.play(isError ? 'error' : kind === 'success' ? 'success' : 'notification');
  }
  function stylePanel() {
    if ($('mygramMessagingToolsStyles')) return;
    const style = document.createElement('style'); style.id = 'mygramMessagingToolsStyles';
    style.textContent = [
      '.mygram-tools{margin:8px 0 10px;padding:10px;border:1px solid #dbe4ee;border-radius:14px;background:var(--surface,#fff);color:var(--ink,#1e293b);font-size:12px}',
      '.mygram-tools *{box-sizing:border-box}.mygram-tools-toolbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.mygram-tools-btn{border:1px solid #d5deeb;border-radius:9px;background:#fff;color:#32445e;padding:7px 10px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}',
      '.mygram-tools-btn:hover,.mygram-tools-btn[aria-pressed=true]{background:#eef3ff;border-color:#b9c9ef;color:#294b9e}',
      '.mygram-tools-body{padding-top:10px}.mygram-tools-body[hidden]{display:none!important}.mygram-tools-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:7px 0}',
      '.mygram-tools input,.mygram-tools textarea,.mygram-tools select{min-width:0;max-width:100%;border:1px solid #d6deea;border-radius:9px;padding:8px 9px;font:inherit;background:#fff;color:#24324a}',
      '.mygram-tools input[type=text]{flex:1}.mygram-tools textarea{width:100%;min-height:65px}',
      '.mygram-tools-list{display:grid;gap:7px;max-height:260px;overflow:auto;margin-top:8px}',
      '.mygram-tools-item{padding:9px;border:1px solid #e2e8f0;border-radius:10px;background:#fbfcff;overflow-wrap:anywhere}',
      '.mygram-tools-item p{margin:0 0 5px;line-height:1.65}.mygram-tools-muted{color:#7a879a;font-size:10px}',
      '.mygram-message-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.mygram-message-actions button{border:1px solid #d5deeb;border-radius:7px;background:#fff;padding:4px 7px;font-size:10px;color:#435572;cursor:pointer}',
      '.mygram-message-quote{display:block;margin:5px 0;padding:6px 9px;border-inline-start:3px solid #6b83c5;background:#f4f7ff;border-radius:5px;font-size:11px;color:#536481;white-space:pre-wrap}',
      '.mygram-reaction-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}',
      '.mygram-reaction-chip{border:1px solid #dbe4f0;border-radius:999px;background:#fff;color:#3c4f70;padding:3px 7px;font-size:11px;cursor:pointer}',
      '.mygram-reaction-chip[aria-pressed=true]{background:#eaf0ff;border-color:#96afea;color:#243f87;font-weight:900}',
      '.mygram-reply-indicator{display:flex;align-items:center;gap:8px;padding:7px 10px;margin-bottom:8px;background:#eef3ff;border:1px solid #cfdaf7;border-radius:9px;color:#2f477e;font-size:11px}',
      '.mygram-reply-indicator[hidden]{display:none!important}.mygram-reply-indicator span{flex:1;overflow-wrap:anywhere}',
      '.mygram-poll-option{display:flex;align-items:center;gap:7px;width:100%;text-align:start;margin-top:5px}.mygram-poll-option span:first-child{flex:1}.mygram-poll-bar{height:5px;background:#d9e4ff;border-radius:99px;overflow:hidden;margin-top:4px}.mygram-poll-bar i{display:block;height:100%;background:#476ac3}',
      '@media(max-width:520px){.mygram-tools{padding:8px}.mygram-tools-btn{padding:7px 8px}.mygram-tools-list{max-height:210px}}'
    ].join('');
    document.head.appendChild(style);
  }
  function button(label, action, pressed) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mygram-tools-btn'; b.textContent = label;
    if (pressed !== undefined) b.setAttribute('aria-pressed',String(pressed));
    b.addEventListener('click',action); return b;
  }
  function ensurePanel() {
    if (panel && panel.isConnected) return;
    const composer = $(context.source === 'direct' ? 'messageForm' : context.source === 'whatsmygram' ? 'waCompose' : 'chatCompose');
    if (!composer || !composer.parentNode) return;
    stylePanel();
    panel = document.createElement('section'); panel.id = 'mygramMessagingTools'; panel.className = 'mygram-tools';
    panel.setAttribute('aria-label','أدوات المحادثة المشتركة');
    const toolbar = document.createElement('div'); toolbar.className = 'mygram-tools-toolbar';
    const specs=[
      {kind:'search',label:'🔎 البحث'},
      {kind:'topics',label:'🧵 المواضيع'},
      {kind:'pins',label:'📌 المثبتة'},
      {kind:'bookmarks',label:'⭐ المحفوظات'},
      {kind:'polls',label:'📊 استطلاع'}
    ];
    specs.forEach(spec=>{const b=button(spec.label,()=>openPanel(spec.kind),false);b.dataset.kind=spec.kind;b.hidden=context.source==='direct'&&!['search','bookmarks'].includes(spec.kind);toolbar.appendChild(b);});
    panelBody = document.createElement('div'); panelBody.className = 'mygram-tools-body'; panelBody.hidden = true;
    panel.append(toolbar,panelBody); composer.parentNode.insertBefore(panel,composer);
    if(context.source!=='direct'){
      let replyBar=$('mygramReplyIndicator');
      if(!replyBar){
        replyBar=document.createElement('div');replyBar.id='mygramReplyIndicator';replyBar.className='mygram-reply-indicator';replyBar.hidden=true;
        const replyText=document.createElement('span');replyText.id='mygramReplyText';
        const cancel=button('إلغاء الرد',clearReplyTarget);cancel.className='mygram-tools-btn';
        replyBar.append(replyText,cancel);
      }
      const inputId=context.source==='whatsmygram'?'waBody':'chatBody';
      const messageInput=$(inputId);
      if(messageInput && messageInput.parentNode===composer && replyBar.parentNode!==composer) composer.insertBefore(replyBar,messageInput);
    }
  }
  function rootStatus() {
    const item = document.createElement('p'); item.className='mygram-tools-muted'; item.setAttribute('role','status'); item.setAttribute('aria-live','polite'); return item;
  }
  function title(text) { const h = document.createElement('strong'); h.textContent = text; return h; }
  function searchButton(input, callback, label) {
    const row = document.createElement('div'); row.className = 'mygram-tools-row';
    const b = button(label || 'بحث',callback);
    row.append(input,b); return row;
  }
  function input(placeholder, type) {
    const el = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') el.type = type || 'text';
    el.placeholder = placeholder; el.autocomplete = 'off'; return el;
  }
  function listBox() { const box = document.createElement('div'); box.className='mygram-tools-list'; return box; }
  function empty(box, text) { const e=document.createElement('div');e.className='mygram-tools-item mygram-tools-muted';e.textContent=text;box.appendChild(e); }
  function openPanel(kind) {
    ensurePanel(); if (!panelBody) return;
    currentPanel = kind; panelBody.hidden = false; panelBody.replaceChildren();
    panel.querySelectorAll('button[data-kind]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.kind===kind));b.hidden=context.source==='direct'&&!['search','bookmarks'].includes(b.dataset.kind);});
    if (!context.spaceId || !context.userId) { empty(panelBody,'اختر محادثة أولاً.'); return; }
    if (context.source==='direct'&&!['search','bookmarks'].includes(kind)) { empty(panelBody,'هذه الأداة متاحة في مجموعات MYGRAM Chat وWHATSMYGRAM.'); return; }
    if (kind === 'search') renderSearch();
    else if (kind === 'topics') renderTopics();
    else if (kind === 'pins') renderPins();
    else if (kind === 'bookmarks') renderBookmarks();
    else if (kind === 'polls') renderPolls();
  }
  async function renderSearch() {
    const q=input('ابحث في رسائل هذه المحادثة…');
    const output=listBox();
    panelBody.append(title('بحث داخل المحادثة'),searchButton(q,run,'بحث'),output);
    async function run() {
      const term=q.value.trim(); output.replaceChildren();
      if(term.length<2){empty(output,'اكتب حرفين على الأقل.');return;}
      let query;
      if(context.source==='direct') {
        query=db.from('direct_messages').select('id,sender_id,recipient_id,body,attachment_type,created_at')
          .or('and(sender_id.eq.'+context.userId+',recipient_id.eq.'+context.spaceId+'),and(sender_id.eq.'+context.spaceId+',recipient_id.eq.'+context.userId+')');
      } else {
        query=db.from(tableForSource(context.source)).select('id,chat_id,sender_id,body,attachment_type,created_at')
          .eq('chat_id',context.spaceId);
      }
      const result=await query.ilike('body','%'+term+'%').order('created_at',{ascending:false}).limit(50);
      if(result.error){empty(output,'تعذر البحث: '+result.error.message);return;}
      if(!(result.data||[]).length){empty(output,'لم نعثر على رسائل مطابقة.');return;}
      result.data.forEach(m=>{
        const item=document.createElement('article');item.className='mygram-tools-item';
        const p=document.createElement('p');p.textContent=messageText(m);
        const meta=document.createElement('small');meta.className='mygram-tools-muted';meta.textContent=new Date(m.created_at).toLocaleString();
        const jump=button('الانتقال للرسالة',()=>jumpToMessage(m.id));
        item.append(p,meta,jump);output.appendChild(item);
      });
    }
    q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();}});
  }
  async function renderTopics() {
    const area=document.createElement('div');
    const topicSelect=document.createElement('select');topicSelect.setAttribute('aria-label','فلترة حسب الموضوع');
    const all=document.createElement('option');all.value='';all.textContent='كل الرسائل';topicSelect.appendChild(all);
    const topicResult=await db.from('messaging_topics').select('id,title,description,created_by,created_at,position')
      .eq('source',context.source).eq('space_id',context.spaceId).order('position',{ascending:true}).order('created_at',{ascending:true});
    topics=topicResult.data||[];
    if(topicResult.error){empty(area,'تعذر تحميل المواضيع: '+topicResult.error.message);panelBody.append(title('مواضيع المحادثة'),area);return;}
    topics.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.title;topicSelect.appendChild(o);});
    topicSelect.value=activeTopicId||'';
    topicSelect.addEventListener('change',()=>{
      activeTopicId=topicSelect.value||null;
      window.dispatchEvent(new CustomEvent('mygram:topic-changed',{detail:{source:context.source,spaceId:context.spaceId,topicId:activeTopicId}}));
      notice(activeTopicId?'تم اختيار الموضوع، وستظهر رسائله فقط.':'تم عرض جميع الرسائل.');
    });
    const desc=input('اسم الموضوع الجديد');
    const create=button('＋ إنشاء موضوع',async()=>{
      const value=desc.value.trim(); if(value.length<2){notice('اكتب اسماً للموضوع من حرفين على الأقل.',true);return;}
      create.disabled=true;
      const result=await db.from('messaging_topics').insert({source:context.source,space_id:context.spaceId,title:value,created_by:context.userId})
        .select('id,title,description,created_by,created_at,position').single();
      create.disabled=false;
      if(result.error){notice('تعذر إنشاء الموضوع. يلزم أن تكون منشئ المحادثة أو مشرفاً فيها. '+result.error.message,true);return;}
      topics.push(result.data); activeTopicId=result.data.id;
      window.dispatchEvent(new CustomEvent('mygram:topic-changed',{detail:{source:context.source,spaceId:context.spaceId,topicId:activeTopicId}}));
      openPanel('topics');notice('تم إنشاء الموضوع.','success');
    });
    const info=rootStatus();info.textContent='اختر موضوعاً لفلترة الرسائل. إنشاء المواضيع متاح لمنشئ المساحة أو المشرف المصرّح له.';
    area.append(topicSelect,document.createElement('div'));area.lastChild.className='mygram-tools-row';area.lastChild.append(desc,create);area.appendChild(info);
    panelBody.append(title('مواضيع المحادثة'),area);
  }
  async function renderPins() {
    const box=listBox();panelBody.append(title('الرسائل المثبتة'),box);
    const result=await db.from('messaging_pins').select('id,message_id,pinned_by,created_at').eq('source',context.source).eq('space_id',context.spaceId).order('created_at',{ascending:false}).limit(50);
    if(result.error){empty(box,'تعذر تحميل المثبتات: '+result.error.message);return;}
    if(!(result.data||[]).length){empty(box,'لا توجد رسائل مثبتة بعد.');return;}
    const ids=result.data.map(x=>x.message_id);
    const messages=await db.from(tableForSource(context.source)).select('id,body,attachment_type,created_at').in('id',ids);
    const map=new Map((messages.data||[]).map(m=>[m.id,m]));
    result.data.forEach(pin=>{
      const m=map.get(pin.message_id);const item=document.createElement('article');item.className='mygram-tools-item';
      const p=document.createElement('p');p.textContent=m?messageText(m):'رسالة مثبتة';
      const meta=document.createElement('small');meta.className='mygram-tools-muted';meta.textContent=new Date(pin.created_at).toLocaleString();
      const jump=button('عرض الرسالة',()=>jumpToMessage(pin.message_id));item.append(p,meta,jump);box.appendChild(item);
    });
  }
  async function renderBookmarks() {
    const box=listBox();panelBody.append(title('رسائلي المحفوظة'),box);
    let bookmarkQuery=db.from('messaging_bookmarks').select('message_id,label,created_at').eq('user_id',context.userId).eq('source',context.source);
    if(context.source!=='direct')bookmarkQuery=bookmarkQuery.eq('space_id',context.spaceId);
    const result=await bookmarkQuery.order('created_at',{ascending:false}).limit(100);
    if(result.error){empty(box,'تعذر تحميل المحفوظات: '+result.error.message);return;}
    if(!(result.data||[]).length){empty(box,'لا توجد رسائل محفوظة. اضغط «حفظ» أسفل أي رسالة.');return;}
    const messages=await db.from(tableForSource(context.source)).select(context.source==='direct'?'id,sender_id,recipient_id,body,attachment_type,created_at':'id,body,attachment_type,created_at').in('id',result.data.map(x=>x.message_id));
    const map=new Map((messages.data||[]).map(m=>[m.id,m]));
    let peerProfiles=new Map();
    if(context.source==='direct'){
      const peers=[...new Set((messages.data||[]).map(m=>m.sender_id===context.userId?m.recipient_id:m.sender_id).filter(id=>id!==context.userId))];
      if(peers.length){const prof=await db.from('profiles').select('id,username,full_name').in('id',peers);peerProfiles=new Map((prof.data||[]).map(p=>[p.id,p]));}
    }
    result.data.forEach(saved=>{
      const item=document.createElement('article');item.className='mygram-tools-item';
      const message=map.get(saved.message_id);
      const p=document.createElement('p');p.textContent=message?messageText(message):(saved.label||'رسالة محفوظة');
      const meta=document.createElement('small');meta.className='mygram-tools-muted';
      let metaText=new Date(saved.created_at).toLocaleString();
      if(context.source==='direct'&&message){const peerId=message.sender_id===context.userId?message.recipient_id:message.sender_id;const peer=peerProfiles.get(peerId);metaText+=' · '+(peer?.full_name||peer?.username||'محادثة خاصة');}
      meta.textContent=metaText;
      const row=document.createElement('div');row.className='mygram-tools-row';
      const open=button(context.source==='direct'?'فتح المحادثة':'عرض',()=>{
        if(context.source==='direct'&&message){
          const peerId=message.sender_id===context.userId?message.recipient_id:message.sender_id;
          if(peerId!==context.spaceId){const peer=peerProfiles.get(peerId);if(peer?.username){location.href='services.html?tab=messages&to='+encodeURIComponent(peer.username);return;}notice('تعذّر فتح المحادثة لأن اسم المستخدم غير متاح.',true);return;}
        }
        jumpToMessage(saved.message_id);
      });
      row.append(open,button('إزالة من المحفوظات',async()=>{
        const del=await db.from('messaging_bookmarks').delete().eq('user_id',context.userId).eq('source',context.source).eq('message_id',saved.message_id);
        if(del.error)notice('تعذر حذف الحفظ: '+del.error.message,true);else{notice('تمت إزالة الرسالة من المحفوظات.');renderBookmarks();}
      }));item.append(p,meta,row);box.appendChild(item);
    });
  }
  async function renderPolls() {
    const heading=document.createElement('div');heading.className='mygram-tools-row';heading.append(title('استطلاعات الرأي'));
    const q=input('سؤال الاستطلاع');
    const options=input('كل خيار في سطر مستقل','textarea');
    const create=button('＋ نشر استطلاع',async()=>{
      const question=q.value.trim();const choices=options.value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
      if(question.length<2||choices.length<2||choices.length>10||choices.some(x=>x.length>200)){notice('أدخل سؤالاً وخيارين إلى عشرة خيارات.',true);return;}
      create.disabled=true;
      const poll=await db.from('messaging_polls').insert({source:context.source,space_id:context.spaceId,created_by:context.userId,question,poll_type:'poll',is_anonymous:false})
        .select('id').single();
      if(poll.error){create.disabled=false;notice('تعذر إنشاء الاستطلاع: '+poll.error.message,true);return;}
      const inserted=await db.from('messaging_poll_options').insert(choices.map((option_text,position)=>({poll_id:poll.data.id,option_text,position})));
      create.disabled=false;
      if(inserted.error){notice('أُنشئ الاستطلاع لكن تعذر حفظ بعض الخيارات: '+inserted.error.message,true);return;}
      q.value='';options.value='';notice('تم نشر الاستطلاع.');renderPolls();
    });
    const creator=document.createElement('div');creator.append(q,options,create);creator.className='mygram-tools-list';
    const box=listBox();panelBody.append(heading,creator,title('الاستطلاعات المنشورة'),box);
    const polls=await db.from('messaging_polls').select('id,question,created_by,closes_at,closed_at,created_at').eq('source',context.source).eq('space_id',context.spaceId).order('created_at',{ascending:false}).limit(30);
    if(polls.error){empty(box,'تعذر تحميل الاستطلاعات: '+polls.error.message);return;}
    if(!(polls.data||[]).length){empty(box,'لا توجد استطلاعات منشورة.');return;}
    const ids=polls.data.map(p=>p.id);
    const [optResult,voteResult]=await Promise.all([
      db.from('messaging_poll_options').select('id,poll_id,option_text,position').in('poll_id',ids).order('position',{ascending:true}),
      db.from('messaging_poll_votes').select('poll_id,option_id,user_id').in('poll_id',ids)
    ]);
    const opts=optResult.data||[],votes=voteResult.data||[];
    polls.data.forEach(poll=>{
      const item=document.createElement('article');item.className='mygram-tools-item';item.appendChild(title(poll.question));
      const pOpts=opts.filter(o=>o.poll_id===poll.id),pVotes=votes.filter(v=>v.poll_id===poll.id);
      const mine=pVotes.find(v=>v.user_id===context.userId);
      const closed=!!poll.closed_at||(poll.closes_at&&new Date(poll.closes_at)<=new Date());
      pOpts.forEach(opt=>{
        const count=pVotes.filter(v=>v.option_id===opt.id).length;
        const b=button('',async()=>{
          if(closed){notice('هذا الاستطلاع مغلق.',true);return;}
          const vote=await db.from('messaging_poll_votes').upsert({poll_id:poll.id,option_id:opt.id,user_id:context.userId},{onConflict:'poll_id,user_id'});
          if(vote.error){notice('تعذر تسجيل تصويتك: '+vote.error.message,true);return;}
          notice('تم تسجيل تصويتك.');renderPolls();
        });
        b.className='mygram-tools-btn mygram-poll-option';b.disabled=!!closed;
        const label=document.createElement('span');label.textContent=(mine&&mine.option_id===opt.id?'✓ ':'')+opt.option_text;
        const countLabel=document.createElement('span');countLabel.className='mygram-tools-muted';countLabel.textContent=String(count);
        b.append(label,countLabel);
        const bar=document.createElement('div');bar.className='mygram-poll-bar';const i=document.createElement('i');i.style.width=(pVotes.length?Math.round(count/pVotes.length*100):0)+'%';bar.appendChild(i);
        item.append(b,bar);
      });
      const meta=rootStatus();meta.textContent=pVotes.length+' صوت · '+(closed?'مغلق':'مفتوح');item.appendChild(meta);box.appendChild(item);
    });
  }
  async function togglePin(message) {
    const existing=await db.from('messaging_pins').select('id').eq('source',context.source).eq('space_id',context.spaceId).eq('message_id',message.id).maybeSingle();
    if(existing.error){notice(existing.error.message,true);return;}
    if(existing.data){
      const result=await db.from('messaging_pins').delete().eq('id',existing.data.id);
      if(result.error){notice('تعذر إزالة التثبيت، يلزم صلاحية إدارة.',true);return;}
      notice('تم إلغاء تثبيت الرسالة.');
    }else{
      const result=await db.from('messaging_pins').insert({source:context.source,space_id:context.spaceId,message_id:message.id,pinned_by:context.userId});
      if(result.error){notice('التثبيت متاح لمنشئ المساحة أو المشرف فقط: '+result.error.message,true);return;}
      notice('تم تثبيت الرسالة.');
    }
  }
  async function toggleBookmark(message) {
    const existing=await db.from('messaging_bookmarks').select('message_id').eq('user_id',context.userId).eq('source',context.source).eq('message_id',message.id).maybeSingle();
    if(existing.error){notice(existing.error.message,true);return;}
    if(existing.data){notice('هذه الرسالة محفوظة بالفعل.');return;}
    const bookmark={user_id:context.userId,source:context.source,message_id:message.id,label:messageText(message).slice(0,160)};
    if(context.source!=='direct')bookmark.space_id=context.spaceId;
    const result=await db.from('messaging_bookmarks').insert(bookmark);
    if(result.error)notice('تعذر حفظ الرسالة: '+result.error.message,true);
    else {notice('تم حفظ الرسالة في «المحفوظات».');window.MYGRAM_SOUNDS&&window.MYGRAM_SOUNDS.play('success');}
  }
  function decorateMessageBubble(bubble,message) {
    if(!message || !message.id || bubble.querySelector('.mygram-message-actions')) return;
    bubble.dataset.messageId=message.id;
    const actions=document.createElement('div');actions.className='mygram-message-actions';
    const save=button('☆ حفظ',()=>toggleBookmark(message));save.setAttribute('aria-label','حفظ الرسالة');save.className='';
    actions.appendChild(save);
    if(context.source!=='direct'){
      const reply=button('↩ رد',()=>setReplyTarget(message));reply.setAttribute('aria-label','الرد على الرسالة');reply.className='';actions.appendChild(reply);
      const pin=button('📌 تثبيت',()=>togglePin(message));pin.className='';actions.appendChild(pin);
    }
    renderReactionRow(bubble,message);
    bubble.appendChild(actions);
  }
  async function loadMessageReactions(messageIds) {
    const ids=[...new Set((messageIds||[]).filter(Boolean))];
    if(!ids.length || !context.source || !context.userId) return new Map();
    let query=db.from('messaging_message_reactions').select('id,source,space_id,message_id,user_id,emoji')
      .eq('source',context.source).in('message_id',ids);
    if(context.source!=='direct')query=query.eq('space_id',context.spaceId);
    const result=await query;
    if(result.error){console.warn('Could not load message reactions:',result.error.message);return reactionCache;}
    ids.forEach(id=>reactionCache.delete(id));
    for(const row of result.data||[]){
      if(!reactionCache.has(row.message_id))reactionCache.set(row.message_id,[]);
      const values=reactionCache.get(row.message_id);
      let summary=values.find(x=>x.emoji===row.emoji);
      if(!summary){summary={emoji:row.emoji,count:0,mine:false};values.push(summary);}
      summary.count++;
      if(row.user_id===context.userId)summary.mine=true;
    }
    return reactionCache;
  }
  function renderReactionRow(bubble,message) {
    if(!bubble||!message)return;
    let row=bubble.querySelector('.mygram-reaction-row');
    if(!row){row=document.createElement('div');row.className='mygram-reaction-row';const actions=bubble.querySelector('.mygram-message-actions');if(actions)bubble.insertBefore(row,actions);else bubble.appendChild(row);}
    row.replaceChildren();
    const current=reactionCache.get(message.id)||[];
    const defaults=['👍','❤️','😂','🔥'];
    const emojiList=[...new Set([...current.map(x=>x.emoji),...defaults])];
    for(const emoji of emojiList){
      const summary=current.find(x=>x.emoji===emoji);
      const chip=document.createElement('button');chip.type='button';chip.className='mygram-reaction-chip';
      chip.textContent=emoji+(summary&&summary.count?' '+summary.count:'');
      chip.setAttribute('aria-label','تفاعل '+emoji);chip.setAttribute('aria-pressed',String(!!summary?.mine));
      chip.addEventListener('click',()=>toggleMessageReaction(message,emoji));
      row.appendChild(chip);
    }
    if(!emojiList.length)row.remove();
  }
  async function toggleMessageReaction(message,emoji) {
    if(!context.source||!context.userId)return;
    const lookup=db.from('messaging_message_reactions').select('id')
      .eq('source',context.source).eq('message_id',message.id).eq('user_id',context.userId).eq('emoji',emoji);
    const existing=await lookup.maybeSingle();
    if(existing.error){notice('تعذر قراءة التفاعل: '+existing.error.message,true);return;}
    let result;
    if(existing.data){
      result=await db.from('messaging_message_reactions').delete().eq('id',existing.data.id);
    }else{
      const payload={source:context.source,space_id:context.source==='direct'?null:context.spaceId,message_id:message.id,user_id:context.userId,emoji};
      result=await db.from('messaging_message_reactions').insert(payload);
    }
    if(result.error){notice('تعذر حفظ التفاعل: '+result.error.message,true);return;}
    await loadMessageReactions([message.id]);
    const bubble=[...document.querySelectorAll('[data-message-id]')].find(node=>node.dataset.messageId===message.id);
    if(bubble)renderReactionRow(bubble,message);
    if(window.MYGRAM_SOUNDS)window.MYGRAM_SOUNDS.play('reaction');
  }
  function setReplyTarget(message) {
    if(context.source==='direct' || !message || !message.id)return;
    replyTarget={id:message.id,text:messageText(message).slice(0,180)};
    const bar=$('mygramReplyIndicator'); const span=$('mygramReplyText');
    if(bar)bar.hidden=false;
    if(span)span.textContent='رد على: '+(replyTarget.text||'رسالة مرفقة');
    const body=$(context.source==='whatsmygram'?'waBody':'chatBody');
    if(body)body.focus();
  }
  function clearReplyTarget() {
    replyTarget=null;
    const bar=$('mygramReplyIndicator');if(bar)bar.hidden=true;
    const span=$('mygramReplyText');if(span)span.textContent='';
  }
  function jumpToMessage(id) {
    const el=[...document.querySelectorAll('[data-message-id]')].find(node=>node.dataset.messageId===id);
    if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid #6a86d6';setTimeout(()=>el.style.outline='',1800);}
    else notice('حمّل سجل الرسائل حتى تظهر هذه الرسالة.');
  }
  function setContext(next) {
    context = Object.assign({},context,next||{});
    if(panel && panel.isConnected){panel.remove();panel=null;panelBody=null;}
    activeTopicId = null;clearReplyTarget();
    const replyBar=$('mygramReplyIndicator');if(replyBar)replyBar.remove();
    ensurePanel();
    if (panel && panelBody) { panelBody.hidden = true; panelBody.replaceChildren(); }
    return Promise.resolve();
  }
  window.MYGRAM_MESSAGING_TOOLS = {
    setContext, getActiveTopicId:()=>activeTopicId, getReplyToMessageId:()=>replyTarget&&replyTarget.id, clearReplyTarget, loadMessageReactions, decorateMessageBubble,
    getContext:()=>Object.assign({},context), openPanel
  };
  window.addEventListener('mygram:topic-changed', event => {
    if (event.detail && event.detail.source===context.source && event.detail.spaceId===context.spaceId) {
      if (currentPanel==='topics') openPanel('topics');
    }
  });
})();