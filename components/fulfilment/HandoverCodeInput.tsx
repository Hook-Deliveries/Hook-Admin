"use client";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const HANDOVER_CODE_LENGTH = 4;

/**
 * Four boxes for the handover code written on a package. Digits only, a numeric
 * keypad on phones and tablets, paste works, and it calls onComplete when the
 * fourth digit lands so Hub staff do not need to find a button.
 */
export function HandoverCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  ariaLabel = "Handover code",
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  return (
    <InputOTP
      maxLength={HANDOVER_CODE_LENGTH}
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      value={value}
      disabled={disabled}
      onChange={(next) => onChange(next.replace(/\D/g, "").slice(0, HANDOVER_CODE_LENGTH))}
      onComplete={onComplete}
    >
      <InputOTPGroup>
        {Array.from({ length: HANDOVER_CODE_LENGTH }, (_, index) => (
          <InputOTPSlot key={index} index={index} aria-invalid={invalid || undefined} className="size-10 text-base font-semibold" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
