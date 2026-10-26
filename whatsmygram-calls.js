(() => {
  'use strict';
  const cfg = window.MYGRAM_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const $ = id => document.getElementById(id);
  let me = null, activeChat = null, activePeerId = null, isGroup = false;
  let channel = null, pc = null, localStream = null, callId = null, callKind = null;
  let incomingOffer = null, callReady = false, localIceQueue = [], remoteIceQueue = [];
  let disposed = false;

  function status(text, error = false) {
    const el = $('waCallStatus');
    if (el) el.textContent = text || '';
    if (error && window.MYGRAM_SOUNDS) window.MYGRAM_SOUNDS.play('error');
  }
  function mode(value) {
    const inCall = ['incoming','calling','active'].includes(value);
    $('waAcceptCallButton').hidden = value !== 'incoming';
    $('waRejectCallButton').hidden = value !== 'incoming';
    $('waEndCallButton').hidden = !inCall;
    $('waAudioCallButton').disabled = !activeChat || !activePeerId || isGroup || inCall;
    $('waVideoCallButton').disabled = !activeChat || !activePeerId || isGroup || inCall;
    $('waCallMedia').hidden = !['calling','active'].includes(value);
    $('waLocalCallVideo').hidden = callKind !== 'video';
    $('waRemoteCallVideo').hidden = callKind !== 'video';
  }
  function contextFromPage() {
    const value = window.MYGRAM_WHATSMYGRAM?.getContext?.();
    if (!value || !value.me) return;
    return value;
  }
  async function sendSignal(type, payload = {}) {
    if (!activeChat || !callId || !me || !activePeerId) throw new Error('اختر محادثة فردية أولاً.');
    const { error } = await db.from('whatsmygram_call_signals').insert({
      chat_id:activeChat, call_id:callId, sender_id:me.id,
      target_user_id:activePeerId, signal_type:type, payload,
      expires_at:new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });
    if (error) throw error;
  }
  async function getIceServers() {
    const fallback = [{ urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302'] }];
    try {
      const session = await db.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token || !activeChat) return fallback;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      let response;
      try {
        response = await fetch(cfg.supabaseUrl + '/functions/v1/turn-credentials', {
          method:'POST',
          headers:{ apikey:cfg.supabaseKey, Authorization:'Bearer ' + token, 'Content-Type':'application/json' },
          body:JSON.stringify({ chatId:activeChat, product:'whatsmygram' }),
          signal:controller.signal, cache:'no-store'
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) return fallback;
      const result = await response.json();
      return Array.isArray(result.iceServers) && result.iceServers.length ? result.iceServers : fallback;
    } catch (error) {
      console.info('WHATSMYGRAM uses STUN-only fallback; TURN is not available:', error?.message || '');
      return fallback;
    }
  }
  async function createPeerConnection() {
    const iceServers = await getIceServers();
    pc = new RTCPeerConnection({ iceServers });
    for (const track of localStream.getTracks()) pc.addTrack(track, localStream);
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (callReady) sendSignal('ice',{candidate}).catch(error => status('تعذر إرسال بيانات الاتصال: ' + error.message,true));
      else localIceQueue.push(candidate);
    };
    pc.ontrack = event => {
      const stream = event.streams?.[0];
      if (!stream) return;
      if (callKind === 'audio') $('waRemoteCallAudio').srcObject = stream;
      else $('waRemoteCallVideo').srcObject = stream;
    };
    pc.onconnectionstatechange = () => {
      if (!pc) return;
      if (pc.connectionState === 'connected') {
        mode('active'); status(callKind === 'video' ? 'مكالمة الفيديو متصلة.' : 'المكالمة الصوتية متصلة.');
      } else if (pc.connectionState === 'failed') {
        status('تعذر الاتصال. تحقّق من TURN أو الشبكة وحاول مجدداً.',true);
      } else if (pc.connectionState === 'disconnected') {
        status('انقطع الاتصال مؤقتاً. إذا لم يعد، أنهِ المكالمة وأعد المحاولة.');
      }
    };
  }
  async function flushLocalIce() {
    for (const candidate of localIceQueue.splice(0)) {
      try { await sendSignal('ice',{candidate}); } catch (error) { status('تعذر إرسال بيانات الاتصال: '+error.message,true); }
    }
  }
  async function flushRemoteIce() {
    if (!pc?.remoteDescription) return;
    for (const candidate of remoteIceQueue.splice(0)) {
      try { await pc.addIceCandidate(candidate); } catch (error) { console.warn('WHATSMYGRAM ICE candidate rejected',error); }
    }
  }
  async function beginCall(kind) {
    try {
      if (!activeChat || !activePeerId) throw new Error('افتح محادثة فردية أولاً.');
      if (isGroup) throw new Error('المكالمات الجماعية ليست مفعّلة في WHATSMYGRAM حالياً.');
      if (pc || incomingOffer || callId) throw new Error('هناك مكالمة نشطة بالفعل.');
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error('المتصفح لا يدعم مكالمات WebRTC.');
      callId = crypto.randomUUID(); callKind = kind; callReady = false;
      localIceQueue = []; remoteIceQueue = [];
      mode('calling'); status(kind === 'video' ? 'جارٍ طلب إذن الكاميرا والميكروفون…' : 'جارٍ طلب إذن الميكروفون…');
      localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:kind === 'video' });
      $('waLocalCallVideo').srcObject = localStream;
      await createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer',{description:pc.localDescription,kind});
      callReady = true;
      await flushLocalIce();
      status('تم إرسال دعوة المكالمة، بانتظار رد الطرف الآخر…');
    } catch (error) {
      await finishCall(false);
      status('تعذر بدء المكالمة: ' + (error?.message || 'تحقق من الأذونات وإعداد TURN.'),true);
    }
  }
  async function acceptCall() {
    try {
      if (!incomingOffer || !callId || !activePeerId) throw new Error('انتهت صلاحية دعوة المكالمة.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('المتصفح لا يدعم الميكروفون أو الكاميرا.');
      localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video:callKind === 'video' });
      $('waLocalCallVideo').srcObject = localStream;
      await createPeerConnection();
      await pc.setRemoteDescription(incomingOffer);
      await flushRemoteIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer',{description:pc.localDescription});
      callReady = true;
      await flushLocalIce();
      incomingOffer = null;
      mode('calling'); status('تم قبول المكالمة، جارٍ إنشاء الاتصال…');
    } catch (error) {
      status('تعذر قبول المكالمة: ' + (error?.message || 'خطأ غير معروف.'),true);
      await finishCall(true);
    }
  }
  async function finishCall(notifyPeer = true) {
    const hadCall = !!callId && !!activePeerId;
    if (notifyPeer && hadCall) {
      try { await sendSignal('hangup',{}); } catch (_) {}
    }
    if (pc) {
      pc.ontrack = null; pc.onicecandidate = null;
      try { pc.close(); } catch (_) {}
    }
    pc = null;
    localStream?.getTracks().forEach(track => track.stop()); localStream = null;
    $('waLocalCallVideo').srcObject = null; $('waRemoteCallVideo').srcObject = null; $('waRemoteCallAudio').srcObject = null;
    callId = null; callKind = null; incomingOffer = null; callReady = false;
    localIceQueue = []; remoteIceQueue = [];
    mode('idle');
  }
  async function rejectCall() {
    try { await sendSignal('reject',{}); } catch (_) {}
    await finishCall(false);
    status('تم رفض المكالمة.');
  }
  async function getPeerFromChat(chatId, senderId) {
    const { data, error } = await db.from('whatsmygram_chat_members')
      .select('user_id').eq('chat_id',chatId);
    if (error) throw error;
    const users = (data || []).map(row => row.user_id);
    if (!users.includes(me.id) || !users.includes(senderId)) throw new Error('المتصل ليس عضواً في هذه المحادثة.');
    const peers = [...new Set(users.filter(id => id !== me.id))];
    if (peers.length !== 1) throw new Error('المكالمات المتاحة حالياً فردية فقط.');
    return peers[0];
  }
  async function handleSignal(signal) {
    if (!signal || signal.sender_id === me?.id || disposed) return;
    try {
      if (signal.signal_type === 'offer') {
        if (pc || incomingOffer || callId) return;
        const sender = await getPeerFromChat(signal.chat_id,signal.sender_id);
        await window.MYGRAM_WHATSMYGRAM?.openChat(signal.chat_id);
        activeChat = signal.chat_id; activePeerId = sender; isGroup = false;
        callId = signal.call_id; callKind = signal.payload?.kind === 'video' ? 'video' : 'audio';
        incomingOffer = signal.payload?.description;
        mode('incoming'); status(callKind === 'video' ? 'هناك مكالمة فيديو واردة.' : 'هناك مكالمة صوتية واردة.');
        if (window.MYGRAM_SOUNDS) window.MYGRAM_SOUNDS.play('call');
        return;
      }
      if (signal.call_id !== callId || signal.chat_id !== activeChat || signal.sender_id !== activePeerId) return;
      if (signal.signal_type === 'answer' && pc) {
        await pc.setRemoteDescription(signal.payload.description); await flushRemoteIce();
        status('تم الرد، جارٍ الاتصال…');
      } else if (signal.signal_type === 'ice' && signal.payload?.candidate) {
        if (pc?.remoteDescription) await pc.addIceCandidate(signal.payload.candidate);
        else remoteIceQueue.push(signal.payload.candidate);
      } else if (signal.signal_type === 'reject') {
        await finishCall(false); status('تم رفض المكالمة.');
      } else if (signal.signal_type === 'hangup') {
        await finishCall(false); status('انتهت المكالمة.');
      }
    } catch (error) { status('تعذر التعامل مع إشارة المكالمة: '+(error?.message||'خطأ غير معروف.'),true); }
  }
  function syncContext(detail) {
    if (!detail || !detail.chatId || !me) return;
    if (callId && activeChat !== detail.chatId) finishCall(true).catch(()=>{});
    activeChat = detail.chatId;
    activePeerId = detail.peerId || null;
    isGroup = !!detail.isGroup;
    mode('idle');
    if (isGroup) status('المكالمات داخل مجموعات WHATSMYGRAM ليست متاحة بعد.');
    else status(activePeerId ? 'يمكنك بدء مكالمة صوتية أو فيديو.' : '');
  }
  async function init() {
    const result = await db.auth.getSession();
    if (result.error) throw result.error;
    me = result.data?.session?.user;
    if (!me) return;
    window.addEventListener('mygram:whatsmygram-chat-opened',event=>syncContext(event.detail));
    $('waAudioCallButton').addEventListener('click',()=>beginCall('audio'));
    $('waVideoCallButton').addEventListener('click',()=>beginCall('video'));
    $('waAcceptCallButton').addEventListener('click',acceptCall);
    $('waRejectCallButton').addEventListener('click',rejectCall);
    $('waEndCallButton').addEventListener('click',()=>finishCall(true).then(()=>status('أنهيت المكالمة.')));
    channel = db.channel('whatsmygram-call-signals-'+me.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'whatsmygram_call_signals',filter:'target_user_id=eq.'+me.id},payload=>handleSignal(payload.new))
      .subscribe();
    const ctx = contextFromPage();
    if (ctx?.activeChat) {
      const roster = await db.from('whatsmygram_chat_members').select('user_id').eq('chat_id',ctx.activeChat);
      const peers = (roster.data||[]).map(row=>row.user_id).filter(id=>id!==me.id);
      syncContext({chatId:ctx.activeChat,userId:me.id,peerId:peers.length===1?peers[0]:null,isGroup:!!ctx.activeChatMeta?.is_group || peers.length!==1});
    }
  }
  window.addEventListener('beforeunload',()=>{
    disposed=true;
    try { if (pc) pc.close(); localStream?.getTracks().forEach(track=>track.stop()); } catch (_) {}
    if (channel && typeof db.removeChannel === 'function') db.removeChannel(channel).catch(()=>{});
  });
  init().catch(error=>status('تعذر تهيئة المكالمات: '+(error?.message||'خطأ غير معروف.'),true));
})();