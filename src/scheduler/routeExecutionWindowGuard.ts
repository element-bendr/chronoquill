export class RouteExecutionWindowGuard {
  private readonly routeMinuteGuards = new Map<string, string>();

  shouldRun(routeId: string, minuteKey: string): boolean {
    const previousKey = this.routeMinuteGuards.get(routeId);
    if (previousKey === minuteKey) {
      return false;
    }
    this.routeMinuteGuards.set(routeId, minuteKey);
    return true;
  }

  clear(): void {
    this.routeMinuteGuards.clear();
  }
}
