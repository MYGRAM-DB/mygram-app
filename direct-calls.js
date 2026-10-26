(() => {
  'use strict';
  const cfg = window.MYGRAM_CONFIG;
  if (!cfg || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const $ = id => document.getElementById(id);
  let me = null, activePeerId = null, hasConversation = false;
  let channel = null, pc = null, localStream = null, callId = null, callKind = null;
  let incomingOffer = null, callReady = false, localIceQueue = [], remoteIceQueue = [];
  let disposed = false;

  function say(message, isError = false) {
    const el = $('dmCallStatus');
    if (el) el.textContent = message || '';
    if (isError && window.MYGRAM_SOUNDS) window.MYGRAM_SOUNDS.play('error');
  }
  function setMode(value) {
    const active = ['incoming','calling','active'].includes(value);
    $('dmCallToolbar').hidden = !active && !activePeerId;
    $('dmAcceptCallButton').hidden = value !== 'incoming';
    $('dmRejectCallButton').hidden = value !== 'incoming';
    $('dmEndCallButton').hidden = !active;
    $('dmAudioCallButton').disabled = !activePeerId || !hasConversation || active;
    $('dmVideoCallButton').disabled = !activePeerId || !hasConversation || active;
    $('dmCallMedia').hidden = !['calling','active'].includes(value);
    $('dmLocalCallVideo').hidden = callKind !== 'video';
    $('dmRemoteCallVideo').hidden = callKind !== 'video';
  }
  function syncContext(detail) {
    if (!detail || !me || !detail.peerId) {
      if (!callId) { activePeerId = null; hasConversation = false; setMode('idle'); }
      return;
    }
    if (callId && activePeerId !== detail.peerId) {
      finishCall(true).catch(() => {});
    }
    activePeerId = detail.peerId;
    hasConversation = Boolean(detail.hasConversation);
    setMode('idle');
    if (!hasConversation) say('أرسل أو استقبل رسالة أولاً، ثم يمكنك بدء المكالمة بأمان.');
    else say('المكالمة الصوتية والفيديو جاهزتان لهذه المحادثة.');
  }
  async function sendSignal(type, payload = {}) {
    if (!callId || !me || !activePeerId) throw new Error('اختر محادثة مباشرة قبل بدء المكالمة.');
    const { error } = await db.from('direct_call_signals').insert({
      call_id:callId, sender_id:me.id, target_user_id:activePeerId,
      signal_type:type, payload,
      expires_at:new Date(Date.now() + 8 * 60 * 1000).toISOString()
    });
    if (error) throw error;
  }
  async function getIceServers() {
    const fallback = [{ urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302'] }];
    try {
      const session = await db.auth.getSession();
      const token = session.data?.session?.access_token;
      if (!token || !activePeerId) return fallback;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      let response;
      try {
        response = await fetch(cfg.supabaseUrl + '/functions/v1/turn-credentials', {
          method:'POST',
          headers:{ apikey:cfg.supabaseKey, Authorization:'Bearer ' + token, 'Content-Type':'application/json' },
          body:JSON.stringify({ product:'direct', peerUserId:activePeerId }),
          signal:controller.signal, cache:'no-store'
        });
      } finally { clearTimeout(timeout); }
      if (!response.ok) return fallback;
      const result = await response.json();
      return Array.isArray(result.iceServers) && result.iceServers.length ? result.iceServers : fallback;
    } catch (error) {
      console.info('Direct Messenger uses STUN-only fallback; TURN is not available:', error?.message || '');
      return fallback;
    }
  }
  async function createPeerConnection() {
    const iceServers = await getIceServers();
    pc = new RTCPeerConnection({ iceServers });
    for (const track of localStream.getTracks()) pc.addTrack(track,localStream);
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (callReady) sendSignal('ice',{candidate}).catch(error => say('تعذر إرسال بيانات الاتصال: '+error.message,true));
      else localIceQueue.push(candidate);
    };
    pc.ontrack = event => {
      const stream = event.streams?.[0];
      if (!stream) return;
      if (callKind === 'audio') $('dmRemoteCallAudio').srcObject = stream;
      else $('dmRemoteCallVideo').srcObject = stream;
    };
    pc.onconnectionstatechange = () => {
      if (!pc) return;
      if (pc.connectionState === 'connected') {
        setMode('active'); say(callKind === 'video' ? 'مكالمة الفيديو متصلة.' : 'المكالمة الصوتية متصلة.');
      } else if (pc.connectionState === 'failed') {
        say('تعذر الاتصال. تحقّق من خادم TURN أو الشبكة وحاول مجدداً.',true);
      } else if (pc.connectionState === 'disconnected') {
        say('انقطع الاتصال مؤقتاً. إذا لم يعد، أنهِ المكالمة وأعد المحاولة.');
      }
    };
  }
  async function flushLocalIce() {
    for (const candidate of localIceQueue.splice(0)) {
      try { await sendSignal('ice',{candidate}); }
      catch (error) { say('تعذر إرسال بيانات الاتصال: '+error.message,true); }
    }
  }
  async function flushRemoteIce() {
    if (!pc?.remoteDescription) return;
    for (const candidate of remoteIceQueue.splice(0)) {
      try { await pc.addIceCandidate(candidate); }
      catch (error) { console.warn('Direct Messenger ICE candidate rejected',error); }
    }
  }
  async function beginCall(kind) {
    try {
      if (!activePeerId) throw new Error('افتح محادثة مباشرة أولاً.');
      if (!hasConversation) throw new Error('أرسل رسالة أولاً قبل الاتصال بهذا المستخدم.');
      if (pc || incomingOffer || callId) throw new Error('هناك مكالمة نشطة بالفعل.');
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error('المتصفح لا يدعم مكالمات WebRTC.');
      callId = crypto.randomUUID(); callKind = kind; callReady = false;
      localIceQueue = []; remoteIceQueue = [];
      setMode('calling'); say(kind === 'video' ? 'جارٍ طلب إذن الكاميرا والميكروفون…' : 'جارٍ طلب إذن الميكروفون…');
      localStream = await navigator.mediaDevices.getUserMedia({audio:true,video:kind === 'video'});
      $('dmLocalCallVideo').srcObject = localStream;
      await createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer',{description:pc.localDescription,kind});
      callReady = true; await flushLocalIce();
      say('تم إرسال دعوة المكالمة، بانتظار رد الطرف الآخر…');
    } catch (error) {
      await finishCall(false);
      say('تعذر بدء المكالمة: '+(error?.message || 'تحقّق من أذونات الميكروفون والكاميرا وTURN.'),true);
    }
  }
  async function acceptCall() {
    try {
      if (!incomingOffer || !callId || !activePeerId) throw new Error('انتهت صلاحية دعوة المكالمة.');
      localStream = await navigator.mediaDevices.getUserMedia({audio:true,video:callKind === 'video'});
      $('dmLocalCallVideo').srcObject = localStream;
      await createPeerConnection();
      await pc.setRemoteDescription(incomingOffer);
      await flushRemoteIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer',{description:pc.localDescription});
      callReady = true; await flushLocalIce();
      incomingOffer = null; setMode('calling'); say('تم قبول المكالمة، جارٍ إنشاء الاتصال…');
    } catch (error) {
      say('تعذر قبول المكالمة: '+(error?.message || 'خطأ غير معروف.'),true);
      await finishCall(false);
    }
  }
  async function finishCall(notifyPeer = true) {
    const hasCall = Boolean(callId && activePeerId);
    if (notifyPeer && hasCall) { try { await sendSignal('hangup',{}); } catch (_) {} }
    if (pc) {
      pc.ontrack = null; pc.onicecandidate = null;
      try { pc.close(); } catch (_) {}
    }
    pc = null;
    localStream?.getTracks().forEach(track => track.stop()); localStream = null;
    $('dmLocalCallVideo').srcObject = null; $('dmRemoteCallVideo').srcObject = null; $('dmRemoteCallAudio').srcObject = null;
    callId = null; callKind = null; incomingOffer = null; callReady = false;
    localIceQueue = []; remoteIceQueue = [];
    setMode('idle');
  }
  async function rejectCall() {
    try { await sendSignal('reject',{}); } catch (_) {}
    await finishCall(false); say('تم رفض المكالمة.');
  }
  async function handleSignal(signal) {
    if (!signal || signal.sender_id === me?.id || disposed) return;
    try {
      if (signal.signal_type === 'offer') {
        if (pc || incomingOffer || callId) return;
        const opened = await window.MYGRAM_DIRECT_MESSENGER?.openUserById(signal.sender_id);
        if (!opened) throw new Error('تعذر فتح محادثة المتصل.');
        activePeerId = signal.sender_id; hasConversation = true;
        callId = signal.call_id;
        callKind = signal.payload?.kind === 'video' ? 'video' : 'audio';
        incomingOffer = signal.payload?.description;
        setMode('incoming');
        say(callKind === 'video' ? 'هناك مكالمة فيديو واردة.' : 'هناك مكالمة صوتية واردة.');
        if (window.MYGRAM_SOUNDS) window.MYGRAM_SOUNDS.play('call');
        return;
      }
      if (signal.call_id !== callId || signal.sender_id !== activePeerId) return;
      if (signal.signal_type === 'answer' && pc) {
        await pc.setRemoteDescription(signal.payload.description); await flushRemoteIce();
        say('تم الرد، جارٍ الاتصال…');
      } else if (signal.signal_type === 'ice' && signal.payload?.candidate) {
        if (pc?.remoteDescription) await pc.addIceCandidate(signal.payload.candidate);
        else remoteIceQueue.push(signal.payload.candidate);
      } else if (signal.signal_type === 'reject') {
        await finishCall(false); say('تم رفض المكالمة.');
      } else if (signal.signal_type === 'hangup') {
        await finishCall(false); say('انتهت المكالمة.');
      }
    } catch (error) {
      say('تعذر التعامل مع المكالمة: '+(error?.message || 'خطأ غير معروف.'),true);
    }
  }
  async function init() {
    const session = await db.auth.getSession();
    if (session.error) throw session.error;
    me = session.data?.session?.user;
    if (!me) return;
    window.addEventListener('mygram:direct-chat-opened', event => syncContext(event.detail));
    $('dmAudioCallButton').addEventListener('click',() => beginCall('audio'));
    $('dmVideoCallButton').addEventListener('click',() => beginCall('video'));
    $('dmAcceptCallButton').addEventListener('click',acceptCall);
    $('dmRejectCallButton').addEventListener('click',rejectCall);
    $('dmEndCallButton').addEventListener('click',() => finishCall(true).then(() => say('أنهيت المكالمة.')));
    channel = db.channel('direct-call-signals-'+me.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_call_signals',filter:'target_user_id=eq.'+me.id},payload => handleSignal(payload.new))
      .subscribe();
    const context = window.MYGRAM_DIRECT_MESSENGER?.getContext?.();
    if (context?.activeRecipient) {
      const hasHistory = window.MYGRAM_DIRECT_MESSENGER.getContext().hasConversation;
      syncContext({userId:me.id,peerId:context.activeRecipient.id,hasConversation:hasHistory});
    }
  }
  window.addEventListener('beforeunload',() => {
    disposed = true;
    try { if (pc) pc.close(); localStream?.getTracks().forEach(track => track.stop()); } catch (_) {}
    if (channel && typeof db.removeChannel === 'function') db.removeChannel(channel).catch(() => {});
  });
  init().catch(error => say('تعذر تهيئة مكالمات Messenger: '+(error?.message || 'خطأ غير معروف.'),true));
})();