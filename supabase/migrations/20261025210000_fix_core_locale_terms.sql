-- Replace a few untranslated core catalog entries discovered by the locale audit.
update public.translation_catalog set translated_text='Ηλεκτρονικό ταχυδρομείο',updated_at=now()
 where target_locale='el' and message_key='Email' and source_hash='core-ui-v1';
update public.translation_catalog set translated_text='Larawan sa pabalat',updated_at=now()
 where target_locale='fil' and message_key='Cover photo' and source_hash='core-ui-v1';
update public.translation_catalog set translated_text='Tahanan',updated_at=now()
 where target_locale='fil' and message_key='Home' and source_hash='core-ui-v1';
update public.translation_catalog set translated_text='Kontrasenyas',updated_at=now()
 where target_locale='fil' and message_key='Password' and source_hash='core-ui-v1';
update public.translation_catalog set translated_text='Pagina iniziale',updated_at=now()
 where target_locale='it' and message_key='Home' and source_hash='core-ui-v1';
update public.translation_catalog set translated_text='Parola d''ordine',updated_at=now()
 where target_locale='it' and message_key='Password' and source_hash='core-ui-v1';
