# Config Shape

## Example Logical Config

- app_name
- timezone
- log_level
- database_path
- transport_adapter
- browser_worker_adapter
- llm_curation_enabled
- llm_provider_name
- source_sync_enabled
- source_sync_schedule
- catchup_enabled
- global_same_day_duplicate_block
- max_retry_attempts
- retry_base_delay_ms
- retry_max_delay_ms
- default_cooldown_days
- allow_same_quote_global_same_day

## Route Config
Each route should define:
- route_name
- enabled
- cron
- timezone
- target_type
- target_ref
- allowed_authors
- allowed_themes
- cooldown_days
- quiet_hours
- allow_same_quote_global_same_day

## Source Config
Each source should define:
- source_name
- author
- source_type
- url_or_path
- enabled
- fetch_mode_preference
- parsing_profile
- priority
