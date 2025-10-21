use serde::Serialize;

#[derive(Serialize, Clone)]
pub enum EventType {
    ADDED,
    MODIFIED,
    DELETED,
}
