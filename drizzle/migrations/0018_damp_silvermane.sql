-- NULLABLE WITH NO DEFAULT, and here that is the whole of what the column has to say.
--
-- Every row already in this table was written before a transfer decision could name its transfer,
-- and null is the true statement about all of them: nobody recorded one. A default would assert
-- something about decisions nobody observed, which is the failure `0013`'s note is about.
--
-- No foreign key to `learning_transfers`, for `drill_id`'s reason: this record is append-only, so
-- a constraint that could refuse a write is a constraint that could lose a decision. The binding is
-- checked at the boundary in `commitDecision`, where a refusal can name what went wrong.
ALTER TABLE `decisions` ADD `transfer_id` varchar(64);
