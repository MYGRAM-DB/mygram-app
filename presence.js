(() => {
  'use strict';

  const ONLINE_WINDOW_MS = 90_000;
  const HEARTBEAT_MS = 30_000;

  function relativeLastSeen(value) {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (ageSeconds < 120) return 'آخر ظهور منذ دقيقة';
    const minutes = Math.floor(ageSeconds / 60);
    if (minutes < 60) return 'آخر ظهور منذ ' + minutes + ' دقيقة';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return 'آخر ظهور منذ ' + hours + ' ساعة';
    const days = Math.floor(hours / 24);
    if (days < 30) return 'آخر ظهور منذ ' + days + ' يوم';
    return 'آخر ظهور منذ أكثر من شهر';
  }

  function createAvatar(profile, className = 'presence-avatar') {
    const avatar = document.createElement('span');
    avatar.className = className;
    avatar.setAttribute('aria-label', profile?.full_name || profile?.username || 'صورة المستخدم');
    if (profile?.avatar_url) {
      const image = document.createElement('img');
      image.src = profile.avatar_url;
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => {
        image.remove();
        avatar.textContent = initial(profile);
      };
      avatar.appendChild(image);
    } else {
      avatar.textContent = initial(profile);
    }
    return avatar;
  }

  function initial(profile) {
    const name = String(profile?.full_name || profile?.username || '').trim();
    return name ? Array.from(name)[0].toLocaleUpperCase() : '👤';
  }

  function renderStatus(container, status) {
    if (!container) return;
    container.replaceChildren();
    container.className = 'presence-status';
    if (!status || status.state === 'unavailable') {
      container.textContent = 'الحالة غير متاحة';
      container.setAttribute('aria-label', 'الحالة غير متاحة');
      return;
    }

    const dot = document.createElement('span');
    dot.className = 'presence-dot' + (status.state === 'online' ? ' is-online' : ' is-offline');
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = status.state === 'online' ? 'متصل الآن' : relativeLastSeen(status.last_seen_at);
    container.append(dot, label);
    container.setAttribute('aria-label', label.textContent);
  }

  async function init(db, user, toggle) {
    if (!db || !user?.id) throw new Error('لا يمكن تهيئة حالة الاتصال دون جلسة مستخدم.');
    let showOnlineStatus = true;
    let disposed = false;
    let heartbeatTimer = null;

    async function savePreference(show) {
      const now = new Date().toISOString();
      const { error } = await db.from('user_presence').upsert({
        user_id: user.id,
        show_online_status: show,
        last_seen_at: show ? now : null,
        updated_at: now
      }, { onConflict: 'user_id' });
      if (error) throw error;
      showOnlineStatus = show;
    }

    async function heartbeat() {
      if (disposed || document.visibilityState === 'hidden') return;
      const now = new Date().toISOString();
      const { error } = await db.from('user_presence').upsert({
        user_id: user.id,
        show_online_status: showOnlineStatus,
        last_seen_at: showOnlineStatus ? now : null,
        updated_at: now
      }, { onConflict: 'user_id' });
      if (error) throw error;
    }

    const { data, error } = await db.from('user_presence')
      .select('show_online_status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) showOnlineStatus = data.show_online_status !== false;

    if (toggle) {
      toggle.checked = showOnlineStatus;
      toggle.disabled = false;
      toggle.addEventListener('change', async () => {
        const nextValue = toggle.checked;
        toggle.disabled = true;
        try {
          await savePreference(nextValue);
          toggle.title = nextValue ? 'ستظهر حالة اتصالك وآخر ظهورك لجهات محادثاتك' : 'تم إخفاء حالة اتصالك وآخر ظهورك';
          document.dispatchEvent(new CustomEvent('mygram:presence-setting-changed', {
            detail: { showOnlineStatus: showOnlineStatus }
          }));
        } catch (err) {
          toggle.checked = showOnlineStatus;
          console.error('MYGRAM presence preference could not be saved:', err?.message || err);
          const status = document.getElementById('presenceSettingStatus');
          if (status) status.textContent = 'تعذّر حفظ الإعداد. تأكد من تحديث قاعدة البيانات.';
        } finally {
          toggle.disabled = false;
        }
      });
    }

    if (!data) await savePreference(true);
    await heartbeat().catch(err => console.warn('MYGRAM presence heartbeat unavailable:', err?.message || err));
    heartbeatTimer = window.setInterval(() => {
      heartbeat().catch(err => console.warn('MYGRAM presence heartbeat unavailable:', err?.message || err));
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') heartbeat().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);

    return {
      get showOnlineStatus() { return showOnlineStatus; },
      async getStatus(targetUserId) {
        if (!targetUserId || targetUserId === user.id) return { state: 'unavailable' };
        const { data: target, error: statusError } = await db.from('user_presence')
          .select('user_id,show_online_status,last_seen_at')
          .eq('user_id', targetUserId)
          .maybeSingle();
        if (statusError) throw statusError;
        if (!target || target.show_online_status === false || !target.last_seen_at) {
          return { state: 'unavailable' };
        }
        const age = Date.now() - new Date(target.last_seen_at).getTime();
        if (Number.isFinite(age) && age >= 0 && age <= ONLINE_WINDOW_MS) {
          return { state: 'online', last_seen_at: target.last_seen_at };
        }
        return { state: 'offline', last_seen_at: target.last_seen_at };
      },
      async refresh(targetUserId, container) {
        try {
          const status = await this.getStatus(targetUserId);
          renderStatus(container, status);
          return status;
        } catch (err) {
          renderStatus(container, { state: 'unavailable' });
          console.warn('MYGRAM presence status unavailable:', err?.message || err);
          return { state: 'unavailable' };
        }
      },
      stop() {
        disposed = true;
        if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }

  window.MYGRAM_PRESENCE = { init, createAvatar, renderStatus };
})();