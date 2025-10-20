pub struct Bytes;

impl Bytes {
    pub fn qty_to_bytes(s: &str) -> Option<f64> {
        let s: &str = s.trim();
        if s.is_empty() {
            return None;
        }
        // Kubernetes quantity examples: 1024Ki, 64Mi, 5Gi, 1Ti, also plain numbers
        let mut num_part: String = String::new();
        let mut unit_part: String = String::new();
        for c in s.chars() {
            if c.is_ascii_digit() || c == '.' {
                num_part.push(c);
            } else {
                unit_part.push(c);
            }
        }
        let val: f64 = num_part.parse().ok()?;
        let bytes: f64 = match unit_part.as_str() {
            "Ki" | "K" | "k" => val * 1024.0,
            "Mi" | "M" | "m" => val * 1024.0 * 1024.0,
            "Gi" | "G" | "g" => val * 1024.0 * 1024.0 * 1024.0,
            "Ti" | "T" | "t" => val * 1024.0 * 1024.0 * 1024.0 * 1024.0,
            "Pi" | "P" | "p" => val * 1024.0_f64.powi(5),
            "Ei" | "E" | "e" => val * 1024.0_f64.powi(6),
            "" => val, // already bytes
            _ => return None,
        };
        Some(bytes)
    }

    pub fn format_bytes_decimal(bytes: f64) -> String {
        const KB: f64 = 1000.0;
        const MB: f64 = KB * 1000.0;
        const GB: f64 = MB * 1000.0;
        const TB: f64 = GB * 1000.0;

        if bytes >= TB {
            return format!("{:.2} TB", bytes / TB);
        }
        if bytes >= GB {
            return format!("{:.2} GB", bytes / GB);
        }
        if bytes >= MB {
            return format!("{:.2} MB", bytes / MB);
        }
        if bytes >= KB {
            return format!("{:.2} KB", bytes / KB);
        }
        format!("{:.0} B", bytes)
    }

    pub fn pretty_size(q: &str) -> String {
        match Self::qty_to_bytes(q) {
            Some(b) => Self::format_bytes_decimal(b),
            None => q.to_string(),
        }
    }
}
