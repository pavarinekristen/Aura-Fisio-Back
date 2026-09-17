ALTER TABLE "patient_intake" ADD CONSTRAINT "intake_pain_range" CHECK (pain_intensity BETWEEN 0 AND 10);
ALTER TABLE "clinical_sessions" ADD CONSTRAINT "session_pain_range" CHECK (pain_level BETWEEN 0 AND 10);
ALTER TABLE "clinical_sessions" ADD CONSTRAINT "session_number_positive" CHECK (session_number > 0);
ALTER TABLE "workout_checkins" ADD CONSTRAINT "checkin_pain_range" CHECK (pain_reported BETWEEN 0 AND 10);
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_date_order" CHECK (end_date > start_date);
