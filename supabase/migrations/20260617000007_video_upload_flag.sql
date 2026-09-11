-- Feature flag: video upload is gated by subscription plan (false by default).
-- TODO: when subscription system is built, set enable_video_upload = true on plan activation.
alter table families add column if not exists enable_video_upload boolean not null default false;
