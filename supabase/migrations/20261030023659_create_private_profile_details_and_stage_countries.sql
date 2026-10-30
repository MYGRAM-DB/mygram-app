BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_private_details (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth date NOT NULL,
  gender text,
  nationality_code text,
  contact_email text,
  contact_phone text,
  verified_contact_method text,
  contact_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_private_details_date_of_birth_check CHECK (date_of_birth <= CURRENT_DATE),
  CONSTRAINT profile_private_details_gender_check CHECK (gender IS NULL OR gender = ANY (ARRAY['female','male','nonbinary','prefer_not_to_say'])),
  CONSTRAINT profile_private_details_verified_contact_method_check CHECK (verified_contact_method IS NULL OR verified_contact_method = ANY (ARRAY['email','phone'])),
  CONSTRAINT profile_private_details_nationality_code_check CHECK (nationality_code IS NULL OR nationality_code ~ '^[A-Z]{2}$')
);

ALTER TABLE public.profile_private_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_private_details_select_own ON public.profile_private_details
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY profile_private_details_insert_own ON public.profile_private_details
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY profile_private_details_update_own ON public.profile_private_details
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY profile_private_details_delete_own ON public.profile_private_details
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.profile_private_details FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.profile_private_details TO authenticated;
GRANT INSERT (user_id, date_of_birth, gender, nationality_code, contact_email, contact_phone)
  ON TABLE public.profile_private_details TO authenticated;
GRANT UPDATE (date_of_birth, gender, nationality_code, contact_email, contact_phone)
  ON TABLE public.profile_private_details TO authenticated;
GRANT ALL ON TABLE public.profile_private_details TO service_role;

CREATE OR REPLACE FUNCTION public.set_profile_private_details_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_profile_private_details_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER set_profile_private_details_updated_at
  BEFORE UPDATE ON public.profile_private_details
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_private_details_updated_at();

COMMENT ON TABLE public.profile_private_details IS
  'Private onboarding details. Read/write is restricted to the owning authenticated user; contact verification fields are backend-managed.';
COMMENT ON COLUMN public.profile_private_details.verified_contact_method IS
  'Set only by a trusted server-side verification flow; not writable by anon/authenticated browser roles.';
COMMENT ON COLUMN public.profile_private_details.contact_verified_at IS
  'Timestamp set only by a trusted server-side verification flow.';

CREATE TABLE IF NOT EXISTS public.supported_countries (
  code text PRIMARY KEY,
  calling_code text,
  national_prefix text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  name_en text,
  name_ar text,
  CONSTRAINT supported_countries_code_check CHECK (code ~ '^[A-Z]{2}$'),
  CONSTRAINT supported_countries_calling_code_format CHECK (calling_code IS NULL OR calling_code ~ '^[+][0-9]{1,4}$')
);

ALTER TABLE public.supported_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY supported_countries_read_enabled ON public.supported_countries
  FOR SELECT TO anon, authenticated USING (enabled = true);

REVOKE ALL ON TABLE public.supported_countries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.supported_countries TO anon, authenticated;
GRANT ALL ON TABLE public.supported_countries TO service_role;

INSERT INTO public.supported_countries
  (code,calling_code,national_prefix,enabled,name_en,name_ar,updated_at)
VALUES
('AD','+376','',true,'Andorra','أندورا',now()),
('AE','+971','',true,'United Arab Emirates','الإمارات العربية المتحدة',now()),
('AF','+93','',true,'Afghanistan','أفغانستان',now()),
('AG','+1','268',true,'Antigua & Barbuda','أنتيغوا وبربودا',now()),
('AL','+355','',true,'Albania','ألبانيا',now()),
('AM','+374','',true,'Armenia','أرمينيا',now()),
('AO','+244','',true,'Angola','أنغولا',now()),
('AR','+54','',true,'Argentina','الأرجنتين',now()),
('AS','+1','684',true,'American Samoa','ساموا الأمريكية',now()),
('AT','+43','',true,'Austria','النمسا',now()),
('AU','+61','',true,'Australia','أستراليا',now()),
('AZ','+994','',true,'Azerbaijan','أذربيجان',now()),
('BA','+387','',true,'Bosnia & Herzegovina','البوسنة والهرسك',now()),
('BB','+1','246',true,'Barbados','بربادوس',now()),
('BD','+880','',true,'Bangladesh','بنغلاديش',now()),
('BE','+32','',true,'Belgium','بلجيكا',now()),
('BF','+226','',true,'Burkina Faso','بوركينا فاسو',now()),
('BG','+359','',true,'Bulgaria','بلغاريا',now()),
('BH','+973','',true,'Bahrain','البحرين',now()),
('BI','+257','',true,'Burundi','بوروندي',now()),
('BJ','+229','',true,'Benin','بنين',now()),
('BN','+673','',true,'Brunei','بروناي',now()),
('BO','+591','',true,'Bolivia','بوليفيا',now()),
('BR','+55','',true,'Brazil','البرازيل',now()),
('BS','+1','242',true,'Bahamas','جزر البهاما',now()),
('BT','+975','',true,'Bhutan','بوتان',now()),
('BW','+267','',true,'Botswana','بوتسوانا',now()),
('BY','+375','',true,'Belarus','بيلاروس',now()),
('BZ','+501','',true,'Belize','بليز',now()),
('CA','+1','',true,'Canada','كندا',now()),
('CD','+243','',true,'Congo - Kinshasa','الكونغو - كينشاسا',now()),
('CF','+236','',true,'Central African Republic','جمهورية أفريقيا الوسطى',now()),
('CG','+242','',true,'Congo - Brazzaville','الكونغو - برازافيل',now()),
('CH','+41','',true,'Switzerland','سويسرا',now()),
('CI','+225','',true,'Côte d’Ivoire','ساحل العاج',now()),
('CL','+56','',true,'Chile','تشيلي',now()),
('CM','+237','',true,'Cameroon','الكاميرون',now()),
('CN','+86','',true,'China','الصين',now()),
('CO','+57','',true,'Colombia','كولومبيا',now()),
('CR','+506','',true,'Costa Rica','كوستاريكا',now()),
('CU','+53','',true,'Cuba','كوبا',now()),
('CV','+238','',true,'Cape Verde','الرأس الأخضر',now()),
('CY','+357','',true,'Cyprus','قبرص',now()),
('CZ','+420','',true,'Czechia','التشيك',now()),
('DE','+49','',true,'Germany','ألمانيا',now()),
('DJ','+253','',true,'Djibouti','جيبوتي',now()),
('DK','+45','',true,'Denmark','الدانمرك',now()),
('DM','+1','767',true,'Dominica','دومينيكا',now()),
('DO','+1','',true,'Dominican Republic','جمهورية الدومينيكان',now()),
('DZ','+213','',true,'Algeria','الجزائر',now()),
('EC','+593','',true,'Ecuador','الإكوادور',now()),
('EE','+372','',true,'Estonia','إستونيا',now()),
('EG','+20','',true,'Egypt','مصر',now()),
('ER','+291','',true,'Eritrea','إريتريا',now()),
('ES','+34','',true,'Spain','إسبانيا',now()),
('ET','+251','',true,'Ethiopia','إثيوبيا',now()),
('FI','+358','',true,'Finland','فنلندا',now()),
('FJ','+679','',true,'Fiji','فيجي',now()),
('FM','+691','',true,'Micronesia','ميكرونيزيا',now()),
('FO','+298','',true,'Faroe Islands','جزر فارو',now()),
('FR','+33','',true,'France','فرنسا',now()),
('GA','+241','',true,'Gabon','الغابون',now()),
('GB','+44','',true,'United Kingdom','المملكة المتحدة',now()),
('GD','+1','473',true,'Grenada','غرينادا',now()),
('GE','+995','',true,'Georgia','جورجيا',now()),
('GG','+44','1481',true,'Guernsey','غيرنزي',now()),
('GH','+233','',true,'Ghana','غانا',now()),
('GI','+350','',true,'Gibraltar','جبل طارق',now()),
('GM','+220','',true,'Gambia','غامبيا',now()),
('GN','+224','',true,'Guinea','غينيا',now()),
('GQ','+240','',true,'Equatorial Guinea','غينيا الاستوائية',now()),
('GR','+30','',true,'Greece','اليونان',now()),
('GT','+502','',true,'Guatemala','غواتيمالا',now()),
('GU','+1','671',true,'Guam','غوام',now()),
('GW','+245','',true,'Guinea-Bissau','غينيا بيساو',now()),
('GY','+592','',true,'Guyana','غيانا',now()),
('HK','+852','',true,'Hong Kong','هونغ كونغ',now()),
('HN','+504','',true,'Honduras','هندوراس',now()),
('HR','+385','',true,'Croatia','كرواتيا',now()),
('HT','+509','',true,'Haiti','هايتي',now()),
('HU','+36','',true,'Hungary','هنغاريا',now()),
('ID','+62','',true,'Indonesia','إندونيسيا',now()),
('IE','+353','',true,'Ireland','أيرلندا',now()),
('IL','+972','',true,'Israel','إسرائيل',now()),
('IN','+91','',true,'India','الهند',now()),
('IQ','+964','',true,'Iraq','العراق',now()),
('IR','+98','',true,'Iran','إيران',now()),
('IS','+354','',true,'Iceland','آيسلندا',now()),
('IT','+39','',true,'Italy','إيطاليا',now()),
('JM','+1','876',true,'Jamaica','جامايكا',now()),
('JO','+962','',true,'Jordan','الأردن',now()),
('JP','+81','',true,'Japan','اليابان',now()),
('KE','+254','',true,'Kenya','كينيا',now()),
('KG','+996','',true,'Kyrgyzstan','قيرغيزستان',now()),
('KH','+855','',true,'Cambodia','كمبوديا',now()),
('KI','+686','',true,'Kiribati','كيريباتي',now()),
('KM','+269','',true,'Comoros','جزر القمر',now()),
('KN','+1','869',true,'St. Kitts & Nevis','سانت كيتس ونيفيس',now()),
('KP','+850','',true,'North Korea','كوريا الشمالية',now()),
('KR','+82','',true,'South Korea','كوريا الجنوبية',now()),
('KW','+965','',true,'Kuwait','الكويت',now()),
('KZ','+7','',true,'Kazakhstan','كازاخستان',now()),
('LA','+856','',true,'Laos','لاوس',now()),
('LB','+961','',true,'Lebanon','لبنان',now()),
('LC','+1','758',true,'St. Lucia','سانت لوسيا',now()),
('LI','+423','',true,'Liechtenstein','ليختنشتاين',now()),
('LK','+94','',true,'Sri Lanka','سريلانكا',now()),
('LR','+231','',true,'Liberia','ليبيريا',now()),
('LS','+266','',true,'Lesotho','ليسوتو',now()),
('LT','+370','',true,'Lithuania','ليتوانيا',now()),
('LU','+352','',true,'Luxembourg','لوكسمبورغ',now()),
('LV','+371','',true,'Latvia','لاتفيا',now()),
('LY','+218','',true,'Libya','ليبيا',now()),
('MA','+212','',true,'Morocco','المغرب',now()),
('MC','+377','',true,'Monaco','موناكو',now()),
('MD','+373','',true,'Moldova','مولدوفا',now()),
('ME','+382','',true,'Montenegro','الجبل الأسود',now()),
('MG','+261','',true,'Madagascar','مدغشقر',now()),
('MH','+692','',true,'Marshall Islands','جزر مارشال',now()),
('MK','+389','',true,'North Macedonia','مقدونيا الشمالية',now()),
('ML','+223','',true,'Mali','مالي',now()),
('MM','+95','',true,'Myanmar (Burma)','ميانمار (بورما)',now()),
('MN','+976','',true,'Mongolia','منغوليا',now()),
('MO','+853','',true,'Macao','مكاو',now()),
('MR','+222','',true,'Mauritania','موريتانيا',now()),
('MT','+356','',true,'Malta','مالطا',now()),
('MU','+230','',true,'Mauritius','موريشيوس',now()),
('MV','+960','',true,'Maldives','جزر المالديف',now()),
('MW','+265','',true,'Malawi','ملاوي',now()),
('MX','+52','',true,'Mexico','المكسيك',now()),
('MY','+60','',true,'Malaysia','ماليزيا',now()),
('MZ','+258','',true,'Mozambique','موزمبيق',now()),
('NA','+264','',true,'Namibia','ناميبيا',now()),
('NE','+227','',true,'Niger','النيجر',now()),
('NG','+234','',true,'Nigeria','نيجيريا',now()),
('NI','+505','',true,'Nicaragua','نيكاراغوا',now()),
('NL','+31','',true,'Netherlands','هولندا',now()),
('NO','+47','',true,'Norway','النرويج',now()),
('NP','+977','',true,'Nepal','نيبال',now()),
('NR','+674','',true,'Nauru','ناورو',now()),
('NZ','+64','',true,'New Zealand','نيوزيلندا',now()),
('OM','+968','',true,'Oman','عُمان',now()),
('PA','+507','',true,'Panama','بنما',now()),
('PE','+51','',true,'Peru','بيرو',now()),
('PG','+675','',true,'Papua New Guinea','بابوا غينيا الجديدة',now()),
('PH','+63','',true,'Philippines','الفلبين',now()),
('PK','+92','',true,'Pakistan','باكستان',now()),
('PL','+48','',true,'Poland','بولندا',now()),
('PR','+1','787',true,'Puerto Rico','بورتوريكو',now()),
('PS','+970','',true,'Palestine','فلسطين',now()),
('PT','+351','',true,'Portugal','البرتغال',now()),
('PW','+680','',true,'Palau','بالاو',now()),
('PY','+595','',true,'Paraguay','باراغواي',now()),
('QA','+974','',true,'Qatar','قطر',now()),
('RO','+40','',true,'Romania','رومانيا',now()),
('RS','+381','',true,'Serbia','صربيا',now()),
('RU','+7','',true,'Russia','روسيا',now()),
('RW','+250','',true,'Rwanda','رواندا',now()),
('SA','+966','',true,'Saudi Arabia','المملكة العربية السعودية',now()),
('SB','+677','',true,'Solomon Islands','جزر سليمان',now()),
('SC','+248','',true,'Seychelles','سيشل',now()),
('SD','+249','',true,'Sudan','السودان',now()),
('SE','+46','',true,'Sweden','السويد',now()),
('SG','+65','',true,'Singapore','سنغافورة',now()),
('SI','+386','',true,'Slovenia','سلوفينيا',now()),
('SK','+421','',true,'Slovakia','سلوفاكيا',now()),
('SL','+232','',true,'Sierra Leone','سيراليون',now()),
('SM','+378','',true,'San Marino','سان مارينو',now()),
('SN','+221','',true,'Senegal','السنغال',now()),
('SO','+252','',true,'Somalia','الصومال',now()),
('SR','+597','',true,'Suriname','سورينام',now()),
('SS','+211','',true,'South Sudan','جنوب السودان',now()),
('ST','+239','',true,'São Tomé & Príncipe','ساو تومي وبرينسيبي',now()),
('SV','+503','',true,'El Salvador','السلفادور',now()),
('SY','+963','',true,'Syria','سوريا',now()),
('SZ','+268','',true,'Eswatini','إسواتيني',now()),
('TD','+235','',true,'Chad','تشاد',now()),
('TG','+228','',true,'Togo','توغو',now()),
('TH','+66','',true,'Thailand','تايلاند',now()),
('TJ','+992','',true,'Tajikistan','طاجيكستان',now()),
('TL','+670','',true,'Timor-Leste','تيمور - ليشتي',now()),
('TM','+993','',true,'Turkmenistan','تركمانستان',now()),
('TN','+216','',true,'Tunisia','تونس',now()),
('TO','+676','',true,'Tonga','تونغا',now()),
('TR','+90','',true,'Türkiye','تركيا',now()),
('TT','+1','868',true,'Trinidad & Tobago','ترينيداد وتوباغو',now()),
('TV','+688','',true,'Tuvalu','توفالو',now()),
('TW','+886','',true,'Taiwan','تايوان',now()),
('TZ','+255','',true,'Tanzania','تنزانيا',now()),
('UA','+380','',true,'Ukraine','أوكرانيا',now()),
('UG','+256','',true,'Uganda','أوغندا',now()),
('US','+1','',true,'United States','الولايات المتحدة',now()),
('UY','+598','',true,'Uruguay','أورغواي',now()),
('UZ','+998','',true,'Uzbekistan','أوزبكستان',now()),
('VA','+39','',true,'Vatican City','الفاتيكان',now()),
('VC','+1','784',true,'St. Vincent & Grenadines','سانت فنسنت وجزر غرينادين',now()),
('VE','+58','',true,'Venezuela','فنزويلا',now()),
('VN','+84','',true,'Vietnam','فيتنام',now()),
('VU','+678','',true,'Vanuatu','فانواتو',now()),
('WS','+685','',true,'Samoa','ساموا',now()),
('XK','+383','',true,'Kosovo','كوسوفو',now()),
('YE','+967','',true,'Yemen','اليمن',now()),
('ZA','+27','',true,'South Africa','جنوب أفريقيا',now()),
('ZM','+260','',true,'Zambia','زامبيا',now()),
('ZW','+263','',true,'Zimbabwe','زيمبابوي',now())
ON CONFLICT (code) DO UPDATE SET
  calling_code = EXCLUDED.calling_code,
  national_prefix = EXCLUDED.national_prefix,
  enabled = EXCLUDED.enabled,
  name_en = EXCLUDED.name_en,
  name_ar = EXCLUDED.name_ar,
  updated_at = now();

COMMIT;
