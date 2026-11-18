-- File bytes now live in the database. Rows created before this change get
-- an empty value (their bytes were on local disk and are not migrated).
ALTER TABLE "files" ADD COLUMN "data" "bytea" DEFAULT ''::bytea NOT NULL;
