import { describe, expect, it } from 'vitest';
import { RouteExecutionWindowGuard } from '../src/scheduler/routeExecutionWindowGuard';

describe('RouteExecutionWindowGuard', () => {
  it('blocks duplicate run in same minute for same route', () => {
    const guard = new RouteExecutionWindowGuard();

    expect(guard.shouldRun('route-a', '2026-02-27:09:00')).toBe(true);
    expect(guard.shouldRun('route-a', '2026-02-27:09:00')).toBe(false);
    expect(guard.shouldRun('route-a', '2026-02-27:09:01')).toBe(true);
  });

  it('isolates routes and resets state on clear', () => {
    const guard = new RouteExecutionWindowGuard();

    expect(guard.shouldRun('route-a', '2026-02-27:09:00')).toBe(true);
    expect(guard.shouldRun('route-b', '2026-02-27:09:00')).toBe(true);

    guard.clear();
    expect(guard.shouldRun('route-a', '2026-02-27:09:00')).toBe(true);
  });
});
