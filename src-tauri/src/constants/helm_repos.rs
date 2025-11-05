// Static list of Helm chart repositories to query without Helm CLI.
// You can later make this configurable per cluster/context.
pub static HELM_REPOS: &[&str] = &[
    "https://charts.bitnami.com/bitnami",
    "https://prometheus-community.github.io/helm-charts",
];
