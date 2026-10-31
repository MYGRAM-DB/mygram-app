export const messages={ar:{post:"منشور",reply:"رد",settings:"الإعدادات"},en:{post:"Post",reply:"Reply",settings:"Settings"}};
export function translate(locale,key){if(!messages[locale]||!(key in messages[locale]))throw Error("MISSING_TRANSLATION");return messages[locale][key]}
export function direction(locale){if(!messages[locale])throw Error("UNSUPPORTED_LOCALE");return locale==="ar"?"rtl":"ltr"}
export function assertParity(){const keys=Object.keys(messages.ar).sort().join("|");if(keys!==Object.keys(messages.en).sort().join("|"))throw Error("LOCALE_KEY_MISMATCH")}