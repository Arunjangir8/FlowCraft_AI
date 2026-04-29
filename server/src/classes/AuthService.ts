import { SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { prisma } from "../lib/prisma";
import { AppEnv } from "../config";

class AuthService {
  private googleClient = AppEnv.GOOGLE_CLIENT_ID
    ? new OAuth2Client(AppEnv.GOOGLE_CLIENT_ID)
    : null;

  private async createSession(userId: string) {
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 3 days

    const session = await prisma.userSession.create({
      data: { userId, token, expiresAt },
    });

    return session.token;
  }

  private async ensureFreePlanSubscription(userId: string) {
    const freePlan = await prisma.plan.findUnique({ where: { name: "free" } });

    if (!freePlan) return;

    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing) return;

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);

    await prisma.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: end,
      },
    });
  }

  async signup(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("Email already in use");

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    await this.ensureFreePlanSubscription(user.id);

    return user;
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new Error("Invalid credentials");
    if (user.deletedAt) throw new Error("Account not found");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const token = await this.createSession(user.id);

    return { user, token };
  }

  async loginWithGoogleIdToken(idToken: string) {
    if (!this.googleClient || !AppEnv.GOOGLE_CLIENT_ID) {
      throw new Error("Google login is not configured");
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: AppEnv.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new Error("Invalid Google token");
    }

    const provider = "google";

    const linkedOauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: payload.sub,
        },
      },
      include: {
        user: true,
      },
    });

    let user = linkedOauthAccount?.user ?? null;

    if (user?.deletedAt) {
      throw new Error("Account not found");
    }

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: payload.email } });

      if (user?.deletedAt) {
        throw new Error("Account not found");
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name,
            avatarUrl: payload.picture,
            emailVerified: Boolean(payload.email_verified),
          },
        });

        await this.ensureFreePlanSubscription(user.id);
      }
    }

    await prisma.oAuthAccount.upsert({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: payload.sub,
        },
      },
      create: {
        userId: user.id,
        provider,
        providerUserId: payload.sub,
      },
      update: {
        userId: user.id,
      },
    });

    const token = await this.createSession(user.id);

    return { user, token };
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




