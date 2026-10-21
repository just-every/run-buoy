-- ADOPT-001: every report and consumer attributes the same exact reviewed claim.
-- Index the null-safe join as well as the canonical claim-key write lookup.
CREATE INDEX buoy_usage_mappings_claim_lookup
 ON buoy_usage_mappings(source_id,user_id,group_id);
