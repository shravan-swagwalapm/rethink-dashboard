/**
 * OTP Input Validation and Sanitization Service
 *
 * Provides robust input validation and sanitization for OTP authentication.
 * Prevents injection attacks and ensures data integrity.
 *
 * @module otp-validator
 */

import { z } from 'zod';

/**
 * Phone number validation regex
 * Supports international format with country code
 */
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

/**
 * Email validation (using Zod's built-in validator)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * OTP validation (4 digits)
 */
const OTP_REGEX = /^\d{4}$/;

/**
 * Sanitize phone number
 * - Remove all non-digit characters except leading +
 * - Validate format
 * - Add country code if missing (assumes India +91)
 *
 * @param phone - Raw phone number input
 * @returns Sanitized phone number with country code
 * @throws Error if phone number is invalid
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  // Remove whitespace
  let cleaned = phone.trim();

  // Remove all characters except digits and +
  cleaned = cleaned.replace(/[^\d+]/g, '');

  // Remove + from middle/end (only allow at start)
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/\+/g, '');
  if (hasPlus) {
    cleaned = '+' + cleaned;
  }

  // Validate length (E.164 format: max 15 digits including country code)
  if (cleaned.replace('+', '').length > 15) {
    throw new Error('Phone number is too long');
  }

  if (cleaned.replace('+', '').length < 10) {
    throw new Error('Phone number is too short');
  }

  // Add country code if missing (10 digits = Indian number)
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    cleaned = '+91' + cleaned;
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Final validation
  if (!PHONE_REGEX.test(cleaned)) {
    throw new Error('Invalid phone number format');
  }

  return cleaned;
}

/**
 * Sanitize email address
 * - Trim whitespace
 * - Convert to lowercase
 * - Validate format
 *
 * @param email - Raw email input
 * @returns Sanitized email address
 * @throws Error if email is invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email) {
    throw new Error('Email is required');
  }

  const cleaned = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(cleaned)) {
    throw new Error('Invalid email format');
  }

  // Additional security: prevent SQL injection attempts
  if (cleaned.includes('--') || cleaned.includes(';') || cleaned.includes('/*')) {
    throw new Error('Invalid email format');
  }

  return cleaned;
}

/**
 * Validate OTP code
 * - Must be exactly 4 digits
 * - No special characters
 *
 * @param otp - OTP code to validate
 * @returns Boolean indicating if OTP is valid
 */
export function validateOTP(otp: string): boolean {
  if (!otp) return false;
  return OTP_REGEX.test(otp.trim());
}

/**
 * Sanitize identifier based on type
 *
 * @param identifier - Phone or email
 * @param type - Identifier type
 * @returns Sanitized identifier
 * @throws Error if validation fails
 */
export function sanitizeIdentifier(
  identifier: string,
  type: 'phone' | 'email'
): string {
  if (type === 'phone') {
    return sanitizePhoneNumber(identifier);
  } else {
    return sanitizeEmail(identifier);
  }
}

/**
 * Zod schemas for API validation
 */
export const sendOTPSchema = z.object({
  identifier: z.string().min(1, 'Phone number is required'),
  identifierType: z.literal('phone'),
});

export const verifyOTPSchema = z.object({
  identifier: z.string().min(1, 'Phone number is required'),
  identifierType: z.literal('phone'),
  otp: z.string().length(4, 'OTP must be 4 digits').regex(/^\d{4}$/, 'OTP must contain only digits'),
  loginMode: z.enum(['user', 'admin']).optional().default('user'),
});

export const resendOTPSchema = z.object({
  identifier: z.string().min(1, 'Phone number is required'),
  identifierType: z.literal('phone'),
  retryType: z.enum(['text', 'voice']).optional().default('text'),
});

/**
 * Validate and sanitize send OTP request
 */
export function validateSendOTPRequest(body: unknown) {
  const validated = sendOTPSchema.parse(body);
  return {
    ...validated,
    identifier: sanitizePhoneNumber(validated.identifier),
  };
}

/**
 * Validate and sanitize verify OTP request
 */
export function validateVerifyOTPRequest(body: unknown) {
  const validated = verifyOTPSchema.parse(body);

  if (!validateOTP(validated.otp)) {
    throw new Error('Invalid OTP format');
  }

  return {
    ...validated,
    identifier: sanitizePhoneNumber(validated.identifier),
  };
}

/**
 * Validate and sanitize resend OTP request
 */
export function validateResendOTPRequest(body: unknown) {
  const validated = resendOTPSchema.parse(body);
  return {
    ...validated,
    identifier: sanitizePhoneNumber(validated.identifier),
  };
}
