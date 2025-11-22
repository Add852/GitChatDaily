"use client";

import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pt-6 pb-20 px-4 md:pt-4 md:pb-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 animate-fade-in" />
      
      {/* Modal */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-github-dark border border-github-dark-border rounded-lg shadow-xl max-h-[calc(100vh-8rem)] md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-down`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-github-dark-border">
          <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-github-dark-hover transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

