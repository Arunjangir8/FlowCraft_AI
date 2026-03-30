import {  SubscriptionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

class SubscriptionService {
  async getPlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async getUserSubscription(userId: string) {
    return prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
  }

  async upgradePlan(userId: string, planName: string, billingCycle: "monthly" | "yearly") {
    const plan = await prisma.plan.findUnique({ where: { name: planName } });
    if (!plan) throw new Error("Plan not found");

    const now = new Date();
    const end = new Date(now);
    billingCycle === "yearly" ? end.setFullYear(end.getFullYear() + 1) : end.setMonth(end.getMonth() + 1);

    return prisma.subscription.update({
      where: { userId },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
      include: { plan: true },
    });
  }

  async cancelAtPeriodEnd(userId: string) {
    return prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  async reactivate(userId: string) {
    return prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: false, cancelledAt: null },
    });
  }

  async checkLimit(userId: string, limit: keyof Pick<typeof prisma.plan.fields, "maxOwnedFiles" | "maxStorageMb" | "aiGenerationsPerMonth" | "aiChatsPerMonth" | "maxCollaboratorsPerFile">) {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!sub) throw new Error("No subscription found");
    return (sub.plan as any)[limit] as number;
  }

  async syncFromStripe(
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  ) {
    return prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { status, currentPeriodStart, currentPeriodEnd },
    });
  }
}

export const subscriptionService = new SubscriptionService();