ALTER TABLE users
  ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER display_name,
  ADD COLUMN can_create_group TINYINT(1) NOT NULL DEFAULT 0 AFTER approval_status;

UPDATE users
SET approval_status = 'approved'
WHERE approval_status IS NULL OR approval_status = '';
