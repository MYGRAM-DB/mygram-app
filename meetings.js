(() => {
  'use strict';
  const cfg = window.MYGRAM_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const $ = id => document.getElementById(id);
  let me = null, activeMeeting = null, participants = [], profiles = new Map();
  let room = null, roomChannel = null, speechRecognition = null;
  let cameraEnabled = true, microphoneEnabled = true;
  const langNames = { ar:'العربية', en:'English', hi:'हिन्दी', zh:'中文', fr:'Français', es:'Español' };

  function status(elId, message, kind) {
    const el = $(elId); if (!el) return;
    el.textContent = message || '';
    el.className = 'meet-status' + (kind ? ' ' + kind : '');
    if (kind === 'error') window.MYGRAM_SOUNDS && window.MYGRAM_SOUNDS.play('error');
    if (kind === 'success') window.MYGRAM_SOUNDS && window.MYGRAM_SOUNDS.play('success');
  }
  function safeName(profile, id) {
    return (profile && profile.full_name && profile.full_name.trim()) ||
      (profile && profile.username ? '@' + profile.username : (id === (me && me.id) ? 'أنت' : 'مشارك'));
  }
  function lang() { return $('meetingLanguage').value || ((navigator.language || 'ar').split('-')[0].toLowerCase()); }
  function fmtDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(document.documentElement.lang || navigator.language || 'ar', { dateStyle:'medium', timeStyle:'short' });
  }
  function activeParticipants() { return participants.filter(p => !p.left_at); }
  function isMeetingManager() {
    return !!activeMeeting && !!me && (activeMeeting.created_by === me.id || activeMeeting.chair_user_id === me.id);
  }
  function languageLabel(code) {
    const base = String(code || '').split('-')[0].toLowerCase();
    return langNames[base] || code || 'غير محددة';
  }
  function statusLabel(value) {
    return ({ scheduled:'مجدول', live:'مباشر', ended:'منتهٍ', cancelled:'ملغى' })[value] || value;
  }
  function parseInvite(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    try {
      if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        return url.searchParams.get('code') || url.searchParams.get('invite') || value;
      }
    } catch (_) {}
    const m = value.match(/[?&](?:code|invite)=([^&\s]+)/i);
    return m ? decodeURIComponent(m[1]) : value;
  }
  function speechLocale(code) {
    const base = String(code || '').split('-')[0].toLowerCase();
    return ({ar:'ar',en:'en-US',hi:'hi-IN',zh:'zh-CN',fr:'fr-FR',es:'es-ES'})[base] || code || 'ar';
  }
  async function loadMyMeetings() {
    const list = $('meetingList'); list.replaceChildren();
    const result = await db.from('meeting_participants').select('meeting_id,user_id,role,left_at,joined_at')
      .eq('user_id', me.id).order('joined_at', { ascending:false }).limit(100);
    if (result.error) throw result.error;
    const ids = [...new Set((result.data || []).map(x => x.meeting_id))];
    if (!ids.length) {
      list.innerHTML = '<div class="meet-empty">بعدك ما أنشأت أو انضممت لأي اجتماع.<br>ابدأ اجتماعك الأول أو ألصق رابط دعوة.</div>';
      return;
    }
    const rows = await db.from('meetings').select('id,title,created_by,chair_user_id,invite_code,status,max_participants,preferred_language,starts_at,created_at,ended_at')
      .in('id', ids).order('created_at', { ascending:false }).limit(100);
    if (rows.error) throw rows.error;
    for (const m of rows.data || []) {
      const item = document.createElement('article'); item.className = 'meet-list-item';
      const copy = document.createElement('div'); copy.className = 'meet-list-copy';
      const title = document.createElement('strong'); title.textContent = m.title;
      const meta = document.createElement('small'); meta.textContent = statusLabel(m.status) + ' · ' + languageLabel(m.preferred_language) + ' · ' + fmtDate(m.starts_at || m.created_at);
      copy.append(title, meta);
      const open = document.createElement('button'); open.className = 'meet-btn'; open.type = 'button'; open.textContent = 'فتح';
      open.addEventListener('click', () => openMeeting(m.id).catch(e => status('roomStatus', 'تعذر فتح الاجتماع: ' + e.message, 'error')));
      item.append(copy, open); list.appendChild(item);
    }
  }
  async function loadProfiles(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) { profiles = new Map(); return; }
    const result = await db.from('profiles').select('id,username,full_name,avatar_url').in('id', unique);
    if (!result.error) profiles = new Map((result.data || []).map(p => [p.id, p]));
  }
  async function openMeeting(meetingId) {
    const result = await db.from('meetings')
      .select('id,title,agenda,created_by,chair_user_id,invite_code,status,max_participants,preferred_language,video_provider,recording_consent,starts_at,started_at,ended_at,created_at')
      .eq('id', meetingId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('الاجتماع غير موجود أو لا تملك صلاحية الوصول إليه.');
    const meeting = result.data;
    const roster = await db.from('meeting_participants')
      .select('meeting_id,user_id,role,preferred_language,recording_consent,joined_at,left_at,last_seen_at')
      .eq('meeting_id', meetingId).order('joined_at', { ascending:true });
    if (roster.error) throw roster.error;
    participants = roster.data || [];
    if (!participants.some(p => p.user_id === me.id)) throw new Error('انضم إلى الاجتماع برابط الدعوة قبل فتح الغرفة.');
    activeMeeting = meeting;
    await loadProfiles(participants.map(p => p.user_id));
    $('meetingRoom').hidden = false;
    $('activeMeetingTitle').textContent = meeting.title;
    $('activeMeetingMeta').textContent = statusLabel(meeting.status) + ' · ' + languageLabel(meeting.preferred_language) + ' · حتى 31 شخصاً إجمالاً · أنشئ في ' + fmtDate(meeting.created_at);
    const mine = participants.find(p => p.user_id === me.id);
    $('recordingConsent').checked = !!(mine && mine.recording_consent);
    $('recordingConsent').disabled = meeting.status === 'ended' || meeting.status === 'cancelled' || !!(mine && mine.left_at);
    $('transcriptLanguage').value = speechLocale((mine && mine.preferred_language) || lang());
    $('meetingChatInput').disabled = !['scheduled','live'].includes(meeting.status) || !!(mine && mine.left_at);
    $('meetingChatSend').disabled = $('meetingChatInput').disabled;
    $('startMeetingButton').hidden = meeting.status !== 'scheduled' || !isMeetingManager();
    $('endMeetingButton').hidden = !['scheduled','live'].includes(meeting.status) || !isMeetingManager();
    await renderRoster();
    await Promise.all([loadMeetingChat(), loadTranscript(), loadMinutes()]);
    await startRoomRealtime();
  }
  async function renderRoster() {
    const list = $('participantRoster'); list.replaceChildren();
    const selector = $('newChairSelect'); selector.replaceChildren();
    const defaultOption = document.createElement('option'); defaultOption.value = ''; defaultOption.textContent = 'اختر رئيساً جديداً من الحضور'; selector.appendChild(defaultOption);
    const active = activeParticipants();
    if (!participants.length) { list.innerHTML = '<div class="meet-empty">لا يوجد حضور.</div>'; return; }
    for (const p of participants) {
      const profile = profiles.get(p.user_id);
      const item = document.createElement('div'); item.className = 'meet-person';
      const avatar = document.createElement('span'); avatar.className = 'meet-avatar'; avatar.textContent = Array.from(safeName(profile,p.user_id))[0] || 'م';
      const copy = document.createElement('span'); copy.className = 'meet-person-copy';
      const name = document.createElement('strong'); name.textContent = safeName(profile,p.user_id) + (p.user_id === me.id ? ' (أنت)' : '');
      let role = p.role === 'host' ? 'المضيف' : p.role === 'chair' ? 'رئيس الاجتماع' : p.role === 'presenter' ? 'مقدّم' : 'مشارك';
      if (p.user_id === activeMeeting.chair_user_id) role = 'رئيس الاجتماع';
      const small = document.createElement('small');
      small.textContent = (p.left_at ? 'غادر الاجتماع' : role) + ' · ' + languageLabel(p.preferred_language || activeMeeting.preferred_language) + (p.recording_consent ? ' · وافق على النص' : ' · لم يوافق على النص');
      copy.append(name, small); item.append(avatar, copy); list.appendChild(item);
      if (!p.left_at && p.user_id !== activeMeeting.chair_user_id && isMeetingManager()) {
        const option = document.createElement('option'); option.value = p.user_id; option.textContent = safeName(profile,p.user_id); selector.appendChild(option);
      }
    }
    selector.disabled = !isMeetingManager() || active.length < 2;
    $('transferChairButton').disabled = !isMeetingManager() || active.length < 2;
    const allConsented = active.length > 0 && active.every(p => p.recording_consent === true);
    $('startTranscriptButton').disabled = !allConsented || activeMeeting.status === 'ended' || activeMeeting.status === 'cancelled';
    $('generateMinutesButton').disabled = !isMeetingManager() || activeMeeting.status !== 'ended';
    $('roomStatus').textContent = 'الحضور النشط: ' + active.length + ' / ' + activeMeeting.max_participants + '. موافقات المحضر النصي: ' + active.filter(p => p.recording_consent === true).length + ' من ' + active.length + '.';
  }
  async function loadMeetingChat() {
    if (!activeMeeting) return;
    const box = $('meetingChatLog'); box.replaceChildren();
    const result = await db.from('meeting_messages').select('id,meeting_id,sender_id,body,reply_to_message_id,edited_at,created_at')
      .eq('meeting_id', activeMeeting.id).order('created_at', { ascending:true }).limit(300);
    if (result.error) throw result.error;
    if (!(result.data || []).length) { box.innerHTML = '<div class="meet-empty">لا توجد رسائل بعد. استخدم الدردشة لتوثيق الأسئلة والقرارات.</div>'; return; }
    for (const msg of result.data) {
      const el = document.createElement('article'); el.className = 'meet-message' + (msg.sender_id === me.id ? ' mine' : '');
      const name = document.createElement('strong'); name.textContent = safeName(profiles.get(msg.sender_id), msg.sender_id) + ': ';
      const body = document.createElement('span'); body.textContent = msg.body;
      const time = document.createElement('small'); time.textContent = fmtDate(msg.created_at) + (msg.edited_at ? ' · عُدّلت' : '');
      el.append(name, body, time); box.appendChild(el);
    }
    box.scrollTop = box.scrollHeight;
  }
  async function loadTranscript() {
    if (!activeMeeting) return;
    const box = $('transcriptLog');
    const result = await db.from('meeting_transcripts').select('id,speaker_id,language_code,transcript_text,source,captured_at')
      .eq('meeting_id', activeMeeting.id).order('captured_at', { ascending:true }).limit(500);
    if (result.error) { box.textContent = 'تعذر تحميل النص: ' + result.error.message; return; }
    box.replaceChildren();
    if (!(result.data || []).length) { box.textContent = 'لا توجد مقاطع نصية بعد. لا يتم حفظ النص إلا بعد موافقة الحضور النشطين.'; return; }
    for (const row of result.data) {
      const line = document.createElement('p'); line.style.margin = '0 0 9px';
      const speaker = document.createElement('strong'); speaker.textContent = safeName(profiles.get(row.speaker_id), row.speaker_id) + ': ';
      const text = document.createElement('span'); text.textContent = row.transcript_text;
      line.append(speaker, text); box.appendChild(line);
    }
  }
  async function loadMinutes() {
    if (!activeMeeting) return;
    const box = $('minutesContainer');
    const result = await db.from('meeting_minutes').select('id,meeting_id,recipient_id,language_code,status,summary_markdown,key_points,explanations,pdf_storage_path,generated_at,created_at')
      .eq('meeting_id', activeMeeting.id).eq('recipient_id', me.id).order('created_at', { ascending:false }).limit(3);
    if (result.error) { box.innerHTML = '<div class="meet-empty">تعذر تحميل المحضر الشخصي.</div>'; return; }
    box.replaceChildren();
    if (!(result.data || []).length) { box.innerHTML = '<div class="meet-empty">لم يصل محضر إلى حسابك بعد.</div>'; return; }
    for (const row of result.data) {
      const card = document.createElement('article'); card.className = 'meet-minute';
      const heading = document.createElement('h4'); heading.textContent = 'محضر الاجتماع · ' + languageLabel(row.language_code) + ' · ' + ({draft:'مسودة',processing:'قيد المعالجة',ready:'جاهز',failed:'تعذر الإنشاء'})[row.status];
      const summary = document.createElement('p'); summary.textContent = row.summary_markdown || 'المحضر قيد الإعداد.';
      card.append(heading, summary);
      const points = Array.isArray(row.key_points) ? row.key_points : [];
      if (points.length) {
        const ul = document.createElement('ul');
        for (const point of points) {
          const li = document.createElement('li'); li.textContent = typeof point === 'string' ? point : [point.title, point.explanation].filter(Boolean).join(': ');
          ul.appendChild(li);
        }
        card.appendChild(ul);
      }
      const exp = Array.isArray(row.explanations) ? row.explanations : [];
      if (exp.length) {
        const ul = document.createElement('ul');
        for (const point of exp) { const li = document.createElement('li'); li.textContent = typeof point === 'string' ? point : [point.title, point.explanation].filter(Boolean).join(': '); ul.appendChild(li); }
        card.appendChild(ul);
      }
      const print = document.createElement('button'); print.type = 'button'; print.className = 'meet-btn'; print.textContent = '⇩ تصدير PDF';
      print.addEventListener('click', () => printMinute(row)); card.appendChild(print); box.appendChild(card);
    }
  }
  function printMinute(row) {
    const title = activeMeeting ? activeMeeting.title : 'MYGRAM Meeting Minutes';
    const points = Array.isArray(row.key_points) ? row.key_points : [];
    const explanations = Array.isArray(row.explanations) ? row.explanations : [];
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const code = String(row.language_code || 'en').split('-')[0];
    const rtl = ['ar','fa','ur','he'].includes(code);
    const pointsHtml = points.map(p => '<li>' + esc(typeof p === 'string' ? p : [p.title,p.explanation].filter(Boolean).join('：')) + '</li>').join('');
    const explanationsHtml = explanations.map(p => '<li>' + esc(typeof p === 'string' ? p : [p.title,p.explanation].filter(Boolean).join('：')) + '</li>').join('');
    const w = window.open('', '_blank');
    if (!w) { status('minutesStatus', 'اسمح بفتح نافذة التصدير ثم أعد المحاولة.', 'error'); return; }
    let html = '<!doctype html><html lang="' + esc(code) + '" dir="' + (rtl ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>' + esc(title) + ' - Minutes</title>';
    html += '<style>body{font-family:Arial,"Noto Sans",sans-serif;margin:36px;color:#182642;line-height:1.8}h1{font-size:24px;border-bottom:2px solid #304b9b;padding-bottom:12px}h2{font-size:17px;margin-top:24px}p,li{font-size:12pt;white-space:pre-wrap}small{color:#66758d}@media print{body{margin:16mm}}</style>';
    html += '</head><body><h1>' + esc(title) + '</h1><p><strong>' + esc(safeName(profiles.get(me.id),me.id)) + '</strong></p><small>' + esc(fmtDate(row.generated_at || row.created_at)) + ' · ' + esc(languageLabel(row.language_code)) + '</small><h2>الملخص / Summary</h2><p>' + esc(row.summary_markdown) + '</p>';
    if (pointsHtml) html += '<h2>النقاط الأساسية</h2><ul>' + pointsHtml + '</ul>';
    if (explanationsHtml) html += '<h2>القرارات والتوضيحات والمهام</h2><ul>' + explanationsHtml + '</ul>';
    html += '<script>window.onload=function(){window.print()}<\/script></body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }
  async function startRoomRealtime() {
    if (roomChannel && db.removeChannel) { try { await db.removeChannel(roomChannel); } catch (_) {} }
    if (!activeMeeting || !db.channel) return;
    const id = activeMeeting.id;
    roomChannel = db.channel('mygram-meeting-' + id)
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'meeting_messages',filter:'meeting_id=eq.' + id}, payload => {
        if (!activeMeeting || activeMeeting.id !== id) return;
        if (payload.new && payload.new.sender_id !== me.id && window.MYGRAM_SOUNDS) window.MYGRAM_SOUNDS.play('message');
        loadMeetingChat().catch(() => {});
      })
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'meeting_transcripts',filter:'meeting_id=eq.' + id}, () => { if(activeMeeting && activeMeeting.id===id)loadTranscript().catch(()=>{}); })
      .on('INSERT', {event:'INSERT',schema:'public',table:'meeting_minutes',filter:'meeting_id=eq.' + id}, payload => {
        if (payload.new && payload.new.recipient_id === me.id) { if(window.MYGRAM_SOUNDS)window.MYGRAM_SOUNDS.play('notification'); loadMinutes().catch(()=>{}); }
      }).subscribe();
  }
  async function disconnectRoom() {
    const old = room; room = null;
    if (old) { try { await old.disconnect(); } catch (_) {} }
    $('videoGrid').replaceChildren();
    $('joinVideoButton').disabled = false; $('leaveVideoButton').disabled = true;
    $('toggleCameraButton').disabled = true; $('toggleMicButton').disabled = true;
    $('toggleCameraButton').textContent = '📷 إيقاف الكاميرا'; $('toggleMicButton').textContent = '🎙️ كتم الميكروفون';
  }
  function getVideoTile(identity, isLocal) {
    let tile = [...$('videoGrid').querySelectorAll('.meet-video-tile')].find(node => node.dataset.participantId === identity);
    if (tile) return tile;
    tile = document.createElement('div'); tile.className = 'meet-video-tile'; tile.dataset.participantId = identity;
    const name = document.createElement('div'); name.className = 'meet-video-name';
    name.textContent = safeName(profiles.get(identity), identity) + (isLocal ? ' (أنت)' : '');
    tile.appendChild(name); $('videoGrid').appendChild(tile); return tile;
  }
  async function joinVideo() {
    if (!activeMeeting) return;
    $('joinVideoButton').disabled = true; status('videoStatus', 'جارٍ إعداد الاتصال الآمن…');
    try {
      const invoke = await db.functions.invoke('meetings-token', {body:{meetingId:activeMeeting.id}});
      if (invoke.error) {
        let message = invoke.error.message || 'تعذر طلب رمز المكالمة.';
        try { const body = await invoke.error.context.json(); if (body && body.error) message = body.error; } catch (_) {}
        throw new Error(message);
      }
      const data = invoke.data;
      if (!data || !data.url || !data.token) throw new Error((data && data.error) || 'خدمة الفيديو لم تُرجع رمز الاتصال.');
      const LK = window.LivekitClient;
      if (!LK || !LK.Room) throw new Error('تعذر تحميل مكتبة LiveKit. تحقق من الاتصال بالإنترنت.');
      room = new LK.Room({ adaptiveStream:true, dynacast:true });
      room.on(LK.RoomEvent.TrackSubscribed, (track, publication, participant) => {
        const tile = getVideoTile(participant.identity, false); const element = track.attach();
        if (track.kind === LK.Track.Kind.Video) {
          element.autoplay = true; element.playsInline = true; element.className = 'meet-video-feed';
          const old = tile.querySelector('video'); if (old) old.remove(); tile.prepend(element);
        } else { element.autoplay = true; element.style.display = 'none'; document.body.appendChild(element); }
      });
      room.on(LK.RoomEvent.TrackUnsubscribed, track => { track.detach().forEach(element => element.remove()); });
      room.on(LK.RoomEvent.ParticipantConnected, p => getVideoTile(p.identity, false));
      room.on(LK.RoomEvent.ParticipantDisconnected, p => {
        const tile = [...$('videoGrid').querySelectorAll('.meet-video-tile')].find(n => n.dataset.participantId === p.identity);
        if (tile) tile.remove();
      });
      room.on(LK.RoomEvent.LocalTrackPublished, publication => {
        if (!publication.track) return;
        const tile = getVideoTile(me.id, true); const element = publication.track.attach();
        if (publication.kind === LK.Track.Kind.Video) { element.autoplay = true; element.muted = true; element.playsInline = true; element.className = 'meet-video-feed'; tile.prepend(element); }
        else { element.autoplay = true; element.style.display = 'none'; document.body.appendChild(element); }
      });
      room.on(LK.RoomEvent.Disconnected, () => { status('videoStatus', 'انقطع الاتصال بالمكالمة.'); });
      await room.connect(data.url, data.token);
      for (const p of room.remoteParticipants.values()) getVideoTile(p.identity, false);
      await room.localParticipant.setMicrophoneEnabled(true);
      try { await room.localParticipant.setCameraEnabled(true); cameraEnabled = true; }
      catch (_) { cameraEnabled = false; status('videoStatus', 'دخلت بالصوت. لم تسمح المتصفّح بتشغيل الكاميرا، يمكنك متابعة الاجتماع صوتياً.'); }
      microphoneEnabled = true;
      $('joinVideoButton').disabled = true; $('leaveVideoButton').disabled = false;
      $('toggleCameraButton').disabled = false; $('toggleMicButton').disabled = false;
      $('toggleCameraButton').textContent = cameraEnabled ? '📷 إيقاف الكاميرا' : '📷 تشغيل الكاميرا';
      status('videoStatus', cameraEnabled ? 'أنت داخل مكالمة الاجتماع. اختر الميكروفون والكاميرا المناسبين.' : 'أنت داخل المكالمة بالصوت فقط.', 'success');
    } catch (error) {
      await disconnectRoom(); $('joinVideoButton').disabled = false;
      status('videoStatus', 'لم تبدأ مكالمة الفيديو: ' + (error.message || 'خطأ غير معروف.'), 'error');
    }
  }
  async function setConsent(value) {
    if (!activeMeeting) return;
    const {error} = await db.from('meeting_participants').update({recording_consent:value})
      .eq('meeting_id',activeMeeting.id).eq('user_id',me.id);
    if (error) throw error;
    participants = participants.map(p => p.user_id === me.id ? Object.assign({},p,{recording_consent:value}) : p);
    await renderRoster();
    status('transcriptStatus', value ? 'تم حفظ موافقتك. لن يبدأ تحويل الكلام إلى نص إلا عند موافقة جميع الحاضرين النشطين.' : 'سحبت موافقتك، ولن تُحفظ مقاطع جديدة ما دمت غير موافق.', 'success');
  }
  function startTranscript() {
    if (!activeMeeting) return;
    if (!activeParticipants().every(p => p.recording_consent === true)) {
      status('transcriptStatus', 'لا يمكن البدء قبل موافقة كل المشاركين النشطين.', 'error'); return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      status('transcriptStatus', 'التعرّف على الكلام غير مدعوم في هذا المتصفح. جرّب Chrome حديثاً أو أضف ملاحظات مكتوبة يدوياً.', 'error'); return;
    }
    if (speechRecognition) { try { speechRecognition.stop(); } catch (_) {} speechRecognition = null; }
    const recognition = new Recognition();
    recognition.lang = $('transcriptLanguage').value || 'ar'; recognition.continuous = true; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = async event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const transcript = String(event.results[i][0] && event.results[i][0].transcript || '').trim();
        if (!transcript || !activeMeeting) continue;
        if (!activeParticipants().every(p => p.recording_consent === true)) {
          try { recognition.stop(); } catch (_) {}
          status('transcriptStatus', 'أُوقف تحويل الكلام لأن أحد المشاركين سحب موافقته.', 'error'); return;
        }
        const result = await db.from('meeting_transcripts').insert({
          meeting_id:activeMeeting.id, speaker_id:me.id, language_code:recognition.lang.split('-')[0],
          transcript_text:transcript, source:'browser_speech', created_by:me.id
        });
        if (result.error) status('transcriptStatus', 'تعذّر حفظ النص: ' + result.error.message, 'error');
        else loadTranscript().catch(() => {});
      }
    };
    recognition.onerror = event => status('transcriptStatus', 'توقف التعرّف على الكلام: ' + (event.error || 'تعذر التعرّف') + '.', 'error');
    recognition.onend = () => {
      $('stopTranscriptButton').disabled = true; $('startTranscriptButton').disabled = !activeParticipants().every(p => p.recording_consent === true);
      if (speechRecognition === recognition) speechRecognition = null;
    };
    try {
      speechRecognition = recognition; recognition.start();
      $('startTranscriptButton').disabled = true; $('stopTranscriptButton').disabled = false;
      status('transcriptStatus', 'بدأ التعرّف على الكلام. قد يختلف الدعم حسب المتصفح واللغة.', 'success');
    } catch (error) { speechRecognition = null; status('transcriptStatus', 'تعذر بدء التعرف: ' + error.message, 'error'); }
  }

  $('createMeetingForm').addEventListener('submit', async event => {
    event.preventDefault(); $('createMeetingButton').disabled = true;
    try {
      const result = await db.from('meetings').insert({
        title:$('meetingTitle').value.trim(), agenda:$('meetingAgenda').value.trim(),
        created_by:me.id, chair_user_id:me.id, preferred_language:lang(), max_participants:31, status:'scheduled'
      }).select('id,title,invite_code,status').single();
      if (result.error) throw result.error;
      status('createMeetingStatus','تم إنشاء الاجتماع.','success');
      $('meetingTitle').value=''; $('meetingAgenda').value='';
      await loadMyMeetings(); await openMeeting(result.data.id);
      history.replaceState(null,'',location.pathname+'?meeting='+encodeURIComponent(result.data.id));
    } catch (error) { status('createMeetingStatus','تعذر إنشاء الاجتماع: '+(error.message||'خطأ غير معروف.'),'error'); }
    finally { $('createMeetingButton').disabled = false; }
  });
  $('joinMeetingForm').addEventListener('submit', async event => {
    event.preventDefault(); const code = parseInvite($('meetingInviteCode').value);
    if (!code) { status('joinMeetingStatus','ألصق رمز الدعوة أولاً.','error'); return; }
    try {
      const result = await db.rpc('join_meeting',{p_invite_code:code,p_language_code:lang()});
      if (result.error) throw result.error;
      $('meetingInviteCode').value=''; await loadMyMeetings(); await openMeeting(result.data);
      history.replaceState(null,'',location.pathname+'?meeting='+encodeURIComponent(result.data));
      status('joinMeetingStatus','انضممت إلى الاجتماع بنجاح.','success');
    } catch (error) { status('joinMeetingStatus','تعذر الانضمام: '+(error.message||'رمز الدعوة غير صالح.'),'error'); }
  });
  $('refreshMeetings').addEventListener('click', () => loadMyMeetings().catch(e => status('createMeetingStatus','تعذر تحديث القائمة: '+e.message,'error')));
  $('copyMeetingInvite').addEventListener('click', async () => {
    if (!activeMeeting) return;
    const link = location.origin + location.pathname + '?code=' + encodeURIComponent(activeMeeting.invite_code);
    try { await navigator.clipboard.writeText(link); status('roomStatus','تم نسخ رابط الدعوة.','success'); }
    catch (_) { window.prompt('انسخ رابط الدعوة التالي:',link); }
  });
  $('startMeetingButton').addEventListener('click', async () => {
    try {
      const result = await db.rpc('update_meeting_status',{p_meeting_id:activeMeeting.id,p_status:'live'});
      if (result.error) throw result.error;
      await openMeeting(activeMeeting.id); await loadMyMeetings(); status('roomStatus','بدأ الاجتماع.','success');
    } catch (error) { status('roomStatus','تعذر بدء الاجتماع: '+error.message,'error'); }
  });
  $('endMeetingButton').addEventListener('click', async () => {
    if (!activeMeeting || !window.confirm('هل تريد إنهاء الاجتماع للجميع؟')) return;
    try {
      if (speechRecognition) { try { speechRecognition.stop(); } catch (_) {} speechRecognition=null; }
      await disconnectRoom();
      const result = await db.rpc('update_meeting_status',{p_meeting_id:activeMeeting.id,p_status:'ended'});
      if (result.error) throw result.error;
      await openMeeting(activeMeeting.id); await loadMyMeetings(); status('roomStatus','انتهى الاجتماع.','success');
    } catch (error) { status('roomStatus','تعذر إنهاء الاجتماع: '+error.message,'error'); }
  });
  $('transferChairButton').addEventListener('click', async () => {
    const target = $('newChairSelect').value;
    if (!activeMeeting || !target) { status('chairStatus','اختر رئيساً جديداً من الحضور النشطين.','error'); return; }
    $('transferChairButton').disabled = true;
    try {
      const result = await db.rpc('transfer_meeting_chair',{p_meeting_id:activeMeeting.id,p_new_chair_id:target,p_note:$('chairTransferNote').value.trim()});
      if (result.error) throw result.error;
      await openMeeting(activeMeeting.id); status('chairStatus','تم نقل الرئاسة وتوثيقها في سجل الاجتماع.','success');
    } catch (error) { status('chairStatus','تعذر نقل الرئاسة: '+error.message,'error'); }
    finally { $('transferChairButton').disabled = !isMeetingManager(); }
  });
  $('meetingChatForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeMeeting || !['scheduled','live'].includes(activeMeeting.status)) { status('roomStatus','الدردشة مغلقة لهذا الاجتماع.','error'); return; }
    const body = $('meetingChatInput').value.trim(); if (!body) return;
    $('meetingChatSend').disabled = true;
    try {
      const result = await db.from('meeting_messages').insert({meeting_id:activeMeeting.id,sender_id:me.id,body});
      if (result.error) throw result.error;
      $('meetingChatInput').value=''; await loadMeetingChat();
      if (window.MYGRAM_SOUNDS) window.MYGRAM_SOUNDS.play('sent');
    } catch (error) { status('roomStatus','تعذر إرسال الرسالة: '+error.message,'error'); }
    finally { $('meetingChatSend').disabled = false; }
  });
  $('recordingConsent').addEventListener('change', async () => {
    const value = $('recordingConsent').checked;
    try { await setConsent(value); }
    catch (error) {
      $('recordingConsent').checked = !value;
      status('transcriptStatus','تعذر حفظ الموافقة: '+error.message,'error');
    }
  });
  $('startTranscriptButton').addEventListener('click', startTranscript);
  $('stopTranscriptButton').addEventListener('click', () => {
    if (speechRecognition) { try { speechRecognition.stop(); } catch (_) {} speechRecognition = null; }
    $('stopTranscriptButton').disabled = true;
    $('startTranscriptButton').disabled = !activeParticipants().every(p => p.recording_consent === true);
    status('transcriptStatus','تم إيقاف التعرف على الكلام.');
  });
  $('generateMinutesButton').addEventListener('click', async () => {
    if (!activeMeeting) return;
    $('generateMinutesButton').disabled = true; status('minutesStatus','جارٍ إنشاء ملخص مستقل لكل لغة يحتاجها الحضور…');
    try {
      const result = await db.functions.invoke('meeting-ai-minutes',{body:{meetingId:activeMeeting.id}});
      if (result.error) {
        let message = result.error.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي.';
        try { const body = await result.error.context.json(); if (body && body.error) message = body.error; } catch (_) {}
        throw new Error(message);
      }
      if (result.data && result.data.error) throw new Error(result.data.error);
      await loadMinutes(); status('minutesStatus','تم طلب إنشاء المحاضر بلغات الحاضرين. سيجد كل مشارك محضره داخل حسابه.','success');
    } catch (error) { status('minutesStatus','تعذر إنشاء المحاضر: '+(error.message||'خطأ غير معروف.'),'error'); }
    finally { $('generateMinutesButton').disabled = !isMeetingManager() || activeMeeting.status !== 'ended'; }
  });
  $('refreshMinutesButton').addEventListener('click', () => loadMinutes().catch(e => status('minutesStatus',e.message,'error')));
  $('joinVideoButton').addEventListener('click', joinVideo);
  $('leaveVideoButton').addEventListener('click', async () => {
    await disconnectRoom(); status('videoStatus','غادرت مكالمة الفيديو.');
  });
  $('toggleCameraButton').addEventListener('click', async () => {
    if (!room) return;
    try {
      cameraEnabled = !cameraEnabled; await room.localParticipant.setCameraEnabled(cameraEnabled);
      $('toggleCameraButton').textContent = cameraEnabled ? '📷 إيقاف الكاميرا' : '📷 تشغيل الكاميرا';
    } catch (error) { cameraEnabled = !cameraEnabled; status('videoStatus',error.message,'error'); }
  });
  $('toggleMicButton').addEventListener('click', async () => {
    if (!room) return;
    try {
      microphoneEnabled = !microphoneEnabled; await room.localParticipant.setMicrophoneEnabled(microphoneEnabled);
      $('toggleMicButton').textContent = microphoneEnabled ? '🎙️ كتم الميكروفون' : '🎙️ تشغيل الميكروفون';
    } catch (error) { microphoneEnabled = !microphoneEnabled; status('videoStatus',error.message,'error'); }
  });
  window.addEventListener('beforeunload', () => {
    try { if (room) room.disconnect(); if (speechRecognition) speechRecognition.stop(); } catch (_) {}
  });
  async function init() {
    try {
      const session = await db.auth.getSession();
      if (session.error) throw session.error;
      me = session.data && session.data.session && session.data.session.user;
      if (!me) { location.href = 'index.html'; return; }
      const prefs = await db.from('user_preferences').select('language_code').eq('user_id',me.id).maybeSingle();
      if (prefs.data && langNames[prefs.data.language_code]) $('meetingLanguage').value = prefs.data.language_code;
      await loadMyMeetings();
      const url = new URL(location.href); const code = url.searchParams.get('code') || url.searchParams.get('invite');
      const meetingId = url.searchParams.get('meeting');
      if (code) {
        $('meetingInviteCode').value = code;
        const joined = await db.rpc('join_meeting',{p_invite_code:parseInvite(code),p_language_code:lang()});
        if (joined.error) throw joined.error;
        await openMeeting(joined.data); history.replaceState(null,'',location.pathname+'?meeting='+encodeURIComponent(joined.data));
      } else if (meetingId) {
        try { await openMeeting(meetingId); }
        catch (error) { status('createMeetingStatus','تعذر فتح الرابط المحفوظ: '+error.message,'error'); }
      }
    } catch (error) { status('createMeetingStatus','تعذر تهيئة الاجتماعات: '+(error.message||'تحقق من اتصال Supabase.'),'error'); }
  }
  init();
})();