# DATA_SCHEMA

Long format; UTC ISO-8601; immutable raw events plus derived tables.

## Core tables

### participants

`participant_id, consent_version, enrolled_at, rating, rating_source, platform, games_90d, hebrew_native, english_1_5, prior_tools_json, stratum, arm, allocation_id`

### product_freeze

`study_version, dl_commit_sha, competitor, competitor_plan, competitor_version_or_capture_date, capability_snapshot_url, item_bank_sha256, randomization_seed_hash`

### sessions

`session_id, participant_id, stage, scheduled_at, started_at, ended_at, device_class, viewport, network_class, active_seconds, idle_seconds, completed, deviation_code`

### item_responses

`response_id, participant_id, session_id, item_id, phase, shown_at, move_frozen_at, move_uci, reason_text, confidence_1_7, timed_out, accepted, trigger_label, distance_tier`

### outputs_for_raters

`output_id, participant_id, source_session_id, normalized_text, normalization_version, blind_key`

### ratings

`blind_key, rater_id, diagnostic_0_2, causal_0_2, boundary_0_2, actionable_0_2, overclaim_0_1, rated_at`

### product_events

`event_id, participant_id, session_id, product, event_name, occurred_at, foreground_ms, object_id_hash, error_code, product_caused, payload_schema_version`

### moderator_events

`event_id, participant_id, session_id, occurred_at, moderator_id, category, trigger, exact_words, resolution`

### future_games

`participant_id, game_hash, played_at, platform, time_control, rated, eligible_opportunities, recurrences, classifier_version, audit_label`

### free_choice

`participant_id, first_product_opened, first_meaningful_product, dl_active_seconds, baa_active_seconds, dl_sessions, baa_sessions, day7_return_product`

## Constraints

- `arm` immutable after allocation.
- no engine fields may be written before `move_frozen_at` in test sessions.
- accepted labels join only from frozen item bank.
- raw reason text is never overwritten by normalized rater text.
- account handles and direct URLs live only in the identity vault.
- each exclusion/deviation has one enumerated cause: participant, product, competitor, research infrastructure, moderator, data, unknown.
