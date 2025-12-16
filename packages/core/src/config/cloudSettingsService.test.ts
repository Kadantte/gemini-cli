/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudSettingsService } from './cloudSettingsService.js';
import { getOauthClient } from '../code_assist/oauth2.js';
import { AuthType } from '../core/contentGenerator.js';
import type { Config } from './config.js';

// Mock getOauthClient
vi.mock('../code_assist/oauth2.js', () => ({
  getOauthClient: vi.fn(),
}));

// Mock debugLogger
vi.mock('../utils/debugLogger.js', () => ({
  debugLogger: {
    debug: vi.fn(),
  },
}));

describe('CloudSettingsService', () => {
  let service: CloudSettingsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRequest: any;
  let mockConfig: Config;

  beforeEach(() => {
    // Reset singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (CloudSettingsService as any).instance = undefined;
    service = CloudSettingsService.getInstance();

    // Setup mocks
    mockRequest = vi.fn();
    vi.mocked(getOauthClient).mockResolvedValue({
      request: mockRequest,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    mockConfig = {} as Config; // Mock config

    // Reset env vars
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', '');

    // Mock console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should load settings successfully when env var is set', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
    mockRequest.mockResolvedValue({
      status: 200,
      data: { foo: 'bar' },
    });

    const settings = await service.loadSettings(
      mockConfig,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(settings).toEqual({ foo: 'bar' });
    expect(getOauthClient).toHaveBeenCalledWith(
      AuthType.LOGIN_WITH_GOOGLE,
      mockConfig,
    );
    expect(mockRequest).toHaveBeenCalledWith({
      url: 'https://storage.googleapis.com/storage/v1/b/test-project-gemini-cli-settings/o/settings.json?alt=media',
      method: 'GET',
    });
  });

  it('should return null if project ID is not in env vars', async () => {
    // Ensure no env vars are set
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT_ID', '');

    const settings = await service.loadSettings(
      mockConfig,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(settings).toBeNull();
    // Should not attempt to fetch
    expect(getOauthClient).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('should return null and log debug on 403', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
    mockRequest.mockRejectedValue({
      code: 403,
    });

    const settings = await service.loadSettings(
      mockConfig,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(settings).toBeNull();
    // Should not log error to console
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log debug on 404', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
    mockRequest.mockRejectedValue({
      response: { status: 404 },
    });

    const settings = await service.loadSettings(
      mockConfig,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(settings).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log error on invalid JSON', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
    mockRequest.mockResolvedValue({
      status: 200,
      data: 'invalid-json', // Not an object
    });

    const settings = await service.loadSettings(
      mockConfig,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(settings).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse settings.json'),
    );
  });

  it('should return null on non-200 status', async () => {
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'test-project');
    mockRequest.mockResolvedValue({
      status: 500,
    });

    const settings = await service.loadSettings(
      mockConfig,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(settings).toBeNull();
  });
});
