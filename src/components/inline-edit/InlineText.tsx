"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type InlineTextProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function InlineText({
  value,
  onChange,
  className,
  placeholder = "Click to edit...",
  disabled = false,
}: InlineTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    if (editValue.trim() !== value) {
      onChange(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (disabled) {
    return (
      <span className={cn("truncate", className)}>{value || placeholder}</span>
    );
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        className={cn(
          "bg-transparent border-b border-primary outline-none px-0 py-0 text-inherit font-inherit",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={cn(
        "truncate cursor-text hover:bg-muted/50 rounded px-1 -mx-1 transition-colors",
        !value && "text-muted-foreground italic",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {value || placeholder}
    </span>
  );
}
