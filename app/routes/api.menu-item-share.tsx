import type { ActionFunctionArgs } from "@remix-run/node";
import { menuItemSharePrismaEntity } from "~/domain/cardapio/menu-item-share.prisma.entity.server";
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
  const { sharesEnabled } = await getEngagementSettings();
  if (!sharesEnabled) {
    return ok({
      action: "menu-item-share-it",
      shareAmount: 0,
      disabled: true,
    });
  }

  if (!isAllowedRequestOrigin(request)) {
    return forbidden({
      action: "menu-item-share-it",
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
        action: "menu-item-share-it",
        shareAmount: 0,
      },
      { headers: responseHeaders }
    );
  }

  const alreadyShared = await hasRecentMenuItemInterestEvent({
    menuItemId: itemId,
    type: "share",
    clientId,
  });

  if (alreadyShared) {
    return ok(
      {
        action: "menu-item-share-it",
        shareAmount: 0,
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
    return ok(
      {
        action: "menu-item-share-it",
        shareAmount: 0,
      },
      { headers: responseHeaders }
    );
  }

  const [err, shareAmount] = await prismaIt(
    menuItemSharePrismaEntity.create({
      createdAt: new Date().toISOString(),
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
        action: "menu-item-share-it",
        shareAmount,
      },
      { headers: responseHeaders }
    );
  }

  await createMenuItemInterestEvent({
    menuItemId: itemId,
    type: "share",
    clientId,
  });

  return ok(
    {
      action: "menu-item-share-it",
      shareAmount,
    },
    { headers: responseHeaders }
  );
}
