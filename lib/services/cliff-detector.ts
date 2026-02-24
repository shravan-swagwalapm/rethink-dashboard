// ─────────────────────────────────────────────────────────────
// Cliff Detection Service
// Pure function that analyzes Zoom meeting participant departure
// patterns to detect when an instructor says "session is over"
// (mass exodus). The detected "cliff" timestamp becomes the
// effective session end so students aren't penalized for leaving
// when told to.
// ─────────────────────────────────────────────────────────────

export interface CliffDetectionResult {
  detected: boolean;
  reason?: string;
  confidence?: 'high' | 'medium' | 'low';
  effectiveEndMinutes?: number;
  cliffWindowStartMin?: number;
  cliffWindowEndMin?: number;
  departuresInCliff?: number;
  totalFinalDepartures?: number;
  meetingEndStayers?: number;
  totalParticipants?: number;
  cliffRatio?: number;
  spikeRatio?: number;
  studentsImpacted?: number;
  histogram?: { minute: number; departures: number; isCliff: boolean }[];
}

export interface ParticipantSegment {
  join_time: string; // ISO timestamp
  leave_time: string; // ISO timestamp
}

export interface ResolvedParticipantInput {
  userId: string | null;
  segments: ParticipantSegment[];
}

// ── Internal helpers ──────────────────────────────────────────

interface FinalDeparture {
  minutesMark: number;
}

const WINDOW_SIZE = 10; // minutes
const STAYER_THRESHOLD_MS = 2 * 60_000; // 2 minutes before meeting end

// ── Main detection function ──────────────────────────────────

export function detectFormalEnd(
  participants: ResolvedParticipantInput[],
  meetingStartTime: string,
  meetingEndTime: string,
): CliffDetectionResult {
  const meetingStart = new Date(meetingStartTime).getTime();
  const meetingEnd = new Date(meetingEndTime).getTime();
  const totalMeetingMinutes = (meetingEnd - meetingStart) / 60_000;

  // ── Step 2: Extract final departures ──────────────────────
  const finalDepartures: FinalDeparture[] = [];
  let stayers = 0;

  for (const participant of participants) {
    if (!participant.segments || participant.segments.length === 0) {
      continue;
    }

    // Sort segments by join_time ascending
    const sorted = [...participant.segments].sort(
      (a, b) => new Date(a.join_time).getTime() - new Date(b.join_time).getTime(),
    );

    const lastSegment = sorted[sorted.length - 1];
    const finalLeave = new Date(lastSegment.leave_time).getTime();

    if (finalLeave >= meetingEnd - STAYER_THRESHOLD_MS) {
      // Stayer – left within 2 min of meeting end (or after)
      stayers++;
    } else {
      const minutesMark = (finalLeave - meetingStart) / 60_000;
      finalDepartures.push({ minutesMark });
    }
  }

  const totalParticipants = finalDepartures.length + stayers;

  // ── Step 3: Early exits ───────────────────────────────────
  if (finalDepartures.length < 3) {
    return { detected: false, reason: 'TOO_FEW_DEPARTURES' };
  }
  if (totalParticipants < 5) {
    return { detected: false, reason: 'SESSION_TOO_SMALL' };
  }

  // ── Step 4: Sliding window scan ───────────────────────────
  const sortedDepartures = [...finalDepartures].sort(
    (a, b) => a.minutesMark - b.minutesMark,
  );

  const halfwayMark = totalMeetingMinutes * 0.5;

  let bestWindow = { startMin: 0, count: 0 };

  for (const d of sortedDepartures) {
    if (d.minutesMark < halfwayMark) continue;

    const windowEnd = d.minutesMark + WINDOW_SIZE;
    let count = 0;
    for (const other of sortedDepartures) {
      if (other.minutesMark >= d.minutesMark && other.minutesMark <= windowEnd) {
        count++;
      }
    }

    if (count > bestWindow.count) {
      bestWindow = { startMin: d.minutesMark, count };
    }
  }

  // ── Step 5: Validate cliff ────────────────────────────────
  const cliffRatio = bestWindow.count / finalDepartures.length;

  const nonCliffDepartures = finalDepartures.length - bestWindow.count;
  const nonCliffMinutes = totalMeetingMinutes - WINDOW_SIZE;
  const backgroundRate = nonCliffDepartures / nonCliffMinutes;
  const expectedInWindow = backgroundRate * WINDOW_SIZE;
  const spikeRatio = bestWindow.count / Math.max(expectedInWindow, 0.5);

  const minRatio = totalParticipants < 20 ? 0.30 : 0.25;
  const minAbsolute = totalParticipants < 20 ? 3 : 5;
  const minSpike = 2.5;

  if (cliffRatio < minRatio) {
    return { detected: false, reason: 'CLUSTER_TOO_SMALL' };
  }
  if (bestWindow.count < minAbsolute) {
    return { detected: false, reason: 'ABSOLUTE_COUNT_LOW' };
  }
  if (spikeRatio < minSpike) {
    return { detected: false, reason: 'NOT_ENOUGH_SPIKE' };
  }

  // ── Step 6: Effective end ─────────────────────────────────
  const effectiveEndMinutes = Math.round(bestWindow.startMin);

  // ── Step 7: Confidence ────────────────────────────────────
  let confidence: 'high' | 'medium' | 'low';
  if (cliffRatio >= 0.50 && bestWindow.count >= 8 && spikeRatio >= 5) {
    confidence = 'high';
  } else if (cliffRatio >= 0.35 || (bestWindow.count >= 6 && spikeRatio >= 3)) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // ── Step 8: Histogram ─────────────────────────────────────
  const cliffWindowStartMin = bestWindow.startMin;
  const cliffWindowEndMin = bestWindow.startMin + WINDOW_SIZE;

  const bucketSize = 5;
  const bucketCount = Math.ceil(totalMeetingMinutes / bucketSize);
  const histogram: { minute: number; departures: number; isCliff: boolean }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = i * bucketSize;
    const bucketEnd = bucketStart + bucketSize;

    let departures = 0;

    // Count voluntary departures in this bucket
    for (const dep of sortedDepartures) {
      if (dep.minutesMark >= bucketStart && dep.minutesMark < bucketEnd) {
        departures++;
      }
    }

    // Place stayers in the last bucket
    const isLastBucket = i === bucketCount - 1;
    if (isLastBucket) {
      departures += stayers;
    }

    // Mark buckets overlapping with [cliffWindowStart, cliffWindowEnd]
    const isCliff = bucketStart < cliffWindowEndMin && bucketEnd > cliffWindowStartMin;

    histogram.push({ minute: bucketStart, departures, isCliff });
  }

  // ── Step 9: Impact ────────────────────────────────────────
  let studentsImpacted = 0;
  for (const dep of sortedDepartures) {
    if (
      dep.minutesMark >= effectiveEndMinutes * 0.85 &&
      dep.minutesMark / totalMeetingMinutes < 0.95
    ) {
      studentsImpacted++;
    }
  }

  // ── Step 10: Return full result ───────────────────────────
  return {
    detected: true,
    confidence,
    effectiveEndMinutes,
    cliffWindowStartMin,
    cliffWindowEndMin,
    departuresInCliff: bestWindow.count,
    totalFinalDepartures: finalDepartures.length,
    meetingEndStayers: stayers,
    totalParticipants,
    cliffRatio,
    spikeRatio,
    studentsImpacted,
    histogram,
  };
}
