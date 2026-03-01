/**
 * Utility functions for cost estimation
 */

/**
 * Parse CPU string to cores
 * Supports formats: "2", "2000m", "2.5"
 */
export function parseCPU(cpu: string): number {
  if (!cpu) return 0;
  
  const cpuStr = cpu.trim();
  
  // Handle millicores (e.g., "2000m")
  if (cpuStr.endsWith('m')) {
    const millicores = parseFloat(cpuStr.slice(0, -1));
    return millicores / 1000;
  }
  
  // Handle cores (e.g., "2" or "2.5")
  return parseFloat(cpuStr);
}

/**
 * Parse memory string to GB
 * Supports formats: "4Gi", "4096Mi", "4G", "4096M"
 */
export function parseMemory(memory: string): number {
  if (!memory) return 0;
  
  const memoryStr = memory.trim();
  
  // Handle Gibibytes (e.g., "4Gi")
  if (memoryStr.endsWith('Gi')) {
    return parseFloat(memoryStr.slice(0, -2));
  }
  
  // Handle Gigabytes (e.g., "4G")
  if (memoryStr.endsWith('G')) {
    return parseFloat(memoryStr.slice(0, -1));
  }
  
  // Handle Mebibytes (e.g., "4096Mi")
  if (memoryStr.endsWith('Mi')) {
    const mebibytes = parseFloat(memoryStr.slice(0, -2));
    return mebibytes / 1024;
  }
  
  // Handle Megabytes (e.g., "4096M")
  if (memoryStr.endsWith('M')) {
    const megabytes = parseFloat(memoryStr.slice(0, -1));
    return megabytes / 1024;
  }
  
  // Assume GB if no unit
  return parseFloat(memoryStr);
}

/**
 * Parse storage string to GB
 * Supports formats: "10Gi", "10G", "10240Mi", "10240M"
 */
export function parseStorage(storage: string): number {
  if (!storage) return 0;
  
  // Use same logic as memory parsing
  return parseMemory(storage);
}

/**
 * Calculate hours per month (average)
 */
export function hoursPerMonth(): number {
  return 730; // Average hours per month (365 days / 12 months * 24 hours)
}

/**
 * Generate cache key for cost estimation
 */
export function generateCacheKey(
  type: 'estimate' | 'historical',
  identifier: string,
  params?: Record<string, any>,
): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `finops:${type}:${identifier}:${paramsStr}`;
}
