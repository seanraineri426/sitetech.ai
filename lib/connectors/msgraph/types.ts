/**
 * Microsoft Graph API response types and Zod schemas (allowlist-aligned).
 */

import { z } from "zod";

// Zod schemas for validation (passthrough to allow new provider fields)
const EmailAddressSchema = z.object({
  name: z.string(),
  address: z.string(),
}).passthrough();

const RecipientSchema = z.object({
  emailAddress: EmailAddressSchema,
}).passthrough();

const BodySchema = z.object({
  contentType: z.enum(["text", "html"]),
  content: z.string(),
}).passthrough();

export const GraphMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  subject: z.string(),
  bodyPreview: z.string(),
  body: BodySchema.nullish(),
  from: RecipientSchema,
  toRecipients: z.array(RecipientSchema),
  ccRecipients: z.array(RecipientSchema),
  receivedDateTime: z.string(),
  sentDateTime: z.string(),
  hasAttachments: z.boolean(),
  importance: z.enum(["low", "normal", "high"]),
  isRead: z.boolean(),
  categories: z.array(z.string()),
}).passthrough();

const FileHashesSchema = z.object({
  sha256Hash: z.string().optional(),
}).passthrough();

const FileSchema = z.object({
  mimeType: z.string(),
  hashes: FileHashesSchema,
}).passthrough();

const FolderSchema = z.object({
  childCount: z.number(),
}).passthrough();

const DeletedSchema = z.object({
  state: z.string(),
}).passthrough();

const UserSchema = z.object({
  displayName: z.string(),
  id: z.string().optional(),
  // email DROPPED per CTO 2026-10-07 - accepted for validation but must be stripped before storage
  email: z.string().optional(),
}).passthrough();

const CreatedBySchema = z.object({
  user: UserSchema,
}).passthrough();

const ParentReferenceSchema = z.object({
  driveId: z.string(),
  id: z.string(),
  path: z.string(),
}).passthrough();

export const GraphDriveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  webUrl: z.string(),
  size: z.number(),
  createdDateTime: z.string(),
  lastModifiedDateTime: z.string(),
  createdBy: CreatedBySchema,
  lastModifiedBy: CreatedBySchema,
  file: FileSchema.optional(),
  folder: FolderSchema.optional(),
  parentReference: ParentReferenceSchema,
  deleted: DeletedSchema.optional(),
}).passthrough();

export const GraphSiteSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  webUrl: z.string(),
  createdDateTime: z.string(),
}).passthrough();

export const GraphMailFolderSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  parentFolderId: z.string().nullable(),
  childFolderCount: z.number(),
  unreadItemCount: z.number(),
  totalItemCount: z.number(),
}).passthrough();

export type GraphMessage = z.infer<typeof GraphMessageSchema>;
export type GraphDriveItem = z.infer<typeof GraphDriveItemSchema>;
export type GraphSite = z.infer<typeof GraphSiteSchema>;
export type GraphMailFolder = z.infer<typeof GraphMailFolderSchema>;

export const MESSAGE_ALLOWLIST = [
  "id",
  "conversationId",
  "subject",
  "bodyPreview",
  "body",
  "from",
  "toRecipients",
  "ccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "hasAttachments",
  "importance",
  "isRead",
  "categories",
] as const;

export const DRIVEITEM_ALLOWLIST = [
  "id",
  "name",
  "webUrl",
  "size",
  "createdDateTime",
  "lastModifiedDateTime",
  "createdBy",
  "lastModifiedBy",
  "file",
  "folder",
  "parentReference",
  "deleted",
] as const;
