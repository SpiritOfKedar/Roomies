import request from 'supertest';
import app from '../../app';
import { randomUUID } from 'crypto';
import { prisma } from '../../shared/db/prisma';

// Helper
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

describe('Integration Test: Voting Engine', () => {
  let assignee: { userId: string; token: string };
  let memberB: { userId: string; token: string };
  let memberC: { userId: string; token: string };
  let houseId: string;
  let taskId: string;

  beforeEach(async () => {
    // 1. Setup 3 members
    assignee = await registerUser('Assignee A', `a.${randomUUID()}@test.com`);
    memberB = await registerUser('Member B', `b.${randomUUID()}@test.com`);
    memberC = await registerUser('Member C', `c.${randomUUID()}@test.com`);

    // Create house
    const hRes = await request(app)
      .post('/api/houses')
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({ name: 'Voting Test House' })
      .expect(201);
    houseId = hRes.body.data.id;

    // Join house
    await request(app)
      .post(`/api/houses/${houseId}/join`)
      .set('Authorization', `Bearer ${memberB.token}`)
      .expect(200);

    await request(app)
      .post(`/api/houses/${houseId}/join`)
      .set('Authorization', `Bearer ${memberC.token}`)
      .expect(200);

    // 2. Assign & Submit a Task
    // First rotation hits Assignee A
    const tRes = await request(app)
      .post(`/api/houses/${houseId}/tasks/assign`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({ title: 'Test Task', deadline: new Date(Date.now() + 86400000).toISOString() })
      .expect(201);
    taskId = tRes.body.data.id;

    // Output must be completed before voting
    await request(app)
      .post(`/api/tasks/${taskId}/submit`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({ imageUrl: 'http://test.com/img.jpg' })
      .expect(200);
  });

  it('TC1: Assigned user attempting to vote returns 403 Forbidden', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/vote`)
      .set('Authorization', `Bearer ${assignee.token}`) // trying to vote on own task
      .send({ vote: 'approve' })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('You cannot vote on your own task');
  });

  it('TC2: A member attempting to double-vote returns 409 Conflict', async () => {
    // First vote succeeds
    const res1 = await request(app)
      .post(`/api/tasks/${taskId}/vote`)
      .set('Authorization', `Bearer ${memberB.token}`)
      .send({ vote: 'approve' })
      .expect(200);

    // Final status not hit yet
    expect(res1.body.data.finalStatus).toBe('submitted');

    // Second vote fails via unique constraint wrap
    const res2 = await request(app)
      .post(`/api/tasks/${taskId}/vote`)
      .set('Authorization', `Bearer ${memberB.token}`)
      .send({ vote: 'approve' })
      .expect(409);

    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toBe('You have already voted on this task');
  });

  it('TC3: Majority Rejection - Updates status to rejected and applies 10pt penalty', async () => {
    // Eligible voters: 2 (B and C). Majority = floor(2/2)+1 = 2
    // B rejects
    const resB = await request(app)
      .post(`/api/tasks/${taskId}/vote`)
      .set('Authorization', `Bearer ${memberB.token}`)
      .send({ vote: 'reject' })
      .expect(200);
    expect(resB.body.data.finalStatus).toBe('submitted');

    // C rejects
    const resC = await request(app)
      .post(`/api/tasks/${taskId}/vote`)
      .set('Authorization', `Bearer ${memberC.token}`)
      .send({ vote: 'reject' })
      .expect(200);

    // Status should pivot!
    expect(resC.body.data.finalStatus).toBe('rejected');

    // Check penalty record natively using prisma query
    const penalties = await prisma.penalty.findMany({
      where: { userId: assignee.userId, taskId }
    });

    expect(penalties.length).toBe(1);
    expect(penalties[0].points).toBe(10);

    // Assert task record in DB directly to verify the atomic output
    const taskRecord = await prisma.task.findUnique({ where: { id: taskId } });
    expect(taskRecord?.status).toBe('rejected');
  });
});
