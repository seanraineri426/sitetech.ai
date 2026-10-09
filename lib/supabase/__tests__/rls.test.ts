import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Database } from "../database.types";

/**
 * RLS Integration Tests
 *
 * These tests verify Row Level Security policies work correctly.
 * They require a running local Supabase instance.
 *
 * To run:
 * 1. pnpm supabase start
 * 2. pnpm supabase db reset
 * 3. Copy local keys to .env.local
 * 4. pnpm test
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const testEnabled = !!supabaseUrl && !!supabaseAnonKey && !!supabaseServiceKey;

describe.skipIf(!testEnabled)("Supabase RLS Policies", () => {
  let adminClient: SupabaseClient<Database>;
  let testOrg1Id: string;
  let testOrg2Id: string;
  let testUser1Id: string;
  let testUser2Id: string;
  let testAdminId: string;
  let testMemberId: string;

  beforeAll(async () => {
    if (!testEnabled || !supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return;
    }

    // Admin client for setup/teardown only
    adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create test users
    const { data: user1 } = await adminClient.auth.admin.createUser({
      email: "rls-owner1@example.com",
      password: "testpass123!",
      email_confirm: true,
    });

    const { data: user2 } = await adminClient.auth.admin.createUser({
      email: "rls-owner2@example.com",
      password: "testpass123!",
      email_confirm: true,
    });

    const { data: adminUser } = await adminClient.auth.admin.createUser({
      email: "rls-admin@example.com",
      password: "testpass123!",
      email_confirm: true,
    });

    const { data: memberUser } = await adminClient.auth.admin.createUser({
      email: "rls-member@example.com",
      password: "testpass123!",
      email_confirm: true,
    });

    testUser1Id = user1!.user!.id;
    testUser2Id = user2!.user!.id;
    testAdminId = adminUser!.user!.id;
    testMemberId = memberUser!.user!.id;

    // Create test orgs using create_org function
    const user1Client = createClient<Database>(supabaseUrl, supabaseAnonKey);
    await user1Client.auth.signInWithPassword({
      email: "rls-owner1@example.com",
      password: "testpass123!",
    });

    const { data: org1Id } = await user1Client.rpc("create_org", {
      p_name: "Test Org 1",
      p_slug: "test-org-rls-1",
    });
    testOrg1Id = org1Id!;

    const user2Client = createClient<Database>(supabaseUrl, supabaseAnonKey);
    await user2Client.auth.signInWithPassword({
      email: "rls-owner2@example.com",
      password: "testpass123!",
    });

    const { data: org2Id } = await user2Client.rpc("create_org", {
      p_name: "Test Org 2",
      p_slug: "test-org-rls-2",
    });
    testOrg2Id = org2Id!;

    // Add admin and member to org 1 (as owner)
    await adminClient.from("org_memberships").insert([
      { org_id: testOrg1Id, user_id: testAdminId, role: "admin" },
      { org_id: testOrg1Id, user_id: testMemberId, role: "member" },
    ]);

    // Create projects
    await adminClient.from("projects").insert([
      { org_id: testOrg1Id, name: "Project A1", created_by: testUser1Id },
      { org_id: testOrg2Id, name: "Project B1", created_by: testUser2Id },
    ]);

    // Create audit log entries
    await adminClient.from("audit_log").insert([
      {
        org_id: testOrg1Id,
        actor_type: "system",
        action: "test_setup",
        target_table: "orgs",
      },
      {
        org_id: testOrg2Id,
        actor_type: "system",
        action: "test_setup",
        target_table: "orgs",
      },
    ]);
  });

  afterAll(async () => {
    if (!testEnabled || !adminClient) {
      return;
    }

    // Clean up
    await adminClient.from("orgs").delete().in("id", [testOrg1Id, testOrg2Id]);
    await adminClient.auth.admin.deleteUser(testUser1Id);
    await adminClient.auth.admin.deleteUser(testUser2Id);
    await adminClient.auth.admin.deleteUser(testAdminId);
    await adminClient.auth.admin.deleteUser(testMemberId);
  });

  describe("Cross-org isolation", () => {
    it("users in different orgs cannot see each other's orgs", async () => {
      const user1Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user1Client.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { data: user1Orgs } = await user1Client.from("orgs").select("id");
      expect(user1Orgs).toHaveLength(1);
      expect(user1Orgs![0].id).toBe(testOrg1Id);

      const user2Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user2Client.auth.signInWithPassword({
        email: "rls-owner2@example.com",
        password: "testpass123!",
      });

      const { data: user2Orgs } = await user2Client.from("orgs").select("id");
      expect(user2Orgs).toHaveLength(1);
      expect(user2Orgs![0].id).toBe(testOrg2Id);
    });

    it("users in different orgs cannot see each other's projects", async () => {
      const user1Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user1Client.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { data: user1Projects } = await user1Client
        .from("projects")
        .select("name, org_id");

      expect(user1Projects).toHaveLength(1);
      expect(user1Projects![0].org_id).toBe(testOrg1Id);
    });

    it("users in different orgs cannot see each other's memberships", async () => {
      const user1Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user1Client.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { data: user1Memberships } = await user1Client
        .from("org_memberships")
        .select("*");

      expect(user1Memberships).toHaveLength(3); // owner, admin, member

      const user2Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user2Client.auth.signInWithPassword({
        email: "rls-owner2@example.com",
        password: "testpass123!",
      });

      const { data: user2Memberships } = await user2Client
        .from("org_memberships")
        .select("*");

      expect(user2Memberships).toHaveLength(1); // only owner
    });

    it("users cannot see audit logs from other orgs", async () => {
      const user1Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user1Client.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { data: user1Logs } = await user1Client
        .from("audit_log")
        .select("*")
        .not("org_id", "is", null);

      expect(user1Logs).toHaveLength(1);
      expect(user1Logs![0].org_id).toBe(testOrg1Id);
    });
  });

  describe("Role-based permissions", () => {
    it("member cannot update org", async () => {
      const memberClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await memberClient.auth.signInWithPassword({
        email: "rls-member@example.com",
        password: "testpass123!",
      });

      const { error } = await memberClient
        .from("orgs")
        .update({ name: "Updated Name" })
        .eq("id", testOrg1Id);

      expect(error).toBeTruthy();
    });

    it("member cannot create projects", async () => {
      const memberClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await memberClient.auth.signInWithPassword({
        email: "rls-member@example.com",
        password: "testpass123!",
      });

      const { error } = await memberClient
        .from("projects")
        .insert({ org_id: testOrg1Id, name: "New Project" });

      expect(error).toBeTruthy();
    });

    it("admin cannot promote anyone to owner", async () => {
      const adminClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await adminClient.auth.signInWithPassword({
        email: "rls-admin@example.com",
        password: "testpass123!",
      });

      const { error } = await adminClient
        .from("org_memberships")
        .insert({ org_id: testOrg1Id, user_id: testMemberId, role: "owner" });

      expect(error).toBeTruthy();
    });

    it("admin cannot modify owner", async () => {
      const adminClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await adminClient.auth.signInWithPassword({
        email: "rls-admin@example.com",
        password: "testpass123!",
      });

      const { error } = await adminClient
        .from("org_memberships")
        .update({ role: "admin" })
        .eq("org_id", testOrg1Id)
        .eq("user_id", testUser1Id);

      expect(error).toBeTruthy();
    });

    it("admin cannot remove owner", async () => {
      const adminClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await adminClient.auth.signInWithPassword({
        email: "rls-admin@example.com",
        password: "testpass123!",
      });

      const { error } = await adminClient
        .from("org_memberships")
        .delete()
        .eq("org_id", testOrg1Id)
        .eq("user_id", testUser1Id);

      expect(error).toBeTruthy();
    });

    it("admin cannot change own role", async () => {
      const adminClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await adminClient.auth.signInWithPassword({
        email: "rls-admin@example.com",
        password: "testpass123!",
      });

      const { error } = await adminClient
        .from("org_memberships")
        .update({ role: "owner" })
        .eq("org_id", testOrg1Id)
        .eq("user_id", testAdminId);

      expect(error).toBeTruthy();
    });

    it("owner can update org", async () => {
      const ownerClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await ownerClient.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { error } = await ownerClient
        .from("orgs")
        .update({ name: "Updated Org A" })
        .eq("id", testOrg1Id);

      expect(error).toBeNull();
    });

    it("owner can create projects", async () => {
      const ownerClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await ownerClient.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { error } = await ownerClient
        .from("projects")
        .insert({ org_id: testOrg1Id, name: "Owner Project" });

      expect(error).toBeNull();
    });

    it("owner can promote to owner", async () => {
      const ownerClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await ownerClient.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { error } = await ownerClient
        .from("org_memberships")
        .update({ role: "owner" })
        .eq("org_id", testOrg1Id)
        .eq("user_id", testAdminId);

      expect(error).toBeNull();

      // Reset for other tests
      await adminClient
        .from("org_memberships")
        .update({ role: "admin" })
        .eq("org_id", testOrg1Id)
        .eq("user_id", testAdminId);
    });

    it("admin can manage member/admin roles", async () => {
      const adminClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await adminClient.auth.signInWithPassword({
        email: "rls-admin@example.com",
        password: "testpass123!",
      });

      const { error } = await adminClient
        .from("org_memberships")
        .update({ role: "admin" })
        .eq("org_id", testOrg1Id)
        .eq("user_id", testMemberId);

      expect(error).toBeNull();

      // Reset
      await adminClient
        .from("org_memberships")
        .update({ role: "member" })
        .eq("org_id", testOrg1Id)
        .eq("user_id", testMemberId);
    });
  });

  describe("Org creation", () => {
    it("create_org makes caller the owner", async () => {
      const user2Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user2Client.auth.signInWithPassword({
        email: "rls-owner2@example.com",
        password: "testpass123!",
      });

      const { data: newOrgId } = await user2Client.rpc("create_org", {
        p_name: "New Test Org",
        p_slug: "new-test-org-rls",
      });

      expect(newOrgId).toBeTruthy();

      const { data: membership } = await user2Client
        .from("org_memberships")
        .select("role")
        .eq("org_id", newOrgId!)
        .eq("user_id", testUser2Id)
        .single();

      expect(membership!.role).toBe("owner");

      // Cleanup
      await adminClient.from("orgs").delete().eq("id", newOrgId!);
    });
  });

  describe("Last owner protection", () => {
    it("cannot remove last owner", async () => {
      const ownerClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await ownerClient.auth.signInWithPassword({
        email: "rls-owner2@example.com",
        password: "testpass123!",
      });

      const { error } = await ownerClient
        .from("org_memberships")
        .delete()
        .eq("org_id", testOrg2Id)
        .eq("user_id", testUser2Id);

      expect(error).toBeTruthy();
      expect(error!.message).toContain("last owner");
    });

    it("owner can delete org (cascades memberships)", async () => {
      const ownerClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await ownerClient.auth.signInWithPassword({
        email: "rls-owner2@example.com",
        password: "testpass123!",
      });

      // Create a test org to delete
      const { data: orgId } = await ownerClient.rpc("create_org", {
        p_name: "Org To Delete",
        p_slug: "org-to-delete-rls",
      });

      const { error } = await ownerClient
        .from("orgs")
        .delete()
        .eq("id", orgId!);

      expect(error).toBeNull();

      // Verify memberships were cascade deleted
      const { data: memberships } = await adminClient
        .from("org_memberships")
        .select("*")
        .eq("org_id", orgId!);

      expect(memberships).toHaveLength(0);
    });
  });

  describe("Member self-service", () => {
    it("member can leave org", async () => {
      // Add member to org 2
      await adminClient.from("org_memberships").insert({
        org_id: testOrg2Id,
        user_id: testMemberId,
        role: "member",
      });

      const memberClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await memberClient.auth.signInWithPassword({
        email: "rls-member@example.com",
        password: "testpass123!",
      });

      const { error } = await memberClient
        .from("org_memberships")
        .delete()
        .eq("org_id", testOrg2Id)
        .eq("user_id", testMemberId);

      expect(error).toBeNull();
    });
  });

  describe("Audit log security", () => {
    it("authenticated user cannot insert into audit_log", async () => {
      const user1Client = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
      await user1Client.auth.signInWithPassword({
        email: "rls-owner1@example.com",
        password: "testpass123!",
      });

      const { error } = await user1Client.from("audit_log").insert({
        org_id: testOrg1Id,
        actor_type: "user",
        action: "bad_action",
      });

      expect(error).toBeTruthy();
    });
  });
});

describe("Supabase RLS Tests (skipped when Supabase not configured)", () => {
  it.skipIf(testEnabled)("should skip when Supabase is not configured", () => {
    expect(testEnabled).toBe(false);
  });
});
