-- Indexes for common filter/sort paths (lists, roster, points aggregation).
CREATE INDEX IF NOT EXISTS "User_classId_idx" ON "User"("classId");

CREATE INDEX IF NOT EXISTS "ViolationRecord_studentId_idx" ON "ViolationRecord"("studentId");
CREATE INDEX IF NOT EXISTS "ViolationRecord_createdAt_idx" ON "ViolationRecord"("createdAt");
CREATE INDEX IF NOT EXISTS "ViolationRecord_studentId_createdAt_idx" ON "ViolationRecord"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "ViolationRecord_violationTypeId_idx" ON "ViolationRecord"("violationTypeId");
CREATE INDEX IF NOT EXISTS "ViolationRecord_date_idx" ON "ViolationRecord"("date");
