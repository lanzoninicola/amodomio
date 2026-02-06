import type { ActionFunctionArgs } from "@remix-run/node";
import { menuItemLikePrismaEntity } from "~/domain/cardapio/menu-item-like.prisma.entity.server";
import {
  createMenuItemInterestEvent,
  hasRecentMenuItemInterestEvent,
} from "~/domain/cardapio/menu-item-interest/menu-item-interest.server";
import {
  buildLikeRateLimitContext,
  consumeLikeRateLimit,
} from "~/domain/rate-limit/like-rate-limit.server";
import { isAllowedRequestOrigin } from "~/domain/security/origin.server";
import { badRequest, forbidden, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { getEngagementSettings } from "~/domain/cardapio/engagement-settings.server";

export async function action({ request }: ActionFunctionArgs) {
  const { likesEnabled } = await getEngagementSettings();
  if (!likesEnabled) {
    return ok({
      action: "menu-item-like-it",
      likeAmount: 0,
      disabled: true,
    });
  }

  if (!isAllowedRequestOrigin(request)) {
    return forbidden({
      action: "menu-item-like-it",
      message: "Origem não permitida",
    });
  }

  const formData = await request.formData();
  const values = Object.fromEntries(formData);

  const itemId = typeof values?.itemId === "string" ? values.itemId : "";
  const clientId = typeof values?.clientId === "string" ? values.clientId : null;

  const rateLimitContext = await buildLikeRateLimitContext(request);
  const responseHeaders = rateLimitContext.headers ?? undefined;

  if (!itemId || !clientId) {
    return badRequest(
      {
        action: "menu-item-like-it",
        likeAmount: 0,
      },
      { headers: responseHeaders }
    );
  }

  const alreadyLiked = await hasRecentMenuItemInterestEvent({
    menuItemId: itemId,
    type: "like",
    clientId,
  });

  if (alreadyLiked) {
    const currentAmount = await menuItemLikePrismaEntity.countByMenuItemId(
      itemId
    );
    return ok(
      {
        action: "menu-item-like-it",
        likeAmount: currentAmount,
      },
      { headers: responseHeaders }
    );
  }

  const rateLimitResult = await consumeLikeRateLimit({
    menuItemId: itemId,
    rateLimitId: rateLimitContext.rateLimitId,
    ip: rateLimitContext.ip,
  });

  if (!rateLimitResult.allowed) {
    const currentAmount = await menuItemLikePrismaEntity.countByMenuItemId(
      itemId
    );
    return ok(
      {
        action: "menu-item-like-it",
        likeAmount: currentAmount,
      },
      { headers: responseHeaders }
    );
  }

  const [err, likeAmount] = await prismaIt(
    menuItemLikePrismaEntity.create({
      createdAt: new Date().toISOString(),
      amount: 1,
      MenuItem: {
        connect: {
          id: itemId,
        },
      },
    })
  );

  if (err) {
    return badRequest(
      {
        action: "menu-item-like-it",
        likeAmount,
      },
      { headers: responseHeaders }
    );
  }

  await createMenuItemInterestEvent({
    menuItemId: itemId,
    type: "like",
    clientId,
  });

  return ok(
    {
      action: "menu-item-like-it",
      likeAmount,
    },
    { headers: responseHeaders }
  );
}
