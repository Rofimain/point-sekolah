-- Samakan semua email ke lowercase agar cocok dengan login credentials.
-- (Login selalu menormalisasi email ke lowercase.)
UPDATE "User"
SET email = lower(email)
WHERE email <> lower(email);
