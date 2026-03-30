import { SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { prisma } from "../lib/prisma";

class AuthService {
  async signup(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("Email already in use");

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const freePlan = await prisma.plan.findUnique({ where: { name: "free" } });
    if (freePlan) {
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);

      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: end,
        },
      });
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new Error("Invalid credentials");
    if (user.deletedAt) throw new Error("Account not found");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 3 days

    const session = await prisma.userSession.create({
      data: { userId: user.id, token, expiresAt },
    });

    return { user, token: session.token };
  }

  async logout(token: string) {
    await prisma.userSession.deleteMany({ where: { token } });
  }

  async getUserFromToken(token: string) {
    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) throw new Error("Session not found");
    if (session.expiresAt < new Date()) {
      await prisma.userSession.delete({ where: { token } });
      throw new Error("Session expired");
    }

    return session.user;
  }

  async deleteAccount(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }
}

export const authService = new AuthService();




