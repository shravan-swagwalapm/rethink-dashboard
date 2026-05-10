// Smoke test — proves the Vitest runner is wired up.
// Real unit tests will land alongside the policy module in subsequent tasks.
describe('vitest smoke', () => {
  it('runs basic assertions', () => {
    expect(1 + 1).toBe(2)
  })
})
