import type { RequestHandler } from "express";
import type { AuthContext } from "../types.js";

function unauthorizedResponse(message: string) {
  return {
    error: {
      code: "Unauthorized",
      message,
    },
  };
}

export function getAuthContext(req: {
  authContext?: AuthContext;
}): AuthContext {
  return req.authContext ?? {
    principal: "anonymous",
    isAuthenticated: false,
  };
}

export function createServerAuthMiddleware(expectedToken?: string): RequestHandler {
  return (req, res, next) => {
    if (!expectedToken) {
      req.authContext = {
        principal: "anonymous",
        isAuthenticated: false,
      };
      next();
      return;
    }

    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json(unauthorizedResponse("Missing bearer token"));
      return;
    }

    const token = header.slice("Bearer ".length);
    if (token !== expectedToken) {
      res.status(403).json(unauthorizedResponse("Invalid bearer token"));
      return;
    }

    req.authContext = {
      principal: "local-user",
      isAuthenticated: true,
    };
    next();
  };
}
