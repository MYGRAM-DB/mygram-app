/**
 * MYGRAM shared contracts.
 *
 * This file intentionally models only columns and RPC arguments verified in
 * the committed Staging migration sources and the current React data queries.
 * Do not add a column here until its source migration or live Staging schema
 * has been reviewed.
 */
export type UUID = string;
export type ISODateTime = string;

export interface PublicProfileRow {
  id: UUID;
  username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface PostRow {
  id: UUID;
  user_id: UUID;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: ISODateTime;
}

export interface PostCommentRow {
  id: UUID;
  post_id: UUID;
  user_id: UUID;
  content: string;
  created_at: ISODateTime;
  parent_comment_id: UUID | null;
}

export interface PostReactionRow {
  id: UUID;
  post_id: UUID;
  user_id: UUID;
  reaction: string;
}

export type MessengerMessageType = "text" | "image" | "video" | "audio" | "file";

export interface MessengerConversationRow {
  id: UUID;
  user_low: UUID;
  user_high: UUID;
  created_by: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  last_message_at: ISODateTime | null;
}

export interface MessengerParticipantRow {
  conversation_id: UUID;
  user_id: UUID;
  role: "owner" | "member";
  joined_at: ISODateTime;
}

export interface MessengerMessageRow {
  id: UUID;
  conversation_id: UUID;
  sender_id: UUID;
  client_message_id: UUID | null;
  message_type: MessengerMessageType;
  body: string | null;
  created_at: ISODateTime;
}

export interface MessengerAttachmentRow {
  id: UUID;
  conversation_id: UUID;
  message_id: UUID;
  uploaded_by: UUID;
  object_path: string;
  mime_type: string;
  byte_size: number;
  created_at: ISODateTime;
}

export interface ProfilePrivateDetailsRow {
  user_id: UUID;
  date_of_birth: string;
  gender: "female" | "male" | "nonbinary" | "prefer_not_to_say" | null;
  nationality_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  verified_contact_method: "email" | "phone" | null;
  contact_verified_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface UserPreferencesRow {
  user_id: UUID;
  language_code: string;
  current_country_code: string | null;
  nationality_code: string | null;
  region: string | null;
  city_name: string | null;
  share_location: boolean;
  auto_detect_language: boolean;
  auto_detect_region: boolean;
  timezone_name: string | null;
  country_detection_source: "manual" | "browser_locale" | "ip_approximate" | "gps_consent" | null;
  language_detection_source: "manual" | "browser_locale" | "account_default" | null;
  location_consent_at: ISODateTime | null;
  updated_at: ISODateTime;
}

export interface SupportedCountryRow {
  code: string;
  calling_code: string | null;
  national_prefix: string;
  enabled: boolean;
  updated_at: ISODateTime;
  name_en: string | null;
  name_ar: string | null;
}

export interface SupportedLocaleRow {
  code: string;
  native_name: string;
  english_name: string;
  is_rtl: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: ISODateTime;
  enabled: boolean;
  updated_at: ISODateTime;
}

export interface UiTranslationCacheRow {
  source_locale: string;
  target_locale: string;
  translation_key: string;
  source_text: string;
  translated_text: string;
  provider: string;
  updated_at: ISODateTime;
}

export interface UiTranslationDailyUsageRow {
  usage_date: string;
  characters_used: number;
  updated_at: ISODateTime;
}

export type PrivateStorageBucketId = "profile-avatars" | "messenger-attachments";

export interface CompleteMygramProfileArgs {
  p_first_name: string;
  p_last_name: string;
  p_username: string;
  p_date_of_birth: string;
  p_gender: string | null;
  p_nationality_code: string | null;
  p_contact_phone: string | null;
  p_current_country_code: string | null;
  p_region: string | null;
  p_city_name: string | null;
  p_bio: string;
  p_interests: string[];
  p_share_location: boolean;
}

export interface MygramServiceContracts {
  identity: {
    get_my_profile_state: { Args: Record<string, never>; Returns: Record<string, unknown> };
    complete_mygram_profile: { Args: CompleteMygramProfileArgs; Returns: unknown };
    public_profiles: PublicProfileRow;
    profile_private_details: ProfilePrivateDetailsRow;
    user_preferences: UserPreferencesRow;
    supported_countries: SupportedCountryRow;
    supported_locales: SupportedLocaleRow;
  };
  social: {
    posts: PostRow;
    post_comments: PostCommentRow;
    post_reactions: PostReactionRow;
  };
  localization: {
    supported_locales: SupportedLocaleRow;
    ui_translation_cache: UiTranslationCacheRow;
    ui_translation_daily_usage: UiTranslationDailyUsageRow;
  };
  messenger: {
    messenger_conversations: MessengerConversationRow;
    messenger_participants: MessengerParticipantRow;
    messenger_messages: MessengerMessageRow;
    messenger_attachments: MessengerAttachmentRow;
  };
}

/**
 * These product surfaces have no verified, versioned schema contract in the
 * reviewed Staging migration set yet. Keep them explicitly unmapped rather
 * than fabricating table names, columns, RPCs, or authorization behavior.
 */
export type SchemaPendingService =
  | "meetings"
  | "ai"
  | "notifications"
  | "translation"
  | "moderation"
  | "audit"
  | "marketplace"
  | "video-processing";

export const SCHEMA_PENDING_SERVICES: readonly SchemaPendingService[] = [
  "meetings",
  "ai",
  "notifications",
  "translation",
  "moderation",
  "audit",
  "marketplace",
  "video-processing",
];
