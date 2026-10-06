/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Type generation would be done via supabase gen types in production
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

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
 *
 * Tests are skipped if NEXT_PUBLIC_SUPABASE_URL is not set.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const testEnabled = !!supabaseUrl && !!supabaseServiceRoleKey;

describe.skipIf(!testEnabled)("Supabase RLS Policies", () => {
  let adminClient: ReturnType<typeof createClient>;
  let testOrg1Id: string;
  let testOrg2Id: string;
  let testUser1Id: string;
  let testUser2Id: string;

  beforeAll(async () => {
    if (!testEnabled || !supabaseUrl || !supabaseServiceRoleKey) {
      return;
    }

    // Create admin client that bypasses RLS
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create test users
    const { data: user1 } = await adminClient.auth.admin.createUser({
      email: "test-user-1@example.com",
      password: "testpass123",
      email_confirm: true,
    });

    const { data: user2 } = await adminClient.auth.admin.createUser({
      email: "test-user-2@example.com",
      password: "testpass123",
      email_confirm: true,
    });

    testUser1Id = user1!.user!.id;
    testUser2Id = user2!.user!.id;

    // Create test orgs
    const { data: org1 } = await adminClient
      .from("orgs")
      .insert({ name: "Test Org 1", slug: "test-org-1" })
      .select()
      .single();

    const { data: org2 } = await adminClient
      .from("orgs")
      .insert({ name: "Test Org 2", slug: "test-org-2" })
      .select()
      .single();

    testOrg1Id = org1!.id;
    testOrg2Id = org2!.id;

    // Create memberships
    await adminClient.from("org_memberships").insert([
      { org_id: testOrg1Id, user_id: testUser1Id, role: "owner" },
      { org_id: testOrg2Id, user_id: testUser2Id, role: "owner" },
    ]);

    // Create projects
    await adminClient.from("projects").insert([
      { org_id: testOrg1Id, name: "Project A1", created_by: testUser1Id },
      { org_id: testOrg2Id, name: "Project B1", created_by: testUser2Id },
    ]);
  });

  afterAll(async () => {
    if (!testEnabled || !adminClient) {
      return;
    }

    // Clean up test data
    await adminClient.from("projects").delete().in("org_id", [testOrg1Id, testOrg2Id]);
    await adminClient.from("org_memberships").delete().in("org_id", [testOrg1Id, testOrg2Id]);
    await adminClient.from("orgs").delete().in("id", [testOrg1Id, testOrg2Id]);
    await adminClient.auth.admin.deleteUser(testUser1Id);
    await adminClient.auth.admin.deleteUser(testUser2Id);
  });

  it("users in different orgs cannot see each other's orgs", async () => {
    if (!testEnabled || !supabaseUrl || !supabaseServiceRoleKey) {
      return;
    }

    // Sign in as user 1
    const user1Client = createClient(supabaseUrl, supabaseServiceRoleKey);
    await user1Client.auth.signInWithPassword({
      email: "test-user-1@example.com",
      password: "testpass123",
    });

    const { data: user1Orgs } = await user1Client.from("orgs").select("id");

    // User 1 should only see org 1
    expect(user1Orgs).toHaveLength(1);
    expect(user1Orgs![0].id).toBe(testOrg1Id);

    // Sign in as user 2
    const user2Client = createClient(supabaseUrl, supabaseServiceRoleKey);
    await user2Client.auth.signInWithPassword({
      email: "test-user-2@example.com",
      password: "testpass123",
    });

    const { data: user2Orgs } = await user2Client.from("orgs").select("id");

    // User 2 should only see org 2
    expect(user2Orgs).toHaveLength(1);
    expect(user2Orgs![0].id).toBe(testOrg2Id);
  });

  it("users in different orgs cannot see each other's projects", async () => {
    if (!testEnabled || !supabaseUrl || !supabaseServiceRoleKey) {
      return;
    }

    // Sign in as user 1
    const user1Client = createClient(supabaseUrl, supabaseServiceRoleKey);
    await user1Client.auth.signInWithPassword({
      email: "test-user-1@example.com",
      password: "testpass123",
    });

    const { data: user1Projects } = await user1Client
      .from("projects")
      .select("name, org_id");

    // User 1 should only see projects from org 1
    expect(user1Projects).toHaveLength(1);
    expect(user1Projects![0].name).toBe("Project A1");
    expect(user1Projects![0].org_id).toBe(testOrg1Id);
  });

  it("projects with same name in different orgs are isolated", async () => {
    if (!testEnabled || !supabaseUrl || !supabaseServiceRoleKey) {
      return;
    }

    // Add projects with same name to both orgs
    await adminClient.from("projects").insert([
      { org_id: testOrg1Id, name: "Main Building", created_by: testUser1Id },
      { org_id: testOrg2Id, name: "Main Building", created_by: testUser2Id },
    ]);

    // Sign in as user 1
    const user1Client = createClient(supabaseUrl, supabaseServiceRoleKey);
    await user1Client.auth.signInWithPassword({
      email: "test-user-1@example.com",
      password: "testpass123",
    });

    const { data: user1Buildings } = await user1Client
      .from("projects")
      .select("name, org_id")
      .eq("name", "Main Building");

    // User 1 should only see their org's "Main Building"
    expect(user1Buildings).toHaveLength(1);
    expect(user1Buildings![0].org_id).toBe(testOrg1Id);
  });

  it("members can view but not update orgs without admin/owner role", async () => {
    if (!testEnabled || !supabaseUrl || !supabaseServiceRoleKey) {
      return;
    }

    // Create a member user (not admin/owner)
    const { data: memberUser } = await adminClient.auth.admin.createUser({
      email: "test-member@example.com",
      password: "testpass123",
      email_confirm: true,
    });

    const memberUserId = memberUser!.user!.id;

    // Add as member to org 1
    await adminClient.from("org_memberships").insert({
      org_id: testOrg1Id,
      user_id: memberUserId,
      role: "member",
    });

    // Sign in as member
    const memberClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    await memberClient.auth.signInWithPassword({
      email: "test-member@example.com",
      password: "testpass123",
    });

    // Member should be able to view the org
    const { data: orgs } = await memberClient
      .from("orgs")
      .select("id")
      .eq("id", testOrg1Id);
    expect(orgs).toHaveLength(1);

    // Member should NOT be able to update the org
    const { error } = await memberClient
      .from("orgs")
      .update({ name: "Member Updated Name" })
      .eq("id", testOrg1Id);

    expect(error).toBeTruthy();

    // Clean up
    await adminClient
      .from("org_memberships")
      .delete()
      .eq("user_id", memberUserId);
    await adminClient.auth.admin.deleteUser(memberUserId);
  });
});

describe("Supabase RLS Tests (skipped when Supabase not configured)", () => {
  it.skipIf(testEnabled)("should skip when Supabase is not configured", () => {
    expect(testEnabled).toBe(false);
  });
});
