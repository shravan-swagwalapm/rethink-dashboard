import { NextResponse } from 'next/server';

/**
 * Standardized API response helpers.
 * Ensures consistent response format across all routes.
 */

/** Return a success response with JSON data */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/** Return an error response with a message */
export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

/** Return a 401 Unauthorized response */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** Return a 403 Forbidden response */
export function forbiddenResponse(message: string = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** Return a 404 Not Found response */
export function notFoundResponse(message: string = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Return a 400 Bad Request response */
export function badRequestResponse(message: string = 'Bad request') {
  return NextResponse.json({ error: message }, { status: 400 });
}
