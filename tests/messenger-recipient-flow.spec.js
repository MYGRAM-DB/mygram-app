const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.__dbWrites = [];
window.supabase = { createClient: () => ({
 auth: {
  getSession: async () => ({ data: { session: { access_token: 'mock-token', user: { id: 'sender-uuid', email: 'sender@example.test' } } }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
 },
 from(table) {
  const q = { table, op: 'select', filters: [], payload: null,
   select() { return this; }, eq(k,v) { this.filters.push([k,v]); return this; },
   ilike(k,v) { this.filters.push([k,v]); return this; }, gt() { return this; },
   order() { return this; }, limit() { return this; }, or() { return this; }, is() { return this; },
   insert(payload) { this.op='insert'; this.payload=payload; window.__dbWrites.push({table,op:'insert',payload}); return this; },
   update(payload) { this.op='update'; this.payload=payload; return this; },
   delete() { this.op='delete'; return this; },
   maybeSingle() { return Promise.resolve({data:null,error:null}); },
   then(resolve,reject) {
    let data=[];
    if(this.table==='profiles') {
     const fullName=this.filters.find(([k])=>k==='full_name')?.[1];
     const username=this.filters.find(([k])=>k==='username')?.[1];
     const id=this.filters.find(([k])=>k==='id')?.[1];
     const profile={id:'recipient-uuid',username:null,full_name:'Marah Om Samer',avatar_url:null};
     if((fullName && String(fullName).toLowerCase().includes('marah')) || (id==='recipient-uuid')) data=[profile];
     if(username) data=[];
    }
    return Promise.resolve({data,error:null}).then(resolve,reject);
   }
  }; return q;
 },
 channel() { return { on(){return this;}, subscribe(){return this;} }; },
 storage: { from: () => ({ upload: async () => ({data:{path:'mock'},error:null}), createSignedUrl: async () => ({data:{signedUrl:'https://example.test/mock'},error:null}), getPublicUrl: () => ({data:{publicUrl:'https://example.test/media'}}) }) }
}) };
`;

test('Messenger opens a found profile even when it has no username', async ({ page }) => {
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
  route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase})
 );
 await page.goto('/services.html');
 await page.locator('#messageUsername').fill('Marah');
 await page.locator('#loadChat').click();
 await expect(page.locator('#dmPeerName')).toHaveText('Marah Om Samer');
 await expect(page.locator('#chatBox')).toContainText('ابدأ المحادثة');
 await expect(page.locator('#toast')).not.toContainText('لا يملك اسم مستخدم');
});

test('Messenger sends to the selected profile ID when username is absent', async ({ page }) => {
 await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
  route.fulfill({status:200,contentType:'application/javascript',body:mockSupabase})
 );
 await page.goto('/services.html');
 await page.locator('#messageUsername').fill('Marah');
 await page.locator('#loadChat').click();
 await page.locator('#messageBody').fill('Hi');
 await page.locator('#messageForm button[type="submit"]').click();
 await expect.poll(() => page.evaluate(() => window.__dbWrites.some(w =>
  w.table==='direct_messages' && w.op==='insert' && w.payload?.recipient_id==='recipient-uuid' && w.payload?.body==='Hi'
 ))).toBe(true);
 await expect(page.locator('#toast')).toContainText('تم إرسال الرسالة');
});
