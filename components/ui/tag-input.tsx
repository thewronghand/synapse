"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "./input";
import { Badge } from "./badge";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  variant?: "include" | "exclude";
  showHelper?: boolean;
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "태그 추가...",
  variant = "include",
  showHelper = false,
}: TagInputProps) {
  const colorClasses = variant === "include"
    ? "bg-primary/10 text-primary border border-primary hover:bg-primary/20"
    : "bg-destructive/10 text-destructive border border-destructive hover:bg-destructive/20";
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion) &&
      suggestion !== inputValue
  );

  // Add current input if it matches exactly
  const exactMatch = suggestions.find(
    (s) => s.toLowerCase() === inputValue.toLowerCase()
  );

  const displaySuggestions = inputValue.trim()
    ? filteredSuggestions.slice(0, 5)
    : [];

  useEffect(() => {
    setSelectedIndex(0);
    // Show suggestions when user types
    if (inputValue.trim() && displaySuggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [inputValue, displaySuggestions.length]);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onChange([...tags, trimmedTag]);
      setInputValue("");
      // Keep input focused and ready for next tag
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Ignore key events during IME composition (Korean, Japanese, Chinese input)
    if (isComposing) {
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (displaySuggestions.length > 0 && showSuggestions) {
        addTag(displaySuggestions[selectedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < displaySuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "," || e.key === " ") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    }
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    // After Korean input is complete, check for delimiters
    const value = e.currentTarget.value;
    if (value.includes(",") || value.includes(" ")) {
      // Extract the tag before the delimiter
      const parts = value.split(/[,\s]+/);
      const tagToAdd = parts[0].trim();
      if (tagToAdd) {
        addTag(tagToAdd);
        // Keep any remaining text after delimiter
        const remaining = parts.slice(1).join(" ").trim();
        setInputValue(remaining);
      }
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 p-2 border border-border rounded-lg min-h-[42px] bg-card focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
        {tags.map((tag) => (
          <Badge
            key={tag}
            className={`flex items-center gap-1 px-2 py-1 ${colorClasses}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={handleCompositionEnd}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && displaySuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
          {displaySuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 ${
                index === selectedIndex ? "bg-primary/20 text-primary" : ""
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {showHelper && (
        <p className="text-xs text-muted-foreground mt-1">
          Enter, 쉼표, 스페이스로 태그 추가
        </p>
      )}
    </div>
  );
}
