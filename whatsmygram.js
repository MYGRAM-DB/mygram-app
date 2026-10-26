(() => {
  'use strict';
  const cfg = window.MYGRAM_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const $ = id => document.getElementById(id);
  const PAGE_LIMIT = 250;
  let me = null, presence = null, activeChat = null, activeChatMeta = null;
  let activeMembers = [], activeProfiles = new Map(), inboxChannel = null, toastTimer = null;
  let mediaRecorder = null, recordingStream = null, recordingChunks = [], recordedVoiceFile = null;
  let recordedVoiceDurationSeconds = null, recordingStartedAt = 0, recordingLimitTimer = null;

  function toast(message, error = false) {
    if (window.MYGRAM_TRANSLATE_TEXT) message = window.MYGRAM_TRANSLATE_TEXT(message);
    const el = $('waToast'); el.textContent = message; el.hidden = false;
    el.className = 'wa-toast show' + (error ? ' error' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'wa-toast'; el.hidden = true; }, 4200);
    window.MYGRAM_SOUNDS?.play(error ? 'error' : 'tap');
  }
  function safeName(profile) { return profile?.full_name?.trim() || (profile?.username ? '@' + profile.username : 'عضو MYGRAM'); }
  function initial(profile) { const text = String(profile?.full_name || profile?.username || '').trim(); return text ? Array.from(text)[0].toLocaleUpperCase() : '👤'; }
  function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(document.documentElement.lang || 'ar', { hour: '2-digit', minute: '2-digit' }); }
  function formatVoiceDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function relativeLastSeen(value) {
    const age = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (age < 120) return 'آخر ظهور منذ دقيقة';
    const minutes = Math.floor(age / 60); if (minutes < 60) return 'آخر ظهور منذ ' + minutes + ' دقيقة';
    const hours = Math.floor(minutes / 60); if (hours < 24) return 'آخر ظهور منذ ' + hours + ' ساعة';
    return 'آخر ظهور منذ ' + Math.floor(hours / 24) + ' يوم';
  }
  function makeAvatar(profile, className = 'presence-avatar') {
    if (window.MYGRAM_PRESENCE) return window.MYGRAM_PRESENCE.createAvatar(profile, className);
    const el = document.createElement('span'); el.className = className; el.textContent = initial(profile);
    if (profile?.avatar_url) { const img = document.createElement('img'); img.src = profile.avatar_url; img.alt = ''; el.replaceChildren(img); }
    return el;
  }
  async function getProfileByUsername(username) {
    const name = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(name)) throw new Error('اكتب اسم مستخدم صحيحاً من 3 إلى 30 حرفاً.');
    const { data, error } = await db.from('profiles').select('id,username,full_name,avatar_url').eq('username', name).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('لم نعثر على المستخدم @' + name + '.');
    if (data.id === me.id) throw new Error('لا يمكنك بدء محادثة مع نفسك.');
    return data;
  }
  function chatTitle(chat, members, profiles) {
    if (chat?.is_group) return chat.title || 'مجموعة WHATSMYGRAM';
    const peer = members.find(member => member.user_id !== me.id);
    return safeName(profiles.get(peer?.user_id));
  }
  async function createOrFindChat(others) {
    if (others.length === 1) {
      const { data: ownRows, error: ownError } = await db.from('whatsmygram_chat_members').select('chat_id').eq('user_id', me.id);
      if (ownError) throw ownError;
      const ids = [...new Set((ownRows || []).map(row => row.chat_id))];
      if (ids.length) {
        const [membersResult, chatsResult] = await Promise.all([
          db.from('whatsmygram_chat_members').select('chat_id,user_id').in('chat_id', ids),
          db.from('whatsmygram_chats').select('id,is_group,title').in('id', ids)
        ]);
        if (membersResult.error) throw membersResult.error;
        if (chatsResult.error) throw chatsResult.error;
        const chatById = new Map((chatsResult.data || []).map(chat => [chat.id, chat]));
        const byChat = new Map();
        for (const member of membersResult.data || []) {
          if (!byChat.has(member.chat_id)) byChat.set(member.chat_id, []);
          byChat.get(member.chat_id).push(member);
        }
        for (const id of ids) {
          const chat = chatById.get(id), people = byChat.get(id) || [];
          if (chat && !chat.is_group && people.some(person => person.user_id === others[0].id) && people.some(person => person.user_id === me.id)) return chat;
        }
      }
    }
    const isGroup = others.length > 1;
    const title = isGroup ? others.map(safeName).join('، ').slice(0, 100) : null;
    const { data: chat, error: createError } = await db.from('whatsmygram_chats')
      .insert({ created_by: me.id, is_group: isGroup, title })
      .select('id,is_group,title,created_at')
      .single();
    if (createError) throw createError;
    const people = [{ chat_id: chat.id, user_id: me.id }, ...others.map(person => ({ chat_id: chat.id, user_id: person.id }))];
    const { error: memberError } = await db.from('whatsmygram_chat_members').insert(people);
    if (memberError) {
      try { await db.from('whatsmygram_chats').delete().eq('id', chat.id).eq('created_by', me.id); } catch {}
      throw memberError;
    }
    return chat;
  }
  async function loadChatList() {
    const box = $('waChatList'); box.replaceChildren();
    const { data: ownMembers, error: ownError } = await db.from('whatsmygram_chat_members')
      .select('chat_id,last_read_at').eq('user_id', me.id);
    if (ownError) throw ownError;
    const ids = [...new Set((ownMembers || []).map(row => row.chat_id))];
    if (!ids.length) {
      const empty = document.createElement('div'); empty.className = 'wa-empty';
      empty.innerHTML = '<span class="wa-empty-icon">👋</span>لا توجد محادثات بعد.<br>ابدأ بكتابة اسم مستخدم بالأعلى.';
      box.appendChild(empty); return;
    }
    const [chatsResult, membersResult, messagesResult] = await Promise.all([
      db.from('whatsmygram_chats').select('id,created_by,is_group,title,created_at,updated_at').in('id', ids),
      db.from('whatsmygram_chat_members').select('chat_id,user_id,last_read_at').in('chat_id', ids),
      db.from('whatsmygram_messages').select('id,chat_id,sender_id,body,attachment_type,created_at').in('chat_id', ids).order('created_at', { ascending: false }).limit(500)
    ]);
    if (chatsResult.error) throw chatsResult.error;
    if (membersResult.error) throw membersResult.error;
    if (messagesResult.error) throw messagesResult.error;
    const chats = chatsResult.data || [], members = membersResult.data || [], messages = messagesResult.data || [];
    const peerIds = [...new Set(members.map(row => row.user_id).filter(id => id !== me.id))];
    const profilesResult = peerIds.length ? await db.from('profiles').select('id,username,full_name,avatar_url').in('id', peerIds) : { data: [], error: null };
    if (profilesResult.error) throw profilesResult.error;
    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    const chatById = new Map(chats.map(chat => [chat.id, chat]));
    const membersByChat = new Map();
    for (const member of members) { if (!membersByChat.has(member.chat_id)) membersByChat.set(member.chat_id, []); membersByChat.get(member.chat_id).push(member); }
    const latestByChat = new Map(), unreadByChat = new Map();
    for (const message of messages) {
      if (!latestByChat.has(message.chat_id)) latestByChat.set(message.chat_id, message);
      if (message.sender_id !== me.id) {
        const own = (ownMembers || []).find(row => row.chat_id === message.chat_id);
        if (!own?.last_read_at || new Date(message.created_at) > new Date(own.last_read_at)) unreadByChat.set(message.chat_id, (unreadByChat.get(message.chat_id) || 0) + 1);
      }
    }
    chats.sort((a, b) => new Date(latestByChat.get(b.id)?.created_at || b.updated_at || b.created_at) - new Date(latestByChat.get(a.id)?.created_at || a.updated_at || a.created_at));
    for (const chat of chats) {
      const chatMembers = membersByChat.get(chat.id) || [];
      const title = chatTitle(chat, chatMembers, profiles);
      const peerMember = chatMembers.find(member => member.user_id !== me.id);
      const profile = chat.is_group ? { full_name: title } : profiles.get(peerMember?.user_id);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wa-chat-entry';
      button.dataset.chatId = chat.id; button.setAttribute('aria-current', String(activeChat === chat.id));
      button.appendChild(makeAvatar(profile));
      const copy = document.createElement('span'); copy.className = 'wa-chat-entry-copy';
      const heading = document.createElement('span'); heading.className = 'wa-chat-entry-title'; heading.textContent = title;
      const latest = latestByChat.get(chat.id);
      const preview = document.createElement('span'); preview.className = 'wa-chat-preview';
      preview.textContent = latest ? (latest.attachment_type === 'audio' ? '🎙️ رسالة صوتية' : latest.attachment_type === 'image' ? '📷 صورة' : latest.attachment_type === 'video' ? '🎬 فيديو' : latest.body) : (chat.is_group ? 'مجموعة WHATSMYGRAM' : 'ابدأ المحادثة');
      copy.append(heading, preview);
      const meta = document.createElement('span'); meta.className = 'wa-chat-meta';
      const time = document.createElement('small'); time.className = 'wa-chat-time'; time.textContent = latest ? formatTime(latest.created_at) : formatTime(chat.created_at);
      meta.appendChild(time);
      const unread = unreadByChat.get(chat.id) || 0;
      if (unread > 0 && activeChat !== chat.id) { const badge = document.createElement('span'); badge.className = 'wa-unread'; badge.textContent = unread > 99 ? '99+' : String(unread); meta.appendChild(badge); }
      button.append(copy, meta); box.appendChild(button);
    }
    activeMembers = activeChat ? (membersByChat.get(activeChat) || activeMembers) : activeMembers;
    activeProfiles = profiles;
  }
  async function renderPresence(targetUserId) {
    const target = $('waPeerPresence');
    if (!target) return;
    if (!targetUserId || !presence) { target.textContent = activeChatMeta?.is_group ? 'محادثة جماعية' : 'الحالة غير متاحة'; target.replaceChildren(...[document.createTextNode(target.textContent)]); return; }
    await presence.refresh(targetUserId, target);
  }
  async function openChat(chatId, chatHint = null) {
    activeChat = chatId;
    const { data: memberResult, error: memberError } = await db.from('whatsmygram_chat_members')
      .select('chat_id,user_id,last_read_at').eq('chat_id', chatId);
    if (memberError) throw memberError;
    activeMembers = memberResult || [];
    const peerIds = [...new Set(activeMembers.map(row => row.user_id).filter(id => id !== me.id))];
    const { data: peerRows, error: peerError } = peerIds.length
      ? await db.from('profiles').select('id,username,full_name,avatar_url').in('id', peerIds)
      : { data: [], error: null };
    if (peerError) throw peerError;
    activeProfiles = new Map((peerRows || []).map(profile => [profile.id, profile]));
    const { data: chatRows, error: chatError } = await db.from('whatsmygram_chats')
      .select('id,created_by,is_group,title,created_at,updated_at').eq('id', chatId).maybeSingle();
    if (chatError) throw chatError;
    activeChatMeta = chatRows || chatHint || { id: chatId, is_group: peerIds.length > 1 };
    window.MYGRAM_MESSAGING_TOOLS?.setContext({source:'whatsmygram',spaceId:chatId,userId:me?.id,chatType:activeChatMeta.is_group?'group':'direct'});
    const profile = peerIds.length === 1 ? activeProfiles.get(peerIds[0]) : { full_name: activeChatMeta.title || 'مجموعة WHATSMYGRAM' };
    $('waThreadHead').hidden = false;
    const previousAvatar = $('waPeerAvatar');
    const avatar = makeAvatar(profile, 'presence-avatar');
    avatar.id = 'waPeerAvatar'; previousAvatar.replaceWith(avatar);
    $('waPeerName').textContent = chatTitle(activeChatMeta, activeMembers, activeProfiles);
    $('waPeerHandle').textContent = profile?.username ? '@' + profile.username : (activeChatMeta.is_group ? 'محادثة جماعية · WHATSMYGRAM' : '');
    $('waBody').disabled = false; $('waFile').disabled = false; $('waRecordVoice').disabled = false; $('waSend').disabled = false;
    for (const item of $('waChatList').querySelectorAll('[data-chat-id]')) item.setAttribute('aria-current', String(item.dataset.chatId === chatId));
    await renderPresence(peerIds.length === 1 ? peerIds[0] : null);
    await loadMessages();
    $('waBody').focus({ preventScroll: true });
  }
  async function loadMessages() {
    if (!activeChat) return;
    const chatId = activeChat;
    let query = db.from('whatsmygram_messages')
      .select('id,chat_id,sender_id,body,attachment_url,attachment_type,duration_seconds,created_at,topic_id')
      .eq('chat_id', chatId);
    const topicId = window.MYGRAM_MESSAGING_TOOLS?.getActiveTopicId();
    if (topicId) query = query.eq('topic_id', topicId);
    const { data, error } = await query.order('created_at', { ascending: true }).limit(PAGE_LIMIT);
    if (error) throw error;
    if (chatId !== activeChat) return;
    const box = $('waMessages'); box.replaceChildren();
    const others = activeMembers.filter(member => member.user_id !== me.id);
    const allOthersRead = createdAt => others.length > 0 && others.every(member => member.last_read_at && new Date(member.last_read_at) >= new Date(createdAt));
    if (!data?.length) {
      const empty = document.createElement('div'); empty.className = 'wa-empty'; empty.innerHTML = '<span class="wa-empty-icon">🌿</span>ابدأ المحادثة برسالة لطيفة.<br>رسائلك الخاصة تبقى ضمن أعضاء هذه المحادثة.';
      box.appendChild(empty);
    }
    for (const message of data || []) {
      const bubble = document.createElement('article');
      bubble.className = 'wa-bubble' + (message.sender_id === me.id ? ' mine' : '');
      const audioPlaceholder = message.attachment_type === 'audio' && /رسالة صوتية/.test(message.body || '');
      if (message.body && !audioPlaceholder) { const text = document.createElement('p'); text.className = 'wa-bubble-text'; text.textContent = message.body; bubble.appendChild(text); }
      if (message.attachment_url && message.attachment_type) {
        const signed = await db.storage.from('mygram-private-messages').createSignedUrl(message.attachment_url, 3600);
        if (!signed.error) {
          if (message.attachment_type === 'audio') {
            const card = document.createElement('div'); card.className = 'wa-voice-card';
            const icon = document.createElement('span'); icon.className = 'wa-voice-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '🎙️';
            const copy = document.createElement('span'); copy.className = 'wa-voice-copy';
            const label = document.createElement('strong'); label.textContent = 'رسالة صوتية';
            const duration = document.createElement('small'); duration.textContent = formatVoiceDuration(message.duration_seconds);
            copy.append(label, duration);
            const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'metadata'; audio.src = signed.data.signedUrl; audio.setAttribute('aria-label', 'تشغيل الرسالة الصوتية');
            card.append(icon, copy, audio); bubble.appendChild(card);
          } else {
            let media;
            if (message.attachment_type === 'video') { media = document.createElement('video'); media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
            else { media = document.createElement('img'); media.alt = 'صورة مرفقة'; media.loading = 'lazy'; }
            media.src = signed.data.signedUrl; bubble.appendChild(media);
          }
        }
      }
      const meta = document.createElement('div'); meta.className = 'wa-bubble-meta';
      const time = document.createElement('time'); time.dateTime = message.created_at; time.textContent = formatTime(message.created_at); meta.appendChild(time);
      if (message.sender_id === me.id) { const readMark = document.createElement('span'); readMark.className = 'wa-read-mark'; readMark.setAttribute('aria-label', allOthersRead(message.created_at) ? 'قرأها الأعضاء' : 'تم الإرسال'); readMark.textContent = allOthersRead(message.created_at) ? '✓✓' : '✓'; meta.appendChild(readMark); }
      bubble.appendChild(meta); window.MYGRAM_MESSAGING_TOOLS?.decorateMessageBubble(bubble,message); box.appendChild(bubble);
    }
    box.scrollTop = box.scrollHeight;
    const readAt = new Date().toISOString();
    const { error: markReadError } = await db.from('whatsmygram_chat_members').update({ last_read_at: readAt }).eq('chat_id', chatId).eq('user_id', me.id);
    if (markReadError) console.warn('WHATSMYGRAM could not update read marker:', markReadError.message);
    activeMembers = activeMembers.map(member => member.user_id === me.id ? { ...member, last_read_at: readAt } : member);
  }
  async function startInbox() {
    if (inboxChannel && typeof db.removeChannel === 'function') { try { await db.removeChannel(inboxChannel); } catch {} }
    inboxChannel = db.channel('whatsmygram-inbox-' + me.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsmygram_messages' }, payload => {
        const message = payload?.new;
        if (!message || !message.chat_id) return;
        if (message.sender_id !== me.id) {
          window.MYGRAM_SOUNDS?.play('message');
          window.dispatchEvent(new CustomEvent('mygram:message-received', { detail: { product: 'whatsmygram', chatId: message.chat_id } }));
        }
        loadChatList().catch(() => {});
        if (activeChat === message.chat_id) loadMessages().catch(error => toast('تعذر تحديث الرسائل: ' + error.message, true));
      })
      .subscribe();
  }
  async function uploadMedia(file, chatId) {
    const extension = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const path = me.id + '/whatsmygram/' + chatId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
    const { error } = await db.storage.from('mygram-private-messages').upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
    if (error) throw error;
    return path;
  }
  $('waNewChat').addEventListener('submit', async event => {
    event.preventDefault();
    const names = [...new Set($('waUsernames').value.split(/[，,\n]/).map(x => x.trim().replace(/^@/, '').toLowerCase()).filter(Boolean))];
    if (!names.length) return;
    if (names.length > 20) { toast('الحد الأقصى للمجموعة 20 شخصاً إضافةً إليك.', true); return; }
    const button = $('waNewChat').querySelector('button[type=submit]'); button.disabled = true;
    try {
      const others = [];
      for (const name of names) others.push(await getProfileByUsername(name));
      const chat = await createOrFindChat(others);
      $('waUsernames').value = '';
      await loadChatList();
      await openChat(chat.id, chat);
      toast(others.length > 1 ? 'تم إنشاء مجموعة WHATSMYGRAM.' : 'تم فتح محادثة WHATSMYGRAM.');
      window.MYGRAM_SOUNDS?.play('success');
    } catch (error) {
      toast('تعذر بدء المحادثة: ' + (error?.message || 'خطأ غير معروف.'), true);
    } finally { button.disabled = false; }
  });
  $('waChatList').addEventListener('click', event => {
    const button = event.target.closest('[data-chat-id]');
    if (!button) return;
    openChat(button.dataset.chatId).catch(error => toast('تعذر فتح المحادثة: ' + error.message, true));
  });
  $('waRefresh').addEventListener('click', () => loadChatList().then(() => activeChat && loadMessages()).then(() => toast('تم تحديث المحادثات.')).catch(error => toast(error.message, true)));
  $('waReloadMessages').addEventListener('click', () => loadMessages().catch(error => toast(error.message, true)));
  $('waFile').addEventListener('change', () => {
    if ($('waFile').files.length) { recordedVoiceFile = null; recordedVoiceDurationSeconds = null; $('waComposeStatus').textContent = $('waFile').files[0].name; }
  });
  $('waRecordVoice').addEventListener('click', async () => {
    try {
      if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); $('waRecordVoice').textContent = '🎙️ تسجيل صوت'; return; }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('تسجيل الصوت غير مدعوم في هذا المتصفح.');
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingChunks = []; recordingStartedAt = Date.now(); recordedVoiceDurationSeconds = null;
      mediaRecorder = new MediaRecorder(recordingStream);
      mediaRecorder.ondataavailable = e => { if (e.data?.size) recordingChunks.push(e.data); };
      mediaRecorder.onerror = () => toast('تعذر تسجيل الصوت.', true);
      mediaRecorder.onstop = () => {
        clearTimeout(recordingLimitTimer); recordingLimitTimer = null;
        recordingStream?.getTracks().forEach(track => track.stop()); recordingStream = null;
        const mime = mediaRecorder?.mimeType || 'audio/webm';
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
        recordedVoiceFile = duration <= 600 ? new File([new Blob(recordingChunks, { type: mime })], 'voice-message.webm', { type: mime }) : null;
        recordedVoiceDurationSeconds = recordedVoiceFile ? duration : null;
        $('waComposeStatus').textContent = recordedVoiceFile ? 'الصوت جاهز للإرسال · ' + formatVoiceDuration(duration) : 'الحد الأقصى 10 دقائق. أعد التسجيل برسالة أقصر.';
        $('waFile').value = '';
        $('waRecordVoice').textContent = '🎙️ تسجيل صوت';
      };
      mediaRecorder.start();
      recordingLimitTimer = setTimeout(() => { if (mediaRecorder?.state === 'recording') { toast('وصل التسجيل إلى الحد الأقصى لعشر دقائق.'); mediaRecorder.stop(); } }, 600000);
      $('waComposeStatus').textContent = 'جارٍ التسجيل… اضغط للإيقاف';
      $('waRecordVoice').textContent = '⏹️ إيقاف التسجيل';
    } catch (error) { toast('تعذر الوصول إلى الميكروفون: ' + error.message, true); }
  });
  $('waCompose').addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeChat) { toast('اختر محادثة أولاً.', true); return; }
    const body = $('waBody').value.trim();
    const file = recordedVoiceFile || $('waFile').files[0] || null;
    if (!body && !file) { toast('اكتب رسالة أو أرفق ملفاً أولاً.', true); $('waBody').focus(); return; }
    if (file && file.size > 50 * 1024 * 1024) { toast('حجم المرفق يتجاوز 50 ميغابايت.', true); return; }
    const send = $('waSend'); send.disabled = true;
    try {
      let attachment_url = null, attachment_type = null;
      if (file) {
        attachment_type = file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
        if (!attachment_type) throw new Error('نوع الملف غير مدعوم. اختر صورة أو فيديو أو صوتاً.');
        attachment_url = await uploadMedia(file, activeChat);
      }
      const { error } = await db.from('whatsmygram_messages').insert({
        chat_id: activeChat, sender_id: me.id,
        body: body || (attachment_type === 'audio' ? '🎙️ رسالة صوتية' : attachment_type === 'video' ? '🎬 فيديو مرفق' : '🖼️ صورة مرفقة'),
        attachment_url, attachment_type,
        duration_seconds: attachment_type === 'audio' && file === recordedVoiceFile ? recordedVoiceDurationSeconds : null,
        topic_id: window.MYGRAM_MESSAGING_TOOLS?.getActiveTopicId() || null
      });
      if (error) throw error;
      $('waBody').value = ''; $('waFile').value = ''; $('waComposeStatus').textContent = '';
      recordedVoiceFile = null; recordedVoiceDurationSeconds = null;
      await loadMessages(); await loadChatList();
      window.MYGRAM_SOUNDS?.play('sent');
      toast('تم إرسال الرسالة.');
    } catch (error) { toast('تعذر إرسال الرسالة: ' + error.message, true); }
    finally { send.disabled = false; }
  });
  async function start() {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data?.session?.user) { location.replace(cfg.loginUrl); return; }
    me = data.session.user;
    if (window.MYGRAM_PRESENCE) {
      try { presence = await window.MYGRAM_PRESENCE.init(db, me, $('showPresenceToggle')); }
      catch (error) { $('showPresenceToggle').disabled = true; $('presenceSettingStatus').textContent = 'إعداد الحالة غير جاهز بعد.'; console.warn('WHATSMYGRAM presence unavailable:', error?.message || error); }
    }
    await loadChatList();
    await startInbox();
    const to = new URLSearchParams(location.search).get('to');
    if (to) { $('waUsernames').value = to; $('waNewChat').requestSubmit(); }
    window.setInterval(() => {
      if (document.hidden) return;
      loadChatList().catch(() => {});
      if (activeChat) loadMessages().catch(() => {});
      if (activeChatMeta && !activeChatMeta.is_group) {
        const member = activeMembers.find(person => person.user_id !== me.id);
        if (member) renderPresence(member.user_id).catch(() => {});
      }
    }, 15000);
  }
  window.addEventListener('mygram:topic-changed', event => { if (event.detail?.source === 'whatsmygram' && event.detail.spaceId === activeChat) loadMessages().catch(error => toast('تعذر تحميل الموضوع: ' + error.message, true)); });
  window.addEventListener('beforeunload', () => {
    clearTimeout(recordingLimitTimer);
    recordingStream?.getTracks().forEach(track => track.stop());
    if (inboxChannel && typeof db.removeChannel === 'function') db.removeChannel(inboxChannel).catch(() => {});
  });
  start().catch(error => toast('تعذر تشغيل WHATSMYGRAM: ' + error.message, true));
})();