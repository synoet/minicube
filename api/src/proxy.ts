import httpProxy from "http-proxy";
import internal from "stream";
import Cookie from "universal-cookie";
import { handleToken } from "./auth";
import { JwtPayload } from "jsonwebtoken";
import http, { ServerResponse, IncomingMessage } from "http";
import dotenv from 'dotenv';

dotenv.config()

const proxy = httpProxy.createProxyServer({
  ws: true,
});

/**
 * Parse incoming request and verify jwt token
 * @param req
 * @returns
 */
const parseRequest = (req: IncomingMessage): { token: JwtPayload } => {
  const cookies = new Cookie(req.headers.cookie);
  let token: JwtPayload;

  return { token: handleToken(cookies.get("session_token")) };
};

/**
 * Write an unauthorized 404 response to the ServerResponse
 * @param res
 * @param message
 * @returns
 */
const unauthorized = (
  res: ServerResponse,
  message?: string
): ServerResponse => {
  res.writeHead(404, message || "Unauthorized");
  res.end();
  return res;
};

/**
 * Simple http server to proxy requests to the right pod living on the cluster
 */
const proxyServer = http.createServer(
  (req: IncomingMessage, res: ServerResponse) => {
    const { token } = parseRequest(req);

    if (!token) {
      return unauthorized(res);
    }

    proxy.web(req, res, {
      target: {
        host: token.clusterIP,
        port: 80,
      },
    });
  }
);

proxyServer.on("upgrade", (req: IncomingMessage, socket: internal.Duplex) => {
  const { token } = parseRequest(req);

  if (!token) {
    return null;
  }

  proxy.ws(req, socket, {
    target: {
      host: token.clusterIP,
      port: 80,
    },
  });
});

proxyServer.listen(8000);
