INSERT INTO "PlanLimit" (
  "plan",
  "maxConcurrentSessions",
  "maxDevices",
  "sessionDurationMinutes",
  "fileTransfer",
  "sessionRecording",
  "teamMembers"
) VALUES
  ('TRIAL', 1, 3, 20160, true, false, 1),
  ('SOLO', 1, 10, 480, true, false, 2),
  ('PRO', 3, 50, 1440, true, false, 5),
  ('BUSINESS', 10, 200, 1440, true, true, 25),
  ('ENTERPRISE', -1, -1, -1, true, true, -1)
ON CONFLICT ("plan") DO UPDATE SET
  "maxConcurrentSessions" = EXCLUDED."maxConcurrentSessions",
  "maxDevices" = EXCLUDED."maxDevices",
  "sessionDurationMinutes" = EXCLUDED."sessionDurationMinutes",
  "fileTransfer" = EXCLUDED."fileTransfer",
  "sessionRecording" = EXCLUDED."sessionRecording",
  "teamMembers" = EXCLUDED."teamMembers";
