/**
 * OTP Logging Service
 *
 * Centralized logging for OTP operations with proper observability.
 * Structured logs for monitoring, debugging, and security auditing.
 *
 * @module otp-logger
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  operation: string;
  identifier?: string;
  identifierType?: 'phone' | 'email';
  [key: string]: any;
}

/**
 * Mask sensitive data for logging
 * Shows first 3 and last 2 characters only
 */
function maskIdentifier(identifier: string): string {
  if (!identifier || identifier.length < 6) {
    return '***';
  }
  const first = identifier.slice(0, 3);
  const last = identifier.slice(-2);
  return `${first}***${last}`;
}

/**
 * Create structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext
): object {
  return {
    timestamp: new Date().toISOString(),
    level,
    service: 'otp-auth',
    message,
    ...context,
    // Mask sensitive data
    identifier: context.identifier ? maskIdentifier(context.identifier) : undefined,
  };
}

/**
 * Log OTP sent successfully
 */
export function logOTPSent(context: {
  identifier: string;
  identifierType: 'phone' | 'email';
  requestId?: string;
  expiresIn: number;
}) {
  const logEntry = createLogEntry('info', 'OTP sent successfully', {
    operation: 'send_otp',
    ...context,
  });

  console.log(JSON.stringify(logEntry));

  // TODO: Send to monitoring service (e.g., Sentry, LogRocket, DataDog)
  // await sendToMonitoring(logEntry);
}

/**
 * Log OTP verification attempt
 */
export function logOTPVerification(context: {
  identifier: string;
  identifierType: 'phone' | 'email';
  success: boolean;
  attemptNumber?: number;
  error?: string;
}) {
  const level: LogLevel = context.success ? 'info' : 'warn';
  const message = context.success
    ? 'OTP verified successfully'
    : 'OTP verification failed';

  const logEntry = createLogEntry(level, message, {
    operation: 'verify_otp',
    ...context,
  });

  console.log(JSON.stringify(logEntry));
}

/**
 * Log rate limit triggered
 */
export function logRateLimitTriggered(context: {
  identifier: string;
  identifierType: 'phone' | 'email';
  requestCount: number;
  blockedUntil?: Date;
}) {
  const logEntry = createLogEntry('warn', 'Rate limit triggered', {
    operation: 'rate_limit',
    ...context,
    blockedUntil: context.blockedUntil?.toISOString(),
  });

  console.warn(JSON.stringify(logEntry));

  // TODO: Alert security team for potential abuse
  // await alertSecurityTeam(logEntry);
}

/**
 * Log OTP resend
 */
export function logOTPResend(context: {
  identifier: string;
  identifierType: 'phone' | 'email';
  retryType: 'text' | 'voice';
  success: boolean;
}) {
  const level: LogLevel = context.success ? 'info' : 'error';
  const message = context.success ? 'OTP resent successfully' : 'OTP resend failed';

  const logEntry = createLogEntry(level, message, {
    operation: 'resend_otp',
    ...context,
  });

  console.log(JSON.stringify(logEntry));
}

/**
 * Log MSG91 API error
 */
export function logMSG91Error(context: {
  operation: 'send' | 'verify' | 'resend';
  identifier: string;
  error: string;
  statusCode?: number;
}) {
  const { operation, ...rest } = context;
  const logEntry = createLogEntry('error', 'MSG91 API error', {
    operation: `msg91_${operation}`,
    ...rest,
  });

  console.error(JSON.stringify(logEntry));

  // TODO: Alert on-call engineer if error rate > threshold
  // await checkErrorRateAndAlert(logEntry);
}

/**
 * Log session creation
 */
export function logSessionCreation(context: {
  userId: string;
  identifier: string;
  loginMode: 'user' | 'admin';
  success: boolean;
  error?: string;
}) {
  const level: LogLevel = context.success ? 'info' : 'error';
  const message = context.success
    ? 'Session created successfully'
    : 'Session creation failed';

  const logEntry = createLogEntry(level, message, {
    operation: 'create_session',
    ...context,
    userId: context.userId ? maskIdentifier(context.userId) : undefined,
  });

  console.log(JSON.stringify(logEntry));
}

/**
 * Log unexpected errors for debugging
 */
export function logUnexpectedError(context: {
  operation: string;
  error: Error | unknown;
  identifier?: string;
}) {
  const errorMessage = context.error instanceof Error
    ? context.error.message
    : String(context.error);

  const errorStack = context.error instanceof Error
    ? context.error.stack
    : undefined;

  const logEntry = createLogEntry('error', 'Unexpected error', {
    ...context,
    error: errorMessage,
    stack: errorStack,
  });

  console.error(JSON.stringify(logEntry));

  // TODO: Send to error tracking service
  // await sendToSentry(context.error, logEntry);
}

/**
 * Log security event (for audit trail)
 */
export function logSecurityEvent(context: {
  event: 'max_attempts_exceeded' | 'suspicious_activity' | 'account_locked';
  identifier: string;
  details: string;
}) {
  const logEntry = createLogEntry('warn', `Security event: ${context.event}`, {
    operation: 'security_event',
    ...context,
  });

  console.warn(JSON.stringify(logEntry));

  // TODO: Send to SIEM for security monitoring
  // await sendToSIEM(logEntry);
}

/**
 * Log metrics for monitoring dashboards
 */
export function logMetric(context: {
  metric: 'otp_sent' | 'otp_verified' | 'otp_failed' | 'rate_limited';
  value: number;
  tags?: Record<string, string>;
}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'metric',
    ...context,
  };

  console.log(JSON.stringify(logEntry));

  // TODO: Send to metrics service (e.g., DataDog, CloudWatch)
  // await sendMetric(context.metric, context.value, context.tags);
}
