BEGIN;

INSERT INTO "PlanLimit" (
  plan,
  "maxConcurrentSessions",
  "maxDevices",
  "sessionDurationMinutes",
  "fileTransfer",
  "sessionRecording",
  "teamMembers"
)
VALUES
  ('TRIAL',      1,  3, -1, TRUE, FALSE,  1),
  ('SOLO',       1, 10, -1, TRUE, FALSE,  2),
  ('PRO',        3, 50, -1, TRUE, FALSE,  5),
  ('BUSINESS',  10, 200, -1, TRUE, TRUE, 25),
  ('ENTERPRISE', -1, -1, -1, TRUE, TRUE, -1)
ON CONFLICT (plan) DO UPDATE SET
  "maxConcurrentSessions" = EXCLUDED."maxConcurrentSessions",
  "maxDevices" = EXCLUDED."maxDevices",
  "sessionDurationMinutes" = EXCLUDED."sessionDurationMinutes",
  "fileTransfer" = EXCLUDED."fileTransfer",
  "sessionRecording" = EXCLUDED."sessionRecording",
  "teamMembers" = EXCLUDED."teamMembers";

COMMIT;

SELECT
  plan,
  "maxConcurrentSessions",
  "maxDevices",
  "sessionDurationMinutes",
  "fileTransfer",
  "sessionRecording",
  "teamMembers"
FROM "PlanLimit"
ORDER BY plan;
