// 성능 모니터링 유틸리티

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private marks: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark?: string): number {
    const endTime = performance.now();
    const startTime = startMark ? this.marks.get(startMark) || 0 : 0;
    const duration = endTime - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ Performance: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.mark(`${name}-start`);
    return fn().finally(() => {
      this.measure(name, `${name}-start`);
    });
  }

  measureSync<T>(name: string, fn: () => T): T {
    this.mark(`${name}-start`);
    const result = fn();
    this.measure(name, `${name}-start`);
    return result;
  }
}

export const perf = PerformanceMonitor.getInstance();

// React 컴포넌트 성능 측정을 위한 HOC
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.memo((props: P) => {
    const startTime = React.useRef<number>(0);
    
    React.useEffect(() => {
      startTime.current = performance.now();
      return () => {
        const duration = performance.now() - startTime.current;
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ Component ${componentName} rendered for ${duration.toFixed(2)}ms`);
        }
      };
    });

    return React.createElement(Component, props);
  });
}
