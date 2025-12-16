/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '../utils/debugLogger.js';
import type { Config } from './config.js';
import type { AuthType } from '../core/contentGenerator.js';
import { getOauthClient } from '../code_assist/oauth2.js';

export interface CloudSettings {
  [key: string]: unknown;
}

export class CloudSettingsService {
  private static instance: CloudSettingsService;

  private constructor() {}

  static getInstance(): CloudSettingsService {
    if (!CloudSettingsService.instance) {
      CloudSettingsService.instance = new CloudSettingsService();
    }
    return CloudSettingsService.instance;
  }

  async loadSettings(
    config: Config,
    authType: AuthType,
  ): Promise<CloudSettings | null> {
    try {
      // Check if we can get a project ID from environment variables.
      // We only support explicit project ID configuration for Cloud Settings.
      const projectId =
        process.env['GOOGLE_CLOUD_PROJECT'] ||
        process.env['GOOGLE_CLOUD_PROJECT_ID'];

      if (!projectId) {
        debugLogger.log(
          'Cloud Settings: No project ID found in environment variables; skipping.',
        );
        return null;
      }

      const bucketName = `${projectId}-gemini-cli-settings`;
      const fileName = 'settings.json';
      const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${fileName}?alt=media`;

      debugLogger.log(`Cloud Settings: Attempting to fetch from ${url}`);

      const client = await getOauthClient(authType, config);
      let res;
      try {
        res = await client.request({ url, method: 'GET' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        const status = e.code || e.response?.status;
        if (status === 403 || status === 404) {
          debugLogger.log(
            `Cloud Settings: Skipped (Status ${status}). Project/Bucket not found or access denied.`,
          );
          return null;
        }
        throw e;
      }

      if (res.status !== 200) {
        debugLogger.log(
          `Cloud Settings: Fetch failed with status ${res.status}; skipping`,
        );
        return null;
      }

      const data = res.data;
      if (!data || typeof data !== 'object') {
        // Prominent error for invalid data
        console.error(
          'Cloud Settings: Failed to parse settings.json. The file must be a valid JSON object.',
        );
        return null;
      }

      debugLogger.log('Cloud Settings: Successfully loaded.');
      return data as CloudSettings;
    } catch (e) {
      // Log other errors as debug, unless it's a critical failure we want to show
      debugLogger.log(`Cloud Settings: Error loading settings: ${e}`);
      return null;
    }
  }
}
