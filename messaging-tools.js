(() => {
  'use strict';
  const cfg = window.MYGRAM_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const $ = id => document.getElementById(id);
  let context = { source:null, spaceId:null, userId:null, chatType:'group' };
  let activeTopicId = null, panel = null, panelBody = null, currentPanel = null, topics = [];
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
    specs.forEach(spec=>{const b=button(spec.label,()=>openPanel(spec.kind),false);b.dataset.kind=spec.kind;toolbar.appendChild(b);});
    panelBody = document.createElement('div'); panelBody.className = 'mygram-tools-body'; panelBody.hidden = true;
    panel.append(toolbar,panelBody); composer.parentNode.insertBefore(panel,composer);
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
    result.data.forEach(saved=>{
      const item=document.createElement('article');item.className='mygram-tools-item';
      const p=document.createElement('p');p.textContent=map.has(saved.message_id)?messageText(map.get(saved.message_id)):(saved.label||'رسالة محفوظة');
      const meta=document.createElement('small');meta.className='mygram-tools-muted';meta.textContent=new Date(saved.created_at).toLocaleString();
      const row=document.createElement('div');row.className='mygram-tools-row';
      const message=map.get(saved.message_id);
      const open=button(context.source==='direct'?'عرض الرسالة':'عرض',()=>jumpToMessage(saved.message_id));
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
    if(context.source!=='direct'){const pin=button('📌 تثبيت',()=>togglePin(message));pin.className='';actions.appendChild(pin);}
    bubble.appendChild(actions);
  }
  function jumpToMessage(id) {
    const el=[...document.querySelectorAll('[data-message-id]')].find(node=>node.dataset.messageId===id);
    if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid #6a86d6';setTimeout(()=>el.style.outline='',1800);}
    else notice('حمّل سجل الرسائل حتى تظهر هذه الرسالة.');
  }
  function setContext(next) {
    context = Object.assign({},context,next||{});
    if(panel && panel.isConnected){panel.remove();panel=null;panelBody=null;}
    activeTopicId = null;
    ensurePanel();
    if (panel && panelBody) { panelBody.hidden = true; panelBody.replaceChildren(); }
    return Promise.resolve();
  }
  window.MYGRAM_MESSAGING_TOOLS = {
    setContext, getActiveTopicId:()=>activeTopicId, decorateMessageBubble,
    getContext:()=>Object.assign({},context), openPanel
  };
  window.addEventListener('mygram:topic-changed', event => {
    if (event.detail && event.detail.source===context.source && event.detail.spaceId===context.spaceId) {
      if (currentPanel==='topics') openPanel('topics');
    }
  });
})();