"use client";

import React, { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Phase 1: BUTTON COMPONENT ────────────────────────────────────── */
type ButtonVariant = "primary-marigold" | "secondary-teal" | "destructive-chili" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary-marigold", children, className = "", ...props }, ref) => {
    let baseStyles =
      "relative font-display font-bold uppercase tracking-wider text-xs px-5 py-3 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
    let variantStyles = "";

    switch (variant) {
      case "primary-marigold":
        variantStyles =
          "bg-marigold text-base hover:bg-opacity-90 border-2 border-base shadow-[3px_3px_0px_0px_#0a1628] hover:shadow-[1px_1px_0px_0px_#0a1628] hover:translate-x-[2px] hover:translate-y-[2px] focus:ring-marigold";
        break;
      case "secondary-teal":
        variantStyles =
          "bg-teal text-primary hover:bg-opacity-90 border-2 border-base shadow-[3px_3px_0px_0px_#0a1628] hover:shadow-[1px_1px_0px_0px_#0a1628] hover:translate-x-[2px] hover:translate-y-[2px] focus:ring-teal";
        break;
      case "destructive-chili":
        variantStyles =
          "bg-chili text-primary hover:bg-opacity-90 border-2 border-base shadow-[3px_3px_0px_0px_#0a1628] hover:shadow-[1px_1px_0px_0px_#0a1628] hover:translate-x-[2px] hover:translate-y-[2px] focus:ring-chili";
        break;
      case "ghost":
        variantStyles =
          "bg-transparent text-primary hover:bg-surface hover:text-white border-2 border-transparent focus:ring-muted";
        break;
    }

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";


/* ─── Phase 1: CARD COMPONENT ──────────────────────────────────────── */
type CardVariant = "default" | "interactive" | "status";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

export const Card = ({ variant = "default", children, className = "", ...props }: CardProps) => {
  let baseStyles = "bg-surface border border-slate-800 rounded-lg p-5 text-left transition-all duration-300";
  let variantStyles = "";

  switch (variant) {
    case "interactive":
      variantStyles =
        "hover:border-marigold/50 hover:shadow-[0_0_15px_rgba(255,159,28,0.1)] cursor-pointer hover:scale-[1.01]";
      break;
    case "status":
      variantStyles = "border-l-4 border-l-teal";
      break;
    default:
      break;
  }

  return (
    <div className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};


/* ─── Phase 1: INPUT COMPONENT ─────────────────────────────────────── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label className="block text-[10px] uppercase font-bold tracking-wider text-muted font-display">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full bg-[#111322] border-2 border-slate-800 text-primary font-semibold text-xs px-4 py-3 rounded-md focus:outline-none focus:border-marigold transition-colors duration-200 placeholder-slate-600 ${
            error ? "border-chili focus:border-chili" : ""
          } ${className}`}
          {...props}
        />
        {error && <span className="text-[10px] font-bold text-chili">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";


/* ─── Phase 1: SELECT COMPONENT ────────────────────────────────────── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label className="block text-[10px] uppercase font-bold tracking-wider text-muted font-display">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`w-full bg-[#111322] border-2 border-slate-800 text-primary font-semibold text-xs px-4 py-3 rounded-md appearance-none focus:outline-none focus:border-marigold transition-colors duration-200 ${
              error ? "border-chili focus:border-chili" : ""
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface text-primary">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted">
            ▼
          </div>
        </div>
        {error && <span className="text-[10px] font-bold text-chili">{error}</span>}
      </div>
    );
  }
);
Select.displayName = "Select";


/* ─── Phase 1: DATE PICKER COMPONENT ────────────────────────────────── */
interface DatePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label className="block text-[10px] uppercase font-bold tracking-wider text-muted font-display">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="date"
          className={`w-full bg-[#111322] border-2 border-slate-800 text-primary font-semibold text-xs px-4 py-3 rounded-md focus:outline-none focus:border-marigold transition-colors duration-200 [color-scheme:dark] ${
            error ? "border-chili focus:border-chili" : ""
          } ${className}`}
          {...props}
        />
        {error && <span className="text-[10px] font-bold text-chili">{error}</span>}
      </div>
    );
  }
);
DatePicker.displayName = "DatePicker";


/* ─── Phase 1: BADGE COMPONENT ──────────────────────────────────────── */
type BadgeVariant = "upcoming" | "completed" | "cancelled" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export const Badge = ({ variant = "info", children, className = "" }: BadgeProps) => {
  let styles = "";
  switch (variant) {
    case "upcoming":
      styles = "bg-teal/15 text-teal border-teal/30";
      break;
    case "completed":
      styles = "bg-muted/15 text-muted border-muted/30";
      break;
    case "cancelled":
      styles = "bg-chili/15 text-chili border-chili/30";
      break;
    case "info":
    default:
      styles = "bg-marigold/15 text-marigold border-marigold/30";
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border font-display ${styles} ${className}`}
    >
      {children}
    </span>
  );
};


/* ─── Phase 1: SKELETON COMPONENT ───────────────────────────────────── */
type SkeletonVariant = "line" | "card" | "avatar";

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

export const Skeleton = ({ variant = "line", className = "" }: SkeletonProps) => {
  let styles = "bg-slate-800/50 animate-pulse";
  switch (variant) {
    case "avatar":
      styles += " rounded-full w-10 h-10";
      break;
    case "card":
      styles += " rounded-lg h-32 w-full";
      break;
    case "line":
    default:
      styles += " rounded h-4 w-full";
      break;
  }
  return <div className={`${styles} ${className}`} />;
};


/* ─── Phase 1: MODAL COMPONENT ──────────────────────────────────────── */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-base"
          />
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative bg-surface border-2 border-slate-800 rounded-lg max-w-lg w-full p-6 shadow-2xl text-left"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-display font-bold uppercase tracking-wider text-sm text-primary">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-muted hover:text-white transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto pr-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};


/* ─── Phase 1: STEP INDICATOR COMPONENT ──────────────────────────────── */
interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export const StepIndicator = ({ currentStep, steps }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-between w-full max-w-xl mx-auto my-6 px-4">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <React.Fragment key={step}>
            {/* Step Node */}
            <div className="flex flex-col items-center space-y-1.5 relative z-10">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-display font-bold text-xs transition-all duration-300 ${
                  isCompleted
                    ? "bg-teal border-teal text-base shadow-[0_0_10px_rgba(15,163,160,0.4)]"
                    : isActive
                    ? "bg-marigold border-marigold text-base shadow-[0_0_10px_rgba(255,159,28,0.4)]"
                    : "bg-surface border-slate-800 text-muted"
                }`}
              >
                {isCompleted ? "✓" : idx + 1}
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  isActive ? "text-marigold" : isCompleted ? "text-teal" : "text-muted"
                }`}
              >
                {step}
              </span>
            </div>

            {/* Connecting Bar */}
            {idx < steps.length - 1 && (
              <div className="flex-1 h-[2px] bg-slate-800 mx-2 -translate-y-4">
                <div
                  className="h-full bg-teal transition-all duration-500"
                  style={{ width: idx < currentStep ? "100%" : "0%" }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
