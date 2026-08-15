//! LimitRange commands (macro-generated).
//!
//! Generates: create_limit_range, update_limit_range, list_limit_ranges,
//! watch_limit_ranges, delete_limit_ranges
use k8s_openapi::api::core::v1::LimitRange;

crate::k8s_namespaced_commands! {
    kind: LimitRange,
    plural: "limit_ranges",
    create: create_limit_range,
    update: update_limit_range,
    list: list_limit_ranges,
    watch: watch_limit_ranges,
    delete: delete_limit_ranges,
}
