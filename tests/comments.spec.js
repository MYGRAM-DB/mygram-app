const { test, expect } = require('@playwright/test');

const mockSupabase = `
window.__mockCalls = [];
window.__mockTableData = {
  profiles: [{ id: 'other-user-uuid', username: 'someone', full_name: 'Someone', bio: 'Test profile', avatar_url: null }]
};
window.supabase = {
  createClient: () => {
    const query = {
      select() { return this; }, insert(payload) { window.__mockCalls.push({table:this._table,op:'insert',payload}); return this; },
      update() { return this; }, delete() { return this; }, upsert() { return this; }, eq() { return this; },
      neq() { return this; }, in() { return this; }, or() { return this; }, gt() { return this; },
      order() { return this; }, limit() { return this; },
      maybeSingle() { const rows=window.__mockTableData?.[this._table]||[];return Promise.resolve({data:rows[0]||null,error:null}); },
      then(resolve,reject) { const rows=window.__mockTableData?.[this._table]||[];return Promise.resolve({data:rows,error:null,count:rows.length}).then(resolve,reject); }
    };
    return {
      auth: {
        getSession: async () => ({data:{session:{user:{id:'test-user-uuid',email:'tester@example.com',user_metadata:{full_name:'Test User'}}}},error:null}),
        signOut: async () => ({error:null}),
        onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}})
      },
      from: table => {const q=Object.create(query);q._table=table;return q;},
      storage: {from:()=>({upload:async()=>({data:{path:'mock'},error:null}),getPublicUrl:()=>({data:{publicUrl:'https://example.test/mock.png'}})})}
    };
  }
};
`;

test('feed comments show the author name and comment text safely', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabase })
  );
  await page.goto('/home.html');
  await page.evaluate(() => {
    window.__mockTableData.posts = [{
      id: 'post-test-id',
      user_id: 'test-user-uuid',
      content: 'A test post',
      media_url: null,
      media_type: null,
      created_at: new Date().toISOString()
    }];
    window.__mockTableData.post_comments = [{
      id: 'comment-test-id',
      post_id: 'post-test-id',
      user_id: 'other-user-uuid',
      content: '<script>not executable</script> Hello!',
      created_at: new Date().toISOString()
    }];
  });
  await page.locator('#refreshButton').click();
  await expect(page.locator('.post-card')).toContainText('A test post');
  await page.locator('[data-toggle-comments]').click();
  await expect(page.locator('.comment-list')).toContainText('Someone: <script>not executable</script> Hello!');
  await expect(page.locator('.comment-list script')).toHaveCount(0);
});
