import React from "react";

export const Input = React.forwardRef(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`h-9 w-full rounded-md border border-white/20 bg-black/20 px-3 text-sm text-white placeholder:text-white/50 outline-none focus:ring-2 focus:ring-white/30 ${className}`}
      {...props}
    />
  );
});

export default Input;