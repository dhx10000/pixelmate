"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useChatContext } from "@/context/ChatContext";
import type { ContactData } from "@/context/ChatContext";

// ── Types ──────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof ContactData, string>>;

// ── Field subcomponent ─────────────────────────────────────────────────────

function Field({
  label,
  id,
  type = "text",
  value,
  placeholder,
  required,
  error,
  onChange,
}: {
  label: string;
  id: keyof ContactData;
  type?: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  onChange: (id: keyof ContactData, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-medium"
        style={{ color: "#9A9590" }}
      >
        {label}
        {required && (
          <span className="ml-1" style={{ color: "#C8F560" }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(id, e.target.value)}
        className="pm-contact-input w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-text-muted"
        style={{
          background: "#1E1E24",
          border: `1px solid ${error ? "rgba(255,80,80,0.5)" : "rgba(255,255,255,0.06)"}`,
          color: "#E8E4DD",
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p
          id={`${id}-error`}
          className="text-xs"
          style={{ color: "rgba(255,100,100,0.9)" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ── Validation ─────────────────────────────────────────────────────────────

function validate(data: ContactData): FormErrors {
  const errors: FormErrors = {};
  if (!data.name.trim()) errors.name = "Name is required.";
  if (!data.company_name.trim()) errors.company_name = "Company name is required.";
  if (!data.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Please enter a valid email address.";
  }
  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ContactForm() {
  const { submitContact, contactData } = useChatContext();

  const [form, setForm] = useState<ContactData>({
    name: "",
    company_name: "",
    role: "",
    email: "",
    phone_or_messenger: "",
    website: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Once submitted (or if contact was already captured), show nothing
  if (submitted || contactData !== null) return null;

  function handleChange(id: keyof ContactData, value: string) {
    setForm((prev) => ({ ...prev, [id]: value }));
    // Clear the error for this field as the user types
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors = validate(form);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSubmitted(true);
    submitContact(form);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div
        className="rounded-2xl p-5"
        style={{
          background: "#18181C",
          border: "1px solid rgba(255,255,255,0.08)",
          marginTop: 4,
        }}
      >
        {/* Intro */}
        <p className="text-sm text-text-secondary mb-5 leading-relaxed">
          Almost there! Share your details so the PIXEL team can follow up.
        </p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {/* Row: Name + Company — stacks on mobile */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              id="name"
              value={form.name}
              placeholder="Your full name"
              required
              error={errors.name}
              onChange={handleChange}
            />
            <Field
              label="Company"
              id="company_name"
              value={form.company_name}
              placeholder="Your company"
              required
              error={errors.company_name}
              onChange={handleChange}
            />
          </div>

          {/* Role */}
          <Field
            label="Role"
            id="role"
            value={form.role}
            placeholder="e.g. Founder, CEO, Marketing Lead"
            error={errors.role}
            onChange={handleChange}
          />

          {/* Email */}
          <Field
            label="Email"
            id="email"
            type="email"
            value={form.email}
            placeholder="you@company.com"
            required
            error={errors.email}
            onChange={handleChange}
          />

          {/* Row: Phone + Website — stacks on mobile */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Phone or Messenger"
              id="phone_or_messenger"
              value={form.phone_or_messenger}
              placeholder="Telegram, WhatsApp, or phone"
              error={errors.phone_or_messenger}
              onChange={handleChange}
            />
            <Field
              label="Website"
              id="website"
              value={form.website}
              placeholder="Your current website if you have one"
              error={errors.website}
              onChange={handleChange}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full px-5 py-2.5 text-xs font-medium transition-opacity hover:opacity-85 active:opacity-70"
              style={{ background: "#C8F560", color: "#0A0A0C" }}
            >
              Send to PIXEL team
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
