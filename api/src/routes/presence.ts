import { Router } from "express";
import { authGuard, type AuthRequest } from "../middlewares/auth";
import { getKnownLastSeenAt, persistUserLastSeen } from "../presence/presenceStore";
import { issuePresenceSocketTicket } from "../realtime/presenceTickets";

export function presenceRouter(jwtSecret: string) {
  const router = Router();

  router.post("/presence/socket-ticket", authGuard(jwtSecret), (req: AuthRequest, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Token ausente" });
    }

    const ticket = issuePresenceSocketTicket(user);

    return res.json({
      ok: true,
      ...ticket,
    });
  });

  router.post("/presence/heartbeat", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.sub;
      const lastSeenAt = (await persistUserLastSeen(userId, false)) ?? getKnownLastSeenAt(userId);

      return res.json({
        ok: true,
        lastSeenAt,
      });
    } catch (error) {
      console.error("presence http heartbeat error:", error);
      return res.status(500).json({ message: "Nao foi possivel atualizar a presenca." });
    }
  });

  return router;
}
