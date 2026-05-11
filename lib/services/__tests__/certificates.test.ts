/**
 * Red-phase TDD tests for the cohort-certificates service module.
 *
 * Pins the contract for `replaceCertificate`, `deleteCertificate`, and
 * `issueCertSignedUrl`. The service runs against the service-role Supabase
 * client (RLS bypassed at the route layer by `verifyAdmin`/owner checks), so
 * the tests pin behavior at the service surface — validation, storage I/O,
 * DB upsert/delete, and rollback semantics on partial failure.
 *
 * Tests (Phase 1, 8 minimum):
 *   1. replaceCertificate happy path — no prior cert.
 *   2. replaceCertificate happy path — prior cert exists (idempotent upsert).
 *   3. replaceCertificate oversized file — no storage call.
 *   4. replaceCertificate invalid mime — no storage call.
 *   5. replaceCertificate storage upload fails — no DB upsert call.
 *   6. replaceCertificate DB upsert fails — storage.remove called for cleanup.
 *   7. deleteCertificate happy path — storage.remove + DB delete invoked.
 *   8. issueCertSignedUrl denies when requester is not the cert owner.
 *
 * Globals (`describe`, `it`, `expect`, `vi`) provided by vitest.config.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  replaceCertificate,
  deleteCertificate,
  issueCertSignedUrl,
  type CertificateFileInput,
} from '@/lib/services/certificates';

type TableOp = 'upsert' | 'delete' | 'select_single';
type StorageOp = 'upload' | 'remove' | 'createSignedUrl';
type CannedResponse = { data?: unknown; error: unknown };
type ResponseSource = CannedResponse | (() => CannedResponse);

interface TableCallRecord {
  kind: 'table';
  table: string;
  op: TableOp;
  args: unknown[];
}

interface StorageCallRecord {
  kind: 'storage';
  bucket: string;
  op: StorageOp;
  args: unknown[];
}

type CallRecord = TableCallRecord | StorageCallRecord;

function makeMockAdminClient(config: {
  tables?: Record<string, Partial<Record<TableOp, ResponseSource>>>;
  storage?: Record<string, Partial<Record<StorageOp, ResponseSource>>>;
}): { client: SupabaseClient; calls: CallRecord[] } {
  const calls: CallRecord[] = [];

  function resolveTable(table: string, op: TableOp): CannedResponse {
    const src = config.tables?.[table]?.[op];
    if (!src) return { data: null, error: null };
    return typeof src === 'function' ? src() : src;
  }

  function resolveStorage(bucket: string, op: StorageOp): CannedResponse {
    const src = config.storage?.[bucket]?.[op];
    if (!src) return { data: null, error: null };
    return typeof src === 'function' ? src() : src;
  }

  // Builder for table query chains. Captures the terminal op + supports
  // `.select().single()` chaining for read paths.
  function buildTableThenable(
    table: string,
    op: TableOp,
    initialResponse: CannedResponse,
  ) {
    const builder: Record<string, unknown> = {};
    const passthrough = () => builder;
    builder.eq = passthrough;
    builder.in = passthrough;
    builder.is = passthrough;
    builder.select = passthrough;
    // .single() terminates with a separate canned response slot — but for
    // simplicity we route through the same `select_single` key.
    builder.single = () => {
      const singleResponse = resolveTable(table, 'select_single');
      return Promise.resolve(singleResponse);
    };
    builder.maybeSingle = () => {
      const singleResponse = resolveTable(table, 'select_single');
      return Promise.resolve(singleResponse);
    };
    builder.then = (
      onFulfilled: (v: CannedResponse) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(initialResponse).then(onFulfilled, onRejected);
    // void ref for op (kept for symmetry / future expansion)
    void op;
    return builder;
  }

  const fromSpy = vi.fn((table: string) => ({
    upsert: (...args: unknown[]) => {
      calls.push({ kind: 'table', table, op: 'upsert', args });
      return buildTableThenable(table, 'upsert', resolveTable(table, 'upsert'));
    },
    delete: (...args: unknown[]) => {
      calls.push({ kind: 'table', table, op: 'delete', args });
      return buildTableThenable(table, 'delete', resolveTable(table, 'delete'));
    },
    select: (...args: unknown[]) => {
      // Read path: select(...).eq(...).single()
      calls.push({ kind: 'table', table, op: 'select_single', args });
      return buildTableThenable(
        table,
        'select_single',
        resolveTable(table, 'select_single'),
      );
    },
  }));

  const storageFromSpy = vi.fn((bucket: string) => ({
    upload: (...args: unknown[]) => {
      calls.push({ kind: 'storage', bucket, op: 'upload', args });
      return Promise.resolve(resolveStorage(bucket, 'upload'));
    },
    remove: (...args: unknown[]) => {
      calls.push({ kind: 'storage', bucket, op: 'remove', args });
      return Promise.resolve(resolveStorage(bucket, 'remove'));
    },
    createSignedUrl: (...args: unknown[]) => {
      calls.push({ kind: 'storage', bucket, op: 'createSignedUrl', args });
      return Promise.resolve(resolveStorage(bucket, 'createSignedUrl'));
    },
  }));

  const client = {
    from: fromSpy,
    storage: { from: storageFromSpy },
  } as unknown as SupabaseClient;

  return { client, calls };
}

function makeFile(overrides: Partial<CertificateFileInput> = {}): CertificateFileInput {
  return {
    type: overrides.type ?? 'application/pdf',
    size: overrides.size ?? 1024,
    arrayBuffer:
      overrides.arrayBuffer ??
      (async () => new ArrayBuffer(overrides.size ?? 1024)),
  };
}

describe('replaceCertificate', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const cohortId = '22222222-2222-2222-2222-222222222222';
  const uploadedBy = '33333333-3333-3333-3333-333333333333';
  const certificatesBucket = 'certificates';

  it('Test 1 — happy path: no prior cert, uploads and inserts row', async () => {
    const mock = makeMockAdminClient({
      tables: {
        cohort_certificates: {
          upsert: { error: null },
          select_single: {
            data: {
              id: 'cert-new-1',
              file_path: `${cohortId}/${userId}.pdf`,
            },
            error: null,
          },
        },
      },
      storage: {
        certificates: {
          upload: { error: null, data: { path: `${cohortId}/${userId}.pdf` } },
        },
      },
    });

    const result = await replaceCertificate(mock.client, {
      userId,
      cohortId,
      file: makeFile({ type: 'application/pdf', size: 2048 }),
      uploadedBy,
    });

    expect(result).toMatchObject({
      ok: true,
      row: { id: 'cert-new-1', file_path: `${cohortId}/${userId}.pdf` },
    });

    const uploads = mock.calls.filter(
      (c): c is StorageCallRecord =>
        c.kind === 'storage' && c.op === 'upload' && c.bucket === certificatesBucket,
    );
    expect(uploads).toHaveLength(1);
    expect(uploads[0].args[0]).toBe(`${cohortId}/${userId}.pdf`);

    const upserts = mock.calls.filter(
      (c): c is TableCallRecord =>
        c.kind === 'table' &&
        c.op === 'upsert' &&
        c.table === 'cohort_certificates',
    );
    expect(upserts).toHaveLength(1);
    const upsertRow = upserts[0].args[0] as Record<string, unknown>;
    expect(upsertRow).toMatchObject({
      user_id: userId,
      cohort_id: cohortId,
      file_path: `${cohortId}/${userId}.pdf`,
      file_type: 'application/pdf',
      file_size: 2048,
      uploaded_by: uploadedBy,
    });
  });

  it('Test 2 — happy path: existing cert replaced (idempotent upsert at same path)', async () => {
    const mock = makeMockAdminClient({
      tables: {
        cohort_certificates: {
          upsert: { error: null },
          select_single: {
            data: {
              id: 'cert-existing-1',
              file_path: `${cohortId}/${userId}.png`,
            },
            error: null,
          },
        },
      },
      storage: {
        certificates: {
          upload: { error: null, data: { path: `${cohortId}/${userId}.png` } },
        },
      },
    });

    const result = await replaceCertificate(mock.client, {
      userId,
      cohortId,
      file: makeFile({ type: 'image/png', size: 4096 }),
      uploadedBy,
    });

    expect(result).toMatchObject({
      ok: true,
      row: { id: 'cert-existing-1', file_path: `${cohortId}/${userId}.png` },
    });

    const uploads = mock.calls.filter(
      (c): c is StorageCallRecord => c.kind === 'storage' && c.op === 'upload',
    );
    expect(uploads).toHaveLength(1);
    expect(uploads[0].args[0]).toBe(`${cohortId}/${userId}.png`);
    // upload uses upsert:true so the same path overwrites cleanly
    const uploadOpts = uploads[0].args[2] as { upsert?: boolean } | undefined;
    expect(uploadOpts?.upsert).toBe(true);
  });

  it('Test 3 — oversized file: returns validate/too_large, no storage call', async () => {
    const mock = makeMockAdminClient({});

    const tooBig = 10 * 1024 * 1024 + 1; // 10 MB + 1 byte
    const result = await replaceCertificate(mock.client, {
      userId,
      cohortId,
      file: makeFile({ type: 'application/pdf', size: tooBig }),
      uploadedBy,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { stage: 'validate', reason: 'too_large' },
    });

    const storageCalls = mock.calls.filter((c) => c.kind === 'storage');
    expect(storageCalls).toHaveLength(0);
    const tableCalls = mock.calls.filter((c) => c.kind === 'table');
    expect(tableCalls).toHaveLength(0);
  });

  it('Test 4 — invalid mime: returns validate/invalid_type, no storage call', async () => {
    const mock = makeMockAdminClient({});

    const result = await replaceCertificate(mock.client, {
      userId,
      cohortId,
      file: makeFile({ type: 'image/gif', size: 1024 }),
      uploadedBy,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { stage: 'validate', reason: 'invalid_type' },
    });

    const storageCalls = mock.calls.filter((c) => c.kind === 'storage');
    expect(storageCalls).toHaveLength(0);
    const tableCalls = mock.calls.filter((c) => c.kind === 'table');
    expect(tableCalls).toHaveLength(0);
  });

  it('Test 5 — storage upload fails: returns storage_upload, no DB upsert', async () => {
    const mock = makeMockAdminClient({
      storage: {
        certificates: {
          upload: { error: { message: 'storage offline' } },
        },
      },
    });

    const result = await replaceCertificate(mock.client, {
      userId,
      cohortId,
      file: makeFile({ type: 'application/pdf', size: 1024 }),
      uploadedBy,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { stage: 'storage_upload' },
    });

    const upserts = mock.calls.filter(
      (c) => c.kind === 'table' && c.op === 'upsert',
    );
    expect(upserts).toHaveLength(0);
    const removes = mock.calls.filter(
      (c) => c.kind === 'storage' && c.op === 'remove',
    );
    expect(removes).toHaveLength(0);
  });

  it('Test 6 — DB upsert fails after storage upload: cleanup remove called, error surfaced', async () => {
    const mock = makeMockAdminClient({
      tables: {
        cohort_certificates: {
          upsert: { error: { message: 'unique violation on (user_id, cohort_id)' } },
        },
      },
      storage: {
        certificates: {
          upload: { error: null, data: { path: `${cohortId}/${userId}.pdf` } },
          remove: { error: null },
        },
      },
    });

    const result = await replaceCertificate(mock.client, {
      userId,
      cohortId,
      file: makeFile({ type: 'application/pdf', size: 1024 }),
      uploadedBy,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { stage: 'db_upsert' },
    });

    const removes = mock.calls.filter(
      (c): c is StorageCallRecord =>
        c.kind === 'storage' && c.op === 'remove' && c.bucket === 'certificates',
    );
    expect(removes).toHaveLength(1);
    // The remove call should target the path that was just uploaded.
    const paths = removes[0].args[0] as string[];
    expect(paths).toEqual([`${cohortId}/${userId}.pdf`]);
  });
});

describe('deleteCertificate', () => {
  const certId = 'cert-to-delete-1';
  const filePath = '22222222-2222-2222-2222-222222222222/11111111-1111-1111-1111-111111111111.pdf';

  it('Test 7 — happy path: storage.remove called with file_path, DB delete called with cert id', async () => {
    const mock = makeMockAdminClient({
      tables: {
        cohort_certificates: {
          select_single: {
            data: { id: certId, file_path: filePath },
            error: null,
          },
          delete: { error: null },
        },
      },
      storage: {
        certificates: {
          remove: { error: null },
        },
      },
    });

    const result = await deleteCertificate(mock.client, certId);

    expect(result).toEqual({ ok: true });

    const removes = mock.calls.filter(
      (c): c is StorageCallRecord =>
        c.kind === 'storage' && c.op === 'remove' && c.bucket === 'certificates',
    );
    expect(removes).toHaveLength(1);
    expect(removes[0].args[0]).toEqual([filePath]);

    const deletes = mock.calls.filter(
      (c): c is TableCallRecord =>
        c.kind === 'table' &&
        c.op === 'delete' &&
        c.table === 'cohort_certificates',
    );
    expect(deletes).toHaveLength(1);
  });
});

describe('issueCertSignedUrl', () => {
  const certId = 'cert-to-sign-1';
  const ownerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const cohortId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const filePath = `${cohortId}/${ownerId}.pdf`;

  it('Test 8 — denies when requester is not the cert owner; createSignedUrl not called', async () => {
    const mock = makeMockAdminClient({
      tables: {
        cohort_certificates: {
          select_single: {
            data: {
              id: certId,
              user_id: ownerId,
              cohort_id: cohortId,
              file_path: filePath,
              cohorts: { status: 'completed' },
            },
            error: null,
          },
        },
      },
      storage: {
        certificates: {
          createSignedUrl: {
            data: { signedUrl: 'https://signed.example/url' },
            error: null,
          },
        },
      },
    });

    const result = await issueCertSignedUrl(mock.client, certId, otherUserId);

    expect(result).toMatchObject({
      ok: false,
      error: { stage: 'not_owner' },
    });

    const signs = mock.calls.filter(
      (c) => c.kind === 'storage' && c.op === 'createSignedUrl',
    );
    expect(signs).toHaveLength(0);
  });
});
