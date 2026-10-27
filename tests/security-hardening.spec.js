const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('direct chat lookup excludes group chats and requires exactly both participants', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'chat.js'), 'utf8');
  expect(source).toContain(".from('chats').select('id,is_group,created_at').in('id',ids).eq('is_group',false)");
  expect(source).toContain('idsForChat.size===2&&idsForChat.has(me.id)&&idsForChat.has(other.id)');
});

test('member search sanitizes PostgREST filter syntax and wildcard input before building OR filter', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services.js'), 'utf8');
  expect(source).toContain('function sanitizeMemberSearch(value)');
  expect(source).toMatch(/replace\(\/[\\\\%_\(\),\.\\\"']\/g,\s*' '\)/);
  expect(source).toContain('const q=sanitizeMemberSearch($(\'memberSearch\').value)');
  expect(source).toContain('.or(`username.ilike.${pattern},full_name.ilike.${pattern}`)');
});
