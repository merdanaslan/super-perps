import { useId, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Selection changes immediately; only the decorative indicator moves. */
export function SelectionTabs<Value extends string>({
  value,
  options,
  onChange,
  label,
  className,
  variant = 'underline',
}: {
  value: Value;
  options: readonly { value: Value; label: ReactNode }[];
  onChange: (value: Value) => void;
  label: string;
  className: string;
  variant?: 'underline' | 'pill';
}) {
  const indicatorId = useId();
  const reduced = useReducedMotion();
  return (
    <motion.div
      layoutScroll
      role="group"
      aria-label={label}
      className={`${className} selection-tabs selection-tabs-${variant}`}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {value === option.value && (
            <motion.span
              aria-hidden="true"
              className="selection-indicator"
              layoutId={reduced ? undefined : indicatorId}
              initial={false}
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
          <span className="selection-label">{option.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
