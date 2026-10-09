/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { notFound } from 'next/navigation';
import PreviewPage from '../page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@/components/actions/action-list', () => ({
  ActionList: () => null,
}));

describe('Preview page', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('calls notFound in production even with ENABLE_DESIGN_PREVIEW=1', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production', ENABLE_DESIGN_PREVIEW: '1' };
    
    PreviewPage();
    
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when ENABLE_DESIGN_PREVIEW is not set', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development', ENABLE_DESIGN_PREVIEW: undefined };
    
    PreviewPage();
    
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when ENABLE_DESIGN_PREVIEW is 0', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development', ENABLE_DESIGN_PREVIEW: '0' };
    
    PreviewPage();
    
    expect(notFound).toHaveBeenCalled();
  });

  it('does not call notFound in development with ENABLE_DESIGN_PREVIEW=1', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development', ENABLE_DESIGN_PREVIEW: '1' };
    
    PreviewPage();
    
    expect(notFound).not.toHaveBeenCalled();
  });
});
