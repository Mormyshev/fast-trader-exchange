"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({
  className = "",
  disabled,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
