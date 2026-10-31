const PRIVATE_KEY=/(password|token|secret|authorization|email|phone|address)/i;
export function safeAuditPayload(data){return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,PRIVATE_KEY.test(k)?"[REDACTED]":v]))}
export function healthStatus(checks){if(!checks.length||checks.every(x=>!x.ok))return "unavailable";return checks.every(x=>x.ok)?"healthy":"degraded"}