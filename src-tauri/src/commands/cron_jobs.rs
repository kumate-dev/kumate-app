//! CronJob commands (macro-generated).
//!
//! Generates: create_cron_job, update_cron_job, list_cron_jobs, watch_cron_jobs,
//! delete_cron_jobs, suspend_cron_job
use k8s_openapi::api::batch::v1::CronJob;

crate::k8s_namespaced_commands! {
    kind: CronJob,
    plural: "cron_jobs",
    create: create_cron_job,
    update: update_cron_job,
    list: list_cron_jobs,
    watch: watch_cron_jobs,
    delete: delete_cron_jobs,
}

crate::k8s_suspend_command! { kind: CronJob, suspend: suspend_cron_job }
