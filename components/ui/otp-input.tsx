'use client';

import { useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface OTPInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * OTP Input Component
 *
 * A 4-digit OTP input with individual boxes for each digit.
 * Features:
 * - Auto-focus next box on input
 * - Backspace navigation
 * - Paste support (splits OTP string)
 * - Keyboard navigation
 * - Numeric only input
 *
 * @example
 * const [otp, setOtp] = useState(['', '', '', '']);
 * <OTPInput value={otp} onChange={setOtp} length={4} />
 */
export function OTPInput({
  value,
  onChange,
  length = 4,
  disabled = false,
  autoFocus = true,
  className,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    // Only allow digits
    if (!/^\d*$/.test(char)) return;

    const newValue = [...value];
    newValue[index] = char.slice(-1); // Take only last character
    onChange(newValue);

    // Auto-focus next input if character was entered
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // If current box is empty, move to previous box
        inputRefs.current[index - 1]?.focus();
      }
    }
    // Handle left arrow
    else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle right arrow
    else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);

    // Only process if pasted data is all digits
    if (!/^\d+$/.test(pastedData)) return;

    const newValue = [...value];
    pastedData.split('').forEach((char, i) => {
      if (i < length) newValue[i] = char;
    });
    onChange(newValue);

    // Focus last filled box or last box
    const lastIndex = Math.min(pastedData.length, length) - 1;
    inputRefs.current[lastIndex]?.focus();
  };

  const handleFocus = (index: number) => {
    // Select all text on focus for easy replacement
    inputRefs.current[index]?.select();
  };

  return (
    <div className={cn('flex gap-2 justify-center', className)}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          className={cn(
            'w-12 h-14 text-center text-xl font-semibold rounded-lg border-2',
            'focus:border-primary focus:ring-2 focus:ring-primary/20',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'bg-background',
            value[index]
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-primary/50'
          )}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
