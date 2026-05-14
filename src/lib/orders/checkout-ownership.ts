import "server-only";

import {
  readCheckoutAttemptByRecovery,
  type CheckoutAttemptRecord,
} from "./checkout-attempt-store";
import { readCheckoutRecoveryCookie } from "./checkout-recovery-cookie";

export class CheckoutOwnershipError extends Error {
  constructor(
    message = "Checkout recovery token is invalid.",
    readonly status = 403,
  ) {
    super(message);
    this.name = "CheckoutOwnershipError";
  }
}

export async function assertCheckoutOrderOwnership({
  checkoutAttemptId,
  orderId,
  paymentId,
  recoveryToken,
}: {
  checkoutAttemptId?: string;
  orderId?: string;
  paymentId?: string;
  recoveryToken?: string;
}): Promise<CheckoutAttemptRecord> {
  if (!checkoutAttemptId || !recoveryToken) {
    throw new CheckoutOwnershipError("Checkout recovery token is required.");
  }

  const attempt = await readCheckoutAttemptByRecovery({
    attemptId: checkoutAttemptId,
    recoveryToken,
  });

  if (!attempt?.orderId) {
    throw new CheckoutOwnershipError();
  }

  if (orderId && attempt.orderId !== orderId) {
    throw new CheckoutOwnershipError();
  }

  if (paymentId && attempt.paymentId && attempt.paymentId !== paymentId) {
    throw new CheckoutOwnershipError("Checkout payment id is invalid.");
  }

  return attempt;
}

export async function assertCheckoutOrderOwnershipForRequest({
  checkoutAttemptId,
  orderId,
  paymentId,
  recoveryToken,
  request,
}: {
  checkoutAttemptId?: string;
  orderId?: string;
  paymentId?: string;
  recoveryToken?: string;
  request: Request;
}): Promise<CheckoutAttemptRecord> {
  const cookie = readCheckoutRecoveryCookie(request);
  const cookieMatches =
    cookie &&
    (!checkoutAttemptId || cookie.attemptId === checkoutAttemptId) &&
    (!orderId || cookie.orderId === orderId);

  return assertCheckoutOrderOwnership({
    checkoutAttemptId:
      checkoutAttemptId ?? (cookieMatches ? cookie.attemptId : undefined),
    orderId,
    paymentId,
    recoveryToken: cookieMatches ? cookie.token : recoveryToken,
  });
}
