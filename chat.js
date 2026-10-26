(()=>{'use strict';
const cfg=window.MYGRAM_CONFIG,db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey),$=id=>document.getElementById(id);
let me=null,activeChat=null,activePeerId=null,activePeerProfile=null,presence=null,toastTimer=null,mediaRecorder=null,recordingStream=null,recordingChunks=[],recordedVoiceFile=null,recordedVoiceDurationSeconds=null,recordingStartedAt=0,realtimeChannel=null,inboxRealtimeChannel=null,callSignalsChannel=null,peerConnection=null,localCallStream=null,currentCallId=null,currentCallKind=null,incomingOffer=null,callReady=false,localIceQueue=[],remoteIceQueue=[];
function setCallStatus(message){$('callStatus').textContent=window.MYGRAM_TRANSLATE_TEXT?window.MYGRAM_TRANSLATE_TEXT(message||''):(message||'')}
function setCallMode(mode){$('acceptCallButton').hidden=mode!=='incoming';$('rejectCallButton').hidden=mode!=='incoming';$('endCallButton').hidden=!['calling','active','incoming'].includes(mode);$('audioCallButton').disabled=['calling','active','incoming'].includes(mode);$('videoCallButton').disabled=['calling','active','incoming'].includes(mode);$('callMedia').hidden=!['calling','active'].includes(mode);$('localCallVideo').hidden=currentCallKind!=='video';$('remoteCallVideo').hidden=currentCallKind!=='video';}
async function sendCallSignal(signalType,payload={},target=activePeerId){if(!activeChat||!currentCallId||!target)throw new Error('اختر محادثة فردية قبل بدء المكالمة.');const {error}=await db.from('call_signals').insert({chat_id:activeChat,call_id:currentCallId,sender_id:me.id,target_user_id:target,signal_type:signalType,payload,expires_at:new Date(Date.now()+10*60*1000).toISOString()});if(error)throw error}
async function flushLocalIce(){const queue=localIceQueue.splice(0);for(const candidate of queue){try{await sendCallSignal('ice',{candidate})}catch(err){toast('تعذر إرسال بيانات الاتصال: '+err.message,true)}}}
async function flushRemoteIce(){if(!peerConnection?.remoteDescription)return;const queue=remoteIceQueue.splice(0);for(const candidate of queue){try{await peerConnection.addIceCandidate(candidate)}catch(err){console.warn('MYGRAM ICE candidate rejected',err)}}}
async function getIceServers(){const fallback=[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}];try{const {data}=await db.auth.getSession();const token=data?.session?.access_token;if(!token||!activeChat)return fallback;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);let response;try{response=await fetch(cfg.supabaseUrl+'/functions/v1/turn-credentials',{method:'POST',headers:{apikey:cfg.supabaseKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({chatId:activeChat}),signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}if(!response.ok)return fallback;const result=await response.json();if(Array.isArray(result.iceServers)&&result.iceServers.length)return result.iceServers}catch(error){console.info('Using STUN-only fallback; TURN credentials are unavailable.',error?.message||'')}return fallback}
async function createPeerConnection(){const iceServers=await getIceServers();peerConnection=new RTCPeerConnection({iceServers});for(const track of localCallStream.getTracks())peerConnection.addTrack(track,localCallStream);peerConnection.onicecandidate=event=>{if(!event.candidate)return;const candidate=event.candidate.toJSON();if(callReady)sendCallSignal('ice',{candidate}).catch(err=>toast('تعذر إرسال بيانات الاتصال: '+err.message,true));else localIceQueue.push(candidate)};peerConnection.ontrack=event=>{const stream=event.streams?.[0];if(!stream)return;if(currentCallKind==='audio')$('remoteCallAudio').srcObject=stream;else $('remoteCallVideo').srcObject=stream};peerConnection.onconnectionstatechange=()=>{if(!peerConnection)return;const state=peerConnection.connectionState;if(state==='connected'){setCallMode('active');setCallStatus(currentCallKind==='video'?'مكالمة الفيديو متصلة':'المكالمة الصوتية متصلة')}else if(state==='failed'){setCallStatus('تعذر الاتصال المباشر. قد تحتاج الشبكة إلى خادم TURN.')}else if(state==='disconnected'){setCallStatus('انقطع الاتصال مؤقتاً، جارٍ إعادة المحاولة...')}};return peerConnection}
async function beginCall(kind){try{if(!activeChat||!activePeerId)throw new Error('افتح محادثة فردية أولاً. مكالمات المجموعات غير مفعّلة بعد.');if(peerConnection||incomingOffer)throw new Error('هناك مكالمة نشطة بالفعل.');currentCallId=crypto.randomUUID();currentCallKind=kind;callReady=false;localIceQueue=[];remoteIceQueue=[];setCallMode('calling');setCallStatus(kind==='video'?'جارٍ بدء مكالمة الفيديو...':'جارٍ بدء المكالمة الصوتية...');localCallStream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'});$('localCallVideo').srcObject=localCallStream;await createPeerConnection();const offer=await peerConnection.createOffer();await peerConnection.setLocalDescription(offer);await sendCallSignal('offer',{description:peerConnection.localDescription,kind});callReady=true;await flushLocalIce();setCallStatus('تم الاتصال بالطرف الآخر، بانتظار الرد...')}catch(err){await endCall(false);toast('تعذر بدء المكالمة: '+(err?.message||'تحقق من إذن الميكروفون والكاميرا.'),true)}}
async function acceptCall(){try{if(!incomingOffer||!currentCallId||!activePeerId)throw new Error('انتهت صلاحية دعوة المكالمة.');localCallStream=await navigator.mediaDevices.getUserMedia({audio:true,video:currentCallKind==='video'});$('localCallVideo').srcObject=localCallStream;await createPeerConnection();await peerConnection.setRemoteDescription(incomingOffer);await flushRemoteIce();const answer=await peerConnection.createAnswer();await peerConnection.setLocalDescription(answer);await sendCallSignal('answer',{description:peerConnection.localDescription});callReady=true;await flushLocalIce();incomingOffer=null;setCallMode('calling');setCallStatus('جارٍ إنشاء الاتصال الآمن...')}catch(err){toast('تعذر قبول المكالمة: '+(err?.message||''),true);await endCall(true)}}
async function endCall(notifyPeer=true){const target=activePeerId,chat=currentCallId&&activeChat; if(notifyPeer&&chat&&target){try{await sendCallSignal('hangup',{})}catch{}}if(peerConnection){peerConnection.ontrack=null;peerConnection.onicecandidate=null;peerConnection.close()}peerConnection=null;localCallStream?.getTracks().forEach(track=>track.stop());localCallStream=null;$('localCallVideo').srcObject=null;$('remoteCallVideo').srcObject=null;$('remoteCallAudio').srcObject=null;currentCallId=null;currentCallKind=null;incomingOffer=null;callReady=false;localIceQueue=[];remoteIceQueue=[];setCallMode('idle');setCallStatus('');}
async function handleCallSignal(signal){if(!signal||signal.sender_id===me.id)return;if(signal.signal_type==='offer'){if(peerConnection||incomingOffer||currentCallId)return;await openChat(signal.chat_id,{full_name:'مكالمة واردة'},signal.sender_id);currentCallId=signal.call_id;currentCallKind=signal.payload?.kind==='video'?'video':'audio';incomingOffer=signal.payload?.description;setCallMode('incoming');setCallStatus(currentCallKind==='video'?'مكالمة فيديو واردة':'مكالمة صوتية واردة');return}if(signal.call_id!==currentCallId||signal.chat_id!==activeChat)return;if(signal.signal_type==='answer'&&peerConnection){await peerConnection.setRemoteDescription(signal.payload.description);await flushRemoteIce();setCallStatus('تم الرد، جارٍ الاتصال...')}else if(signal.signal_type==='ice'&&signal.payload?.candidate){if(peerConnection?.remoteDescription)await peerConnection.addIceCandidate(signal.payload.candidate);else remoteIceQueue.push(signal.payload.candidate)}else if(signal.signal_type==='hangup'||signal.signal_type==='reject'){await endCall(false);setCallStatus(signal.signal_type==='reject'?'تم رفض المكالمة.':'انتهت المكالمة.');}}
function subscribeToCallSignals(){if(!me||typeof db.channel!=='function')return;callSignalsChannel=db.channel('mygram-call-signals-'+me.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'call_signals',filter:'target_user_id=eq.'+me.id},payload=>handleCallSignal(payload.new).catch(err=>toast('تعذر استقبال المكالمة: '+err.message,true))).subscribe()}
function subscribeToInboxMessages(){if(!me||typeof db.channel!=='function')return;inboxRealtimeChannel=db.channel('mygram-chat-inbox-'+me.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_messages'},payload=>{const message=payload?.new;if(!message?.chat_id)return;if(message.sender_id!==me.id){window.MYGRAM_SOUNDS?.play('message');window.dispatchEvent(new CustomEvent('mygram:message-received',{detail:{product:'mygram-chat',chatId:message.chat_id}}))}loadChatList().catch(()=>{});if(activeChat===message.chat_id)loadMessages().catch(()=>{})}).subscribe()}
function toast(msg,error=false){
    if(error)window.MYGRAM_SOUNDS?.play('error');
    msg=window.MYGRAM_TRANSLATE_TEXT?window.MYGRAM_TRANSLATE_TEXT(msg):msg;const e=$('chatToast');e.textContent=msg;e.className='toast show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.className='toast',4500)}
function safeName(p){return p?.full_name?.trim()||('@'+(p?.username||'عضو MYGRAM'))}
async function getProfileByUsername(username){const {data,error}=await db.from('profiles').select('id,username,full_name,avatar_url').eq('username',username).maybeSingle();if(error)throw error;if(!data)throw new Error('لم نعثر على هذا المستخدم.');if(data.id===me.id)throw new Error('لا يمكنك بدء محادثة مع نفسك.');return data}
async function getOrCreateChat(others){if(others.length===1){const other=others[0];const {data:mine,error}=await db.from('chat_members').select('chat_id').eq('user_id',me.id);if(error)throw error;const ids=(mine||[]).map(x=>x.chat_id);if(ids.length){const {data:members,error:e}=await db.from('chat_members').select('chat_id,user_id').in('chat_id',ids);if(e)throw e;const existing=(members||[]).find(x=>x.user_id===other.id);if(existing)return existing.chat_id}}const isGroup=others.length>1;const title=isGroup?others.map(safeName).join(', ').slice(0,100):null;const {data:chat,error:createError}=await db.from('chats').insert({created_by:me.id,is_group:isGroup,title}).select('id').single();if(createError)throw createError;const participants=[{chat_id:chat.id,user_id:me.id},...others.map(p=>({chat_id:chat.id,user_id:p.id}))];const {error:memberError}=await db.from('chat_members').insert(participants);if(memberError)throw memberError;return chat.id}
async function loadChatList(){
 const box=$('chatList');box.replaceChildren();
 const {data:mine,error}=await db.from('chat_members').select('chat_id').eq('user_id',me.id);
 if(error)throw error;
 const ids=[...new Set((mine||[]).map(x=>x.chat_id))];
 if(!ids.length){box.textContent='لا توجد محادثات بعد.';return}
 const {data:members,error:membersError}=await db.from('chat_members').select('chat_id,user_id').in('chat_id',ids);
 if(membersError)throw membersError;
 const {data:chats,error:chatsError}=await db.from('chats').select('id,title,is_group').in('id',ids);
 if(chatsError)throw chatsError;
 const chatById=Object.fromEntries((chats||[]).map(c=>[c.id,c]));
 const otherIds=[...new Set((members||[]).map(x=>x.user_id).filter(id=>id!==me.id))];
 const {data:profiles,error:profileError}=otherIds.length?await db.from('profiles').select('id,username,full_name,avatar_url').in('id',otherIds):{data:[],error:null};
 if(profileError)throw profileError;
 const byId=Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
 for(const id of ids){
  const chat=chatById[id];
  const member=(members||[]).find(x=>x.chat_id===id&&x.user_id!==me.id);
  const profile=chat?.is_group?{full_name:chat.title||'مجموعة'}:byId[member?.user_id];
  const button=document.createElement('button');button.type='button';button.className='chat-entry';button.dataset.chatId=id;button.setAttribute('aria-current',String(activeChat===id));
  if(window.MYGRAM_PRESENCE)button.appendChild(window.MYGRAM_PRESENCE.createAvatar(profile,'presence-avatar'));
  const copy=document.createElement('span');copy.className='chat-entry-copy';
  const name=document.createElement('span');name.className='chat-entry-name';name.textContent=(chat?.is_group?'👥 ':'')+safeName(profile);copy.appendChild(name);
  if(profile?.username){const handle=document.createElement('small');handle.className='chat-entry-status';handle.textContent='@'+profile.username;copy.appendChild(handle)}
  button.appendChild(copy);button.onclick=()=>openChat(id,profile);box.appendChild(button);
 }
}
async function openChat(chatId,profile,peerOverride=null){
 activeChat=chatId;activePeerId=peerOverride||profile?.id||null;window.MYGRAM_MESSAGING_TOOLS?.setContext({source:'messenger',spaceId:chatId,userId:me?.id,chatType:activePeerId?'direct':'group'});
 if(activePeerId&&(!profile?.avatar_url&&!profile?.username)){
  try{const result=await db.from('profiles').select('id,username,full_name,avatar_url').eq('id',activePeerId).maybeSingle();if(result.data)profile=result.data}catch{}
 }
 activePeerProfile=profile||null;
 const head=$('threadHead');head.replaceChildren();
 if(window.MYGRAM_PRESENCE)head.appendChild(window.MYGRAM_PRESENCE.createAvatar(profile, 'presence-avatar thread-peer-avatar'));
 const copy=document.createElement('div');copy.className='thread-peer-copy';
 const name=document.createElement('strong');name.className='thread-peer-name';name.textContent=safeName(profile);copy.appendChild(name);
 if(profile?.username){const handle=document.createElement('small');handle.className='thread-peer-handle';handle.textContent='@'+profile.username;copy.appendChild(handle)}
 const status=document.createElement('span');status.id='activePeerPresence';status.className='presence-status';status.textContent=activePeerId?'جارٍ التحقق من الحالة…':'محادثة جماعية';copy.appendChild(status);
 head.appendChild(copy);
 for(const b of $('chatList').querySelectorAll('[data-chat-id]'))b.setAttribute('aria-current',String(b.dataset.chatId===chatId));
 if(activePeerId&&presence)await presence.refresh(activePeerId,status);else if(!activePeerId)status.textContent='محادثة جماعية';
 if(realtimeChannel&&typeof db.removeChannel==='function'){try{await db.removeChannel(realtimeChannel)}catch{}realtimeChannel=null}
 await loadMessages();
 if(typeof db.channel==='function'){realtimeChannel=db.channel('mygram-chat-'+chatId).on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:'chat_id=eq.'+chatId},()=>{if(activeChat===chatId)loadMessages().catch(err=>toast('تعذر تحديث المحادثة: '+err.message,true))}).subscribe()}
}
function formatVoiceDuration(seconds){if(!Number.isFinite(Number(seconds))||Number(seconds)<1)return 'رسالة صوتية';const total=Math.floor(Number(seconds));return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')}
async function loadMessages(){
 if(!activeChat)return;
 const box=$('chatMessages');box.replaceChildren();
 let query=db.from('chat_messages').select('id,chat_id,sender_id,body,attachment_url,attachment_type,duration_seconds,created_at,topic_id,reply_to_message_id').eq('chat_id',activeChat);const topicId=window.MYGRAM_MESSAGING_TOOLS?.getActiveTopicId();if(topicId)query=query.eq('topic_id',topicId);const {data,error}=await query.order('created_at',{ascending:true}).limit(200);
 if(error)throw error;
 if(!data?.length){box.innerHTML='<div class="chat-empty">ابدأ المحادثة برسالة لطيفة.</div>';return}
 await window.MYGRAM_MESSAGING_TOOLS?.loadMessageReactions(data.map(m=>m.id));
 const messageMap=new Map(data.map(m=>[m.id,m]));
 for(const m of data){
  const bubble=document.createElement('article');bubble.className='chat-bubble'+(m.sender_id===me.id?' mine':'');
  if(m.reply_to_message_id){const parent=messageMap.get(m.reply_to_message_id);const quote=document.createElement('blockquote');quote.className='mygram-message-quote';quote.textContent='↩ '+(parent?(parent.body||'رسالة مرفقة'):'رد على رسالة');bubble.appendChild(quote)}
  const placeholderVoice=m.attachment_type==='audio'&&/رسالة صوتية/.test(m.body||'');
  if(m.body&&!placeholderVoice){const p=document.createElement('p');p.className='chat-message-text';p.textContent=m.body;bubble.appendChild(p)}
  if(m.attachment_url&&m.attachment_type){
   const signed=await db.storage.from('mygram-private-messages').createSignedUrl(m.attachment_url,3600);
   if(!signed.error){
    if(m.attachment_type==='audio'){
     const card=document.createElement('div');card.className='voice-note-card';
     const icon=document.createElement('span');icon.className='voice-note-icon';icon.setAttribute('aria-hidden','true');icon.textContent='🎙️';
     const meta=document.createElement('span');meta.className='voice-note-copy';
     const title=document.createElement('strong');title.textContent='رسالة صوتية';
     const length=document.createElement('small');length.textContent=formatVoiceDuration(m.duration_seconds);
     meta.append(title,length);
     const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=signed.data.signedUrl;audio.setAttribute('aria-label','تشغيل الرسالة الصوتية');
     card.append(icon,meta,audio);bubble.appendChild(card);
    }else{
     let media;
     if(m.attachment_type==='video'){media=document.createElement('video');media.controls=true;media.playsInline=true;media.preload='metadata'}
     else{media=document.createElement('img');media.alt='مرفق خاص';media.loading='lazy'}
     media.src=signed.data.signedUrl;bubble.appendChild(media);
    }
   }
  }
  const time=document.createElement('small');time.className='chat-message-time';time.textContent=new Date(m.created_at).toLocaleString(undefined,{hour:'2-digit',minute:'2-digit'});bubble.appendChild(time);window.MYGRAM_MESSAGING_TOOLS?.decorateMessageBubble(bubble,m);box.appendChild(bubble);
 }
 box.scrollTop=box.scrollHeight;
}
$('recordVoiceButton').addEventListener('click',async()=>{try{if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();return}if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('تسجيل الصوت غير مدعوم في هذا المتصفح.');recordingStream=await navigator.mediaDevices.getUserMedia({audio:true});recordingChunks=[];recordingStartedAt=Date.now();recordedVoiceDurationSeconds=null;mediaRecorder=new MediaRecorder(recordingStream);mediaRecorder.ondataavailable=e=>{if(e.data&&e.data.size)recordingChunks.push(e.data)};mediaRecorder.onerror=()=>toast('تعذر تسجيل الصوت.',true);mediaRecorder.onstop=()=>{recordingStream?.getTracks().forEach(track=>track.stop());recordingStream=null;const mime=mediaRecorder?.mimeType||'audio/webm';const blob=new Blob(recordingChunks,{type:mime});recordedVoiceFile=blob.size?new File([blob],'voice-note.webm',{type:mime}):null;recordedVoiceDurationSeconds=recordedVoiceFile?Math.max(1,Math.round((Date.now()-recordingStartedAt)/1000)):null;$('recordVoiceButton').textContent='🎙️ تسجيل رسالة صوتية';$('recordVoiceButton').setAttribute('aria-pressed','false');$('voiceRecordingStatus').textContent=recordedVoiceFile?'تم تجهيز التسجيل الصوتي للإرسال.':'';if(recordedVoiceFile)toast('اكتمل التسجيل. أرسل الرسالة لإرفاقه.');};mediaRecorder.start();$('recordVoiceButton').textContent='⏹ إيقاف التسجيل';$('recordVoiceButton').setAttribute('aria-pressed','true');$('voiceRecordingStatus').textContent='جارٍ التسجيل...';toast('بدأ تسجيل الصوت.');}catch(err){recordingStream?.getTracks().forEach(track=>track.stop());recordingStream=null;toast('تعذر الوصول إلى الميكروفون: '+(err?.message||''),true)}});
$('audioCallButton').addEventListener('click',()=>beginCall('audio'));$('videoCallButton').addEventListener('click',()=>beginCall('video'));$('acceptCallButton').addEventListener('click',()=>acceptCall());$('rejectCallButton').addEventListener('click',async()=>{try{await sendCallSignal('reject',{})}catch{}await endCall(false);setCallStatus('تم رفض المكالمة.')});$('endCallButton').addEventListener('click',()=>endCall(true));
$('newChatForm').onsubmit=async e=>{e.preventDefault();const btn=$('newChatForm').querySelector('button');btn.disabled=true;try{const usernames=[...new Set($('chatUsername').value.split(',').map(v=>v.trim().replace(/^@/,'').toLowerCase()).filter(Boolean))];if(!usernames.length||usernames.some(name=>!/^[a-z0-9_]{3,30}$/.test(name)))throw new Error('اكتب اسم مستخدم صحيحاً، وافصل أسماء المجموعة بفواصل.');const others=[];for(const username of usernames)others.push(await getProfileByUsername(username));const chatId=await getOrCreateChat(others);await loadChatList();await openChat(chatId,others.length>1?{full_name:others.map(safeName).join(', ')}:others[0]);$('chatUsername').value='';toast('المحادثة جاهزة.')}catch(err){toast('تعذر بدء المحادثة: '+err.message,true)}finally{btn.disabled=false}};
$('chatCompose').onsubmit=async e=>{e.preventDefault();if(!activeChat){toast('اختر محادثة أولاً.',true);return}const body=$('chatBody').value.trim(),file=$('chatFile').files[0]||recordedVoiceFile;if(recordedVoiceDurationSeconds>600&&file===recordedVoiceFile){toast('الحد الأقصى للرسالة الصوتية 10 دقائق.',true);return}if(!body&&!file){toast('اكتب رسالة أو اختر مرفقاً.',true);return}if(file&&file.size>50*1024*1024){toast('حجم المرفق يتجاوز 50 ميغابايت.',true);return}const btn=$('chatCompose').querySelector('button');btn.disabled=true;try{let attachment_url=null,attachment_type=null;if(file){attachment_type=file.type.startsWith('audio/')?'audio':file.type.startsWith('video/')?'video':file.type.startsWith('image/')?'image':null;if(!attachment_type)throw new Error('نوع الملف غير مدعوم.');const ext=(file.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').toLowerCase()||'bin';attachment_url=me.id+'/chats/'+activeChat+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;const {error}=await db.storage.from('mygram-private-messages').upload(attachment_url,file,{upsert:false,contentType:file.type,cacheControl:'3600'});if(error)throw error}const {error}=await db.from('chat_messages').insert({chat_id:activeChat,sender_id:me.id,body:body||(attachment_type==='audio'?'🎙️ رسالة صوتية':attachment_type==='video'?'🎬 فيديو مرفق':'🖼️ صورة مرفقة'),attachment_url,attachment_type,duration_seconds:attachment_type==='audio'&&file===recordedVoiceFile?recordedVoiceDurationSeconds:null,topic_id:window.MYGRAM_MESSAGING_TOOLS?.getActiveTopicId()||null,reply_to_message_id:window.MYGRAM_MESSAGING_TOOLS?.getReplyToMessageId()||null});if(error)throw error;window.MYGRAM_MESSAGING_TOOLS?.clearReplyTarget();window.MYGRAM_SOUNDS?.play('sent');$('chatBody').value='';$('chatFile').value='';recordedVoiceFile=null;recordedVoiceDurationSeconds=null;$('voiceRecordingStatus').textContent='';await loadMessages();toast('تم إرسال الرسالة.')}catch(err){toast('تعذر إرسال الرسالة: '+err.message,true)}finally{btn.disabled=false}};
async function start(){
 const {data,error}=await db.auth.getSession();if(error)throw error;if(!data.session){location.replace(cfg.loginUrl);return}
 me=data.session.user;
 if(window.MYGRAM_PRESENCE){try{presence=await window.MYGRAM_PRESENCE.init(db,me,$('showPresenceToggle'))}catch(err){console.warn('Chat presence is unavailable until the presence migration is installed:',err?.message||err);const toggle=$('showPresenceToggle');if(toggle)toggle.disabled=true;const note=$('presenceSettingStatus');if(note)note.textContent='ميزة الحالة غير جاهزة بعد.'}}
 subscribeToCallSignals();await loadChatList();subscribeToInboxMessages()
}
window.addEventListener('mygram:topic-changed',event=>{if(event.detail?.source==='messenger'&&event.detail.spaceId===activeChat)loadMessages().catch(err=>toast('تعذر تحميل الموضوع: '+err.message,true))});
setInterval(()=>{
 if(activeChat&&!document.hidden){loadMessages().catch(()=>{});if(activePeerId&&presence)presence.refresh(activePeerId,$('activePeerPresence'))}
},15000);
start().catch(err=>toast('تعذر تحميل MYGRAM Chat: '+err.message,true));
})();