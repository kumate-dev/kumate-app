//! Job commands (macro-generated).
//!
//! Generates: create_job, update_job, list_jobs, watch_jobs, delete_jobs
use k8s_openapi::api::batch::v1::Job;

crate::k8s_namespaced_commands! {
    kind: Job,
    plural: "jobs",
    create: create_job,
    update: update_job,
    list: list_jobs,
    watch: watch_jobs,
    delete: delete_jobs,
}
