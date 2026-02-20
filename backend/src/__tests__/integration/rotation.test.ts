import request from 'supertest';
import app from '../../app';
import { randomUUID } from 'crypto';
import { prisma } from '../../shared/db/prisma';

/**
 * Helper to register a user and return the JWT explicitly
 */
async function registerUser(name: string, email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' })
    .expect(201);
  return {
    userId: res.body.data.user.id,
    token: res.body.data.tokens.accessToken,
  };
}

describe('Integration Test: Task Rotation Engine', () => {
  let admin: { userId: string; token: string };
  let member1: { userId: string; token: string };
  let member2: { userId: string; token: string };
  let houseId: string;

  beforeEach(async () => {
    // 1. Seed House & 3 Members
    admin = await registerUser('Admin Alice', `alice.${randomUUID()}@test.com`);
    member1 = await registerUser('Member Bob', `bob.${randomUUID()}@test.com`);
    member2 = await registerUser('Member Charlie', `charlie.${randomUUID()}@test.com`);

    // Create House
    const houseRes = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Test Rotation House' })
      .expect(201);
    houseId = houseRes.body.data.id;

    // Join House
    await request(app)
      .post(`/api/houses/${houseId}/join`)
      .set('Authorization', `Bearer ${member1.token}`)
      .expect(200);

    await request(app)
      .post(`/api/houses/${houseId}/join`)
      .set('Authorization', `Bearer ${member2.token}`)
      .expect(200);
  });

  it('TC1: Successfully assigns tasks rotating sequentially and increments index', async () => {
    // Assuming deterministic rotation by joinedAt ASC (Alice -> Bob -> Charlie)
    // First Task -> Alice
    const task1 = await request(app)
      .post(`/api/houses/${houseId}/tasks/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Task 1',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);

    expect(task1.body.success).toBe(true);
    expect(task1.body.data.assignedTo).toBe(admin.userId);

    // Second Task -> Bob
    const task2 = await request(app)
      .post(`/api/houses/${houseId}/tasks/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Task 2',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);

    expect(task2.body.data.assignedTo).toBe(member1.userId);

    // Third Task -> Charlie
    const task3 = await request(app)
      .post(`/api/houses/${houseId}/tasks/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        title: 'Task 3',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);

    expect(task3.body.data.assignedTo).toBe(member2.userId);

    // Check DB explicitly for incremented currentIndex == 0 (length 3, mod loops back to 0)
    const houseRecord = await prisma.house.findUnique({ where: { id: houseId } });
    expect(houseRecord?.currentIndex).toBe(0);
  });

  it('TC2: Edge Case - Attempt to assign task in house with 0 active members', async () => {
    const emptyAdmin = await registerUser('Empty Admin', `empty.${randomUUID()}@test.com`);

    const hRes = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${emptyAdmin.token}`)
      .send({ name: 'Empty House' })
      .expect(201);

    const emptyHouseId = hRes.body.data.id;

    // Remove the ONLY active member directly via DB so member count = 0
    await prisma.houseMember.updateMany({
      where: { houseId: emptyHouseId },
      data: { status: 'inactive' },
    });

    // Attempt assignment
    const assignRes = await request(app)
      .post(`/api/houses/${emptyHouseId}/tasks/assign`)
      .set('Authorization', `Bearer ${emptyAdmin.token}`)
      .send({
        title: 'Impossible Task',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(403); // Forbidden, because the only active admin is now inactive too!

    expect(assignRes.body.success).toBe(false);
    expect(assignRes.body.error).toContain('You are not an active member');
  });

  it('TC3: Authentication - Attempt backend call without valid JWT', async () => {
    const assignRes = await request(app)
      .post(`/api/houses/${houseId}/tasks/assign`)
      // .set('Authorization', 'MISSING')
      .send({
        title: 'Hacker Task',
        deadline: new Date().toISOString(),
      })
      .expect(401);

    expect(assignRes.body.success).toBe(false);
    expect(assignRes.body.error).toBe('Authorization header required');
  });
});
