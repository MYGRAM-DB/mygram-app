# MYGRAM shared ownership and contract register

**Integration target:** `rebuild/phase-a-architecture`  
**Contract owner:** W10 / Platform Contracts  
**Schema source of truth:** reviewed Staging migration files plus read-only schema inspection. Production is not a development target.

## File and interface ownership

| Surface | Single owner | Initial owned paths | Integration rule |
|---|---|---|---|
| Shared TypeScript contracts | W10 Platform | `src/contracts/**` | Other workshops consume contracts; they do not redefine shared row shapes |
| Product registry and routing | W10 Platform | `src/config/products.*`, `src/lib/navigation.ts` | Changes coordinated through W10 |
| Identity and profile UI | W10 Platform | `src/App.tsx`, `src/lib/supabase.ts` | Product teams request changes through a reviewed PR |
| FB feed and comments | W1 FB | `src/components/SocialFeedWorkspace.tsx`, FB tests | W1 owns the component and its tests |
| Messenger UI and client lifecycle | W2 Messenger | `src/components/MessengerWorkspace.tsx`, Messenger tests | W2 owns the component and its tests |
| Shared CI and quality gates | W10 Platform | `.github/workflows/ci.yml` | Central workflow only; product branches do not fork CI definitions |
| Staging authorization suite | Security / Gate A | `.github/workflows/staging-authz.yml`, `supabase/functions/qa-*`, security integration tests | Runs only from the protected integration branch; no PR-controlled OIDC job |
| Database migrations | Database / Security | `supabase/migrations/**` | One migration owner at a time; no schema changes in this W10 contract slice |
| Localization | W11 Localization | translation resources and locale tests | Shared key contracts coordinated with W10 |
| Media and private storage | W10 Platform Media, consumed by W2/W4/W7/W8 | verified bucket contracts only | Private buckets stay private; signed URL handling is server/client-contract scoped |

## Verified schema in this delivery

The TypeScript declarations in `src/contracts/database.ts` are limited to:

- `public_profiles` projection fields used by the current application query.
- `posts`, `post_comments` (including `parent_comment_id`), and `post_reactions`.
- `messenger_conversations`, `messenger_participants`, `messenger_messages`, and `messenger_attachments`.
- The exact argument names currently used for `complete_mygram_profile` and the observed `get_my_profile_state` return property.

The messenger column definitions are grounded in migration `20261030165820_create_messenger_direct_conversations_security.sql`. The nested-comment foreign key and field are grounded in `20261030022611_align_staging_core_schema_phase_1.sql`.

## Explicit schema gaps

No table, field, RPC, or authorization contract is fabricated for Meetings, AI quotas, notifications, moderation, audit events, Marketplace, or video processing. These remain **schema-pending** until the current Staging schema and authoritative migration source are inspected. Their service owners must submit evidence before W10 publishes those contracts.

## Ownership constraints

- A path has one owning workshop. Shared changes are proposed to that owner, not edited concurrently.
- Product PRs must target `rebuild/phase-a-architecture`, carry exact tested SHAs, and remain separate.
- CI runs browser/unit/build validation for PRs targeting integration.
- Staging JWT/AuthZ tests execute only from the protected integration branch in a separate workflow. PR-controlled code receives no OIDC permission.
- No Production writes, migrations, RLS relaxation, public private-storage access, or service-role credentials in browser code.
