export type AdminActionNotificationTargetInput = {
  type: string;
  id: string;
};

export type UpsertAdminActionNotificationInput = {
  key: string;
  type: string;
  entityId?: string | null;
  title: string;
  description?: string | null;
  href?: string | null;
  targets: AdminActionNotificationTargetInput[];
};

export type AdminActionNotificationListItem = {
  id: string;
  type: string;
  entityId: string | null;
  title: string;
  description: string | null;
  href: string | null;
  pendingTargetCount: number;
  updatedAt: string;
};

export async function upsertAdminActionNotification(
  db: any,
  input: UpsertAdminActionNotificationInput
) {
  if (input.targets.length === 0) return null;

  return db.$transaction(async (tx: any) => {
    const notification = await tx.adminActionNotification.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        type: input.type,
        entityId: input.entityId || null,
        title: input.title,
        description: input.description || null,
        href: input.href || null,
        status: "open",
      },
      update: {
        type: input.type,
        entityId: input.entityId || null,
        title: input.title,
        description: input.description || null,
        href: input.href || null,
        status: "open",
        resolvedAt: null,
      },
      select: { id: true },
    });

    await tx.adminActionNotificationTarget.deleteMany({
      where: { notificationId: notification.id },
    });
    await tx.adminActionNotificationTarget.createMany({
      data: input.targets.map((target) => ({
        notificationId: notification.id,
        targetType: target.type,
        targetId: target.id,
      })),
    });

    return notification;
  });
}

export async function resolveAdminActionNotificationTarget(
  db: any,
  target: AdminActionNotificationTargetInput
) {
  if (
    typeof db?.adminActionNotificationTarget?.findMany !== "function" ||
    typeof db?.adminActionNotification?.update !== "function"
  ) {
    return;
  }

  const targets = await db.adminActionNotificationTarget.findMany({
    where: {
      targetType: target.type,
      targetId: target.id,
      resolvedAt: null,
      notification: { status: "open" },
    },
    select: { id: true, notificationId: true },
  });
  if (targets.length === 0) return;

  const now = new Date();
  const resolveTargets = async (client: any) => {
    await client.adminActionNotificationTarget.updateMany({
      where: { id: { in: targets.map((row: any) => row.id) } },
      data: { resolvedAt: now },
    });

    for (const notificationId of new Set(
      targets.map((row: any) => String(row.notificationId))
    )) {
      const pendingCount = await client.adminActionNotificationTarget.count({
        where: { notificationId, resolvedAt: null },
      });
      if (pendingCount === 0) {
        await client.adminActionNotification.update({
          where: { id: notificationId },
          data: { status: "resolved", resolvedAt: now },
        });
      }
    }
  };

  if (typeof db?.$transaction === "function") {
    await db.$transaction(resolveTargets);
    return;
  }

  await resolveTargets(db);
}

export async function listOpenAdminActionNotifications(
  db: any,
  limit = 20
): Promise<AdminActionNotificationListItem[]> {
  const rows = await db.adminActionNotification.findMany({
    where: { status: "open" },
    include: {
      targets: {
        where: { resolvedAt: null },
        select: { id: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });

  return rows.map((row: any) => ({
    id: String(row.id),
    type: String(row.type),
    entityId: row.entityId ? String(row.entityId) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    href: row.href ? String(row.href) : null,
    pendingTargetCount: row.targets.length,
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}
