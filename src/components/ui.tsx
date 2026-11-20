import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/** Plain Tailwind primitives (spec asks for shadcn/ui; see README deviations).
 *  Every color pair meets WCAG AA on --surface, and no meaning is carried by
 *  color alone (icon + text always). */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium " +
  "disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-raised)]",
  ghost: "bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]",
  danger: "bg-[var(--danger)] text-white hover:opacity-90",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <a
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...props}
    />
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
  role,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  role?: string;
}) {
  return (
    <Tag
      role={role}
      className={cx(
        "bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--text)]">
        {label}
        {required ? (
          <span className="text-[var(--danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}
      {error && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_BASE =
  "w-full h-11 px-3 rounded-[var(--radius)] border border-[var(--border-strong)] " +
  "bg-[var(--surface)] text-[var(--text)] text-sm placeholder:text-[var(--text-faint)] " +
  "focus:border-[var(--brand)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--brand)]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(INPUT_BASE, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(INPUT_BASE, "h-auto min-h-24 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(INPUT_BASE, "appearance-none pe-8", className)} {...props}>
      {children}
    </select>
  );
}

/** Badge: neutral container; color variants always pair icon+text (spec 11.2). */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border)]",
    brand: "bg-[var(--brand-soft)] text-[var(--brand-strong)] border-transparent",
    success: "bg-[var(--success-soft)] text-[var(--success)] border-transparent",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-transparent",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-transparent",
    accent: "bg-[var(--accent-soft)] text-[var(--warning)] border-transparent",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
      <svg
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-[var(--radius)] bg-[var(--surface-sunken)]", className)}
      aria-hidden="true"
    />
  );
}
