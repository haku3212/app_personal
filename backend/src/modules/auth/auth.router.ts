import { Router } from "express";
import { z } from "zod";
import { asyncHandler, parseBody } from "../../lib/http";
import { bearerToken, requireUser } from "./auth.middleware";
import { loginUser, logoutToken, registerUser } from "./auth.service";

const authSchema = z.object({
  username: z.string().trim().min(3).max(50),
  displayName: z.string().trim().max(80).optional(),
  password: z.string().min(4).max(200),
});

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    res.status(201).json(await registerUser(parseBody(authSchema, req.body)));
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    res.json(await loginUser(parseBody(authSchema.pick({ username: true, password: true }), req.body)));
  }),
);

authRouter.get(
  "/me",
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await logoutToken(bearerToken(req));
    res.json({ ok: true });
  }),
);
