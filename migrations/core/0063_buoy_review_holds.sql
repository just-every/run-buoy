-- A captured review may contain several customers' facts. Any linked hold
-- protects the shared record, including records created after the hold began.
CREATE VIEW buoy_review_hold_dependencies AS
 SELECT DISTINCT p.person_id, p.review_id, h.subject AS held_subject
 FROM buoy_review_people p JOIN buoy_review_people other ON other.review_id=p.review_id
 JOIN buoy_privacy_holds h ON h.person_id=other.person_id;
CREATE TRIGGER buoy_review_hold_guard BEFORE DELETE ON buoy_reviews
 WHEN EXISTS(SELECT 1 FROM buoy_review_people p JOIN buoy_privacy_holds h ON h.person_id=p.person_id WHERE p.review_id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'Business review contains held customer records'); END;
