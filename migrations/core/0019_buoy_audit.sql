-- BOUNDARY-004 (AUDIT-001 builds on it): durable audit rows keep an opaque subject
-- reference and no account foreign key, so they outlive the subject's erasure.
CREATE TABLE buoy_audit (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, subject TEXT NOT NULL,
 detail TEXT NOT NULL, occurred_at TEXT NOT NULL
);
CREATE INDEX buoy_audit_time ON buoy_audit(occurred_at);
