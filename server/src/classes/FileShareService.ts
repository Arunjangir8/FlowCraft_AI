import {  Permission, InvitationStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

import crypto from "crypto";

class FileShareService {
  async enablePublicLink(
    fileId: string,
    requesterId: string,
    permission: Permission = Permission.VIEW,
    allowCopy = true
  ) {
    await this.assertOwner(fileId, requesterId);

    const slug = crypto.randomBytes(10).toString("hex");

    return prisma.fileShareConfig.upsert({
      where: { fileId },
      create: { fileId, slug, isPublic: true, publicPermission: permission, allowCopy },
      update: { isPublic: true, publicPermission: permission, allowCopy },
    });
  }

  async disablePublicLink(fileId: string, requesterId: string) {
    await this.assertOwner(fileId, requesterId);
    return prisma.fileShareConfig.update({
      where: { fileId },
      data: { isPublic: false },
    });
  }

  async getFileBySlug(slug: string) {
    const config = await prisma.fileShareConfig.findUnique({
      where: { slug },
      include: { file: { include: { drawing: true } } },
    });

    if (!config || !config.isPublic) throw new Error("Link not found or not public");
    return { file: config.file, permission: config.publicPermission, allowCopy: config.allowCopy };
  }

  async inviteByEmail(
    fileId: string,
    invitedByUserId: string,
    invitedEmail: string,
    permission: Permission = Permission.VIEW
  ) {
    await this.assertOwner(fileId, invitedByUserId);

    const existingUser = await prisma.user.findUnique({ where: { email: invitedEmail } });

    const alreadyCollaborator = existingUser
      ? await prisma.fileCollaborator.findUnique({
          where: { fileId_userId: { fileId, userId: existingUser.id } },
        })
      : null;

    if (alreadyCollaborator) throw new Error("User is already a collaborator");

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    return prisma.fileInvitation.create({
      data: {
        fileId,
        invitedByUserId,
        invitedEmail,
        invitedUserId: existingUser?.id ?? null,
        permission,
        token,
        expiresAt,
      },
    });
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.fileInvitation.findUnique({ where: { token } });

    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== InvitationStatus.PENDING) throw new Error("Invitation already used");
    if (invitation.expiresAt < new Date()) {
      await prisma.fileInvitation.update({
        where: { token },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new Error("Invitation expired");
    }

    const [collaborator] = await prisma.$transaction([
      prisma.fileCollaborator.create({
        data: { fileId: invitation.fileId, userId, permission: invitation.permission },
      }),
      prisma.fileInvitation.update({
        where: { token },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date(), invitedUserId: userId },
      }),
    ]);

    return collaborator;
  }

  async declineInvitation(token: string) {
    const invitation = await prisma.fileInvitation.findUnique({ where: { token } });
    if (!invitation) throw new Error("Invitation not found");

    return prisma.fileInvitation.update({
      where: { token },
      data: { status: InvitationStatus.DECLINED },
    });
  }

  async deleteInvitation(invitationId: string, requesterId: string) {
    const invitation = await prisma.fileInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new Error("Invitation not found");

    await this.assertOwner(invitation.fileId, requesterId);

    return prisma.fileInvitation.delete({ where: { id: invitationId } });
  }

  async removeCollaborator(fileId: string, collaboratorUserId: string, requesterId: string) {
    await this.assertOwner(fileId, requesterId);

    return prisma.fileCollaborator.delete({
      where: { fileId_userId: { fileId, userId: collaboratorUserId } },
    });
  }

  async updateCollaboratorPermission(
    fileId: string,
    collaboratorUserId: string,
    permission: Permission,
    requesterId: string
  ) {
    await this.assertOwner(fileId, requesterId);

    return prisma.fileCollaborator.update({
      where: { fileId_userId: { fileId, userId: collaboratorUserId } },
      data: { permission },
    });
  }

  async listCollaborators(fileId: string) {
    return prisma.fileCollaborator.findMany({
      where: { fileId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }

  async listPendingInvitations(fileId: string) {
    return prisma.fileInvitation.findMany({
      where: { fileId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: "desc" },
    });
  }

  private async assertOwner(fileId: string, userId: string) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new Error("File not found");
    if (file.ownerId !== userId) throw new Error("Only the owner can perform this action");
  }
}

export const fileShareService = new FileShareService();