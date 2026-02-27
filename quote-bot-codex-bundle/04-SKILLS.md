# Skills

Skills are reusable task units each agent can call.

## Ingestion Skills
- fetch_direct_html
- fetch_browser_rendered
- extract_readable_text
- parse_transcript_blocks
- normalize_whitespace
- strip_navigation_noise

## Quote Skills
- split_sentences
- detect_quote_candidates
- normalize_author_name
- score_quote_quality
- classify_theme
- classify_tone
- compute_quote_hash
- compute_similarity

## Routing Skills
- filter_by_author
- filter_by_theme
- filter_by_tone
- enforce_global_cooldown
- enforce_target_cooldown
- pick_weighted_candidate

## Publishing Skills
- connect_transport
- resolve_target_id
- send_text_message
- retry_with_backoff
- record_send_event

## Persistence Skills
- load_config
- validate_config
- open_database
- run_migrations
- write_event_log
- mark_quote_sent
- refresh_source_state

## Health Skills
- check_transport_health
- check_db_health
- inspect_scheduler_drift
- detect_duplicate_send_window
- summarize_health_status

## Optional LLM Skills
- condense_passage_to_quote_candidates
- tag_quote_semantics
- flag_low-confidence_attribution

Rule:
Any LLM skill must be optional and must return advisory output only.
