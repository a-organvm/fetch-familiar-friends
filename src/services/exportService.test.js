import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatBytes, EXPORT_FORMATS, EXPORT_DATA_TYPES, getExportSizeEstimate, exportUserData } from './exportService';
import { supabase } from '../config/supabase';

vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  isOnlineMode: true,
}));

describe('exportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatBytes', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
    });
  });

  describe('exportUserData', () => {
    it('should handle export and return base structure when no data exists', async () => {
      // Setup mock to return empty data for any fetch
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        then: vi.fn((cb) => cb({ data: [], error: null })),
      });

      const result = await exportUserData(EXPORT_FORMATS.JSON, { userId: 'user-1', dataTypes: [EXPORT_DATA_TYPES.ALL], includeLocalData: false });
      
      expect(result.error).toBeNull();
      expect(result.filename).toMatch(/dogtale-export-.*\.json/);
      expect(result.data).toBeDefined();
      
      const parsed = JSON.parse(result.data);
      expect(parsed.data).toEqual({});
      expect(parsed.version).toBe('1.0');
    });
  });

  describe('getExportSizeEstimate', () => {
    it('should return a size estimate', async () => {
      // Mock empty DB fetch
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        then: vi.fn((cb) => cb({ data: [], error: null })),
      });

      const result = await getExportSizeEstimate({ userId: 'user-1', dataTypes: [EXPORT_DATA_TYPES.ALL], includeLocalData: false });
      
      expect(result.error).toBeNull();
      expect(typeof result.sizeBytes).toBe('number');
      expect(result.sizeBytes).toBeGreaterThan(0);
    });
  });
});
