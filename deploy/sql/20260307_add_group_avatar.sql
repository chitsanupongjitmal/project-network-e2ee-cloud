ALTER TABLE `groups`
ADD COLUMN IF NOT EXISTS `avatar_url` varchar(255) DEFAULT NULL AFTER `name`;
