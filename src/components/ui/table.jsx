import React from "react";

export function Table({ className = "", ...props }) {
  return (
    <table className={`w-full border-collapse text-left text-sm ${className}`} {...props} />
  );
}
export function Thead({ className = "", ...props }) {
  return <thead className={`text-white/70 ${className}`} {...props} />;
}
export function Tbody({ className = "", ...props }) {
  return <tbody className={className} {...props} />;
}
export function Tr({ className = "", ...props }) {
  return <tr className={`border-b border-white/10 ${className}`} {...props} />;
}
export function Th({ className = "", ...props }) {
  return (
    <th className={`sticky top-0 bg-neutral-900/70 px-3 py-2 font-medium ${className}`} {...props} />
  );
}
export function Td({ className = "", ...props }) {
  return <td className={`px-3 py-2 ${className}`} {...props} />;
}