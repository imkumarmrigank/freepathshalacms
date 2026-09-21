-- A rider: staff attached to one centre whose only business in the system is
-- showing that they were there. They check in and out at that centre, and that
-- is all they can reach.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','mentor','center_manager',
                  'teacher','backup_teacher','auditor','sports_teacher','rider'));
