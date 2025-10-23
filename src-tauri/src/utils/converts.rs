use k8s_openapi::apimachinery::pkg::util::intstr::IntOrString;

pub(crate) fn int_or_string_to_string(value: &Option<IntOrString>) -> Option<String> {
    value.as_ref().map(|v| match v {
        IntOrString::Int(i) => i.to_string(),
        IntOrString::String(s) => s.clone(),
    })
}
