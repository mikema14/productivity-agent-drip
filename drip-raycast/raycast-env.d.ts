/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Easy Project URL - Base URL for Easy Project API */
  "apiBaseUrl": string,
  /** API Key - Easy Project API key (X-Redmine-API-Key) */
  "apiKey"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `start-focus` command */
  export type StartFocus = ExtensionPreferences & {}
  /** Preferences accessible in the `add-entry` command */
  export type AddEntry = ExtensionPreferences & {}
  /** Preferences accessible in the `todays-log` command */
  export type TodaysLog = ExtensionPreferences & {}
  /** Preferences accessible in the `search-tasks` command */
  export type SearchTasks = ExtensionPreferences & {}
  /** Preferences accessible in the `todays-intentions` command */
  export type TodaysIntentions = ExtensionPreferences & {}
  /** Preferences accessible in the `log-entries` command */
  export type LogEntries = ExtensionPreferences & {}
  /** Preferences accessible in the `weekly-stats` command */
  export type WeeklyStats = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `start-focus` command */
  export type StartFocus = {}
  /** Arguments passed to the `add-entry` command */
  export type AddEntry = {}
  /** Arguments passed to the `todays-log` command */
  export type TodaysLog = {}
  /** Arguments passed to the `search-tasks` command */
  export type SearchTasks = {}
  /** Arguments passed to the `todays-intentions` command */
  export type TodaysIntentions = {}
  /** Arguments passed to the `log-entries` command */
  export type LogEntries = {}
  /** Arguments passed to the `weekly-stats` command */
  export type WeeklyStats = {}
}

